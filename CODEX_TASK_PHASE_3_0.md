# Codex Task：Phase 3.0 36-Tile Full Map & Content

## 阶段目标

将既有技术切片逐步扩展为正式的 36 格单向、单路径闭环地图与规范内容；继续支持 2、3、4 名同设备本地玩家，并保持既有经济、回合、交接、清算、破产、胜者与表现数据流边界。

`docs/rules-baseline.md` 定义冻结产品规则；本任务书定义 Phase 3.0 实施范围；`AGENTS.md` 定义工程架构、数据流与实施边界。上述项目级约束始终高于外部 Skill；Phase 3.0 taskbook 也始终高于外部 Skill 建议。

## 冻结 36 格地图

| Index | 类型 | 名称 | 内容 / 价格 |
| --- | --- | --- | --- |
| 0 | START | 出发广场 | — |
| 1 | PROPERTY | 滨水公寓 | 500 万 |
| 2 | EVENT | 城市播报 | 现有 event pool |
| 3 | PROPERTY | 河岸市集 | 550 万 |
| 4 | CARD | 幸运邮局 | 现有 card pool |
| 5 | PROPERTY | 中央商街 | 600 万 |
| 6 | STOCK | 金融中心 | 现有 stock market |
| 7 | PROPERTY | 港湾商厦 | 650 万 |
| 8 | PROPERTY | 云顶公馆 | 700 万 |
| 9 | RESERVED / JAIL | 城市拘留所 | no-op destination |
| 10 | PROPERTY | 艺术里巷 | 750 万 |
| 11 | EVENT | 城市事件 | 现有 event pool |
| 12 | PROPERTY | 都会影城 | 800 万 |
| 13 | PROPERTY | 城心广场 | 850 万 |
| 14 | RESERVED / FACILITY | 城市服务中心 | no-op destination |
| 15 | PROPERTY | 都会中心 | 900 万 |
| 16 | CARD | 机会信箱 | 现有 card pool |
| 17 | PROPERTY | 城市之门 | 950 万 |
| 18 | RESERVED / PROJECT | 合作开发区 | no-op destination |
| 19 | PROPERTY | 创意园区 | 1000 万 |
| 20 | EVENT | 市政公告 | 现有 event pool |
| 21 | PROPERTY | 数字港 | 1050 万 |
| 22 | PROPERTY | 智造中心 | 1100 万 |
| 23 | STOCK | 资本市场 | 现有 stock market |
| 24 | PROPERTY | 科技新城 | 1150 万 |
| 25 | RESERVED / FACILITY | 中央枢纽 | no-op destination |
| 26 | PROPERTY | 云端总部 | 1200 万 |
| 27 | RESERVED / MINIGAME | 城市挑战场 | no-op destination |
| 28 | PROPERTY | 国际会展中心 | 1250 万 |
| 29 | PROPERTY | 金融大厦 | 1300 万 |
| 30 | EVENT | 机会时刻 | 现有 event pool |
| 31 | PROPERTY | 星河中心 | 1350 万 |
| 32 | CARD | 城市补给站 | 现有 card pool |
| 33 | PROPERTY | 天际总部 | 1400 万 |
| 34 | PROPERTY | 财富之巅 | 1500 万 |
| 35 | FINISH | 城市终点 | — |

### Tile counts

- 36 格总计：20 `PROPERTY`、4 `EVENT`、3 `CARD`、2 `STOCK`、5 `RESERVED`、1 `START`、1 `FINISH`。
- 拓扑为 `0 → 1 → ... → 35 → 0`：单向、单路径、闭环；`START` 与 `FINISH` 相邻。

### Lap reward

- 仅 `35 → 0` 获得一次固定 80 internal（800 万元）奖励。
- `34 → 35` 没有奖励；落在 `FINISH` 没有额外奖励；初始落在 `START` 没有奖励。

### Property economy

- 不修改现有购买价、升级比例、租金比例和 50% 清算比例。
- 不引入 set bonus、monopoly bonus 或 auction。

### STOCK / CARD / EVENT

- 两个 `STOCK` 格共用同一个既有 stock market。
- 三个 `CARD` 格共用同一个既有 card pool。
- 四个 `EVENT` 格共用同一个既有 event pool。
- 本阶段不扩展内容池或经济参数。

### RESERVED contract

`RESERVED` 是正式 tile type，并带有 `reservedKind`：`JAIL`、`FACILITY`、`PROJECT` 或 `MINIGAME`。

