import { z } from 'zod';

export const mapNodeSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  next: z.string().min(1)
});

export const technicalMapSchema = z.object({
  configVersion: z.string().min(1),
  mapId: z.string().min(1),
  orientation: z.literal('isometric'),
  nodes: z.array(mapNodeSchema).min(2)
});

export type TechnicalMap = z.infer<typeof technicalMapSchema>;
