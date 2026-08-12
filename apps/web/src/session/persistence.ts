import { technicalSliceContent } from '@bigmoney/game-content';
import type {
  CardInstance,
  DomainEvent,
  ForcedPayment,
  GameState,
  PlayerState,
  StockHolding
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
export const CURRENT_SAVE_SCHEMA_VERSION = 3 as const;

const LEGACY_SAVE_SCHEMA_VERSION = 2 as const;
const EVENT_SESSION = 'technical-slice-phase-1.1';

type SavePayload = Omit<TechnicalSliceSave, 'integrity'>;
type LegacyGameState = Omit<GameState, 'status' | 'winnerId'>;
type LegacyFlowPhase = Extract<StableFlowPhase, 'turnReady' | 'awaitingHandoff'>;
type LegacySavePayloadV2 = Omit<LegacyTechnicalSliceSaveV2, 'integrity'>;

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
  game: LegacyGameState;
  random: RandomSnapshot;
  savedAt: string;
}

interface LegacyTechnicalSliceSaveV2 {
  schemaVersion: typeof LEGACY_SAVE_SCHEMA_VERSION;
  game: LegacyGameState;
  random: RandomSnapshot;
  flow: LegacyFlowPhase;
  handoffFromPlayerId: string | null;
  savedAt: string;
  integrity: string;
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

  if (!isRecord(raw)) {
    return recoverInvalidSave(raw, '存档不是对象。');
  }

  if (raw.schemaVersion === 1) {
    const validationError = validateSaveV1(raw);
    if (validationError) return recoverInvalidSave(raw, validationError);

    return migrateLegacySave(
      raw as unknown as LegacyTechnicalSliceSaveV1,
      'turnReady',
      null
    );
  }

  if (raw.schemaVersion === LEGACY_SAVE_SCHEMA_VERSION) {
    const validationError = validateSaveV2(raw);
    if (validationError) return recoverInvalidSave(raw, validationError);

    const legacySave = raw as unknown as LegacyTechnicalSliceSaveV2;
    return migrateLegacySave(
      legacySave,
      legacySave.flow,
      legacySave.handoffFromPlayerId
    );
  }

  if (raw.schemaVersion !== CURRENT_SAVE_SCHEMA_VERSION) {
    return recoverInvalidSave(raw, '存档版本无法识别。');
  }

  const validationError = validateSaveV3(raw);
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
  const normalizedHandoffFromPlayerId =
    flow === 'awaitingHandoff' ? handoffFromPlayerId : null;
  const validationError =
    validateStableFlowGameState(game, flow) ??
    validateHandoffFromPlayerId(
      game,
      flow,
      normalizedHandoffFromPlayerId
    ) ??
    validateRandom(random);

  if (validationError) {
    throw new Error(`拒绝写入非稳定存档：${validationError}`);
  }

