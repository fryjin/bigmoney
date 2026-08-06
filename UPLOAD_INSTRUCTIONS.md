# Phase 1.2 上传说明

## 推荐方式

将本压缩包内部内容覆盖上传到 `fryjin/bigmoney` 仓库根目录。

不要上传最外层文件夹本身。仓库根目录应继续直接显示：

```text
apps
assets
docs
packages
scripts
package.json
```

## 增量上传时必须包含

```text
package.json
apps/web/package.json
apps/web/src/ui/App.vue
apps/web/src/ui/components/GameCanvas.vue
apps/web/src/ui/components/PresentationSettings.vue
apps/web/src/presentation/preferences.ts
apps/web/src/presentation/preferences.test.ts
apps/web/src/phaser/assets/visualAssetRegistry.ts
apps/web/src/phaser/assets/visualAssetRegistry.test.ts
apps/web/src/phaser/bridges/sceneBridge.ts
apps/web/src/phaser/scenes/BootScene.ts
apps/web/src/phaser/scenes/TownScene.ts
scripts/verify-structure.mjs
docs/README.md
docs/development/phase-1.2-presentation-interface.md
docs/development/phase-1.2-validation.md
README.md
```

## 提交信息

```text
feat: add phase 1.2 presentation and visual asset interface
```

## 上传后检查

进入 GitHub Actions，确认最新 `Big Money CI`：

```text
Install dependencies          success
Verify, typecheck, test and build  success
Upload web build              success
```

CI 通过前不要创建 Cloudflare Pages 项目。
