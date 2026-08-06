# Phase 1.3 增量补丁清单

## 新增文件

- `apps/web/src/env.d.ts`
- `apps/web/src/runtime/buildInfo.test.ts`
- `apps/web/src/runtime/buildInfo.ts`
- `apps/web/src/runtime/runtimeHealth.test.ts`
- `apps/web/src/runtime/runtimeHealth.ts`
- `docs/development/cloudflare-first-deployment-checklist.md`
- `docs/development/ipad-runtime-acceptance.md`
- `docs/development/phase-1.3-deployment-hardening.md`
- `docs/development/phase-1.3-validation.md`
- `scripts/verify-dist.mjs`

## 修改文件

- `.env.example`
- `.github/workflows/ci.yml`
- `FILES.txt`
- `README.md`
- `UPLOAD_INSTRUCTIONS.md`
- `apps/web/package.json`
- `apps/web/public/_headers`
- `apps/web/src/phaser/bridges/sceneBridge.ts`
- `apps/web/src/ui/components/GameCanvas.vue`
- `apps/web/src/ui/components/PresentationSettings.vue`
- `apps/web/vite.config.ts`
- `docs/README.md`
- `manual-create/ci.yml`
- `package.json`
- `scripts/verify-structure.mjs`

## 删除文件

- 无

## 上传方式

将补丁目录内部内容覆盖到 GitHub 仓库根目录。不要把最外层目录上传到仓库。
