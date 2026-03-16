/**
 * Async producer/consumer queue for handling metadata packets
 * during history download flow.
 */
export class AsyncQueue<T> {
  private queue: T[] = [];
  private resolvers: ((value: T) => void)[] = [];

  enqueue(item: T): void {
    if (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift()!;
      resolve(item);
    } else {
      this.queue.push(item);
    }
  }

  async dequeue(): Promise<T> {
    if (this.queue.length > 0) {
      return this.queue.shift()!;
    }
    return new Promise<T>((resolve) => this.resolvers.push(resolve));
  }

  clear(): void {
    this.queue = [];
    this.resolvers = [];
  }

  get size(): number {
    return this.queue.length;
  }
}
