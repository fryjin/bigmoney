# Phase 1.3 增量补丁上传说明

1. 解压本补丁；
2. 将补丁内部所有内容上传到 `fryjin/bigmoney` 仓库根目录；
3. 覆盖同名文件；
4. 确认 `.github/workflows/ci.yml` 已更新；
5. 不要上传最外层 `bigmoney-phase1.3-patch` 文件夹。

建议提交信息：

```text
feat: add phase 1.3 deployment hardening and runtime diagnostics
```

上传后等待 `Big Money CI`。只有安装、类型检查、测试、构建、`verify:dist` 和 Artifact 上传全部成功，才进入 Cloudflare Pages 首次部署。
