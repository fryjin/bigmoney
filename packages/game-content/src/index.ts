import rawTechnicalSliceContent from './config/technical-slice.json';
import { technicalSliceContentSchema } from './schema';

export const technicalSliceContent = technicalSliceContentSchema.parse(rawTechnicalSliceContent);

export {
  technicalSliceContentSchema
} from './schema';

export type {
  TechnicalSliceContent,
  TileDefinition,
  PropertyDefinition,
  StockDefinition,
  CardDefinition,
  EventDefinition
} from './schema';
