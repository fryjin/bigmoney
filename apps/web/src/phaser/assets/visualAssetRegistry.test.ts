import { describe, expect, it } from 'vitest';
import {
  VISUAL_ASSETS,
  VISUAL_ASSET_REGISTRY,
  getVisualAsset,
  isVisualAssetId
} from './visualAssetRegistry';

describe('visual asset registry', () => {
  it('uses unique preload keys', () => {
    const keys = VISUAL_ASSETS.map((asset) => asset.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('defines a valid foot anchor for every asset', () => {
    for (const asset of VISUAL_ASSETS) {
      expect(asset.footAnchor.x).toBeGreaterThanOrEqual(0);
      expect(asset.footAnchor.x).toBeLessThanOrEqual(1);
      expect(asset.footAnchor.y).toBeGreaterThanOrEqual(0);
      expect(asset.footAnchor.y).toBeLessThanOrEqual(1);
    }
  });

  it('resolves known asset ids', () => {
    expect(isVisualAssetId('pawn-cat')).toBe(true);
    expect(getVisualAsset('pawn-cat')).toBe(VISUAL_ASSET_REGISTRY['pawn-cat']);
  });
});
