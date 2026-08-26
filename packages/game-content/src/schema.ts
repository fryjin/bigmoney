import { z } from 'zod';

export const FULL_MAP_36_BOARD_VERSION = 'full-map-36-v1';

const cardRaritySchema = z.enum(['COMMON', 'RARE', 'EPIC']);
const cardTypeSchema = z.enum(['ATTACK', 'DEFENSE', 'BUFF']);
const reservedKindSchema = z.enum(['JAIL', 'FACILITY', 'PROJECT', 'MINIGAME']);

const tileBaseShape = {
  id: z.string().min(1),
  index: z.number().int().nonnegative(),
  name: z.string().min(1)
};

const tileDefinitionSchema = z.discriminatedUnion('type', [
  z.object({ ...tileBaseShape, type: z.literal('START') }).strict(),
  z.object({ ...tileBaseShape, type: z.literal('PROPERTY'), propertyId: z.string().min(1) }).strict(),
  z.object({ ...tileBaseShape, type: z.literal('EVENT') }).strict(),
  z.object({ ...tileBaseShape, type: z.literal('STOCK'), stockMarketId: z.string().min(1) }).strict(),
  z.object({ ...tileBaseShape, type: z.literal('CARD') }).strict(),
  z.object({ ...tileBaseShape, type: z.literal('FINISH') }).strict(),
  z.object({ ...tileBaseShape, type: z.literal('RESERVED'), reservedKind: reservedKindSchema }).strict()
]);

const propertySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  purchasePrice: z.number().int().positive(),
  visualKey: z.string().min(1)
});

const stockSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sector: z.string().min(1)
});

const stockOutcomeSchema = z.object({
  min: z.number().int().min(1).max(20),
  max: z.number().int().min(1).max(20),
  label: z.string().min(1),
  multipliers: z.object({
    '2': z.number().nonnegative(),
    '4': z.number().nonnegative(),
    '6': z.number().nonnegative()
  })
});

const cardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  rarity: cardRaritySchema,
  type: cardTypeSchema,
  description: z.string().min(1)
});

const eventSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  kind: z.enum(['PERSONAL_INCOME', 'PERSONAL_EXPENSE', 'PLAYER_TRANSFER']),
  amount: z.number().int().positive()
});

const contentBaseSchema = z.object({
  ruleVersion: z.string().min(1),
  startingCash: z.number().int().positive(),
  lapReward: z.number().int().positive(),
  cardHandCap: z.number().int().positive(),
  cardOverflowPolicy: z.literal('DRAW_THEN_DISCARD_ONE'),
  tiles: z.array(tileDefinitionSchema).min(1),
  properties: z.array(propertySchema).min(1),
  stockMarket: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    offerCount: z.number().int().positive(),
    investmentTiers: z.array(z.number().int().positive()).length(3),
    periods: z.array(z.union([z.literal(2), z.literal(4), z.literal(6)])).length(3)
  }),
  stocks: z.array(stockSchema).min(3),
  stockOutcomes: z.array(stockOutcomeSchema).min(1),
  cards: z.array(cardSchema).min(1),
  events: z.array(eventSchema).min(1)
});

type ContentBase = z.infer<typeof contentBaseSchema>;

function addIssue(ctx: z.RefinementCtx, path: PropertyKey[], message: string): void {
  ctx.addIssue({ code: 'custom', path, message });
}

