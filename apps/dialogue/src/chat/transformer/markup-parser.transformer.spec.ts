import { parseJSON } from '#libs/llm/util';
import { Readable } from 'stream';
import { LLMParsedResult } from '../dialogue.chat.dto.js';
import { StreamingMarkupParserTransformer } from './markup-parser.transformer.js';
import { PreambleTransformer } from './preamble.transformer.js';
import { SentenceTransformer } from './sentence.transformer.js';

const contents: {
  name: string;
  content: string;
  answer?: string;
  completed: (r: LLMParsedResult) => void;
}[] = [
  {
    name: 'complete sample',
    content: `<filter>
{ "skip": false, "answer": "", "explain": "" }
</filter>
<intents>
{ "taskId": "8985a43a-54b3-49a7-9a36-49a408b8c6ad", "match": true, "trigger": false, "cancel": false, "explain": "" }
</intents>
<tools>
{ "matches": { "f-1674996709": {} }, "explain": "" }
</tools>
hello world`,
    completed: (llmParsedResult: LLMParsedResult) => {
      expect(llmParsedResult?.intent).toBeTruthy();
      expect(llmParsedResult?.filter).toBeTruthy();
      expect(llmParsedResult?.tools).toBeTruthy();
    },
  },
  {
    name: 'tool trigger',
    content: `<filter>
{ "skip": false, "answer": "", "explain": "" }
</filter>
<tools>
{ "matches": { "f-1674996709": {} }, "explain": "" }
</tools>`,
    completed: (llmParsedResult: LLMParsedResult) => {
      expect(llmParsedResult?.intent).toBeFalsy();
      expect(llmParsedResult?.filter).toBeTruthy();
      expect(llmParsedResult?.tools).toBeTruthy();
    },
  },
  {
    name: 'filter only',
    content: `<filter>
{ "skip": true, "answer": "", "explain": "" }
</filter>`,
    completed: (llmParsedResult: LLMParsedResult) => {
      expect(llmParsedResult?.filter).toBeTruthy();
      expect(llmParsedResult?.intent).toBeFalsy();
      expect(llmParsedResult?.tools).toBeFalsy();
    },
  },
  {
    name: 'intents only',
    content: `<intents>
{ "taskId": "send-parcel", "match": true, "trigger": false, "cancel": true, "explain": "La richiesta di andare allo sportello implica l'interruzione del processo di preparazione del pacco al chiosco e l'assegnazione di un ticket, quindi il task 'send-parcel' è stato annullato." }
</intents>
hello there`,
    completed: (llmParsedResult: LLMParsedResult) => {
      expect(llmParsedResult?.intent).toBeTruthy();
      expect(llmParsedResult?.filter).toBeFalsy();
      expect(llmParsedResult?.tools).toBeFalsy();
    },
  },
  {
    // seen live: the model reasons in prose before the blocks
    name: 'reasoning before the blocks',
    content: `The user says "ok". Is it relevant? Rule: set 'skip' to false.
Let's go with skip=false.

<filter>
{ "skip": false, "answer": "" }
</filter>
<intents>
{ "taskId": "", "match": false, "trigger": false, "cancel": false }
</intents>
<tools>
{ "matches": {} }
</tools>
CHAT RESPONSE: Sure! How can I help you today?`,
    answer: 'CHAT RESPONSE: Sure! How can I help you today?',
    completed: (llmParsedResult: LLMParsedResult) => {
      expect(llmParsedResult?.filter).toEqual({ skip: false, answer: '' });
      expect(llmParsedResult?.intent).toBeTruthy();
      expect(llmParsedResult?.tools).toBeTruthy();
    },
  },
  {
    // seen live: the filter block alone, without its tags
    name: 'bare filter JSON',
    content: `{ "skip": false, "answer": "" }`,
    answer: '',
    completed: (llmParsedResult: LLMParsedResult) => {
      expect(llmParsedResult?.filter).toEqual({ skip: false, answer: '' });
    },
  },
  {
    name: 'bare blocks then the answer',
    content: `{ "skip": false, "answer": "" }
{ "taskId": "quiz", "match": true, "trigger": false, "cancel": false }
Would you like to take the quiz?`,
    answer: 'Would you like to take the quiz?',
    completed: (llmParsedResult: LLMParsedResult) => {
      expect(llmParsedResult?.filter).toBeTruthy();
      expect(llmParsedResult?.intent).toMatchObject({ taskId: 'quiz' });
    },
  },
  {
    // seen live: <intents>\n<intents>
    name: 'repeated opening tag',
    content: `<filter>
{ "skip": false, "answer": "" }
</filter>
<intents>
<intents>
{ "taskId": "quiz", "match": false, "trigger": false, "cancel": false }
</intents>
Good morning!`,
    answer: 'Good morning!',
    completed: (llmParsedResult: LLMParsedResult) => {
      expect(llmParsedResult?.intent).toMatchObject({ taskId: 'quiz' });
    },
  },
  {
    // seen live: garbled tags around the JSON
    name: 'garbled tags',
    content: `<filter>
{
    "skip": false,
    "answer": ""
}>

</filter>
<{
    "taskId": "",
    "match": false,
    "trigger": false,
    "cancel": false
}>

</intents>
<tools>
    {
        "matches": {}
    }
</tools>
CHAT RESPONSE: Nice to meet you too!`,
    answer: 'CHAT RESPONSE: Nice to meet you too!',
    completed: (llmParsedResult: LLMParsedResult) => {
      expect(llmParsedResult?.filter).toEqual({ skip: false, answer: '' });
      expect(llmParsedResult?.intent).toMatchObject({ match: false });
      expect(llmParsedResult?.tools).toEqual({ matches: {} });
    },
  },
  {
    // seen live: the closing tag replaced by the block again
    name: 'block repeated as closing tag',
    content: `<filter>
{ "skip": false, "answer": "" }>
</{ "skip": false, "answer": "" }>
<intents>
{ "taskId": null, "match": false, "trigger": false, "cancel": false }
</intents>
CHAT RESPONSE: I am Pip.`,
    answer: 'CHAT RESPONSE: I am Pip.',
    completed: (llmParsedResult: LLMParsedResult) => {
      expect(llmParsedResult?.filter).toEqual({ skip: false, answer: '' });
      expect(llmParsedResult?.intent).toMatchObject({ match: false });
    },
  },
  {
    name: 'plain answer without blocks',
    content: `Hello there, how can I help?`,
    answer: 'Hello there, how can I help?',
    completed: () => {},
  },
];

