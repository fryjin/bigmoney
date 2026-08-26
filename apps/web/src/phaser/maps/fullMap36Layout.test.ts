import { describe, expect, it } from 'vitest';
import {
  fullMap36Content,
  technicalSliceContent
} from '@bigmoney/game-content';
import { getBoardPresentationLayout } from './boardPresentationLayout';
import {
  FULL_MAP_36_SAFE_BOUNDS,
  fullMap36PresentationLayout
} from './fullMap36Layout';
import { TECHNICAL_SLICE_LAYOUT } from './technicalSliceLayout';

describe('full-map 36 presentation layout', () => {
  it('derives all 36 nodes from canonical content in board-index order', () => {
    expect(fullMap36PresentationLayout.nodes).toHaveLength(36);
    expect(fullMap36PresentationLayout.nodes.map((node) => node.tileId)).toEqual(
      fullMap36Content.tiles.map((tile) => tile.id)
    );
  });

  it('places unique perimeter nodes inside the reference-canvas safe bounds', () => {
    const coordinates = fullMap36PresentationLayout.nodes.map(
      (node) => `${node.x}:${node.y}`
    );

    expect(new Set(coordinates).size).toBe(36);
    for (const node of fullMap36PresentationLayout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(FULL_MAP_36_SAFE_BOUNDS.left);
      expect(node.x).toBeLessThanOrEqual(FULL_MAP_36_SAFE_BOUNDS.right);
      expect(node.y).toBeGreaterThanOrEqual(FULL_MAP_36_SAFE_BOUNDS.top);
      expect(node.y).toBeLessThanOrEqual(FULL_MAP_36_SAFE_BOUNDS.bottom);
    }
  });

  it('uses the frozen 10×10 perimeter order and keeps FINISH adjacent to START', () => {
    const nodes = fullMap36PresentationLayout.nodes;
    const bottom = nodes.slice(0, 10);
    const right = nodes.slice(10, 19);
    const top = nodes.slice(19, 28);
    const left = nodes.slice(28, 36);

    expect(bottom.every((node) => node.y === bottom[0]!.y)).toBe(true);
    expect(bottom.map((node) => node.x)).toEqual([...bottom].map((node) => node.x).sort((a, b) => a - b));
    expect(right.every((node) => node.x === right[0]!.x)).toBe(true);
    expect(right.map((node) => node.y)).toEqual([...right].map((node) => node.y).sort((a, b) => b - a));
    expect(top.every((node) => node.y === top[0]!.y)).toBe(true);
    expect(top.map((node) => node.x)).toEqual([...top].map((node) => node.x).sort((a, b) => b - a));
    expect(left.every((node) => node.x === left[0]!.x)).toBe(true);
    expect(left.map((node) => node.y)).toEqual([...left].map((node) => node.y).sort((a, b) => a - b));

    const start = nodes[0]!;
    const finish = nodes[35]!;
    expect(Math.hypot(start.x - finish.x, start.y - finish.y)).toBeLessThanOrEqual(
      fullMap36PresentationLayout.perimeterStep
    );
  });

  it('derives 20 unique, bounded property anchors from canonical PROPERTY tiles', () => {
    const anchors = fullMap36PresentationLayout.propertyAnchors;

    expect(anchors).toHaveLength(20);
    expect(anchors.map((anchor) => anchor.propertyId).sort()).toEqual(
      fullMap36Content.properties.map((property) => property.id).sort()
    );
    expect(new Set(anchors.map((anchor) => `${anchor.x}:${anchor.y}`)).size).toBe(20);
    for (const anchor of anchors) {
      expect(anchor.x).toBeGreaterThanOrEqual(FULL_MAP_36_SAFE_BOUNDS.left);
      expect(anchor.x).toBeLessThanOrEqual(FULL_MAP_36_SAFE_BOUNDS.right);
      expect(anchor.y).toBeGreaterThanOrEqual(FULL_MAP_36_SAFE_BOUNDS.top);
      expect(anchor.y).toBeLessThanOrEqual(FULL_MAP_36_SAFE_BOUNDS.bottom);
    }
  });

  it('maps canonical tile types onto all required presentation tones', () => {
    const tones = fullMap36PresentationLayout.nodes.map((node) => node.tone);

    expect(tones.filter((tone) => tone === 'stock')).toHaveLength(2);
    expect(tones.filter((tone) => tone === 'card')).toHaveLength(3);
    expect(tones.filter((tone) => tone === 'event')).toHaveLength(4);
    expect([9, 14, 18, 25, 27].map((index) => fullMap36PresentationLayout.nodes[index]!.tone)).toEqual([
      'reserved',
      'reserved',
      'reserved',
      'reserved',
      'reserved'
    ]);
    expect(fullMap36PresentationLayout.nodes[0]!.tone).toBe('start');
    expect(fullMap36PresentationLayout.nodes[35]!.tone).toBe('finish');
  });
});

describe('board presentation selector', () => {
  it('selects layouts strictly by canonical boardVersion without a technical fallback', () => {
    expect(getBoardPresentationLayout(`technical-slice-${technicalSliceContent.technicalSliceVersion}`)).toBe(
      TECHNICAL_SLICE_LAYOUT
    );
    expect(getBoardPresentationLayout(fullMap36Content.boardVersion)).toBe(
      fullMap36PresentationLayout
    );
    expect(getBoardPresentationLayout('unknown-board')).toBeNull();
  });

  it('preserves the technical 8-node layout and its three property anchors', () => {
    expect(TECHNICAL_SLICE_LAYOUT.nodes).toHaveLength(8);
    expect(TECHNICAL_SLICE_LAYOUT.propertyAnchors.map((anchor) => anchor.propertyId)).toEqual([
      'A1',
      'A2',
      'A3'
    ]);
    expect(TECHNICAL_SLICE_LAYOUT.propertyAnchors.every((anchor) => anchor.assetId)).toBe(true);
  });
});
