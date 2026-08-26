import type { VisualAssetId } from '../assets/visualAssetRegistry';
import { fullMap36PresentationLayout } from './fullMap36Layout';
import { TECHNICAL_SLICE_LAYOUT } from './technicalSliceLayout';

export type BoardTileTone =
  | 'start'
  | 'property'
  | 'event'
  | 'stock'
  | 'card'
  | 'reserved'
  | 'finish';

export interface SceneNode {
  tileId: string;
  x: number;
  y: number;
  label: string;
  tone: BoardTileTone;
}

export interface PropertyPresentationAnchor {
  propertyId: string;
  x: number;
  y: number;
  badgeOffset: { x: number; y: number };
  flagOffset: { x: number; y: number };
  assetId?: VisualAssetId;
}

export interface BoardPresentationLayout {
  boardVersion: string;
  nodes: readonly SceneNode[];
  propertyAnchors: readonly PropertyPresentationAnchor[];
  tile: {
    halfWidth: number;
    halfHeight: number;
    labelFontSize: number;
  };
  road: {
    outerWidth: number;
    innerWidth: number;
    dashWidth: number;
  };
  crosswalks: readonly {
    x: number;
    y: number;
    rotationDegrees: number;
  }[];
}

const layouts: readonly BoardPresentationLayout[] = [
  TECHNICAL_SLICE_LAYOUT,
  fullMap36PresentationLayout
];

export function getBoardPresentationLayout(
  boardVersion: string
): BoardPresentationLayout | null {
  return layouts.find((layout) => layout.boardVersion === boardVersion) ?? null;
}
