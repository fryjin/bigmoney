# Town Board Game

面向 iPad 横屏的 2.5D 单机同屏大富翁游戏。代码托管于 GitHub，部署到 Cloudflare Pages。

## 技术栈

- Phaser 4.2.1：棋盘、镜头、棋子、建筑、小游戏
- TypeScript：规则与应用代码
- XState 5：回合、中断与恢复流程
- Vue 3：HUD、上下文面板和阻断式决策
- Anime.js：DOM UI 动效
- Tiled：等距地图与锚点编排
- IndexedDB：本地快照与事件日志
- Vite PWA：离线缓存与主屏幕运行

## 当前仓库状态

这是开发启动骨架，包含模块边界、示例场景、技术切片配置、CI和综合开发说明。它不是完整游戏，也不代表最终美术质量。

## 本地运行

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

Cloudflare Pages：

- Build command：`npm run build`
- Output directory：`apps/web/dist`
- Node.js：22+

## 首个开发目标

完成 5～7 个工作日技术切片：8个路径节点、6栋正式质量建筑、2名玩家、一个地产、一个股票市场、一张卡片和一个事件。

详细内容见 `docs/development-guide.md`。