- 9：`JAIL`；14、25：`FACILITY`；18：`PROJECT`；27：`MINIGAME`。
- Phase 3.0 中它们都是 no-op destination：完成移动、展示目的地、正常结束回合。
- 不产生收费、jail、project、minigame、新 interaction、新 `GameCommand`、新 `DomainEvent` 或新 XState state。

## Persistence contract

- Persistence Schema 从 v3 升级到 v4。
- 规范 `GameState` 使用 `boardVersion = "full-map-36-v1"` 作为正式地图 identity；不再以 `technicalSliceVersion` 作为正式 board identity。
- v1、v2、v3 technical-slice save 一律 incompatible：quarantine、删除 active old save、recovered，并显示地图版本升级提示后进入 New Game Setup。
- 不 remap position、不增补 property roster、不修改 ownership 后续局、不自动转换为 36 格地图。
- 具体 save slot 字符串由 Step 3 按现有 storage API 选择最小安全设计；行为合同高于 slot naming。

## Architecture guardrail

所有领域结果必须继续遵循：

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

动画只消费 `PresentationCue`，不得决定游戏状态。Vue、Phaser 和测试工具都不能创建第二份 canonical `GameState`，也不能绕过 XState 或 Game Core。

## Staged activation

- Step 1 只创建通用 `GameContent`、`RESERVED` schema、`full-map-36.json`、`fullMap36Content` export 及内容校验；不得把 production App default 从 technical slice 切到 full map。
- 正式 production full-map switch 只能在 Step 5 Integration 进行。
- 命名迁移应受控：正式路径泛化 `TechnicalSliceContent → GameContent`、`technicalSliceVersion → boardVersion`、`createTechnicalSliceState → createLocalGameState`；可保留兼容 alias。不得进行无必要的大规模纯 rename refactor。
- Phase 3.0 不引入 Tiled runtime；Phaser 使用 deterministic generated presentation layout（推荐 10 × 10 perimeter 的 36 个节点）。视觉坐标只服务表现，地图顺序始终由 content 与 `GameState` 决定。

## 明确不做

- Jail rules、Facility fees、Projects、Minigames。
- 完整攻击/防御响应、正式 final map art、economy tuning。
- backend、online multiplayer、accounts、交易、贷款、拍卖。
- 不必要地重建 dependency tree、改变 npm 或 Node 版本、修改 CI install strategy，或删除 `package-lock.json`；现有 `package-lock.json` + `npm ci` 是已验证的跨平台安装基线。

## 实施步骤

### Step 0 — Documentation contract

创建本任务书，并将项目当前阶段入口切换到 Phase 3.0；不修改业务代码、测试或 `docs/rules-baseline.md`。

### Step 1 — Content schema + full-map-36 canonical content

新增通用内容模型、`RESERVED` schema 与 36 格规范内容，并完成全部内容校验；不切换 production default。

### Step 2 — Core full-map activation

实现 `createLocalGameState`、`boardVersion`、36 格 movement/lap/RESERVED/property 测试；Flow 只做必要泛化。

### Step 3 — Persistence Schema v4

实现旧技术切片存档 quarantine 与 full-map stable restore。

### Step 4 — Phaser 36-tile presentation

实现 generated 36-node layout、20 个地产表现、棋子/移动/所有权旗帜。

### Step 5 — Vue / Session / Production Integration

仅在此步骤把 technical-slice production path 切换为 `full-map-36-v1`。

### Step 6 — Browser Regression / Final Acceptance

完成正式地图、存档和多视口浏览器回归验收。

## 验收要求

1. 2、3、4 人 New Game 使用 36 格地图。
2. 验证 36 tiles、`35 → 0` 精确奖励、`FINISH` 不重复奖励、20 个 property operations。
3. 验证 4 个 `EVENT`、3 个 `CARD`、2 个 `STOCK` 与 5 个 `RESERVED` no-op entry positions。
4. 验证 handoff、bankrupt skip、winner、reload 与旧存档 quarantine。
5. Phaser 验证 36 tiles、2–4 pawns、wrap、owner colors、same-tile 与 ghost cleanup。
6. 在 390×844、1194×834、1440×900 截图验证；runtime errors 必须为 0。
7. 所有规则计算保留于 Core，Flow 只编排，Phaser/Vue 只消费 state/cues；保持既定 60 FPS 目标、质量档位与真实设备验收标准。
8. 每个实现步骤完成前至少运行对应 workspace tests、`npm.cmd run check`、`git diff --check`，并报告测试、风险和 diff。
