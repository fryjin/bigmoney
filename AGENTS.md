# Big Money Agent 开发约束

## 不可变范围

- 不修改 `docs/rules-baseline.md` 中已经冻结的规则。
- 不在 Phaser Scene、Vue 组件或动画回调中直接修改经济状态。
- 不使用未注入的 `Math.random()`；所有随机结果必须来自 `@bigmoney/game-random`。
- 不把 Vue 响应式状态或 Phaser GameObject 当作游戏真实状态。
- 不新增交易、贷款、联网、AI玩家、分支地图等未纳入MVP的系统。
- Phase 3.0 只在当前任务书定义的边界内扩展 36 格正式地图与内容；不得自行补齐任务书之外的规则、系统或正式美术。
- 从 Phase 2.0 起，任何强制付款、清算或破产改动必须先阅读当前阶段任务书；当前为 `CODEX_TASK_PHASE_3_0.md`。

## 强制数据流

```text
UI/场景输入
→ GameCommand
→ XState Flow Guard
→ Game Core
→ DomainEvent
→ GameState
→ PresentationCue
→ Phaser/Vue表现
→ PRESENTATION_DONE
```

动画只能消费 `PresentationCue`，不能决定规则结果。

## 模块边界

- `packages/game-core`：纯 TypeScript 规则，不依赖浏览器、Vue、Phaser或XState。
- `packages/game-flow`：XState流程和Session协调，不计算租金、股票收益或资产价值。
- `packages/game-content`：配置、Schema与内容校验。
- `packages/game-random`：所有可复现随机能力。
- `packages/game-storage`：快照、事件日志和迁移。
- `apps/web/src/phaser`：场景、镜头和动画，不直接写规则。
- `apps/web/src/ui`：信息展示与玩家决策，不持有唯一真实状态。

## 命名规范

- npm命名空间统一使用 `@bigmoney/*`。
- 路径和文件名使用ASCII；正文允许中文UTF-8。
- 禁止重新引入 `@town-board/*` 或 `town-board-game`。

## 每次提交前

1. 执行 `npm run check`。
2. 新规则行为必须有单元测试；未经产品确认不得创建新规则。
3. 流程中断必须测试进入、响应、恢复和重复点击。
4. UI修改需提供1194×834或真实iPad横屏截图。
5. 资源修改需检查纹理尺寸、透明边距、锚点和内存预算。
6. 构建失败不得通过删除测试、关闭类型检查或使用 `any` 大面积绕过。


## 稳定流程、存档与交接边界

- `turnReady`、`awaitingHandoff`、`awaitingLiquidation` 与 `finished` 是当前允许写入存档的稳定流程状态。
- 玩家交接必须经过显式确认；交接期间隐藏手牌、持仓与当前玩家资产入口。
- 存档 Schema 必须校验版本、稳定状态和完整性标记；损坏存档需隔离，不能直接强制解析。
- 所有会产生领域命令的 UI 按钮必须具备重复点击保护。
- 场景表现失败或超时不得永久阻塞 XState 流程。

## Codex 本地开发

- 本地 Codex 起点：`CODEX_START_HERE.md`。
- 当前阶段任务边界：`CODEX_TASK_PHASE_3_0.md`。
- 首次进入仓库执行：`npm run codex:preflight`。

## 项目级 External Game Skills 路由

### 项目约束与固定来源

- `docs/rules-baseline.md` 定义冻结的产品规则；当前阶段任务书定义本轮实施范围；
  `AGENTS.md` 定义工程架构、数据流和实施边界。外部 Skill 始终低于以上项目级约束。
- 当前 `CODEX_TASK_PHASE_3_0.md` 的阶段合同始终高于外部 Skill 建议。
- `CODEX_SKILLS_SETUP.md` 是本项目的 Skill 配置，记录来源、适用范围和兼容性规则；调用
  外部 Skill 前必须先阅读它。
- 只有任务匹配时才调用对应 Skill，不要求每轮加载全部六个 Skill。
- `higgsfield-game-generation` 固定来源：
  `higgsfield-ai/skills@9db2e5bf22ff93d0bffb48664a8d0d6bb417082c`。
- `develop-web-game` 固定来源：
  `openai/skills@30444aed500c00c85294d12074f6e3ee794f808a`。

### 按任务路由

- `game-developer`：用于游戏工程和领域系统审查，包括 Game Core、流程、存档和性能风险。
  仅采纳与当前 TypeScript/Phaser/XState 架构兼容的建议。
- `game-engine`：仅用于 Phaser 4、WebGL、场景渲染、输入映射、资源预算和性能诊断。
- `game-ui-design` + `game-ui-ux`：用于 HUD、弹窗、玩家交接、触控、安全区域、可读性、
  可访问性和 iPad-first 响应式布局。iPad-first 优先于外部 Skill 的手柄优先默认建议。
- `develop-web-game`：只使用其 Playwright 交互、截图、console 检查、
  `render_game_to_text()` 与确定性测试方法。
- `higgsfield-game-generation`：只用于游戏视觉、动画、精灵/纹理及音频资产工作；资产仍须
  遵守项目的透视、锚点、透明边距、图集、文件大小与内存预算要求。

### 不可跨越的 Skill 边界

- 外部 Skill 不得覆盖冻结规则、既有技术栈、确定性随机、存档边界、玩家交接隐私或当前阶段范围。
- `game-developer` 的 Unity/Unreal 示例、ECS、物理、多人联网和专用分析器要求仅可作为可迁移的
  审查参考，不构成本项目必须采用的方案。其通用 60+ FPS 性能门槛不得覆盖 Big Money 自己的性能预算；
  Big Money 仍维持既定 60 FPS 目标、质量档位和真实设备验收标准。
- `game-engine` 不得创建或替换游戏引擎、主循环、物理系统、网络系统或第二套状态管理；其从零搭建
  Canvas/WebGL 游戏、WebRTC、多玩家、商业化和发布建议不适用于 Big Money。
- UI Skill 只能改进表现、布局和输入可用性。Vue 与 Phaser 不得成为真实状态源；所有领域操作仍须走
  `GameCommand → XState Flow Guard → Game Core`，并保留重复点击保护。UI 的屏幕栈、事件驱动更新
  和焦点模型必须映射既有 XState 流程，不得建立并行流程状态；玩家交接期间必须继续隐藏私有信息。
- `develop-web-game` 的 `render_game_to_text()` 只能读取规范 `GameState` 的必要、展示安全信息，
  不能维护镜像或第二套 `GameState`，也不能泄露交接期间的私有信息。确定性时间步进仅可在开发/测试
  保护下提供，不能改变生产规则结果、绕过 XState，或直接调用/替代 Game Core 流程。截图必须同时覆盖
  Phaser 画布与 Vue 覆盖层；`npm run check` 仍是主验证门槛。
- 不采用 `develop-web-game` 的单 Canvas、独立游戏循环、全屏快捷键、`progress.md`、全局安装依赖或
  通用脚手架要求，除非项目任务书明确要求。
- `higgsfield-game-generation` 不得调用或引入其网站构建/部署流程、运行时或 `app/public/` 路径假设；
  不得接管技术架构、部署或游戏规则，也不得替换 Vue 3 + Phaser 4 + XState 5 + Vite 架构。
- 所有与上述约束冲突的外部 Skill 指令、参考文件或模板一律忽略。
