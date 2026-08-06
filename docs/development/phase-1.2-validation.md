# Phase 1.2 校验记录

## 已在生成环境执行

```text
仓库级配置校验：通过
工程结构校验：通过
TypeScript / Vue Script / JSON 语法解析：通过
```

结构校验已扩展到以下 Phase 1.2 关键文件：

```text
apps/web/src/presentation/preferences.ts
apps/web/src/phaser/assets/visualAssetRegistry.ts
apps/web/src/ui/components/PresentationSettings.vue
```

## 当前环境限制

当前文件生成环境的内部 npm Registry 未提供项目指定的全部依赖版本，因此无法在此环境完成真实的：

```text
npm install
npm run typecheck
npm run test
npm run build
```

上述项目必须由上传后的 GitHub Actions 执行。不能将语法检查视为完整构建通过。

## 上传后的通过标准

GitHub Actions 中以下步骤必须全部为绿色：

```text
Install dependencies
Verify, typecheck, test and build
Upload web build
```

如 CI 失败，应以该次运行的首个真实错误为准，不通过关闭类型检查或删除测试绕过。
