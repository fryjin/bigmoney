# Codex Task：Phase 3.1 Public Facility Activation

## 阶段目标

在正式 36 格地图中激活两个公共设施，并复用既有 `ForcedPayment → Liquidation → Bankruptcy` 链路；保持 2、3、4 名同设备本地玩家、36 格地图、既有经济与回合/交接边界。

`docs/rules-baseline.md` 定义冻结产品规则；本任务书定义 Phase 3.1 实施范围；`AGENTS.md` 定义工程架构、数据流与实施边界。上述项目级约束与当前 Phase 3.1 taskbook 始终高于外部 Skill 建议。

## 冻结公共设施合同

| Index | 类型 | 名称 | Fee |
| --- | --- | --- | --- |
| 14 | `FACILITY` | 城市服务中心 | 30 internal（300 万元） |
| 25 | `FACILITY` | 中央枢纽 | 50 internal（500 万元） |

- 仅在最终落地 `FACILITY` 时收费；经过不收费。
- 收款方是公共系统/银行，`receiverId = null`。
- `FACILITY` 不是可购买、拥有、升级、收租或清算的资产。
- 费用只来自规范 tile 内容：`type: "FACILITY"` 与正整数 `fee`；不新增 `facilityId`、独立 `facilities[]` 配置或 Facility ownership 系统。

### Map type contract

- 14、25 从 Phase 3.0 的 `RESERVED + reservedKind: FACILITY` 正式变为 `FACILITY`。
- 最终 36 格计数：20 `PROPERTY`、4 `EVENT`、3 `CARD`、2 `STOCK`、2 `FACILITY`、3 `RESERVED`、1 `START`、1 `FINISH`。
- 9 `JAIL`、18 `PROJECT`、27 `MINIGAME` 继续是 `RESERVED`、显示正式名称和“暂未开放”、作为 no-op destination 后正常结束回合。

## Forced Payment 合同

公共设施正式使用：

```text
ForcedPayment
→ Liquidation
→ Bankruptcy
```

`PUBLIC_FEE` payment 必须包含：

- `reason = "PUBLIC_FEE"`
- `receiverId = null`
- `amount = tile.fee`
- `tileId = tile.id`

`tileId` 是 Persistence validation、Vue 债务来源与表现的规范来源。不得新增 `FacilityInteraction`、Facility debt model、Facility XState state、Facility 专属 DomainEvent 或 Flow command。

### 现金与结算边界

- `cash > fee`：直接支付。
- `cash === fee`：支付后现金为 0，不破产。
- `cash < fee`：进入既有 liquidation。
- 清算后足够：完成付款。
- 现金与所有可清算地产仍不足：进入既有 bankruptcy；股票不即时清算。
- 不新增贷款。

## DomainEvent 与 Flow

复用 `PAYMENT_REQUESTED`、`PAYMENT_COMPLETED`、`LIQUIDATION_REQUIRED`、`PROPERTY_LIQUIDATED`、`PLAYER_BANKRUPT` 与 `GAME_FINISHED`。`RENT_PAID` 继续仅用于 `RENT`。

表现以 `event.payment.reason === "PUBLIC_FEE"` 识别公共设施付款。Flow 不新增 XState state、Flow command 或业务 transition：直接付款回到 `turnReady`；清算进入 `awaitingLiquidation`；破产复用既有 handoff/winner 路径。若需要 cue，只允许补充 `PUBLIC_FEE` payment 的表现路由。

## Lap 顺序

规则顺序只在 Core 执行。逐格 movement 发生 `FINISH → START` 时先获得 80 internal（800 万元）；在后续新的合法最终落点为 `FACILITY` 时，才结算设施费用。Vue 与 Phaser 不得计算该顺序。

## Persistence v4 合同

