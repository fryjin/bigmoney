# Phase 1.4 上传说明

## 推荐方式

将增量补丁中的内容覆盖到 GitHub 仓库根目录：

```text
fryjin/bigmoney
```

不要把补丁最外层文件夹一并上传到仓库。

## 重点文件

```text
AGENTS.md
CODEX_START_HERE.md
CODEX_TASK_PHASE_2_0.md
package.json
apps/web/package.json
apps/web/src/main.ts
apps/web/src/session/persistence.ts
apps/web/src/session/persistence.test.ts
apps/web/src/ui/App.vue
apps/web/src/ui/components/ControlDock.vue
apps/web/src/ui/components/GameCanvas.vue
apps/web/src/ui/theme/global.css
packages/game-flow/package.json
packages/game-flow/src/index.ts
packages/game-flow/src/machine.ts
packages/game-flow/src/controller.ts
packages/game-flow/tests/controller.test.ts
scripts/codex-preflight.mjs
scripts/verify-structure.mjs
docs/development/phase-1.4-technical-slice-closeout.md
docs/development/phase-1.4-validation.md
```

## 提交信息

```text
feat: close phase 1.4 with stable player handoff and save recovery
```

## 上传后

1. 等待 `Big Money CI` 完成。
2. 必须确认 `Verify, typecheck, test and build` 成功。
3. Cloudflare Pages 应由 `main` 推送自动重新部署。
4. 打开线上地址进行回合交接和刷新恢复验收。

## PWA 缓存提示

Cloudflare 部署完成后，旧 Service Worker 可能短暂继续提供上一版本。测试前执行一次普通刷新；仍旧时，在 DevTools → Application → Service Workers 点击 Update，再刷新页面。
