import { parseJSON } from 'libs/llm/util';
import { Readable } from 'stream';
import { LLMParsedResult } from '../dialogue.chat.dto';
import { StreamingMarkupParserTransformer } from './markup-parser.transformer';
import { SentenceTransformer } from './sentence.transformer';

const contents = [
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
];

describe('MarkupParser', () => {
  beforeEach(() => {});
  contents.forEach(({ name, content, completed }) => {
    describe(`parse tags for ${name}`, () => {
      it('should return a structured output', async () => {
        await new Promise((resolve) => {
          const llmParsedResult: LLMParsedResult = {};

          const transformers = [
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
            new SentenceTransformer(() => {
              completed(llmParsedResult);
              resolve(true);
            }),
          ];

          const sourceStream = Readable.from([]);
          content.split('').forEach((char) => {
            sourceStream.push(char);
          });

          let stream = sourceStream;
          for (const transformer of transformers) {
            stream = stream.pipe(transformer);
          }

          stream.on('data', (chunk) => {
            console.log('data', chunk.toString());
          });

          sourceStream.push(null);
        });
      });
    });
  });
});
