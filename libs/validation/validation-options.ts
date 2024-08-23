import { Logger, ValidationError } from '@nestjs/common';
import { ValidatorOptions } from 'class-validator';

const logger = new Logger('ValidationPipeOptions');

export class ValidationPipeOptions implements ValidatorOptions {
  whitelist: true;
  transform: true;
  validationError?: { target: false };
  disableErrorMessages: false;
  enableDebugMessages: true;
  exceptionFactory(errors: ValidationError[]) {
    errors.forEach((err) => {
      logger.warn(`Validation exception: ${JSON.stringify(err)}`);
    });
  }
}
