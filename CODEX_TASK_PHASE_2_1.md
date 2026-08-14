# Codex Task：Phase 2.1 Full 2–4 Player Local Game

## 阶段目标

在既有 8-node technical slice 中，将当前两人技术切片升级为正式支持 2、3、4 名玩家的同设备本地完整对局：新游戏选择人数、固定顺序轮流行动、显式设备交接与隐私保护、既有地产/股票/卡牌/事件、强制付款/清算/破产、跳过破产玩家、最后一名存活玩家获胜，以及稳定存档与恢复。

`docs/rules-baseline.md` 定义冻结产品规则；本任务书定义 Phase 2.1 实施范围；`AGENTS.md` 定义工程架构、数据流与实施边界。项目级约束始终高于外部 Skill。

## 冻结 Product Decisions

### PLAYER_TRANSFER

- 三/四人局中，付款方为当前玩家之后、按 canonical `players` 固定顺序找到的下一名未破产玩家；自动跳过破产玩家，必要时 wrap-around。
- 不随机选择、不允许手动选择、不选择最富玩家、不平摊。
- 保持独立的既有金额语义：`transferable = min(event amount, payer cash)`。
- 付款方现金不足时，最多支付当前现金；现金可以降为 0；不进入 liquidation、不触发 bankruptcy、不进入 Forced Payment，未支付部分不产生债务。
- `PLAYER_TRANSFER` 不属于 Phase 2.0A Forced Payment 系统。事件文案必须清楚表达上述自动付款方规则。

### New Game 与默认 roster

- New Game 只可选择 `2 players`、`3 players` 或 `4 players`；不提供名字、颜色、顺序或头像编辑，不做 lobby。
- 正式 canonical roster 只能在 Game Core 定义一次：

| ID | 名字 | 颜色 |
| --- | --- | --- |
| P1 | 玩家一 | `#E87868` |
| P2 | 玩家二 | `#4F8FB8` |
| P3 | 玩家三 | `#7E68B8` |
| P4 | 玩家四 | `#5E9B72` |

- 固定顺序为 `P1 → P2 → P3 → P4`；两人局使用前两名，三人局使用前三名，四人局使用全部 roster。
- Vue、Phaser 与 browser fixtures 只能消费 Core roster，不能各自复制业务 roster。

### 已有存档时重新开始

- 存在合法存档时，入口必须提供“继续游戏”或“重新开始”。
- 点击“重新开始”先进入 New Game Setup；选择人数后，明确显示“开始新游戏将覆盖当前存档”。
- 用户点击“覆盖存档并开始”后，才清除旧存档并创建新 session；不新增第二层确认 Modal。
- 无旧存档时，入口使用普通“开始游戏”。

### Persistence

- 继续使用 Schema v3，不升级 Schema v4。
- `GameState.players[]` 是 canonical roster；不得额外保存 `playerCount` 形成第二真实来源。
- v3 validation 必须要求 `2 <= players.length <= 4`；历史合法两人存档继续支持。

## 本阶段范围

- 继续使用当前 8-node technical slice；不扩展为 36 格地图。
- 正式支持 2/3/4 名玩家的建局、顺序轮转、显式 handoff、交接隐私、破产跳过、winner/finished 和稳定恢复。
- 保持现有 property、stock、card、event、forced payment、liquidation 与 bankruptcy 规则；所有领域 mutation 继续走：

```text
UI/场景输入
→ GameCommand
→ XState Flow Guard
→ Game Core
→ DomainEvent
→ GameState
→ PresentationCue
→ Phaser/Vue 表现
→ PRESENTATION_DONE
```

## 明确不做

- 36 tile map、监狱完整规则、合作项目、小游戏、完整攻击/防御卡响应、公共设施地图整合。
- 正式美术替换、经济重平衡、AI 玩家、联网/后端、交易、贷款、拍卖、抵押。
- 第二套 GameState、绕过 XState 或 Game Core 的测试/展示后门。

## 层级边界

### Game Core

- Core 是唯一的 roster 定义与 2–4 人建局校验来源；`GameState.players[]` 保持唯一真实状态。
- 使用既有 active-player helpers、winner、股票结算、Forced Payment、liquidation 与 bankruptcy 规则；不在 Vue、Phaser 或 Flow 重算。
- `PLAYER_TRANSFER` 依冻结规则选择付款方，并保持独立的 best-effort 付款语义。

### Game Flow / XState

- Flow 只编排 command、DomainEvent、PresentationCue、handoff、restore 与重复提交保护。
- 不在 XState action 中重算下一名存活玩家、租金、清算、破产或胜者。
- 稳定恢复状态仅为 `turnReady`、`awaitingHandoff`、`awaitingLiquidation`、`finished`。

### Persistence

- 仅保存稳定状态；恢复不得重放付款、清算、破产或完成事件。
- 继续使用 Schema v3；结构校验覆盖人数、唯一 ID、active player、资产 owner、payment 引用、winner 与 handoff 引用。
- 损坏存档必须隔离，不能强制解析。

### Vue / Phaser

- Vue 负责 New Game Setup、信息展示、玩家决定和交接隐私；不持有 canonical 游戏状态。
- Phaser 只消费 `GameState` 与 `PresentationCue`；四名玩家必须有确定性棋子站位、所有权颜色与破产表现，不新增正式美术资源。
- 交接期间继续隐藏手牌、持仓与当前玩家资产入口；所有领域按钮保留重复点击保护。

### Browser tests

- 继续使用 Playwright、Chrome channel、截图、console/runtime 检查、`render_game_to_text()` 与 deterministic fixtures。
- fixture 只能在 `browser-test` mode 下由固定白名单名称选择；必须使用现有 `GameState` 和 Core factory，不能暴露 mutation API 或直接篡改运行中的 canonical state。
- 合法 Persistence save 优先于 fixture；reload 必须验证产品 Persistence 路径。

## 验收要求

1. 正式 New Game 可选择 2、3、4 名玩家，并创建固定 canonical roster。
2. 正常回合、round wrap、显式 handoff 与交接隐私适用于 2/3/4 人。
3. `PLAYER_TRANSFER` 按固定顺序选择下一名未破产玩家，并覆盖 skip/wrap/现金不足的独立付款语义。
4. 强制付款、清算、破产、连续 bankrupt skip、最后一名胜者和 `finished` 保持 Core 驱动。
5. Schema v3 在四种稳定状态正确保存/恢复 2/3/4 人；旧两人存档继续可恢复。
6. 浏览器回归覆盖 2/3/4 人、多人 handoff、破产跳过、winner、reload、duplicate submit、privacy、console/runtime。
7. 真实浏览器截图覆盖 390×844、1194×834、1440×900；保持既定 60 FPS 目标、质量档位与真实设备验收标准。
8. 完成前运行 `npm.cmd run codex:preflight`、`npm.cmd run check`、`git diff --check`，并报告测试、风险与 diff。
