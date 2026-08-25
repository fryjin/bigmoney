import { describe, expect, it } from 'vitest';
import {
  getPawnDisplayDepth,
  getPawnDisplayPosition,
  getPawnTexture,
  shouldShowActivePlayerRing,
  toPhaserDisplayColor
} from './playerPresentation';

describe('player presentation helpers', () => {
  it('maps the four canonical player indices onto the two existing pawn textures', () => {
    expect([0, 1, 2, 3].map(getPawnTexture)).toEqual([
      'pawn-cat',
      'pawn-bear',
      'pawn-cat',
      'pawn-bear'
    ]);
  });

  it('keeps the two-player tile positions compatible with the existing presentation', () => {
    expect(getPawnDisplayPosition({ x: 164, y: 626 }, 0, 2)).toEqual({
      x: 150,
      y: 626
    });
    expect(getPawnDisplayPosition({ x: 164, y: 626 }, 1, 2)).toEqual({
      x: 180,
      y: 631
    });
  });

  it('assigns distinct, stable slots to three and four players on the same tile', () => {
    const threePlayerSlots = [0, 1, 2].map((index) =>
      getPawnDisplayPosition({ x: 536, y: 416 }, index, 3)
    );
    const fourPlayerSlots = [0, 1, 2, 3].map((index) =>
      getPawnDisplayPosition({ x: 536, y: 416 }, index, 4)
    );

    expect(new Set(threePlayerSlots.map(({ x, y }) => `${x}:${y}`)).size).toBe(3);
    expect(new Set(fourPlayerSlots.map(({ x, y }) => `${x}:${y}`)).size).toBe(4);
  });

  it('uses the same helper for P3 and P4 movement targets, including wrap destinations', () => {
    expect(getPawnDisplayPosition({ x: 318, y: 514 }, 2, 4)).toEqual({
      x: 298,
      y: 539
    });
    expect(getPawnDisplayPosition({ x: 164, y: 626 }, 3, 4)).toEqual({
      x: 184,
      y: 656
    });
  });

  it('keeps pawn depth deterministic and converts canonical CSS colors safely', () => {
    expect(getPawnDisplayDepth(626, 0)).toBeLessThan(getPawnDisplayDepth(626, 1));
    expect(toPhaserDisplayColor('#7E68B8')).toBe(0x7e68b8);
    expect(toPhaserDisplayColor('invalid')).toBe(0x4a9a7f);
  });

  it('hides the active ring for bankrupt players and finished games', () => {
    expect(shouldShowActivePlayerRing('IN_PROGRESS', { bankrupt: false })).toBe(true);
    expect(shouldShowActivePlayerRing('IN_PROGRESS', { bankrupt: true })).toBe(false);
    expect(shouldShowActivePlayerRing('FINISHED', { bankrupt: false })).toBe(false);
  });
});
