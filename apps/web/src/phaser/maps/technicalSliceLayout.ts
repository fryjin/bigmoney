import { technicalSliceContent } from '@bigmoney/game-content';
import type {
  BoardPresentationLayout,
  SceneNode
} from './boardPresentationLayout';

export const TECHNICAL_SLICE_NODES: readonly SceneNode[] = [
  { tileId: 'START', x: 164, y: 626, label: '出发', tone: 'start' },
  { tileId: 'PROPERTY_A1', x: 326, y: 704, label: '滨水公寓', tone: 'property' },
  { tileId: 'EVENT_01', x: 514, y: 614, label: '城市事件', tone: 'event' },
  { tileId: 'STOCK_01', x: 702, y: 520, label: '金融中心', tone: 'stock' },
  { tileId: 'PROPERTY_A2', x: 918, y: 414, label: '中央商街', tone: 'property' },
  { tileId: 'CARD_01', x: 748, y: 316, label: '幸运邮局', tone: 'card' },
  { tileId: 'PROPERTY_A3', x: 536, y: 416, label: '云顶公馆', tone: 'property' },
  { tileId: 'FINISH', x: 318, y: 514, label: '终点', tone: 'finish' }
];

export const PROPERTY_VISUALS = {
  A1: { nodeIndex: 1, buildingKey: 'building-home-a', x: 248, y: 660 },
  A2: { nodeIndex: 4, buildingKey: 'building-market', x: 936, y: 350 },
  A3: { nodeIndex: 6, buildingKey: 'building-home-b', x: 468, y: 370 }
} as const;

export const TECHNICAL_SLICE_LAYOUT = {
  boardVersion: `technical-slice-${technicalSliceContent.technicalSliceVersion}`,
  nodes: TECHNICAL_SLICE_NODES,
  propertyAnchors: Object.entries(PROPERTY_VISUALS).map(([propertyId, visual]) => ({
    propertyId,
    x: visual.x,
    y: visual.y,
    assetId: visual.buildingKey,
    badgeOffset: { x: 52, y: -112 },
    flagOffset: { x: 62, y: -8 }
  })),
  tile: {
    halfWidth: 56,
    halfHeight: 31,
    labelFontSize: 13
  },
  road: {
    outerWidth: 92,
    innerWidth: 72,
    dashWidth: 2
  },
  crosswalks: [
    { x: 418, y: 662, rotationDegrees: -25 },
    { x: 814, y: 463, rotationDegrees: -25 },
    { x: 630, y: 365, rotationDegrees: 24 }
  ]
} as const satisfies BoardPresentationLayout;
