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