- 保持 Schema v4 与 `boardVersion = "full-map-36-v1"`。
- 不升级 schema、不修改 boardVersion、不 quarantine Phase 3.0 v4 save、不 remap position。
- 旧 v4 稳定存档恢复时，若玩家已在 14 或 25 且 destination 已结束，不得补扣设施费；费用只由新的 `RESOLVE_DESTINATION` 触发。
- `awaitingLiquidation` 的 `PUBLIC_FEE` 必须可稳定 save/reload。validator 必须验证 `reason`、`receiverId`、`tileId`、对应 `tile.type === "FACILITY"` 与 `amount === tile.fee`；reload 不得重新生成 payment、重新 resolve destination 或重复收费。

## 表现合同

Vue 必须将设施显示为：

- 城市服务中心：公共设施费用，需支付 300 万元。
- 中央枢纽：公共设施费用，需支付 500 万元。

现金不足时复用既有 liquidation UI，并明确债务来源，例如“公共设施费用 · 城市服务中心”。不得新增设施所有权、购买按钮或专属清算弹窗。

Phaser 为 14/25 使用 `facility` presentation tone；允许轻量颜色、图标或 label，但不新增正式建筑资产或设施动画系统。Phaser 不得计算费用、修改现金或判断破产。

## 架构护栏

所有领域结果继续遵循：

```text
UI / Scene Input
→ GameCommand
→ XState Flow Guard
→ Game Core
→ DomainEvent
→ GameState
→ PresentationCue
→ Phaser / Vue
→ PRESENTATION_DONE
```

动画只消费 `PresentationCue`，不得决定游戏状态。Vue、Phaser 与测试工具都不能创建第二份 canonical `GameState`，也不能绕过 XState 或 Game Core。

## 明确不做

- JAIL、PROJECT、MINIGAME 规则。
- 地产经济、股票规则、卡牌规则、事件经济、lap reward、初始资金或玩家 roster 修改。
- 贷款、拍卖、Facility ownership、upgrade、rent 或 liquidatable Facility asset。
- 正式地图美术、依赖升级、Persistence schema/boardVersion 升级。

## 实施步骤

### Step 0 — Documentation Contract

创建本任务书，并将项目当前阶段入口切换到 Phase 3.1；不修改业务代码、测试或 `docs/rules-baseline.md`。

### Step 1 — Content + Core Facility Activation

实现 `FACILITY` schema、14/25 fee、类型计数、剩余 `RESERVED` 与 Core 的 `PUBLIC_FEE tileId`、落点收费、ForcedPayment、liquidation、bankruptcy/winner 测试。

### Step 2 — Persistence + Flow Presentation Routing

实现 `PUBLIC_FEE` validator、`awaitingLiquidation` reload、错误 tile/fee/receiver 拒绝、旧 v4 稳定存档不追缴；Flow 仅补充必要 presentation routing。

### Step 3 — Vue + Phaser Presentation

实现 Facility HUD、费用/债务来源、Phaser `facility` tone，并验证 9/18/27 仍为 `RESERVED`。

### Step 4 — Browser Final Acceptance

验证两处直接付款、经过不收费、余额恰好、清算、破产、bankrupt skip、winner、`PUBLIC_FEE` liquidation reload、旧稳定存档不追缴、剩余 RESERVED no-op、2/3/4 人回归、三个 viewport 与 runtime errors 为 0。

## 验收要求

1. index 14 精确收费 30 internal，index 25 精确收费 50 internal，且仅在最终落地触发。
2. 公共费用完整复用既有 ForcedPayment、Liquidation、Bankruptcy、winner 与 handoff 语义；`cash === fee` 不破产。
3. 公共费用不新增专属 DomainEvent、Flow state 或交互模型；`receiverId = null` 不向玩家加款。
4. v4/full-map-36-v1 存档兼容；旧稳定 14/25 存档不追缴，新 `PUBLIC_FEE` liquidation 可恢复。
5. Vue/Phaser 只表现内容、状态与 cue；9/18/27 保持 no-op RESERVED。
6. Browser 验收覆盖 390×844、1194×834、1440×900，关键 UI 无回归且 runtime errors 为 0。
7. 每个实施步骤完成前运行相关 workspace tests、`npm.cmd run check` 与 `git diff --check`，并报告测试、风险和 diff。
