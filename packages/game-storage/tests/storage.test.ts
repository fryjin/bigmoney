import { describe, expect, it } from 'vitest';
import {
  deleteSnapshot,
  loadSnapshot,
  saveSnapshot
} from '../src/index';

describe('storage fallback', () => {
  it('stores snapshots when IndexedDB is unavailable', async () => {
    await saveSnapshot('test-slot', { round: 3 });
    await expect(loadSnapshot<{ round: number }>('test-slot')).resolves.toEqual({ round: 3 });
    await deleteSnapshot('test-slot');
    await expect(loadSnapshot('test-slot')).resolves.toBeNull();
  });
});
