import { describe, expect, it } from 'vitest';
import { technicalSliceContent } from '../src/index';

describe('technical slice content', () => {
  it('contains a continuous eight-node loop', () => {
    expect(technicalSliceContent.tiles).toHaveLength(8);
    expect(technicalSliceContent.tiles.map((tile) => tile.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(technicalSliceContent.tiles[0]?.type).toBe('START');
    expect(technicalSliceContent.tiles[7]?.type).toBe('FINISH');
  });

  it('keeps the frozen money baseline', () => {
    expect(technicalSliceContent.startingCash).toBe(500);
    expect(technicalSliceContent.lapReward).toBe(80);
  });

  it('covers all hidden stock results', () => {
    const covered = technicalSliceContent.stockOutcomes.flatMap((outcome) =>
      Array.from({ length: outcome.max - outcome.min + 1 }, (_, offset) => outcome.min + offset)
    );

    expect(covered.sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1)
    );
  });
});
