import {
  BadRequestException,
  Logger,
  ValidationError,
  ValidationPipeOptions as NestValidationPipeOptions,
} from '@nestjs/common';

const logger = new Logger('ValidationPipeOptions');

const describe = (errors: ValidationError[], parent = ''): string[] =>
  errors.flatMap((err) => {
    const path = parent ? `${parent}.${err.property}` : err.property;
    return [
      ...Object.values(err.constraints || {}),
      ...describe(err.children || [], path),
    ].map((m) => (m.startsWith(err.property) ? m : `${path}: ${m}`));
  });

// `whitelist` and `transform` were declared as types only and never applied: enabling
// them now would strip or convert payloads that clients send today (D-30)
export class ValidationPipeOptions implements NestValidationPipeOptions {
  validationError = { target: false };
  exceptionFactory = (errors: ValidationError[]) => {
    errors.forEach((err) => {
      logger.warn(`Validation exception: ${JSON.stringify(err)}`);
    });
    // a factory that returns nothing makes Nest throw `undefined`: a 500
    return new BadRequestException(describe(errors));
  };
}
