/** A clock the queue uses for timing — injectable so tests can run deterministically. */
export interface SendQueueClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

const realClock: SendQueueClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

type Task = () => Promise<void>;

/**
 * Serialises device requests and enforces a minimum interval between them.
 *
 * Frame pushes are *coalesced*: only the most recent un-sent frame is kept, so a
 * burst of state changes collapses to the latest frame instead of flooding the
 * device. Other commands run FIFO and are never dropped.
 */
export class SendQueue {
  private readonly commandQueue: Task[] = [];
  private pendingFrame: Task | null = null;
  private running = false;
  private disposed = false;
  private lastRunAt = Number.NEGATIVE_INFINITY;
  private idleWaiters: Array<() => void> = [];

  constructor(
    private readonly minIntervalMs: number,
    private readonly clock: SendQueueClock = realClock,
  ) {}

  /** Queue a frame push, superseding any frame that has not been sent yet. */
  pushFrame(task: Task): void {
    if (this.disposed) return;
    this.pendingFrame = task;
    void this.run();
  }

  /** Queue a non-frame command; resolves or rejects with the task's result. */
  pushCommand<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (this.disposed) {
        reject(new Error("SendQueue has been disposed"));
        return;
      }
      this.commandQueue.push(async () => {
        try {
          resolve(await task());
        } catch (error) {
          reject(error);
        }
      });
      void this.run();
    });
  }

  /** Resolves once the queue has no pending or in-flight work. */
  whenIdle(): Promise<void> {
    if (!this.running && !this.hasWork()) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.idleWaiters.push(resolve);
    });
  }

  get pendingFrames(): number {
    return this.pendingFrame ? 1 : 0;
  }

  get pendingCommands(): number {
    return this.commandQueue.length;
  }

  /** Discard all queued work and reject future submissions. */
  dispose(): void {
    this.disposed = true;
    this.commandQueue.length = 0;
    this.pendingFrame = null;
    this.resolveIdle();
  }

  private hasWork(): boolean {
    return this.commandQueue.length > 0 || this.pendingFrame !== null;
  }

  private async run(): Promise<void> {
    if (this.running || this.disposed) return;
    this.running = true;
    try {
      while (!this.disposed && this.hasWork()) {
        const waitMs = this.minIntervalMs - (this.clock.now() - this.lastRunAt);
        if (waitMs > 0) {
          await this.clock.sleep(waitMs);
        }
        if (this.disposed) break;
        const task = this.commandQueue.shift() ?? this.takeFrame();
        if (!task) break;
        this.lastRunAt = this.clock.now();
        try {
          await task();
        } catch {
          // A task owns its own error handling; the queue keeps draining.
        }
      }
    } finally {
      this.running = false;
      this.resolveIdle();
    }
  }

  private takeFrame(): Task | null {
    const frame = this.pendingFrame;
    this.pendingFrame = null;
    return frame;
  }

  private resolveIdle(): void {
    if (this.running || this.hasWork()) return;
    const waiters = this.idleWaiters;
    this.idleWaiters = [];
    for (const resolve of waiters) {
      resolve();
    }
  }
}
