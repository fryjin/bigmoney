import { describe, expect, it } from 'vitest';
import { SeededRandom, pickUnique } from '../src/index';

describe('SeededRandom', () => {
  it('repeats the same sequence from the same seed', () => {
    const first = new SeededRandom(20260805);
    const second = new SeededRandom(20260805);

    const sequenceA = Array.from({ length: 8 }, () => first.nextInt(1, 20));
    const sequenceB = Array.from({ length: 8 }, () => second.nextInt(1, 20));

    expect(sequenceA).toEqual(sequenceB);
  });

  it('restores from a snapshot', () => {
    const random = new SeededRandom(42);
    random.nextInt(1, 6);
    const snapshot = random.getSnapshot();
    const restored = SeededRandom.fromSnapshot(snapshot);

    expect(restored.nextInt(1, 20)).toBe(random.nextInt(1, 20));
  });

  it('picks unique values', () => {
    const random = new SeededRandom(7);
    const picked = pickUnique(['A', 'B', 'C', 'D'], 3, random);

    expect(new Set(picked).size).toBe(3);
  });
});
