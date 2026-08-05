# Codex / Agent 开发约束

## 不可变范围

- 不修改 `docs/rules-baseline.md` 中的规则。
- 不在 Phaser Scene、Vue 组件、动画回调中直接修改经济状态。
- 不使用未注入的 `Math.random()`；所有随机结果必须来自 `game-random`。
- 不把 Vue 响应式状态或 Phaser GameObject 当作游戏真实状态。
- 不新增交易、贷款、联网、AI 玩家、分支地图等未纳入 MVP 的系统。

## 强制数据流

`UI/场景输入 → GameCommand → Flow Guard → Game Core → DomainEvent → GameState → PresentationCue`

动画只消费 `PresentationCue`，不能决定规则结果。动画完成后仅回传 `PRESENTATION_DONE`。

## 模块边界

- `packages/game-core`：纯 TypeScript 规则，无浏览器、Vue、Phaser依赖。
- `packages/game-flow`：XState 流程编排，不计算租金、股票收益或资产价值。
- `apps/web/src/phaser`：场景与动画，不直接写规则。
- `apps/web/src/ui`：信息展示与玩家决策，不持有唯一游戏状态。
- `packages/game-content`：JSON配置与Zod校验。
- `packages/game-storage`：快照、事件日志和迁移。

## 每次提交前

1. 运行 `npm run check`。
2. 新规则行为必须有单元测试；但未经产品确认不得创建新规则。
3. 流程中断必须有场景测试：进入、响应、恢复、重复点击。
4. UI修改需提供 iPad 横屏截图。
5. 资源修改需检查纹理尺寸、透明边距和内存预算。
