import { Transform } from 'stream';
import {
  AnswerResponse,
  LLMTool,
  SelectedTool,
  ToolResponse,
} from '../tools/tool.dto';

export class ToolWithAnswerTransformer extends Transform {
  private buffer: string;

  private toolsFound = false;
  private toolSchemas: Record<string, LLMTool>;

  private toolsTag = '[TOOLS]';
  private answerTag = '[ANSWER]';
  constructor(tools: LLMTool[]) {
    super({
      objectMode: true,
    });
    this.buffer = '';
    this.toolSchemas = (tools || []).reduce(
      (obj, tool) => ({
        ...obj,
        [tool.name]: tool,
      }),
      {},
    );
  }

  _transform(
    chunk: Buffer | string,
    encoding: string,
    callback: CallableFunction,
  ) {
    chunk = chunk || '';

    // console.log('chunk ---->', chunk.toString().replace('\n', '\\n'));

    // Append the chunk to the buffer
    this.buffer += chunk.toString();

    // Find the indices of the start and end markers
    const ucbuffer = this.buffer.toUpperCase();
    const startIndex = ucbuffer.indexOf(this.toolsTag);
    const endIndex = ucbuffer.indexOf(this.answerTag);

    // If both start and end markers are found
    if (startIndex !== -1 && endIndex !== -1) {
      this.toolsFound = true;

      // Extract the text between the markers
      const toolsText = this.buffer
        .substring(startIndex + this.toolsTag.length, endIndex)
        .trim();

      // Check if the toolsText is in JSON format
      try {
        // If parsing succeeds, push the JSON data to the readable side of the transform stream

        const json = JSON.parse(toolsText);
        const res: ToolResponse = {
          type: 'tools',
          data: [],
        };

        for (const name in json) {
          const tool: SelectedTool = {
            name,
            values: json[name],
            schema: this.toolSchemas[name] || undefined,
          };

          res.data.push(tool);
        }

        this.push(res);
      } catch (error) {
        // If parsing fails, emit an error
        this.emit(
          'error',
          new Error(`Invalid JSON format in [TOOLS] section: ${toolsText}`),
        );
      }

      // Clear the buffer
      this.buffer = this.buffer.substring(endIndex + this.answerTag.length);
    }

    if (this.toolsFound && this.buffer.length) {
      // Push the answer text to the readable side of the transform stream
      const res: AnswerResponse = {
        type: 'answer',
        data: this.buffer,
      };
      this.push(res);
      // Clear the buffer
      this.buffer = '';
    }

    // assume the model is not respecting the proposed structure and send the buffer as answer
    if (
      this.buffer.length >= this.toolsTag.length &&
      !this.toolsFound &&
      startIndex === -1
    ) {
      this.toolsFound = true;
    }

    callback();
  }
}
