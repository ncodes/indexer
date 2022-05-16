import { LoggerService } from '@nestjs/common';

export class NoopLogger implements LoggerService {
  log() {
    /* your implementation */
  }
  error() {
    /* your implementation */
  }
  warn() {
    /* your implementation */
  }
  debug() {
    /* your implementation */
  }
  verbose() {
    /* your implementation */
  }
}
