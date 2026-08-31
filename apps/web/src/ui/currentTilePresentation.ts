import type {
  GameContent,
  TechnicalSliceContent
} from '@bigmoney/game-content';
import { formatInternalMoney } from '@bigmoney/game-core';

type BoardContent = GameContent | TechnicalSliceContent;

export interface CurrentTilePresentation {
  positionText: string;
  availability: string | null;
  detailText: string | null;
}

export function getCurrentTilePresentation(
  content: BoardContent,
  position: number
): CurrentTilePresentation {
  const tile = content.tiles[position];
  const name = tile?.name ?? '未知地格';

  return {
    positionText: `第 ${position + 1} / ${content.tiles.length} 格 · ${name}`,
    availability: tile?.type === 'RESERVED' ? '暂未开放' : null,
    detailText:
      tile?.type === 'FACILITY'
        ? `公共设施费用 · ${formatInternalMoney(tile.fee)}`
        : null
  };
}
