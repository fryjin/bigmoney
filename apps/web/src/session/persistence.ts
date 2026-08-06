import { technicalSliceContent } from '@bigmoney/game-content';
import type {
  DomainEvent,
  GameState,
  PlayerState,
  StockHolding,
  CardInstance
} from '@bigmoney/game-core';
import type { RandomSnapshot } from '@bigmoney/game-random';
import type { StableFlowPhase } from '@bigmoney/game-flow';
import {
  appendEvent,
  deleteSnapshot,
  loadSnapshot,
  saveSnapshot
} from '@bigmoney/game-storage';

export const TECHNICAL_SLICE_SAVE_SLOT = 'technical-slice-phase-1.1';
export const TECHNICAL_SLICE_QUARANTINE_SLOT = 'technical-slice-quarantine-latest';
export const CURRENT_SAVE_SCHEMA_VERSION = 2 as const;

const EVENT_SESSION = 'technical-slice-phase-1.1';

type SavePayload = Omit<TechnicalSliceSave, 'integrity'>;

export interface TechnicalSliceSave {
  schemaVersion: typeof CURRENT_SAVE_SCHEMA_VERSION;
  game: GameState;
  random: RandomSnapshot;
  flow: StableFlowPhase;
  handoffFromPlayerId: string | null;
  savedAt: string;
  integrity: string;
}

interface LegacyTechnicalSliceSaveV1 {
  schemaVersion: 1;
  game: GameState;
  random: RandomSnapshot;
  savedAt: string;
}

export type TechnicalSliceLoadResult =
  | {
      status: 'empty';
      save: null;
      message: null;
      migrated: false;
    }
  | {
      status: 'ready';
      save: TechnicalSliceSave;
      message: string | null;
      migrated: boolean;
    }
  | {
      status: 'recovered';
      save: null;
      message: string;
      migrated: false;
    };

export async function loadTechnicalSliceSave(): Promise<TechnicalSliceLoadResult> {
  let raw: unknown;

  try {
    raw = await loadSnapshot<unknown>(TECHNICAL_SLICE_SAVE_SLOT);
  } catch (error) {
    return {
      status: 'recovered',
      save: null,
      message: `无法读取本地存档，已使用新游戏启动：${errorMessage(error)}`,
      migrated: false
    };
  }

  if (raw === null) {
    return {
      status: 'empty',
      save: null,
      message: null,
      migrated: false
    };
  }

  if (isLegacySaveV1(raw)) {
    const validationError = validateStableGameState(raw.game) ?? validateRandom(raw.random);
    if (validationError) return recoverInvalidSave(raw, validationError);

    const migrated = createSave(
      raw.game,
      raw.random,
      'turnReady',
      null,
      normalizeSavedAt(raw.savedAt)
    );

    try {
      await saveSnapshot(TECHNICAL_SLICE_SAVE_SLOT, migrated);
    } catch (error) {
      return {
        status: 'recovered',
        save: null,
        message: `旧版存档有效，但迁移写入失败，已使用新游戏启动：${errorMessage(error)}`,
        migrated: false
      };
    }

    return {
      status: 'ready',
      save: migrated,
      message: '旧版存档已安全升级到 Phase 1.4。',
      migrated: true
    };
  }

  if (!isRecord(raw) || raw.schemaVersion !== CURRENT_SAVE_SCHEMA_VERSION) {
    return recoverInvalidSave(raw, '存档版本无法识别。');
  }

  const validationError = validateSaveV2(raw);
  if (validationError) return recoverInvalidSave(raw, validationError);

  return {
    status: 'ready',
    save: raw as unknown as TechnicalSliceSave,
    message: null,
    migrated: false
  };
}

export async function saveTechnicalSliceSave(
  game: GameState,
  random: RandomSnapshot,
  flow: StableFlowPhase,
  handoffFromPlayerId: string | null = null
): Promise<TechnicalSliceSave> {
  const validationError = validateStableGameState(game) ?? validateRandom(random);
  if (validationError) {
    throw new Error(`拒绝写入非稳定存档：${validationError}`);
  }

  if (flow === 'awaitingHandoff') {
    const activePlayerId = game.players[game.activePlayerIndex]?.id;
    const handoffPlayerExists = game.players.some(
      (player) => player.id === handoffFromPlayerId
    );
    if (
      !handoffFromPlayerId ||
      !handoffPlayerExists ||
      handoffFromPlayerId === activePlayerId
    ) {
      throw new Error('拒绝写入交接来源无效的存档。');
    }
  }

  const save = createSave(
    game,
    random,
    flow,
    flow === 'awaitingHandoff' ? handoffFromPlayerId : null,
    new Date().toISOString()
  );

  await saveSnapshot(TECHNICAL_SLICE_SAVE_SLOT, save);
  return save;
}

