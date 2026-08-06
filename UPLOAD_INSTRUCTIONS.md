# 上传说明

将本补丁内部内容覆盖到 GitHub 仓库根目录。

本次需要覆盖 4 个工程文件：

```text
package.json
apps/web/package.json
apps/web/tsconfig.json
apps/web/src/env.d.ts
```

修复记录文件：

```text
docs/development/phase-1.3-ci-types-hotfix-v0.3.1.md
```

建议提交信息：

```text
fix: add Node and Vite environment typings
```

上传后等待 `Big Money CI` 自动运行。不要重新上传 Phase 1.3 完整包，也不要修改 Cloudflare 配置。
