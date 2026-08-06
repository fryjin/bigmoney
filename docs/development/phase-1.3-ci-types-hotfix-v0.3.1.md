# Phase 1.3 CI 类型修复 v0.3.1

## 故障位置

GitHub Actions Run #7 已通过依赖安装、仓库校验和结构校验，失败于 Web 工作区的 `vue-tsc --noEmit`。

错误包括：

1. `ImportMetaEnv` 与 `BuildEnvironment` 没有公共属性；
2. `vite.config.ts` 无法识别 `node:fs`；
3. `vite.config.ts` 无法识别全局变量 `process`。

## 修复内容

- 在根 `devDependencies` 中加入 `@types/node@22.20.1`；
- 在 `apps/web/tsconfig.json` 的 `types` 中加入 `node`；
- 在 `apps/web/src/env.d.ts` 中声明 Phase 1.3 使用的四个 `VITE_*` 环境变量；
- 根项目与 Web 包版本更新至 `0.3.1`。

## 不受影响的范围

本补丁未修改：

- 游戏规则；
- Game Core；
- XState 回合流程；
- Phaser 场景行为；
- Vue 页面交互；
- IndexedDB 存档格式；
- Cloudflare Pages 参数。

## 验收

上传后，GitHub Actions 应继续执行：

1. 全工作区类型检查；
2. Vitest；
3. Vite 生产构建；
4. `verify:dist`；
5. `bigmoney-web-dist` 上传。