export async function logDomainEvents(events: DomainEvent[]): Promise<void> {
  for (const event of events) {
    await appendEvent(EVENT_SESSION, event);
  }
}

export async function clearTechnicalSliceSave(): Promise<void> {
  await Promise.all([
    deleteSnapshot(TECHNICAL_SLICE_SAVE_SLOT),
    deleteSnapshot(TECHNICAL_SLICE_QUARANTINE_SLOT)
  ]);
}

function createSave(
  game: GameState,
  random: RandomSnapshot,
  flow: StableFlowPhase,
  handoffFromPlayerId: string | null,
  savedAt: string
): TechnicalSliceSave {
  const payload: SavePayload = {
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    game: structuredClone(game),
    random: structuredClone(random),
    flow,
    handoffFromPlayerId,
    savedAt
  };

  return {
    ...payload,
    integrity: createIntegrity(payload)
  };
}

async function recoverInvalidSave(
  raw: unknown,
  reason: string
): Promise<TechnicalSliceLoadResult> {
  try {
    await saveSnapshot(TECHNICAL_SLICE_QUARANTINE_SLOT, {
      recoveredAt: new Date().toISOString(),
      reason,
      payload: raw
    });
    await deleteSnapshot(TECHNICAL_SLICE_SAVE_SLOT);
  } catch {
    // 即使隔离写入失败，也必须允许应用以新游戏启动。
  }

  return {
    status: 'recovered',
    save: null,
    message: `检测到不可用存档，已隔离并使用新游戏启动：${reason}`,
    migrated: false
  };
}

function validateSaveV2(value: Record<string, unknown>): string | null {
  if (value.schemaVersion !== CURRENT_SAVE_SCHEMA_VERSION) return '存档版本不匹配。';
  if (value.flow !== 'turnReady' && value.flow !== 'awaitingHandoff') {
    return '存档流程状态无效。';
  }
  if (
    value.handoffFromPlayerId !== null &&
    typeof value.handoffFromPlayerId !== 'string'
  ) {
    return '玩家交接来源无效。';
  }
  if (typeof value.savedAt !== 'string' || Number.isNaN(Date.parse(value.savedAt))) {
    return '存档时间无效。';
  }
  if (typeof value.integrity !== 'string' || value.integrity.length === 0) {
    return '存档完整性标记缺失。';
  }

  const gameError = validateStableGameState(value.game);
  if (gameError) return gameError;

  const game = value.game as GameState;
  const playerIds = new Set(game.players.map((player) => player.id));
  if (value.flow === 'turnReady' && value.handoffFromPlayerId !== null) {
    return '回合开始存档不能保留交接来源。';
  }
  if (
    value.flow === 'awaitingHandoff' &&
    (typeof value.handoffFromPlayerId !== 'string' ||
      !playerIds.has(value.handoffFromPlayerId) ||
      value.handoffFromPlayerId === game.players[game.activePlayerIndex]?.id)
  ) {
    return '玩家交接来源与当前玩家不一致。';
  }

  const randomError = validateRandom(value.random);
  if (randomError) return randomError;

  const payload: SavePayload = {
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    game: value.game as GameState,
    random: value.random as RandomSnapshot,
    flow: value.flow,
    handoffFromPlayerId: value.handoffFromPlayerId,
    savedAt: value.savedAt
  };

  if (createIntegrity(payload) !== value.integrity) {
    return '存档完整性校验失败。';
  }

  return null;
}

