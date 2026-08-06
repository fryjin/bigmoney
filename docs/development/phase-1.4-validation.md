# Phase 1.4 校验记录

## 本地生成环境

当前生成环境无法从内部 npm Registry 获取项目指定的全部依赖，公共 Registry 连接也超时。因此本地未将依赖安装失败冒充为完整构建通过。

## 已执行并通过

```text
仓库级配置校验：4项
工程结构校验：28个关键文件、9个工作区包名
TypeScript / Vue script 语法解析：42个文件
JSON解析：21个文件
SVG / XML解析：8个文件
Persistence关键模块严格类型检查：通过
Game Flow关键模块严格类型检查：通过
Codex本地项目预检：通过
```

另外完成了：

- 玩家交接流程静态审查；
- 稳定存档写入边界审查；
- 存档迁移、完整性校验和损坏隔离测试代码；
- 补丁文件清单与路径校验。

## 本地未完成的项目

以下命令因 Registry 连接限制未能在生成环境中真实执行：

```bash
npm install
npm run check
```

完整依赖解析、全工作区 `vue-tsc` / `tsc`、Vitest、Vite生产构建、PWA产物和 `verify:dist` 仍由上传后的 GitHub Actions 判定。

## 上传后必须由 GitHub Actions 执行

```bash
npm install --no-audit --no-fund
npm run check
```

`npm run check` 包含：

1. 仓库配置校验；
2. 工程结构校验；
3. 全工作区类型检查；
4. Vitest；
5. Vite生产构建；
6. 部署产物校验。

## Phase 1.4 运行验收

1. 有旧存档时出现“继续游戏 / 重新开始”。
2. 点击继续后恢复到正确玩家和大轮。
3. 点击结束回合后进入交接遮罩。
4. 交接遮罩期间看不到手牌、持仓、现金和操作台。
5. 下一玩家确认后才可投骰。
6. 在交接遮罩刷新，仍恢复到交接状态。
7. 快速连续点击投骰、购买、确认或结束回合，不发生重复扣款或重复结算。
8. 至少连续运行八个玩家回合。
9. DevTools中Service Worker与IndexedDB保持正常。
10. iPad真机验收仍标记为 Pending。
