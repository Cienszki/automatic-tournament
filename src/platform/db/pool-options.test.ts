import { describe, expect, it } from 'vitest';
import { poolOptions } from './pool-options';

describe('poolOptions', () => {
  it('never pipelines and never prepares, because the transaction pooler loses both', () => {
    expect(poolOptions()).toMatchObject({ max_pipeline: 1, prepare: false });
  });
  it('takes the pool size from DATABASE_POOL_MAX, 5 by default', () => {
    expect(poolOptions().max).toBe(5);
    expect(poolOptions({ DATABASE_POOL_MAX: '2' }).max).toBe(2);
  });
});
