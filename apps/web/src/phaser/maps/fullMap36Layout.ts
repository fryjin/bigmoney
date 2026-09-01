import { fullMap36Content } from '@bigmoney/game-content';
import type {
  BoardPresentationLayout,
  BoardTileTone,
  PropertyPresentationAnchor,
  SceneNode
} from './boardPresentationLayout';

export const FULL_MAP_36_SAFE_BOUNDS = {
  left: 88,
  right: 1106,
  top: 88,
  bottom: 746
} as const;

const HORIZONTAL_STEP =
  (FULL_MAP_36_SAFE_BOUNDS.right - FULL_MAP_36_SAFE_BOUNDS.left) / 9;
const VERTICAL_STEP =
  (FULL_MAP_36_SAFE_BOUNDS.bottom - FULL_MAP_36_SAFE_BOUNDS.top) / 9;

export const FULL_MAP_36_PERIMETER_STEP = VERTICAL_STEP;

function getPerimeterPosition(index: number): { x: number; y: number } {
  if (index <= 9) {
    return {
      x: FULL_MAP_36_SAFE_BOUNDS.left + HORIZONTAL_STEP * index,
      y: FULL_MAP_36_SAFE_BOUNDS.bottom
    };
  }
  if (index <= 18) {
    return {
      x: FULL_MAP_36_SAFE_BOUNDS.right,
      y: FULL_MAP_36_SAFE_BOUNDS.bottom - VERTICAL_STEP * (index - 9)
    };
  }
  if (index <= 27) {
    return {
      x: FULL_MAP_36_SAFE_BOUNDS.right - HORIZONTAL_STEP * (index - 18),
      y: FULL_MAP_36_SAFE_BOUNDS.top
    };
  }
  return {
    x: FULL_MAP_36_SAFE_BOUNDS.left,
    y: FULL_MAP_36_SAFE_BOUNDS.top + VERTICAL_STEP * (index - 27)
  };
}

function getTileTone(type: typeof fullMap36Content.tiles[number]['type']): BoardTileTone {
  if (type === 'START') return 'start';
  if (type === 'PROPERTY') return 'property';
  if (type === 'EVENT') return 'event';
  if (type === 'STOCK') return 'stock';
  if (type === 'CARD') return 'card';
  if (type === 'FACILITY') return 'facility';
  if (type === 'RESERVED') return 'reserved';
  return 'finish';
}

function createNode(
  tile: typeof fullMap36Content.tiles[number]
): SceneNode {
  return {
    tileId: tile.id,
    ...getPerimeterPosition(tile.index),
    label: `${tile.index} ${tile.name.slice(0, 4)}`,
    tone: getTileTone(tile.type)
  };
}

function getAnchorOffset(index: number): { x: number; y: number } {
  const stagger = index % 2 === 0 ? -8 : 8;
  if (index <= 9) return { x: stagger, y: -48 };
  if (index <= 18) return { x: -48, y: stagger };
  if (index <= 27) return { x: stagger, y: 48 };
  return { x: 48, y: stagger };
}

function createPropertyAnchors(
  nodes: readonly SceneNode[]
): readonly PropertyPresentationAnchor[] {
  return fullMap36Content.tiles.flatMap((tile) => {
    if (tile.type !== 'PROPERTY') return [];
    const node = nodes[tile.index];
    if (!node) return [];
    const offset = getAnchorOffset(tile.index);
    return [{
      propertyId: tile.propertyId,
      x: node.x + offset.x,
      y: node.y + offset.y,
      badgeOffset: { x: 18, y: -22 },
      flagOffset: { x: 22, y: -2 }
    }];
  });
}

const nodes = fullMap36Content.tiles.map(createNode);

export const fullMap36PresentationLayout = {
  boardVersion: fullMap36Content.boardVersion,
  nodes,
  propertyAnchors: createPropertyAnchors(nodes),
  perimeterStep: FULL_MAP_36_PERIMETER_STEP,
  tile: {
    halfWidth: 42,
    halfHeight: 23,
    labelFontSize: 9
  },
  road: {
    outerWidth: 54,
    innerWidth: 38,
    dashWidth: 2
  },
  crosswalks: []
} as const satisfies BoardPresentationLayout & { perimeterStep: number };
