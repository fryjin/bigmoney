# CI TypeScript 配置修复 v0.1.4

## 故障

GitHub Actions 第 3 次运行已完成依赖安装、仓库校验和结构校验，但 Web 工作区在 `vue-tsc --noEmit` 阶段失败：

```text
TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0.
```

## 根因

`apps/web/tsconfig.json` 单独声明了：

```json
"baseUrl": "."
```

当前工程没有配置 `paths`，内部包通过 npm workspaces 的 `@bigmoney/*` 包名解析，因此该 `baseUrl` 没有实际用途。

## 修复

删除 `apps/web/tsconfig.json` 中无效的 `baseUrl`，不使用 `ignoreDeprecations` 掩盖问题。

本修复不改变游戏规则、运行逻辑、UI、场景、存档或资源。
