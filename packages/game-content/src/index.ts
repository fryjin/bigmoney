import rawFullMap36Content from './config/full-map-36.json';
import rawTechnicalSliceContent from './config/technical-slice.json';
import {
  fullMap36ContentSchema,
  technicalSliceContentSchema
} from './schema';

export const technicalSliceContent = technicalSliceContentSchema.parse(rawTechnicalSliceContent);
export const fullMap36Content = fullMap36ContentSchema.parse(rawFullMap36Content);

export {
  FULL_MAP_36_BOARD_VERSION,
  fullMap36ContentSchema,
  gameContentSchema,
  technicalSliceContentSchema
} from './schema';

export type {
  GameContent,
  TechnicalSliceContent,
  TileDefinition,
  PropertyDefinition,
  StockDefinition,
  CardDefinition,
  EventDefinition
} from './schema';
