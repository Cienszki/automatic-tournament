// Remembers which alerts were sent recently, so the same alert is sent once per
// window and not once a minute.
export interface AlertDedupeStore {
  /**
   * Atomically: if `key` was claimed less than `windowMs` before `nowMs`, return
   * false; otherwise record the claim at `nowMs` and return true.
   */
  claim(key: string, nowMs: number, windowMs: number): Promise<boolean>;
  /** Forget a claim, so a send that failed can be retried at once. */
  release(key: string): Promise<void>;
}

/**
 * Per process. On serverless hosting each instance has its own memory, so two
 * instances may each send once. WP-32's database gives a shared store with the same
 * interface.
 */
export class InMemoryDedupeStore implements AlertDedupeStore {
  private readonly until = new Map<string, number>();

  async claim(key: string, nowMs: number, windowMs: number): Promise<boolean> {
    const expires = this.until.get(key);
    if (expires !== undefined && expires > nowMs) return false;
    if (this.until.size > 1000) {
      for (const [k, t] of this.until) if (t <= nowMs) this.until.delete(k);
    }
    this.until.set(key, nowMs + windowMs);
    return true;
  }

  async release(key: string): Promise<void> {
    this.until.delete(key);
  }
}
