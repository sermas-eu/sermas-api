import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { IsArray, IsObject, IsString } from 'class-validator';
import {
  SermasValidationPipe,
  ValidationPipeOptions,
} from './validation-options.js';

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

  it('strips undeclared properties and keeps nested objects whole', async () => {
    class Body {
      @IsString()
      name: string;
      @IsObject()
      settings: Record<string, unknown>;
    }
    const pipe = new SermasValidationPipe();
    const out = await pipe.transform(
      { name: 'x', ownerId: 'injected', settings: { a: 1 } },
      { type: 'body', metatype: Body },
    );
    // a plain object: mongoose refuses DTO instances in Map fields
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(out).toEqual({ name: 'x', settings: { a: 1 } });
  });

  it('still converts typed query parameters', async () => {
    const pipe = new SermasValidationPipe();
    expect(
      await pipe.transform('16000', {
        type: 'query',
        metatype: Number,
        data: 'sampleRate',
      }),
    ).toBe(16000);
  });
});
