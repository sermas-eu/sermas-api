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

type State = 'before' | 'blocks' | 'answer';

/**
 * Normalises the start of a chat answer, which must open with JSON blocks tagged
 * <filter>, <intents> and <tools>, then the plain answer. The model does not always
 * comply, and whatever is not taken as a block is spoken to the user. Seen live:
 * reasoning written before the blocks, blocks without tags, repeated or garbled tags
 * (`<intents>\n<intents>`, `}>`, `</{ ... }>`, `<{ ... }>`).
 *
 * - Text before the blocks is dropped.
 * - The block region runs until the first line that is neither JSON nor a tag; the JSON
 *   objects in it are re-emitted, each in the tag its keys belong to, for the block
 *   parsers downstream.
 * - What follows is the answer and passes through untouched.
 * An answer with no blocks at all is held until it ends and then passed on.
 */
export class PreambleTransformer extends Transform {
  private buffer = '';
  private state: State = 'before';
  // JSON scan state carried across lines of the block region
  private depth = 0;
  private inString = false;
  // start of the first line of the block region not scanned yet
  private scanned = 0;

  constructor() {
    super({ objectMode: true });
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
      this.push(tagBlocks(this.buffer));
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
      if (this.depth === 0 && !this.inString && isAnswer(line)) {
        this.state = 'answer';
        const blocks = tagBlocks(this.buffer.slice(0, offset));
        const answer = this.buffer.slice(offset);
        this.buffer = '';
        if (blocks) this.push(blocks);
        if (answer) this.push(answer);
        return;
      }
      this.scan(line);
      if (nl === -1) return;
      offset = this.scanned = nl + 1;
    }
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
export const tagBlocks = (region: string): string => {
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
  return [...found]
    .map(([tag, raw]) => `<${tag}>\n${raw}\n</${tag}>\n`)
    .join('');
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
