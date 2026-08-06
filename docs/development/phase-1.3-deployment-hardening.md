# Phase 1.3 部署加固与运行验收

## 1. 阶段目标

Phase 1.3 在 Phase 1.2 已通过 GitHub Actions 的基础上，为首次 Cloudflare Pages 上线和 iPad 真机验收建立可观察、可复现、可回退的部署基线。

本阶段不扩展36格地图，不修改经济规则，不增加监狱、小游戏、合作项目或破产清算。

## 2. 工程改动

### 2.1 场景代码拆分

Vue 首屏不再静态导入 Phaser 场景。`GameCanvas.vue` 在挂载后动态导入 `createGame.ts`，加载期间继续显示已有进度遮罩。

`sceneBridge.ts` 不再运行时依赖 Phaser EventEmitter，改为项目内部轻量事件总线。这样 Phaser 及 TownScene 可以进入独立 Chunk，降低首屏阻塞。

### 2.2 构建元数据

新增：

```text
apps/web/src/runtime/buildInfo.ts
```

只记录公开部署信息：

- 应用版本；
- 构建渠道；
- Commit SHA；
- 构建时间；
- Debug 开关。

不得写入 Token、账号、Cookie 或本地游戏存档。

### 2.3 运行诊断

显示设置面板增加部署诊断：

- 在线状态；
- Service Worker 支持和接管状态；
- IndexedDB；
- localStorage；
- 浏览器或主屏幕应用模式；
- 当前视口；
- 版本、渠道和提交号。

诊断只读取能力状态，不上传数据。

### 2.4 部署产物校验

新增：

```text
npm run verify:dist
```

校验：

- PWA 和 SPA 关键文件；
- Cloudflare `_headers`、`_redirects`；
- 生产包不公开 Source Map；
- Phaser 已拆分为独立 Chunk；
- 技术切片总产物不超过15MB。

### 2.5 GitHub Actions

工作流升级到 Node 24 运行时版本的官方 Actions：

```text
actions/checkout@v6
actions/setup-node@v6
actions/upload-artifact@v7
```

项目构建 Node 仍固定为22。CI 写入公开构建元数据，并在上传 Artifact 前执行部署产物校验。

## 3. Cloudflare Pages 边界

本补丁只准备仓库，不会自动创建 Cloudflare 项目，也不要求在 GitHub 保存 Cloudflare API Token。

首次上线采用 Cloudflare Pages GitHub Integration：

```text
Repository: fryjin/bigmoney
Production branch: main
Root directory: 留空
Build command: npm run build
Output directory: apps/web/dist
NODE_VERSION: 22
```

## 4. 通过条件

- GitHub Actions 全绿；
- `verify:dist` 通过；
- Artifact 上传成功；
- Cloudflare 首次生产部署成功；
- `pages.dev` 地址能进入游戏；
- 刷新不返回404；
- Service Worker 第二次访问后显示“已接管”；
- iPad Safari 横屏完成两名玩家至少两个回合；
- 飞行模式重新打开后可加载已缓存技术切片。
