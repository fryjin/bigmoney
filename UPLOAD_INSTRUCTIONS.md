# 上传说明：CI 修复 v0.1.4

将本目录内部内容覆盖上传到 GitHub 仓库根目录。

本次覆盖文件：

```text
package.json
apps/web/tsconfig.json
docs/development/ci-tsconfig-baseurl-hotfix-v0.1.4.md
```

建议提交信息：

```text
fix: remove deprecated TypeScript baseUrl option
```

上传后等待 `Big Money CI` 自动运行。不要手动回退 TypeScript，也不要添加 `ignoreDeprecations`。
