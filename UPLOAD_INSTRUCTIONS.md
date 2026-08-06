# Phase 1.1 仓库激活补丁上传说明

## 为什么需要这次补丁

GitHub网页批量上传时，操作系统可能隐藏以 `.` 开头的文件，导致 `.github`、`.gitignore`、`.editorconfig`、`.env.example` 没有进入仓库。

## 推荐上传方式

使用 GitHub Desktop 或本地 Git，将本补丁内容覆盖到仓库根目录后提交：

```text
chore: activate CI and repository configuration
```

## 仅使用GitHub网页时

通过 **Add file → Create new file** 分别创建：

- `.github/workflows/ci.yml`
- `.gitignore`
- `.editorconfig`
- `.env.example`

`manual-create/` 中提供了可复制的可见文本版本。

随后覆盖上传：

- `package.json`
- `scripts/verify-repository.mjs`
- `docs/development/repository-acceptance.md`
- `docs/development/cloudflare-pages-setup.md`

## 临时文件清理

确认补丁提交后，可删除仓库根目录中的：

- `FILES.txt`
- `UPLOAD_INSTRUCTIONS.md`

它们不是运行依赖。
