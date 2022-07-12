import {
  BadRequestException,
  HttpException,
  HttpStatus,
  ValidationPipeOptions,
} from '@nestjs/common';
import validator from 'validator';

/**
 * CommonValidationPipeOpt describes common validation option
 * for use in a validation pipe.
 *
 * exceptionFactory: configured to return
 *  - first validation error
 *  - the affected field
 */
export const CommonValidationPipeOpt: ValidationPipeOptions = {
  transform: true,
  exceptionFactory: (errors) => {
    const firstMsg = errors[0].constraints[Object.keys(errors[0].constraints)[0]];

    if (validator.isJSON(firstMsg)) {
      const err = JSON.parse(firstMsg);
      throw new HttpException(err.response, err.status);
    }

    throw new BadRequestException({
      statusCode: HttpStatus.BAD_REQUEST,
      message: firstMsg,
      field: errors[0].property,
    });
  },
};
