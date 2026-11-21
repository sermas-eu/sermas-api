import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { IsArray, IsString } from 'class-validator';
import { ValidationPipeOptions } from './validation-options.js';

class Payload {
  @IsString()
  name: string;
  @IsArray()
  modules: string[];
}

describe('ValidationPipeOptions', () => {
  it('turns validation failures into a 400 with the messages', async () => {
    const pipe = new ValidationPipe(new ValidationPipeOptions());
    const err = await pipe
      .transform(
        { name: 'x', modules: 'no' },
        { type: 'body', metatype: Payload },
      )
      .catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.getResponse().message).toEqual(['modules must be an array']);
  });
});
