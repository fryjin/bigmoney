import { describe, expect, it } from 'vitest';
import { formatInternalMoney } from '@bigmoney/game-core';
import { fullMap36Content } from '@bigmoney/game-content';
import { getCurrentTilePresentation } from './currentTilePresentation';

describe('current full-map tile presentation', () => {
  it.each([0, 11, 35])('uses one-based position %i without any reward text', (position) => {
    const tile = fullMap36Content.tiles[position]!;
    const presentation = getCurrentTilePresentation(fullMap36Content, position);

    expect(presentation.positionText).toBe(
      `第 ${position + 1} / 36 格 · ${tile.name}`
    );
    expect(presentation.positionText).not.toContain('800');
    expect(presentation.detailText).toBeNull();
  });

  it.each([
    [9, 'JAIL', '城市拘留所'],
    [18, 'PROJECT', '合作开发区'],
    [27, 'MINIGAME', '城市挑战场']
  ] as const)(
    'shows canonical reserved tile %i as unavailable without an action',
    (position, reservedKind, name) => {
      const tile = fullMap36Content.tiles[position]!;
      const presentation = getCurrentTilePresentation(fullMap36Content, position);

      expect(tile.type).toBe('RESERVED');
      if (tile.type !== 'RESERVED') {
        throw new Error(`Expected RESERVED tile at canonical index ${position}.`);
      }
      expect(tile.reservedKind).toBe(reservedKind);
      expect(tile.name).toBe(name);
      expect(presentation.positionText).toBe(
        `第 ${position + 1} / 36 格 · ${name}`
      );
      expect(presentation.availability).toBe('暂未开放');
      expect(presentation).toEqual({
        positionText: `第 ${position + 1} / 36 格 · ${name}`,
        availability: '暂未开放',
        detailText: null
      });
    }
  );

  it.each([
    [14, '城市服务中心'],
    [25, '中央枢纽']
  ] as const)(
    'shows canonical facility tile %i without reserved availability',
    (position, name) => {
      const tile = fullMap36Content.tiles[position]!;
      const presentation = getCurrentTilePresentation(fullMap36Content, position);

      expect(tile.type).toBe('FACILITY');
      if (tile.type !== 'FACILITY') {
        throw new Error(`Expected FACILITY tile at canonical index ${position}.`);
      }
      expect(tile.name).toBe(name);
      expect(presentation).toEqual({
        positionText: `第 ${position + 1} / 36 格 · ${name}`,
        availability: null,
        detailText: `公共设施费用 · ${formatInternalMoney(tile.fee)}`
      });
    }
  );

  it.each([8, 13, 17, 24, 26])(
    'does not misclassify adjacent property tile %i as reserved',
    (position) => {
      const tile = fullMap36Content.tiles[position]!;
      const presentation = getCurrentTilePresentation(fullMap36Content, position);

      expect(tile.type).toBe('PROPERTY');
      expect(presentation.positionText).toBe(
        `第 ${position + 1} / 36 格 · ${tile.name}`
      );
      expect(presentation.availability).toBeNull();
      expect(presentation.detailText).toBeNull();
    }
  );
});