  const save = createSave(
    game,
    random,
    flow,
    normalizedHandoffFromPlayerId,
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

async function migrateLegacySave(
  legacySave: LegacyTechnicalSliceSaveV1 | LegacyTechnicalSliceSaveV2,
  flow: LegacyFlowPhase,
  handoffFromPlayerId: string | null
): Promise<TechnicalSliceLoadResult> {
  const migrated = createSave(
    {
      ...structuredClone(legacySave.game),
      status: 'IN_PROGRESS',
      winnerId: null
    },
    legacySave.random,
    flow,
    handoffFromPlayerId,
    legacySave.savedAt
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
    message: '旧版存档已安全升级到 Schema v3。',
    migrated: true
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

function validateSaveV1(value: Record<string, unknown>): string | null {
  if (value.schemaVersion !== 1) return '存档版本不匹配。';
  if (typeof value.savedAt !== 'string' || Number.isNaN(Date.parse(value.savedAt))) {
    return '存档时间无效。';
  }

  return validateLegacyStableGameState(value.game) ?? validateRandom(value.random);
}

function validateSaveV2(value: Record<string, unknown>): string | null {
  if (value.schemaVersion !== LEGACY_SAVE_SCHEMA_VERSION) {
    return '存档版本不匹配。';
  }
  if (value.flow !== 'turnReady' && value.flow !== 'awaitingHandoff') {
    return '旧版存档流程状态无效。';
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

  const gameError = validateLegacyStableGameState(value.game);
  if (gameError) return gameError;

  const game = value.game as LegacyGameState;
  const handoffError = validateLegacyHandoffFromPlayerId(
    game,
    value.flow,
    value.handoffFromPlayerId
  );
  if (handoffError) return handoffError;

  const randomError = validateRandom(value.random);
  if (randomError) return randomError;

  const payload: LegacySavePayloadV2 = {
    schemaVersion: LEGACY_SAVE_SCHEMA_VERSION,
    game,
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

function validateSaveV3(value: Record<string, unknown>): string | null {
  if (value.schemaVersion !== CURRENT_SAVE_SCHEMA_VERSION) {
    return '存档版本不匹配。';
  }
  if (!isStableFlowPhase(value.flow)) return '存档流程状态无效。';
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

  const gameError = validateStableFlowGameState(value.game, value.flow);
  if (gameError) return gameError;

  const game = value.game as GameState;
  const handoffError = validateHandoffFromPlayerId(
    game,
    value.flow,
    value.handoffFromPlayerId
  );
  if (handoffError) return handoffError;

  const randomError = validateRandom(value.random);
  if (randomError) return randomError;

  const payload: SavePayload = {
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    game,
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

function validateStableFlowGameState(
  value: unknown,
  flow: StableFlowPhase
): string | null {
  const structureError = validateGameStateStructure(value, true);
  if (structureError) return structureError;

  const game = value as GameState;
  if (flow === 'finished') return validateFinishedGameState(game);

  if (game.status !== 'IN_PROGRESS' || game.winnerId !== null) {
    return '进行中的稳定存档必须没有获胜者。';
  }

  const activePlayer = game.players[game.activePlayerIndex];
  if (!activePlayer || activePlayer.bankrupt) {
    return '进行中的稳定存档当前玩家必须仍可行动。';
  }

  if (flow === 'awaitingLiquidation') {
    return validateLiquidationInteraction(game);
  }

  if (game.pendingInteraction !== null) {
    return '稳定存档不能包含待处理交互。';
  }

  return validateIdleTurn(game.turn);
}

function validateFinishedGameState(game: GameState): string | null {
  if (game.status !== 'FINISHED') return '已结束存档必须标记为 FINISHED。';
  if (typeof game.winnerId !== 'string' || game.winnerId.length === 0) {
    return '已结束存档必须包含获胜者。';
  }
  if (game.pendingInteraction !== null) {
    return '已结束存档不能包含待处理交互。';
  }

  const activePlayers = game.players.filter((player) => !player.bankrupt);
  if (activePlayers.length !== 1 || activePlayers[0]?.id !== game.winnerId) {
    return '已结束存档的获胜者与存活玩家不一致。';
  }

  return null;
}

function validateLiquidationInteraction(game: GameState): string | null {
  const interaction = game.pendingInteraction;
  if (!isRecord(interaction) || interaction.type !== 'LIQUIDATION') {
    return '清算存档必须包含规范的清算债务。';
  }
  if ('selectedPropertyIds' in interaction || 'pendingPayment' in interaction) {
    return '清算存档不能保存界面选择或重复债务。';
  }
  if (typeof interaction.playerId !== 'string' || interaction.playerId.length === 0) {
    return '清算付款玩家无效。';
  }

  const activePlayer = game.players[game.activePlayerIndex];
  const payer = game.players.find((player) => player.id === interaction.playerId);
  if (
    !activePlayer ||
    interaction.playerId !== activePlayer.id ||
    !payer ||
    payer.bankrupt
  ) {
    return '清算付款玩家必须是当前存活玩家。';
  }

  return validateForcedPayment(interaction.payment, game.players, interaction.playerId);
}

function validateForcedPayment(
  value: unknown,
  players: PlayerState[],
  interactionPayerId: string
): string | null {
  if (!isRecord(value)) return '清算债务无效。';
  if (typeof value.id !== 'string' || value.id.length === 0) {
    return '清算 paymentId 无效。';
  }
  if (value.payerId !== interactionPayerId) return '清算付款方不一致。';
  if (!isFiniteNumber(value.amount) || value.amount <= 0) {
    return '清算金额无效。';
  }

  const receiverId = value.receiverId;
  if (
    receiverId !== null &&
    (typeof receiverId !== 'string' ||
      !players.some((player) => player.id === receiverId) ||
      receiverId === interactionPayerId)
  ) {
    return '清算收款方无效。';
  }

  if (value.reason === 'RENT') {
    if (receiverId === null || typeof value.propertyId !== 'string' || value.propertyId.length === 0) {
      return '租金清算债务无效。';
    }
    return null;
  }
  if (value.reason === 'EVENT_EXPENSE') {
    if (
      receiverId !== null ||
      typeof value.eventId !== 'string' ||
      value.eventId.length === 0 ||
      typeof value.title !== 'string' ||
      typeof value.description !== 'string'
    ) {
      return '事件费用清算债务无效。';
    }
    return null;
  }
  if (value.reason === 'PUBLIC_FEE') {
    return receiverId === null ? null : '公共费用清算债务无效。';
  }

  return '清算债务原因无效。';
}

function validateHandoffFromPlayerId(
  game: GameState,
  flow: StableFlowPhase,
  handoffFromPlayerId: string | null
): string | null {
  if (flow !== 'awaitingHandoff') {
    return handoffFromPlayerId === null ? null : '非交接存档不能保留交接来源。';
  }

  const activePlayerId = game.players[game.activePlayerIndex]?.id;
  if (
    typeof handoffFromPlayerId !== 'string' ||
    !game.players.some((player) => player.id === handoffFromPlayerId) ||
    handoffFromPlayerId === activePlayerId
  ) {
    return '玩家交接来源与当前玩家不一致。';
  }

  return null;
}

function validateLegacyHandoffFromPlayerId(
  game: LegacyGameState,
  flow: LegacyFlowPhase,
  handoffFromPlayerId: unknown
): string | null {
  if (flow !== 'awaitingHandoff') {
    return handoffFromPlayerId === null ? null : '回合开始存档不能保留交接来源。';
  }

  const activePlayerId = game.players[game.activePlayerIndex]?.id;
  if (
    typeof handoffFromPlayerId !== 'string' ||
    !game.players.some((player) => player.id === handoffFromPlayerId) ||
    handoffFromPlayerId === activePlayerId
  ) {
    return '玩家交接来源与当前玩家不一致。';
  }

  return null;
}

function validateLegacyStableGameState(value: unknown): string | null {
  const structureError = validateGameStateStructure(value, false);
  if (structureError) return structureError;

  const game = value as LegacyGameState;
  if (game.pendingInteraction !== null) {
    return '旧版稳定存档不能包含待处理交互。';
  }

  return validateIdleTurn(game.turn);
}

function validateGameStateStructure(
  value: unknown,
  requireStatus: boolean
): string | null {
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
  if (
    requireStatus &&
    value.status !== 'IN_PROGRESS' &&
    value.status !== 'FINISHED'
  ) {
    return '游戏状态无效。';
  }
  if (
    requireStatus &&
    value.winnerId !== null &&
    (typeof value.winnerId !== 'string' || value.winnerId.length === 0)
  ) {
    return '获胜者无效。';
  }
  if (!isPositiveInteger(value.round)) return '大轮编号无效。';
  if (!Array.isArray(value.players) || value.players.length < 2) {
    return '玩家列表无效。';
  }
  if (!isInteger(value.activePlayerIndex)) return '当前玩家索引无效。';
  if (value.activePlayerIndex < 0 || value.activePlayerIndex >= value.players.length) {
    return '当前玩家索引越界。';
  }

  const playerIds = new Set<string>();
  for (const player of value.players) {
    const playerError = validatePlayer(player);
    if (playerError) return playerError;
    const playerId = (player as PlayerState).id;
    if (playerIds.has(playerId)) return '玩家 ID 重复。';
    playerIds.add(playerId);
  }

  if (!isRecord(value.properties)) return '地产状态无效。';
  for (const [propertyId, property] of Object.entries(value.properties)) {
    const propertyError = validateProperty(propertyId, property, playerIds);
    if (propertyError) return propertyError;
  }

  const turnError = validateTurn(value.turn);
  if (turnError) return turnError;
  if (!('pendingInteraction' in value)) return '待处理交互字段缺失。';
  if ('pendingPayment' in value || 'selectedPropertyIds' in value) {
    return 'GameState 不能保存重复债务或界面选择。';
  }
  if (!isPositiveInteger(value.nextInstanceSequence)) return '实例序列号无效。';

  return null;
}

function validateTurn(value: unknown): string | null {
  if (!isRecord(value)) return '回合状态无效。';
  if (
    value.rolledValue !== null &&
    (!isInteger(value.rolledValue) || value.rolledValue < 1 || value.rolledValue > 6)
  ) {
    return '骰子结果无效。';
  }
  if (!isInteger(value.remainingSteps) || value.remainingSteps < 0) {
    return '剩余步数无效。';
  }
  if (
    !Array.isArray(value.triggeredStockMarkets) ||
    !value.triggeredStockMarkets.every(
      (marketId) => typeof marketId === 'string'
    )
  ) {
    return '股票路径记录无效。';
  }
  if (typeof value.readyToEnd !== 'boolean') return '回合结束状态无效。';

  return null;
}

function validateIdleTurn(value: GameState['turn']): string | null {
  if (value.rolledValue !== null) return '稳定存档不能包含已掷出的骰子。';
  if (value.remainingSteps !== 0) return '稳定存档不能包含剩余步数。';
  if (value.readyToEnd !== false) return '稳定存档不能停留在待结束状态。';

  return null;
}

function validatePlayer(value: unknown): string | null {
  if (!isRecord(value)) return '玩家状态不是对象。';
  if (typeof value.id !== 'string' || value.id.length === 0) return '玩家 ID 无效。';
  if (typeof value.name !== 'string' || value.name.length === 0) return '玩家名称无效。';
  if (typeof value.color !== 'string' || value.color.length === 0) return '玩家颜色无效。';
  if (!isFiniteNumber(value.cash)) return '玩家现金无效。';
  if (!isInteger(value.position)) return '玩家位置无效。';
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
  if (value.id !== propertyId) return `地产 ${propertyId} 的 ID 不一致。`;
  if (
    value.ownerId !== null &&
    (typeof value.ownerId !== 'string' || !playerIds.has(value.ownerId))
  ) {
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
  if (!isInteger(value.state) || value.state < 0) return '随机状态无效。';
  return null;
}

function isStableFlowPhase(value: unknown): value is StableFlowPhase {
  return (
    value === 'turnReady' ||
    value === 'awaitingHandoff' ||
    value === 'awaitingLiquidation' ||
    value === 'finished'
  );
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
    isInteger(value.remainingRounds) &&
    value.remainingRounds >= 0 &&
    isPositiveInteger(value.purchasedRound)
  );
}

function createIntegrity(payload: SavePayload | LegacySavePayloadV2): string {
  const text = JSON.stringify(payload);
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isPositiveInteger(value: unknown): value is number {
  return isInteger(value) && value > 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '未知存储错误';
}
