export abstract class Job {
  abstract schedule();
}

// tslint:disable-next-line:max-classes-per-file
export abstract class Base extends Job {
  protected processing: boolean;

  schedule() {
    // not implemented
  }

  setProcessing(state: boolean) {
    this.processing = state;
  }

  isProcessing() {
    return this.processing;
  }
}
