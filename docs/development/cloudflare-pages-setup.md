# Cloudflare Pages 部署设置

## 推荐方式

使用 Cloudflare Pages 的 GitHub 集成连接 `fryjin/bigmoney`。连接后，`main` 分支推送会自动触发生产部署，其他分支和 Pull Request 可生成预览部署。

## 创建项目

1. 登录 Cloudflare Dashboard；
2. 进入 **Workers & Pages**；
3. 选择 **Create application**；
4. 选择 **Pages**；
5. 选择 **Import an existing Git repository**；
6. 授权并选择 `fryjin/bigmoney`；
7. 使用下面的构建参数。

## 构建参数

| 配置项 | 值 |
|---|---|
| Project name | `bigmoney` |
| Production branch | `main` |
| Framework preset | `None` 或 `Vue`，以自定义字段为准 |
| Root directory | 留空，使用仓库根目录 |
| Build command | `npm run build` |
| Build output directory | `apps/web/dist` |
| Node version | `22` |

## 环境变量

生产环境：

```text
NODE_VERSION=22
VITE_BUILD_CHANNEL=production
VITE_ENABLE_DEBUG=false
```

预览环境：

```text
NODE_VERSION=22
VITE_BUILD_CHANNEL=preview
VITE_ENABLE_DEBUG=true
```

## 首次部署验收

- 依赖安装成功；
- `npm run build` 返回0；
- `apps/web/dist/index.html` 被部署；
- `*.pages.dev` 地址可访问；
- 刷新任意前端路由不返回404；
- SVG资产加载无404；
- iPad Safari可进入技术切片并完成至少两个回合。
