import { BadRequestException, HttpException, HttpStatus, ValidationPipeOptions } from '@nestjs/common';
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
    let constraints = errors[0].constraints;

    while (true) {
      if (constraints) {
        break;
      } else {
        constraints = errors[0].children[0].constraints;
        errors = errors[0].children;
      }
    }

    if (!constraints && errors[0].children.length > 0) {
      constraints = errors[0].children[0].constraints;
    }

    const firstMsg = constraints[Object.keys(constraints)[0]];

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
