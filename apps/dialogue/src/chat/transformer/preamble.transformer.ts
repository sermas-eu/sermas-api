import { Transform } from 'stream';

// the block a JSON object belongs to, told by its keys (checked in this order: tool
// arguments nest arbitrary keys, so tools comes before intents)
const BLOCK_KEYS: [string, string[]][] = [
  ['filter', ['skip']],
  ['tools', ['matches']],
  ['intents', ['taskId', 'match', 'trigger', 'cancel']],
];

// where the blocks start: a block tag or a JSON object opening a line
const BLOCKS_START =
  /(^|\n)[ \t]*(<(filter|intents|tools)>|```(json)?[ \t]*\n[ \t]*\{|\{)/;
// tags and tag debris the model leaves around the JSON: <filter>, </{, }>, ```json
const TAG_DEBRIS = /<\/?[a-z_ ]*>|<\/?(?=\{)|(?<=\})>|```(json)?/gi;

// the line that opens the answer, as the prompt's response format names it
const ANSWER_MARKER = /^[ \t*#_>-]*CHAT[ _]RESPONSE\b/i;

type State = 'before' | 'blocks' | 'answer';

export type PreambleOptions = {
  /**
   * The blocks the prompt asks for (filter, and intents/tools when enabled). Until all
   * of them have been seen, text between blocks is reasoning, not the answer.
   */
  expect?: string[];
};

/**
 * Normalises the start of a chat answer, which must open with JSON blocks tagged
 * <filter>, <intents> and <tools>, then the plain answer. The model does not always
 * comply, and whatever is not taken as a block is spoken to the user. Seen live:
 * reasoning written before the blocks, blocks without tags, repeated or garbled tags
 * (`<intents>\n<intents>`, `}>`, `</{ ... }>`, `<{ ... }>`).
 *
 * - Text before the blocks is dropped.
 * - The model may also reason between the blocks, following the prompt's section
 *   titles (`## INTENTS`, "Looking at the TASKS: …"; seen live). The answer starts at a
 *   `CHAT RESPONSE` line, or at the first text after all the expected blocks; any other
 *   text in the block region is dropped.
 * - The JSON objects of the region are re-emitted, each in the tag its keys belong to,
 *   for the block parsers downstream.
 * - What follows is the answer and passes through untouched.
 * A block left out (no marker either): the text after the last block is the answer,
 * passed on when the stream ends. An answer with no blocks at all is held until it
 * ends and then passed on.
 */
export class PreambleTransformer extends Transform {
  private buffer = '';
  private state: State = 'before';
  // JSON scan state carried across lines of the block region
  private depth = 0;
  private inString = false;
  // start of the first line of the block region not scanned yet
  private scanned = 0;
  // the block region without the reasoning lines dropped from it
  private region = '';
  // reasoning since the last complete block: the answer if a block was left out
  private sinceLastBlock = '';
  private readonly expect: string[];

  constructor(options: PreambleOptions = {}) {
    super({ objectMode: true });
    this.expect = options.expect?.length ? options.expect : ['filter'];
  }

  _transform(
    chunk: Buffer | string,
    _encoding: string,
    callback: CallableFunction,
  ) {
    const text = (chunk || '').toString();
    if (this.state === 'answer') {
      if (text) this.push(text);
      return callback();
    }
    this.buffer += text;
    this.process(false);
    callback();
  }

  _flush(callback: CallableFunction) {
    this.process(true);
    if (this.state === 'blocks') {
      const blocks = tagBlocks(this.region);
      if (blocks) this.push(blocks);
      // a block was left out and no marker came: what followed the last block
      const answer = this.sinceLastBlock.trim();
      if (answer) this.push(answer);
    } else if (this.state === 'before' && this.buffer) {
      this.push(this.buffer);
    }
    this.buffer = '';
    callback();
  }

  private process(isFlush: boolean) {
    if (this.state === 'before') {
      const m = this.buffer.match(BLOCKS_START);
      if (!m) return;
      this.state = 'blocks';
      this.buffer = this.buffer.slice(m.index! + m[1].length);
    }
    if (this.state !== 'blocks') return;

    // walk the new complete lines (the last one too at the end) until the answer starts
    let offset = this.scanned;
    while (true) {
      const nl = this.buffer.indexOf('\n', offset);
      if (nl === -1 && !isFlush) return;
      const lineEnd = nl === -1 ? this.buffer.length : nl;
      const line = this.buffer.slice(offset, lineEnd);
      const outside = this.depth === 0 && !this.inString;
      if (outside && isAnswer(line)) {
        if (ANSWER_MARKER.test(line) || this.hasExpectedBlocks()) {
          this.state = 'answer';
          const blocks = tagBlocks(this.region);
          const answer = this.buffer.slice(offset);
          this.buffer = '';
          this.region = '';
          if (blocks) this.push(blocks);
          if (answer) this.push(answer);
          return;
        }
        // reasoning between the blocks: never spoken
        this.sinceLastBlock += `${line}\n`;
      } else {
        this.scan(line);
        this.region += `${line}\n`;
        // a block just closed: what came before it was not the answer
        if (this.depth === 0 && !this.inString && line.includes('}'))
          this.sinceLastBlock = '';
      }
      if (nl === -1) {
        // the last, unterminated line was consumed (flush only)
        this.buffer = '';
        this.scanned = 0;
        return;
      }
      offset = this.scanned = nl + 1;
    }
  }

  /** whether every block the prompt asks for has been seen in the region */
  private hasExpectedBlocks() {
    const seen = blockKinds(this.region);
    return this.expect.every((tag) => seen.has(tag));
  }

  /** Track brace depth and strings through one line of the block region. */
  private scan(line: string) {
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (this.inString) {
        if (c === '\\') i++;
        else if (c === '"') this.inString = false;
      } else if (c === '"') this.inString = true;
      else if (c === '{') this.depth++;
      else if (c === '}' && this.depth > 0) this.depth--;
    }
  }
}

/** A line outside any JSON object that is not a tag, tag debris or a new object. */
const isAnswer = (line: string): boolean => {
  const rest = line.replace(TAG_DEBRIS, '').trim();
  return rest.length > 0 && !rest.startsWith('{');
};

/** The JSON objects of a block region, each wrapped in the tag its keys belong to. */
export const tagBlocks = (region: string): string =>
  [...findBlocks(region)]
    .map(([tag, raw]) => `<${tag}>\n${raw}\n</${tag}>\n`)
    .join('');

const blockKinds = (region: string): Set<string> =>
  new Set(findBlocks(region).keys());

/** The first JSON object of each block kind in a region, by tag. */
const findBlocks = (region: string): Map<string, string> => {
  const found = new Map<string, string>();
  let i = region.indexOf('{');
  while (i !== -1) {
    const end = jsonObjectEnd(region, i);
    if (end === -1) break;
    const raw = region.slice(i, end);
    // keys read by pattern, not JSON.parse: the block parsers downstream tolerate
    // slightly malformed JSON, so must this
    const keys = [...raw.matchAll(/"(\w+)"\s*:/g)].map((m) => m[1]);
    const tag = BLOCK_KEYS.find(([, k]) => k.some((key) => keys.includes(key)));
    // the first object of a kind wins: a garbled tag can repeat it
    if (tag && !found.has(tag[0])) found.set(tag[0], raw);
    i = region.indexOf('{', end);
  }
  return found;
};

/** Index just past the object opening at `start`, or -1 if it does not close. */
const jsonObjectEnd = (text: string, start: number): number => {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i + 1;
  }
  return -1;
};
