import { Injectable, Logger } from '@nestjs/common';
import { InvoiceProcessorService, InvoiceJob } from './invoice-processor.service';

class SequentialQueue {
  private active = Promise.resolve();

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.active.then(task);
    this.active = run.then(() => undefined).catch(() => undefined);
    return run;
  }

  async onIdle() {
    await this.active.catch(() => undefined);
  }
}

@Injectable()
export class InvoiceQueueService {
  private readonly logger = new Logger(InvoiceQueueService.name);
  private readonly queue = new SequentialQueue();

  constructor(private readonly processor: InvoiceProcessorService) {
    // no-op constructor
  }

  enqueue(job: InvoiceJob) {
    this.logger.log(`Queueing invoice job for contract ${job.contractCode}`);
    return this.queue.enqueue(async () => {
      await this.processor.process(job);
    });
  }

  waitForIdle() {
    return this.queue.onIdle();
  }
}
