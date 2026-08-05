import { z } from 'zod';

const tileTypeSchema = z.enum(['START', 'PROPERTY', 'EVENT', 'STOCK', 'CARD', 'FINISH']);
const cardRaritySchema = z.enum(['COMMON', 'RARE', 'EPIC']);
const cardTypeSchema = z.enum(['ATTACK', 'DEFENSE', 'BUFF']);

const tileSchema = z.object({
  id: z.string().min(1),
  index: z.number().int().nonnegative(),
  type: tileTypeSchema,
  name: z.string().min(1),
  propertyId: z.string().min(1).optional(),
  stockMarketId: z.string().min(1).optional()
});

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

export const technicalSliceContentSchema = z.object({
  ruleVersion: z.string().min(1),
  technicalSliceVersion: z.string().min(1),
  startingCash: z.number().int().positive(),
  lapReward: z.number().int().positive(),
  cardHandCap: z.number().int().positive(),
  cardOverflowPolicy: z.literal('DRAW_THEN_DISCARD_ONE'),
  tiles: z.array(tileSchema).length(8),
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
}).superRefine((content, ctx) => {
  const sortedTiles = [...content.tiles].sort((a, b) => a.index - b.index);
  sortedTiles.forEach((tile, expectedIndex) => {
    if (tile.index !== expectedIndex) {
      ctx.addIssue({
        code: 'custom',
        path: ['tiles', expectedIndex, 'index'],
        message: `Tile indices must be continuous from 0.`
      });
    }
  });

  const propertyIds = new Set(content.properties.map((property) => property.id));
  for (const tile of content.tiles) {
    if (tile.type === 'PROPERTY' && (!tile.propertyId || !propertyIds.has(tile.propertyId))) {
      ctx.addIssue({
        code: 'custom',
        path: ['tiles', tile.index, 'propertyId'],
        message: 'Property tile must reference an existing property.'
      });
    }
  }

  const ranges = content.stockOutcomes.flatMap((outcome) =>
    Array.from({ length: outcome.max - outcome.min + 1 }, (_, offset) => outcome.min + offset)
  );
  const uniqueResults = new Set(ranges);
  if (uniqueResults.size !== 20 || !Array.from({ length: 20 }, (_, index) => index + 1).every((value) => uniqueResults.has(value))) {
    ctx.addIssue({
      code: 'custom',
      path: ['stockOutcomes'],
      message: 'Stock outcomes must cover every integer result from 1 to 20 exactly once.'
    });
  }
});

export type TechnicalSliceContent = z.infer<typeof technicalSliceContentSchema>;
export type TileDefinition = TechnicalSliceContent['tiles'][number];
export type PropertyDefinition = TechnicalSliceContent['properties'][number];
export type StockDefinition = TechnicalSliceContent['stocks'][number];
export type CardDefinition = TechnicalSliceContent['cards'][number];
export type EventDefinition = TechnicalSliceContent['events'][number];
