import { HttpStatus } from "@nestjs/common";
import { error, ErrorTypes } from "../responses/responses";

/**
 * makeValidatorMsg creates a class-validator decorator message
 * @param msg The error message
 * @param param? The faulty parameter name
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
