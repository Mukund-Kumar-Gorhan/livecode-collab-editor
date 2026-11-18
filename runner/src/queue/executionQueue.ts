import { ExecuteOptions, ExecutionResult, dockerExecutor } from '../executor/dockerExecutor.js';

export class ExecutionQueue {
  private activeJobs = 0;
  private readonly maxConcurrency = 3;
  private queue: Array<() => void> = [];

  async enqueue(options: ExecuteOptions): Promise<ExecutionResult> {
    // If maximum concurrency reached, wait in queue
    if (this.activeJobs >= this.maxConcurrency) {
      await new Promise<void>((resolve) => {
        this.queue.push(resolve);
      });
    }

    this.activeJobs++;
    try {
      return await dockerExecutor.execute(options);
    } finally {
      this.activeJobs--;
      // Dispatch next waiting job from queue
      const nextJob = this.queue.shift();
      if (nextJob) {
        nextJob();
      }
    }
  }

  getStats() {
    return {
      activeJobs: this.activeJobs,
      queuedJobs: this.queue.length,
      maxConcurrency: this.maxConcurrency,
    };
  }
}

export const executionQueue = new ExecutionQueue();