function validateCommonContent(content: ContentBase, ctx: z.RefinementCtx): void {
  const tileIds = new Set(content.tiles.map((tile) => tile.id));
  if (tileIds.size !== content.tiles.length) {
    addIssue(ctx, ['tiles'], 'Tile IDs must be unique.');
  }

  const sortedTiles = [...content.tiles].sort((a, b) => a.index - b.index);
  sortedTiles.forEach((tile, expectedIndex) => {
    if (tile.index !== expectedIndex) {
      addIssue(ctx, ['tiles', expectedIndex, 'index'], 'Tile indices must be continuous from 0.');
    }
  });

  const propertyIds = new Set(content.properties.map((property) => property.id));
  if (propertyIds.size !== content.properties.length) {
    addIssue(ctx, ['properties'], 'Property definition IDs must be unique.');
  }

  for (const tile of content.tiles) {
    if (tile.type === 'PROPERTY' && !propertyIds.has(tile.propertyId)) {
      addIssue(ctx, ['tiles', tile.index, 'propertyId'], 'Property tile must reference an existing property.');
    }

    if (tile.type === 'STOCK' && tile.stockMarketId !== content.stockMarket.id) {
      addIssue(ctx, ['tiles', tile.index, 'stockMarketId'], 'Stock tile must reference the configured stock market.');
    }
  }

  const ranges = content.stockOutcomes.flatMap((outcome) =>
    Array.from({ length: outcome.max - outcome.min + 1 }, (_, offset) => outcome.min + offset)
  );
  const uniqueResults = new Set(ranges);
  const coversEveryResult = Array.from({ length: 20 }, (_, index) => index + 1).every((value) => uniqueResults.has(value));
  if (uniqueResults.size !== 20 || !coversEveryResult || ranges.length !== 20) {
    addIssue(ctx, ['stockOutcomes'], 'Stock outcomes must cover every integer result from 1 to 20 exactly once.');
  }
}

const gameContentStructureSchema = contentBaseSchema.extend({
  boardVersion: z.string().min(1)
});

export const gameContentSchema = gameContentStructureSchema.superRefine(validateCommonContent);

export const technicalSliceContentSchema = contentBaseSchema.extend({
  technicalSliceVersion: z.string().min(1),
  tiles: z.array(tileDefinitionSchema).length(8)
}).superRefine(validateCommonContent);

export const fullMap36ContentSchema = gameContentStructureSchema.extend({
  boardVersion: z.literal(FULL_MAP_36_BOARD_VERSION)
}).superRefine((content, ctx) => {
  validateCommonContent(content, ctx);

  if (content.tiles.length !== 36) {
    addIssue(ctx, ['tiles'], 'The full map must contain exactly 36 tiles.');
  }

  const expectedTypeCounts = {
    START: 1,
    PROPERTY: 20,
    EVENT: 4,
    STOCK: 2,
    CARD: 3,
    RESERVED: 5,
    FINISH: 1
  } as const;

  for (const [type, expectedCount] of Object.entries(expectedTypeCounts)) {
    const actualCount = content.tiles.filter((tile) => tile.type === type).length;
    if (actualCount !== expectedCount) {
      addIssue(ctx, ['tiles'], `The full map must contain exactly ${expectedCount} ${type} tiles.`);
    }
  }

  const startTiles = content.tiles.filter((tile) => tile.type === 'START');
  if (startTiles.length !== 1 || startTiles[0]?.index !== 0) {
    addIssue(ctx, ['tiles'], 'The full map must have exactly one START tile at index 0.');
  }

  const finishTiles = content.tiles.filter((tile) => tile.type === 'FINISH');
  if (finishTiles.length !== 1 || finishTiles[0]?.index !== 35) {
    addIssue(ctx, ['tiles'], 'The full map must have exactly one FINISH tile at index 35.');
  }

  if (content.properties.length !== 20) {
    addIssue(ctx, ['properties'], 'The full map must define exactly 20 properties.');
  }

  const visualKeys = new Set(content.properties.map((property) => property.visualKey));
  if (visualKeys.size !== content.properties.length) {
    addIssue(ctx, ['properties'], 'Full-map property visual keys must be unique.');
  }

  const propertyTileReferences = new Map<string, number>();
  for (const tile of content.tiles) {
    if (tile.type === 'PROPERTY') {
      propertyTileReferences.set(tile.propertyId, (propertyTileReferences.get(tile.propertyId) ?? 0) + 1);
    }
  }

  for (const property of content.properties) {
    if (propertyTileReferences.get(property.id) !== 1) {
      addIssue(ctx, ['properties'], 'Each full-map property must be referenced by exactly one PROPERTY tile.');
      break;
    }
  }
});

export type GameContent = z.infer<typeof gameContentSchema>;
export type TechnicalSliceContent = z.infer<typeof technicalSliceContentSchema>;
export type TileDefinition = GameContent['tiles'][number];
export type PropertyDefinition = GameContent['properties'][number];
export type StockDefinition = GameContent['stocks'][number];
export type CardDefinition = GameContent['cards'][number];
export type EventDefinition = GameContent['events'][number];
