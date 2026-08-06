# Big Money CI Hotfix v0.1.5 上传说明

将压缩包内部内容覆盖到仓库根目录。

本次覆盖文件：

- `package.json`
- `apps/web/src/phaser/createGame.ts`
- `docs/development/ci-phaser-gameconfig-hotfix-v0.1.5.md`

提交信息：

```text
fix: remove unsupported Phaser 4 resolution config
```

上传后 GitHub Actions 会自动触发。不要手动重跑旧工作流；检查由新提交触发的最新一轮。
