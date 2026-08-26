import { describe, expect, it } from 'vitest';
import * as gameContent from '../src/index';

type FullMapCandidate = {
  boardVersion: string;
  ruleVersion: string;
  startingCash: number;
  lapReward: number;
  cardHandCap: number;
  cardOverflowPolicy: string;
  tiles: Array<{
    id: string;
    index: number;
    type: string;
    name: string;
    propertyId?: string;
    stockMarketId?: string;
    reservedKind?: string;
  }>;
  properties: Array<{
    id: string;
    name: string;
    purchasePrice: number;
    visualKey: string;
  }>;
  stockMarket: {
    id: string;
  };
  stocks: unknown;
  stockOutcomes: unknown;
  cards: unknown;
  events: unknown;
};

type FullMapSchema = {
  safeParse: (value: unknown) => { success: boolean };
};

type FullMapExports = {
  fullMap36Content?: FullMapCandidate;
  fullMap36ContentSchema?: FullMapSchema;
};

const fullMapExports = gameContent as typeof gameContent & FullMapExports;

function requireFullMapContent(): FullMapCandidate | undefined {
  expect(fullMapExports.fullMap36Content).toBeDefined();
  return fullMapExports.fullMap36Content;
}

function requireFullMapSchema(): FullMapSchema | undefined {
  expect(fullMapExports.fullMap36ContentSchema).toBeDefined();
  return fullMapExports.fullMap36ContentSchema;
}

function cloneFullMap(content: FullMapCandidate): FullMapCandidate {
  return structuredClone(content);
}

describe('full-map-36 canonical content', () => {
  it('exports a parsed full-map-36-v1 content contract', () => {
    const content = requireFullMapContent();
    if (!content) {
      return;
    }

    expect(content.boardVersion).toBe('full-map-36-v1');
    expect(content.tiles).toHaveLength(36);
    expect(content.tiles.map((tile) => tile.index)).toEqual(Array.from({ length: 36 }, (_, index) => index));
    expect(new Set(content.tiles.map((tile) => tile.id)).size).toBe(36);
  });

  it('keeps START and FINISH at the frozen endpoints', () => {
    const content = requireFullMapContent();
    if (!content) {
      return;
    }

    expect(content.tiles.filter((tile) => tile.type === 'START').map((tile) => tile.index)).toEqual([0]);
    expect(content.tiles.filter((tile) => tile.type === 'FINISH').map((tile) => tile.index)).toEqual([35]);
  });

  it('defines the frozen property identities, prices, and visual keys', () => {
    const content = requireFullMapContent();
    if (!content) {
      return;
    }

    expect(content.properties).toEqual([
      { id: 'HARBOR_01', name: '滨水公寓', purchasePrice: 50, visualKey: 'property-harbor-01' },
      { id: 'HARBOR_02', name: '河岸市集', purchasePrice: 55, visualKey: 'property-harbor-02' },
      { id: 'HARBOR_03', name: '中央商街', purchasePrice: 60, visualKey: 'property-harbor-03' },
      { id: 'HARBOR_04', name: '港湾商厦', purchasePrice: 65, visualKey: 'property-harbor-04' },
      { id: 'HARBOR_05', name: '云顶公馆', purchasePrice: 70, visualKey: 'property-harbor-05' },
      { id: 'METRO_01', name: '艺术里巷', purchasePrice: 75, visualKey: 'property-metro-01' },
      { id: 'METRO_02', name: '都会影城', purchasePrice: 80, visualKey: 'property-metro-02' },
      { id: 'METRO_03', name: '城心广场', purchasePrice: 85, visualKey: 'property-metro-03' },
      { id: 'METRO_04', name: '都会中心', purchasePrice: 90, visualKey: 'property-metro-04' },
      { id: 'METRO_05', name: '城市之门', purchasePrice: 95, visualKey: 'property-metro-05' },
      { id: 'INNOVATION_01', name: '创意园区', purchasePrice: 100, visualKey: 'property-innovation-01' },
      { id: 'INNOVATION_02', name: '数字港', purchasePrice: 105, visualKey: 'property-innovation-02' },
      { id: 'INNOVATION_03', name: '智造中心', purchasePrice: 110, visualKey: 'property-innovation-03' },
      { id: 'INNOVATION_04', name: '科技新城', purchasePrice: 115, visualKey: 'property-innovation-04' },
      { id: 'INNOVATION_05', name: '云端总部', purchasePrice: 120, visualKey: 'property-innovation-05' },
      { id: 'SKYLINE_01', name: '国际会展中心', purchasePrice: 125, visualKey: 'property-skyline-01' },
      { id: 'SKYLINE_02', name: '金融大厦', purchasePrice: 130, visualKey: 'property-skyline-02' },
      { id: 'SKYLINE_03', name: '星河中心', purchasePrice: 135, visualKey: 'property-skyline-03' },
      { id: 'SKYLINE_04', name: '天际总部', purchasePrice: 140, visualKey: 'property-skyline-04' },
      { id: 'SKYLINE_05', name: '财富之巅', purchasePrice: 150, visualKey: 'property-skyline-05' }
    ]);

    const propertyTileIds = content.tiles
      .filter((tile) => tile.type === 'PROPERTY')
      .map((tile) => tile.propertyId)
      .sort();

    expect(propertyTileIds).toEqual(content.properties.map((property) => property.id).sort());
  });

  it('uses the existing card, event, stock, and economy pools', () => {
    const content = requireFullMapContent();
    if (!content) {
      return;
    }

    expect(content.startingCash).toBe(500);
    expect(content.lapReward).toBe(80);
    expect(content.cardHandCap).toBe(3);
    expect(content.cardOverflowPolicy).toBe('DRAW_THEN_DISCARD_ONE');
    expect(content.ruleVersion).toBe(gameContent.technicalSliceContent.ruleVersion);
    expect(content.stockMarket).toEqual(gameContent.technicalSliceContent.stockMarket);
    expect(content.stocks).toEqual(gameContent.technicalSliceContent.stocks);
    expect(content.stockOutcomes).toEqual(gameContent.technicalSliceContent.stockOutcomes);
    expect(content.cards).toEqual(gameContent.technicalSliceContent.cards);
    expect(content.events).toEqual(gameContent.technicalSliceContent.events);
    expect(content.tiles.filter((tile) => tile.type === 'EVENT').map((tile) => tile.index)).toEqual([2, 11, 20, 30]);
    expect(content.tiles.filter((tile) => tile.type === 'CARD').map((tile) => tile.index)).toEqual([4, 16, 32]);
    expect(content.tiles.filter((tile) => tile.type === 'STOCK').map((tile) => [tile.index, tile.stockMarketId])).toEqual([
      [6, 'MARKET_01'],
      [23, 'MARKET_01']
    ]);
  });

  it('models the five reserved no-op destinations as metadata', () => {
    const content = requireFullMapContent();
    if (!content) {
      return;
    }

    expect(content.tiles.filter((tile) => tile.type === 'RESERVED').map((tile) => [tile.index, tile.reservedKind])).toEqual([
      [9, 'JAIL'],
      [14, 'FACILITY'],
      [18, 'PROJECT'],
      [25, 'FACILITY'],
      [27, 'MINIGAME']
    ]);
  });
});

