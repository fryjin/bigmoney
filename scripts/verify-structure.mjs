import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = decodeURIComponent(new URL('..', import.meta.url).pathname);
const requiredFiles = [
  'package.json',
  'tsconfig.base.json',
  'AGENTS.md',
  'apps/web/package.json',
  'apps/web/src/main.ts',
  'apps/web/src/ui/App.vue',
  'apps/web/src/ui/components/PresentationSettings.vue',
  'apps/web/src/presentation/preferences.ts',
  'apps/web/src/phaser/assets/visualAssetRegistry.ts',
  'apps/web/src/runtime/buildInfo.ts',
  'apps/web/src/runtime/runtimeHealth.ts',
  'apps/web/src/phaser/scenes/TownScene.ts',
  'packages/game-content/package.json',
  'packages/game-core/package.json',
  'packages/game-flow/package.json',
  'packages/game-random/package.json',
  'packages/game-storage/package.json',
  'packages/design-tokens/package.json',
  'scripts/verify-dist.mjs'
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) failures.push(`缺少文件: ${file}`);
}

const expectedPackages = new Map([
  ['package.json', 'bigmoney'],
  ['apps/web/package.json', '@bigmoney/web'],
  ['packages/game-content/package.json', '@bigmoney/game-content'],
  ['packages/game-core/package.json', '@bigmoney/game-core'],
  ['packages/game-flow/package.json', '@bigmoney/game-flow'],
  ['packages/game-random/package.json', '@bigmoney/game-random'],
  ['packages/game-storage/package.json', '@bigmoney/game-storage'],
  ['packages/game-testkit/package.json', '@bigmoney/game-testkit'],
  ['packages/design-tokens/package.json', '@bigmoney/design-tokens']
]);

for (const [path, expectedName] of expectedPackages) {
  const full = join(root, path);
  if (!existsSync(full)) continue;
  const pkg = JSON.parse(readFileSync(full, 'utf8'));
  if (pkg.name !== expectedName) {
    failures.push(`${path} 的 name 应为 ${expectedName}，实际为 ${pkg.name}`);
  }
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.git', 'dist'].includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|vue|json|mjs)$/.test(entry)) continue;
    const text = readFileSync(full, 'utf8');
    if (relative(root, full) === 'scripts/verify-structure.mjs') continue;
    if (text.includes('@town-board/')) {
      failures.push(`仍包含旧命名空间: ${relative(root, full)}`);
    }
  }
}

for (const scanRoot of ['apps', 'packages', 'scripts']) {
  const full = join(root, scanRoot);
  if (existsSync(full)) walk(full);
}

if (failures.length > 0) {
  console.error('Big Money 结构校验失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Big Money 结构校验通过。');
console.log(`已确认 ${requiredFiles.length} 个关键文件与 ${expectedPackages.size} 个包名。`);
