import { HttpStatus } from "@nestjs/common";
import { error, ErrorTypes } from "../responses/responses";
import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from "class-validator";

/**
 * makeValidatorMsg creates a class-validator decorator message
 * @param msg The error message
 * @param param The faulty parameter name
 * @param code The error code
 */
export function makeValidatorMsg(msg: string, param?: string, code = '') {
  return (): string => {
    return error()
      .msg(msg)
      .status(HttpStatus.BAD_REQUEST)
      .code(code)
      .param(param)
      .type(ErrorTypes.InvalidRequest)
      .json();
  };
}

/**
 * LiquidityDescriptionValidator validates an array of liquidity description objects
 */
@ValidatorConstraint({ name: 'liquidityDescription', async: false })
export class LiquidityDescriptionValidator implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (!Array.isArray(value)) return false;
    return value.every((item) => {
      return (
        typeof item === 'object' &&
        item.provider &&
        item.lid != undefined &&
        typeof item.provider === 'string' &&
        typeof item.lid === 'number'
      );
    });
  }

  defaultMessage(args: ValidationArguments) {
    return 'liquidity description is invalid';
  }
}
