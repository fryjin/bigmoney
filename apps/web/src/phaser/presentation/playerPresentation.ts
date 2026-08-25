import type { VisualAssetId } from '../assets/visualAssetRegistry';

type PawnTexture = Extract<VisualAssetId, 'pawn-cat' | 'pawn-bear'>;

interface PawnSlotOffset {
  x: number;
  y: number;
}

interface BoardPosition {
  x: number;
  y: number;
}

const PAWN_TEXTURES: readonly PawnTexture[] = ['pawn-cat', 'pawn-bear'];

const PAWN_SLOT_OFFSETS: Record<2 | 3 | 4, readonly PawnSlotOffset[]> = {
  2: [
    { x: -14, y: 0 },
    { x: 16, y: 5 }
  ],
  3: [
    { x: -20, y: -5 },
    { x: 20, y: 0 },
    { x: 0, y: 25 }
  ],
  4: [
    { x: -20, y: -5 },
    { x: 20, y: 0 },
    { x: -20, y: 25 },
    { x: 20, y: 30 }
  ]
};

const PAWN_DEPTH_OFFSET = 44;
const DISPLAY_COLOR_FALLBACK = 0x4a9a7f;

export function getPawnTexture(playerIndex: number): PawnTexture {
  return PAWN_TEXTURES[playerIndex % PAWN_TEXTURES.length] ?? 'pawn-cat';
}

export function getPawnDisplayPosition(
  tilePosition: BoardPosition,
  playerIndex: number,
  playerCount: number
): BoardPosition {
  const slots = PAWN_SLOT_OFFSETS[playerCount as 2 | 3 | 4] ?? PAWN_SLOT_OFFSETS[2];
  const offset = slots[playerIndex] ?? slots[0]!;

  return {
    x: tilePosition.x + offset.x,
    y: tilePosition.y + offset.y
  };
}

export function getPawnDisplayDepth(positionY: number, playerIndex: number): number {
  return positionY + PAWN_DEPTH_OFFSET + playerIndex * 0.01;
}

export function shouldShowActivePlayerRing<T extends { bankrupt: boolean }>(
  status: 'IN_PROGRESS' | 'FINISHED',
  player: T | undefined
): player is T {
  return status === 'IN_PROGRESS' && player !== undefined && !player.bankrupt;
}

export function toPhaserDisplayColor(color: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return DISPLAY_COLOR_FALLBACK;
  return Number.parseInt(color.slice(1), 16);
}
