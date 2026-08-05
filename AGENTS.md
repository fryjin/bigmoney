# Big Money Agent 开发约束

## 不可变范围

- 不修改 `docs/rules-baseline.md` 中已经冻结的规则。
- 不在 Phaser Scene、Vue 组件或动画回调中直接修改经济状态。
- 不使用未注入的 `Math.random()`；所有随机结果必须来自 `@bigmoney/game-random`。
- 不把 Vue 响应式状态或 Phaser GameObject 当作游戏真实状态。
- 不新增交易、贷款、联网、AI玩家、分支地图等未纳入MVP的系统。
- Phase 1.1 不自行补齐清算、破产、监狱、合作项目等后续模块。

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