function validateStableGameState(value: unknown): string | null {
  if (!isRecord(value)) return 'GameState 不是对象。';
  if (typeof value.ruleVersion !== 'string' || value.ruleVersion.length === 0) {
    return '规则版本缺失。';
  }
  if (
    typeof value.technicalSliceVersion !== 'string' ||
    value.technicalSliceVersion.length === 0
  ) {
    return '技术切片版本缺失。';
  }
  if (!isPositiveInteger(value.round)) return '大轮编号无效。';
  if (!Array.isArray(value.players) || value.players.length < 2) {
    return '玩家列表无效。';
  }
  if (!Number.isInteger(value.activePlayerIndex)) return '当前玩家索引无效。';
  if (value.activePlayerIndex < 0 || value.activePlayerIndex >= value.players.length) {
    return '当前玩家索引越界。';
  }

  const playerIds = new Set<string>();
  for (const player of value.players) {
    const playerError = validatePlayer(player);
    if (playerError) return playerError;
    const playerId = (player as PlayerState).id;
    if (playerIds.has(playerId)) return '玩家ID重复。';
    playerIds.add(playerId);
  }

  if (!isRecord(value.properties)) return '地产状态无效。';
  for (const [propertyId, property] of Object.entries(value.properties)) {
    const propertyError = validateProperty(propertyId, property, playerIds);
    if (propertyError) return propertyError;
  }

  if (!isRecord(value.turn)) return '回合状态无效。';
  if (value.turn.rolledValue !== null) return '稳定存档不能包含已投出的骰子。';
  if (value.turn.remainingSteps !== 0) return '稳定存档不能包含剩余步数。';
  if (!Array.isArray(value.turn.triggeredStockMarkets)) return '股票路径记录无效。';
  if (value.turn.readyToEnd !== false) return '稳定存档不能停留在待结束状态。';
  if (value.pendingInteraction !== null) return '稳定存档不能包含待处理交互。';
  if (!isPositiveInteger(value.nextInstanceSequence)) return '实例序列号无效。';

  return null;
}

function validatePlayer(value: unknown): string | null {
  if (!isRecord(value)) return '玩家状态不是对象。';
  if (typeof value.id !== 'string' || value.id.length === 0) return '玩家ID无效。';
  if (typeof value.name !== 'string' || value.name.length === 0) return '玩家名称无效。';
  if (typeof value.color !== 'string' || value.color.length === 0) return '玩家颜色无效。';
  if (!isFiniteNumber(value.cash)) return '玩家现金无效。';
  if (!Number.isInteger(value.position)) return '玩家位置无效。';
  if (value.position < 0 || value.position >= technicalSliceContent.tiles.length) {
    return '玩家位置越界。';
  }
  if (typeof value.bankrupt !== 'boolean') return '玩家破产状态无效。';
  if (!Array.isArray(value.cards) || !value.cards.every(isCardInstance)) {
    return '玩家手牌结构无效。';
  }
  if (!Array.isArray(value.stocks) || !value.stocks.every(isStockHolding)) {
    return '玩家持仓结构无效。';
  }
  return null;
}

function validateProperty(
  propertyId: string,
  value: unknown,
  playerIds: Set<string>
): string | null {
  if (!isRecord(value)) return `地产 ${propertyId} 状态无效。`;
  if (value.id !== propertyId) return `地产 ${propertyId} 的ID不一致。`;
  if (value.ownerId !== null && !playerIds.has(String(value.ownerId))) {
    return `地产 ${propertyId} 的所有者无效。`;
  }
  if (![0, 1, 2, 3].includes(Number(value.level))) {
    return `地产 ${propertyId} 的等级无效。`;
  }
  return null;
}

function validateRandom(value: unknown): string | null {
  if (!isRecord(value)) return '随机数快照无效。';
  if (value.algorithm !== 'xorshift32') return '随机算法不受支持。';
  if (!Number.isInteger(value.state) || value.state < 0) return '随机状态无效。';
  return null;
}

function isLegacySaveV1(value: unknown): value is LegacyTechnicalSliceSaveV1 {
  return isRecord(value) && value.schemaVersion === 1;
}

function isCardInstance(value: unknown): value is CardInstance {
  return (
    isRecord(value) &&
    typeof value.instanceId === 'string' &&
    typeof value.cardId === 'string'
  );
}

function isStockHolding(value: unknown): value is StockHolding {
  return (
    isRecord(value) &&
    typeof value.holdingId === 'string' &&
    typeof value.stockId === 'string' &&
    isFiniteNumber(value.principal) &&
    [2, 4, 6].includes(Number(value.originalPeriod)) &&
    Number.isInteger(value.remainingRounds) &&
    value.remainingRounds >= 0 &&
    isPositiveInteger(value.purchasedRound)
  );
}

function createIntegrity(payload: SavePayload): string {
  const text = JSON.stringify(payload);
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function normalizeSavedAt(value: string): string {
  return Number.isNaN(Date.parse(value)) ? new Date().toISOString() : value;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '未知存储错误';
}
