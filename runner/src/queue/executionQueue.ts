import { ExecuteOptions, ExecutionResult, dockerExecutor } from '../executor/dockerExecutor.js';

export interface QueuedJob {
  id: string;
  options: ExecuteOptions;
  createdAt: Date;
}

/**
 * In-memory execution queue stub.
 * In production: backed by Redis / BullMQ to handle concurrency bursts and rate limiting.
 */
export class ExecutionQueue {
  private activeJobs = 0;
  private readonly maxConcurrency = 4;

  async enqueue(options: ExecuteOptions): Promise<ExecutionResult> {
    // Basic concurrency guard
    while (this.activeJobs >= this.maxConcurrency) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    this.activeJobs++;
    try {
      return await dockerExecutor.execute(options);
    } finally {
      this.activeJobs--;
    }
  }

  getStats() {
    return {
      activeJobs: this.activeJobs,
      maxConcurrency: this.maxConcurrency,
    };
  }
}

export const executionQueue = new ExecutionQueue();

