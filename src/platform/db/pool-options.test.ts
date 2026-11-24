import { describe, expect, it } from 'vitest';
import { poolOptions } from './pool-options';

describe('poolOptions', () => {
  it('never pipelines and never prepares, because the transaction pooler loses both', () => {
    expect(poolOptions()).toMatchObject({ max_pipeline: 1, prepare: false });
  });
  it('gives up on a silent statement in seconds, not at the function limit', () => {
    const o = poolOptions();
    expect(o.query_timeout).toBeGreaterThan(0);
    expect(o.query_timeout).toBeLessThanOrEqual(10);
    expect(o.queue_timeout).toBeGreaterThan(0);
    expect(o.queue_timeout).toBeLessThanOrEqual(o.query_timeout as number);
  });
  it('takes the pool size from DATABASE_POOL_MAX, 5 by default', () => {
    expect(poolOptions().max).toBe(5);
    expect(poolOptions({ DATABASE_POOL_MAX: '2' }).max).toBe(2);
  });
});
