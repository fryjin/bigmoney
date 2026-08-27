import type {
  GameContent,
  TechnicalSliceContent
} from '@bigmoney/game-content';

type BoardContent = GameContent | TechnicalSliceContent;

export interface CurrentTilePresentation {
  positionText: string;
  availability: string | null;
}

export function getCurrentTilePresentation(
  content: BoardContent,
  position: number
): CurrentTilePresentation {
  const tile = content.tiles[position];
  const name = tile?.name ?? '未知地格';

  return {
    positionText: `第 ${position + 1} / ${content.tiles.length} 格 · ${name}`,
    availability: tile?.type === 'RESERVED' ? '暂未开放' : null
  };
}