describe('full-map-36 schema integrity', () => {
  it('rejects duplicate tile IDs', () => {
    const content = requireFullMapContent();
    const schema = requireFullMapSchema();
    if (!content || !schema) {
      return;
    }

    const invalid = cloneFullMap(content);
    invalid.tiles[1]!.id = invalid.tiles[0]!.id;

    expect(schema.safeParse(invalid).success).toBe(false);
  });

  it('rejects missing and duplicate property definitions', () => {
    const content = requireFullMapContent();
    const schema = requireFullMapSchema();
    if (!content || !schema) {
      return;
    }

    const missingReference = cloneFullMap(content);
    missingReference.tiles[1]!.propertyId = 'MISSING_PROPERTY';
    expect(schema.safeParse(missingReference).success).toBe(false);

    const duplicateId = cloneFullMap(content);
    duplicateId.properties[1]!.id = duplicateId.properties[0]!.id;
    expect(schema.safeParse(duplicateId).success).toBe(false);
  });

  it('rejects invalid stock and reserved metadata', () => {
    const content = requireFullMapContent();
    const schema = requireFullMapSchema();
    if (!content || !schema) {
      return;
    }

    const invalidStock = cloneFullMap(content);
    invalidStock.tiles[6]!.stockMarketId = 'MISSING_MARKET';
    expect(schema.safeParse(invalidStock).success).toBe(false);

    const invalidReserved = cloneFullMap(content);
    invalidReserved.tiles[9]!.reservedKind = 'MUSEUM';
    expect(schema.safeParse(invalidReserved).success).toBe(false);
  });

  it('rejects an invalid full-map topology', () => {
    const content = requireFullMapContent();
    const schema = requireFullMapSchema();
    if (!content || !schema) {
      return;
    }

    const duplicateStart = cloneFullMap(content);
    duplicateStart.tiles[2]!.type = 'START';
    expect(schema.safeParse(duplicateStart).success).toBe(false);

    const wrongFinish = cloneFullMap(content);
    wrongFinish.tiles[30]!.type = 'FINISH';
    wrongFinish.tiles[35]!.type = 'EVENT';
    expect(schema.safeParse(wrongFinish).success).toBe(false);

    const wrongCount = cloneFullMap(content);
    wrongCount.tiles.pop();
    expect(schema.safeParse(wrongCount).success).toBe(false);
  });
});
