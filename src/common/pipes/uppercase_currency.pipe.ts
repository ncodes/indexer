import { Injectable, PipeTransform } from '@nestjs/common';

/**
 * Convert body fields to upper case.
 */
@Injectable()
export class UpperCaseFieldValuePipe implements PipeTransform {
  private fields: string[];
  constructor(...fields: string[]) {
    this.fields = fields;
  }

  transform(value: any) {
    this.fields.forEach((f) => {
      if (!value[f]) return;
      value[f] = value[f].toUpperCase();
    });
    return value;
  }
}
