# Phase 1.1 变更清单

## 仓库规范化

- 根包：`town-board-game` → `bigmoney`
- 工作区命名空间：`@town-board/*` → `@bigmoney/*`
- 增加根TypeScript严格配置与结构校验脚本
- 增加Node 22 GitHub Actions构建流程

## 新增核心实现

- `packages/game-content`：八节点配置与Zod校验
- `packages/game-random`：可复现随机与测试序列随机
- `packages/game-core`：规则状态、命令、领域事件和技术切片规则
- `packages/game-flow`：XState流程机与Session协调器
- `packages/game-storage`：IndexedDB快照和事件日志
- `packages/game-testkit`：测试工具
- `packages/design-tokens`：UI基础令牌

## 新增Web实现

- 1194×834 Phaser场景
- 八节点等距道路与技术切片城市
- 两个玩家棋子
- 骰子、移动、市场、地产、升级和回合动画
- Vue玩家HUD、操作Dock、资产/手牌面板和决策Modal
- Anime.js状态提示动画
- PWA和Cloudflare静态部署配置

## 新增技术切片资产

- 6个建筑SVG
- 2个棋子SVG

这些资产用于架构验证，不作为正式美术验收终稿。

## 新增测试

- 内容配置校验
- 随机数复现
- 地产成本和租金
- 移动、圈奖励、股票路径触发、购买、升级、租金和抽卡
- XState Session主要流程
- 本地存储回退

## 应删除的旧文件

```text
apps/web/src/phaser/bridges/gameEvents.ts
packages/game-content/src/maps/technical-slice.json
```

完整包内已不包含以上文件；使用GitHub网页覆盖上传时需要手动删除。
