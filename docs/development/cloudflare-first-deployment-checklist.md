# Cloudflare Pages 首次部署清单

## A. 创建项目前

- GitHub Actions 最新一次运行成功；
- 构建 Artifact 名称为 `bigmoney-web-dist`；
- 仓库 Production branch 为 `main`；
- 仓库没有 Cloudflare API Token、账号密钥或私密 `.env` 文件。

## B. Cloudflare Dashboard

依次进入：

```text
Workers & Pages
→ Create application
→ Pages
→ Connect to Git
→ GitHub
→ fryjin/bigmoney
```

配置：

| 字段 | 值 |
|---|---|
| Project name | `bigmoney` |
| Production branch | `main` |
| Framework preset | `None` |
| Root directory | 留空 |
| Build command | `npm run build` |
| Build output directory | `apps/web/dist` |

环境变量：

```text
NODE_VERSION=22
VITE_BUILD_CHANNEL=production
VITE_ENABLE_DEBUG=false
```

`VITE_BUILD_COMMIT` 和 `VITE_BUILD_TIME` 在 Cloudflare 首次部署中可暂不填写；GitHub CI Artifact 已包含完整构建元数据。

## C. 首次上线检查

- 部署状态为 Success；
- 首页状态码为200；
- `manifest.webmanifest` 可访问；
- `sw.js` 可访问且不是404；
- SVG建筑和棋子全部显示；
- 刷新页面仍进入游戏；
- 显示设置 → 部署诊断中，IndexedDB 和本地设置为“可用”；
- 首次访问后刷新一次，Service Worker 应从“待接管”变为“已接管”。

## D. 异常处理

构建失败：

1. 打开 Deployments；
2. 进入失败部署的 Build log；
3. 记录第一个真实错误；
4. 不通过关闭 TypeScript、删除测试或绕过 `verify:dist` 解决。

页面空白：

1. 检查浏览器控制台首个错误；
2. 检查 Phaser 独立 Chunk 是否404；
3. 检查 `/assets/technical-slice/` 下资源是否404；
4. 检查 `_headers` 是否误阻止同源资源。

## E. 完成定义

只有 Cloudflare 生产部署、浏览器回归、iPad 回归和离线回归均通过，Phase 1.3 才算关闭。
