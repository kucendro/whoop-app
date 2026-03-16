/**
 * Async producer/consumer queue for handling metadata packets
 * during history download flow.
 */
export class AsyncQueue<T> {
  private queue: T[] = [];
  private resolvers: { resolve: (value: T) => void; reject: (err: Error) => void }[] = [];

  enqueue(item: T): void {
    if (this.resolvers.length > 0) {
      const { resolve } = this.resolvers.shift()!;
      resolve(item);
    } else {
      this.queue.push(item);
    }
  }

  async dequeue(timeoutMs: number = 30000): Promise<T> {
    if (this.queue.length > 0) {
      return this.queue.shift()!;
    }
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.resolvers.findIndex((r) => r.resolve === resolve);
        if (idx !== -1) this.resolvers.splice(idx, 1);
        reject(new Error('Queue dequeue timed out'));
      }, timeoutMs);

      this.resolvers.push({
        resolve: (value: T) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (err: Error) => {
          clearTimeout(timer);
          reject(err);
        },
      });
    });
  }

  clear(): void {
    this.queue = [];
    const pending = this.resolvers;
    this.resolvers = [];
    for (const { reject } of pending) {
      reject(new Error('Queue cleared'));
    }
  }

  get size(): number {
    return this.queue.length;
  }
}
