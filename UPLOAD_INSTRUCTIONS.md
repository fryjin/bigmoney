# 上传说明

这是完整仓库内容包，不是仅包含新增文件的补丁。

1. 先备份当前 `main`。
2. 解压本压缩包。
3. 将压缩包内部文件覆盖上传到仓库根目录。
4. 删除旧文件：
   - `apps/web/src/phaser/bridges/gameEvents.ts`
5. 不要删除现有 `docs/design` 和 `assets/*/README.md`；本包已包含这些内容。
6. 建议提交信息：

```text
feat: normalize bigmoney workspace and add phase 1.1 technical slice
```

上传后在联网环境运行：

```bash
npm install
npm run check
```

成功后将新生成的 `package-lock.json` 一并提交。
