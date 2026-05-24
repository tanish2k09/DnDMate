import { type Mutation, mutationKey } from "../domain/mutations";

type Listener = () => void;

/**
 * Ordered queue of pending mutations with dedup-by-key on enqueue.
 *
 * Enqueueing a mutation whose key matches an already-queued one replaces the
 * existing entry in place — preserving the order of distinct actions while
 * collapsing repeated edits to the same target. Subscribers are notified
 * after every enqueue, replace, drain, or clear so the LiveController can
 * re-render the draft preview.
 */
export class PendingActionQueue {
  private items: Mutation[] = [];
  private listeners = new Set<Listener>();

  enqueue(mutation: Mutation): void {
    const key = mutationKey(mutation);
    const existing = this.items.findIndex((m) => mutationKey(m) === key);
    if (existing >= 0) {
      this.items[existing] = mutation;
    } else {
      this.items.push(mutation);
    }
    this.emit();
  }

  list(): readonly Mutation[] {
    return this.items;
  }

  size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /** Remove and return everything in the queue. */
  drain(): Mutation[] {
    if (this.items.length === 0) return [];
    const drained = this.items;
    this.items = [];
    this.emit();
    return drained;
  }

  /** Clear without returning, used for discard. */
  clear(): void {
    if (this.items.length === 0) return;
    this.items = [];
    this.emit();
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
