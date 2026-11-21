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

// `transform` turns bodies into DTO instances and typed query parameters into their
// types. `whitelist` strips properties a DTO does not declare with a class-validator
// decorator; dto-coverage.spec.ts checks that every documented property has one
// (D-30). Nested objects are not descended into unless marked @ValidateNested.
export class ValidationPipeOptions implements NestValidationPipeOptions {
  whitelist = true;
  transform = true;
  validationError = { target: false };
  exceptionFactory = (errors: ValidationError[]) => {
    errors.forEach((err) => {
      logger.warn(`Validation exception: ${JSON.stringify(err)}`);
    });
    // a factory that returns nothing makes Nest throw `undefined`: a 500
    return new BadRequestException(describe(errors));
  };
}