describe('MarkupParser', () => {
  beforeEach(() => {});
  contents.forEach(({ name, content, answer, completed }) => {
    describe(`parse tags for ${name}`, () => {
      it('should return a structured output', async () => {
        await new Promise((resolve, reject) => {
          const llmParsedResult: LLMParsedResult = {};

          let spoken = '';
          const transformers = [
            new PreambleTransformer(),
            new StreamingMarkupParserTransformer(
              'filter',
              (res: string | undefined) => {
                llmParsedResult.filter = parseJSON(res);
              },
            ),
            new StreamingMarkupParserTransformer(
              'intents',
              (res: string | undefined) => {
                llmParsedResult.intent = parseJSON(res);
              },
            ),
            new StreamingMarkupParserTransformer(
              'tools',
              (res: string | undefined) => {
                llmParsedResult.tools = parseJSON(res);
              },
            ),
            new SentenceTransformer(() => {}),
          ];

          const sourceStream = Readable.from([]);
          content.split('').forEach((char) => {
            sourceStream.push(char);
          });

          let stream = sourceStream;
          for (const transformer of transformers) {
            stream = stream.pipe(transformer);
          }

          stream.on('data', (chunk) => (spoken += chunk.toString()));
          stream.on('end', () => {
            try {
              completed(llmParsedResult);
              // the sentence splitter drops the spaces between sentences
              const squash = (t: string) => t.replace(/\s+/g, '');
              if (answer !== undefined)
                expect(squash(spoken)).toBe(squash(answer));
              expect(spoken).not.toMatch(
                /<\/?(filter|intents|tools)>|"skip"|"taskId"/,
              );
              resolve(true);
            } catch (e) {
              reject(e);
            }
          });

          sourceStream.push(null);
        });
      });
    });
  });
});

// the model reasoned between the blocks, under the prompt's section titles (live,
// 2026-11-22): only the answer may be spoken
describe('PreambleTransformer with the expected blocks', () => {
  const run = async (content: string, expect: string[]) => {
    const got: Record<string, unknown> = {};
    let stream: any = Readable.from(content.match(/[\s\S]{1,5}/g) || []);
    for (const t of [
      new PreambleTransformer({ expect }),
      new StreamingMarkupParserTransformer(
        'filter',
        (r) => (got.filter = parseJSON(r)),
      ),
      new StreamingMarkupParserTransformer(
        'intents',
        (r) => (got.intents = r && parseJSON(r)),
      ),
      new StreamingMarkupParserTransformer(
        'tools',
        (r) => (got.tools = parseJSON(r)),
      ),
    ])
      stream = stream.pipe(t);
    let spoken = '';
    await new Promise((res) => {
      stream.on('data', (d: any) => (spoken += d.toString()));
      stream.on('end', res);
    });
    return { got, spoken: spoken.replace(/\s+/g, ' ').trim() };
  };

  const ALL = ['filter', 'intents', 'tools'];

  it('drops reasoning between the blocks and speaks the answer', async () => {
    const { got, spoken } = await run(
      `## FILTER
The user is asking a specific question. It is not background noise.

<filter>
{ "skip": false, "answer": "" }
</filter>

## INTENTS
The user is asking about the pilots.
Looking at the TASKS:
- \`feedback\`: No.

<intents>
{ "taskId": "", "match": false, "trigger": false, "cancel": false }
</intents>

## TOOLS
Looking at the TOOLS:
- \`start-quiz\`: No.

<tools>
{ "matches": {} }
</tools>

CHAT RESPONSE: SERMAS was tested in three pilots.`,
      ALL,
    );
    expect(spoken).toBe('CHAT RESPONSE: SERMAS was tested in three pilots.');
    expect(got.filter).toEqual({ skip: false, answer: '' });
    expect(got.intents).toBeTruthy();
    expect(got.tools).toEqual({ matches: {} });
  });

  it('starts the answer at the marker even with a block left out', async () => {
    const { spoken } = await run(
      `<filter>
{ "skip": false, "answer": "" }
</filter>
Thinking about the tasks: none match.
CHAT RESPONSE: Hello!`,
      ALL,
    );
    expect(spoken).toBe('CHAT RESPONSE: Hello!');
  });

  it('a block left out and no marker: the text after the last block is the answer', async () => {
    const { spoken, got } = await run(
      `<filter>
{ "skip": false, "answer": "" }
</filter>
Hello, I am Pip.`,
      ALL,
    );
    expect(spoken).toBe('Hello, I am Pip.');
    expect(got.filter).toEqual({ skip: false, answer: '' });
  });

  it('without tasks and tools the answer follows the filter at once', async () => {
    const { spoken } = await run(
      `<filter>
{ "skip": false, "answer": "" }
</filter>
Hello, I am Pip.`,
      ['filter'],
    );
    expect(spoken).toBe('Hello, I am Pip.');
  });
});
