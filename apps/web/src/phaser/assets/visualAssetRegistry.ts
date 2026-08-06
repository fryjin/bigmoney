import type Phaser from 'phaser';

export type VisualAssetKind = 'svg' | 'image' | 'atlas';
export type VisualAssetCategory = 'building' | 'pawn' | 'environment' | 'effect';

export interface VisualAssetPoint {
  x: number;
  y: number;
}

export interface VisualAssetSize {
  width: number;
  height: number;
}

export interface VisualAssetDefinition {
  id: string;
  key: string;
  kind: VisualAssetKind;
  source: string;
  atlasSource?: string;
  preloadSize?: VisualAssetSize;
  displaySize: VisualAssetSize;
  origin: VisualAssetPoint;
  footAnchor: VisualAssetPoint;
  depthOffset: number;
  category: VisualAssetCategory;
  critical: boolean;
  fallback: 'procedural' | 'hidden';
}

const ASSET_ROOT = '/assets/technical-slice';

export const VISUAL_ASSET_REGISTRY = {
  'building-bank': {
    id: 'building-bank',
    key: 'building-bank',
    kind: 'svg',
    source: `${ASSET_ROOT}/building-bank.svg`,
    preloadSize: { width: 280, height: 280 },
    displaySize: { width: 220, height: 220 },
    origin: { x: 0.5, y: 0.92 },
    footAnchor: { x: 0.5, y: 0.92 },
    depthOffset: -12,
    category: 'building',
    critical: true,
    fallback: 'procedural'
  },
  'building-market': {
    id: 'building-market',
    key: 'building-market',
    kind: 'svg',
    source: `${ASSET_ROOT}/building-market.svg`,
    preloadSize: { width: 280, height: 280 },
    displaySize: { width: 218, height: 218 },
    origin: { x: 0.5, y: 0.92 },
    footAnchor: { x: 0.5, y: 0.92 },
    depthOffset: -10,
    category: 'building',
    critical: true,
    fallback: 'procedural'
  },
  'building-home-a': {
    id: 'building-home-a',
    key: 'building-home-a',
    kind: 'svg',
    source: `${ASSET_ROOT}/building-home-a.svg`,
    preloadSize: { width: 280, height: 280 },
    displaySize: { width: 200, height: 200 },
    origin: { x: 0.5, y: 0.92 },
    footAnchor: { x: 0.5, y: 0.92 },
    depthOffset: -10,
    category: 'building',
    critical: true,
    fallback: 'procedural'
  },
  'building-home-b': {
    id: 'building-home-b',
    key: 'building-home-b',
    kind: 'svg',
    source: `${ASSET_ROOT}/building-home-b.svg`,
    preloadSize: { width: 280, height: 280 },
    displaySize: { width: 200, height: 200 },
    origin: { x: 0.5, y: 0.92 },
    footAnchor: { x: 0.5, y: 0.92 },
    depthOffset: -10,
    category: 'building',
    critical: true,
    fallback: 'procedural'
  },
  'building-card-shop': {
    id: 'building-card-shop',
    key: 'building-card-shop',
    kind: 'svg',
    source: `${ASSET_ROOT}/building-card-shop.svg`,
    preloadSize: { width: 280, height: 280 },
    displaySize: { width: 188, height: 188 },
    origin: { x: 0.5, y: 0.92 },
    footAnchor: { x: 0.5, y: 0.92 },
    depthOffset: -10,
    category: 'building',
    critical: true,
    fallback: 'procedural'
  },
  'building-event-hall': {
    id: 'building-event-hall',
    key: 'building-event-hall',
    kind: 'svg',
    source: `${ASSET_ROOT}/building-event-hall.svg`,
    preloadSize: { width: 280, height: 280 },
    displaySize: { width: 205, height: 205 },
    origin: { x: 0.5, y: 0.92 },
    footAnchor: { x: 0.5, y: 0.92 },
    depthOffset: -12,
    category: 'building',
    critical: true,
    fallback: 'procedural'
  },
  'pawn-cat': {
    id: 'pawn-cat',
    key: 'pawn-cat',
    kind: 'svg',
    source: `${ASSET_ROOT}/pawn-cat.svg`,
    preloadSize: { width: 160, height: 210 },
    displaySize: { width: 68, height: 88 },
    origin: { x: 0.5, y: 0.88 },
    footAnchor: { x: 0.5, y: 0.88 },
    depthOffset: 44,
    category: 'pawn',
    critical: true,
    fallback: 'procedural'
  },
  'pawn-bear': {
    id: 'pawn-bear',
    key: 'pawn-bear',
    kind: 'svg',
    source: `${ASSET_ROOT}/pawn-bear.svg`,
    preloadSize: { width: 160, height: 210 },
    displaySize: { width: 68, height: 88 },
    origin: { x: 0.5, y: 0.88 },
    footAnchor: { x: 0.5, y: 0.88 },
    depthOffset: 44,
    category: 'pawn',
    critical: true,
    fallback: 'procedural'
  }
} as const satisfies Record<string, VisualAssetDefinition>;

export type VisualAssetId = keyof typeof VISUAL_ASSET_REGISTRY;

export const VISUAL_ASSETS: readonly VisualAssetDefinition[] = Object.values(
  VISUAL_ASSET_REGISTRY
);

export function getVisualAsset(id: VisualAssetId): VisualAssetDefinition {
  return VISUAL_ASSET_REGISTRY[id];
}

export function isVisualAssetId(value: string): value is VisualAssetId {
  return value in VISUAL_ASSET_REGISTRY;
}

export function preloadVisualAssets(scene: Phaser.Scene): void {
  for (const asset of VISUAL_ASSETS) {
    if (asset.kind === 'svg') {
      scene.load.svg(asset.key, asset.source, asset.preloadSize);
      continue;
    }

    if (asset.kind === 'atlas' && asset.atlasSource) {
      scene.load.atlas(asset.key, asset.source, asset.atlasSource);
      continue;
    }

    scene.load.image(asset.key, asset.source);
  }
}
