import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = decodeURIComponent(new URL('..', import.meta.url).pathname);
const failures = [];
const warnings = [];

const required = [
  'AGENTS.md',
  'CODEX_START_HERE.md',
  'CODEX_TASK_PHASE_2_0.md',
  'package.json',
  'apps/web/package.json',
  'packages/game-core/package.json',
  'packages/game-flow/package.json',
  'docs/rules-baseline.md'
];

for (const file of required) {
  if (!existsSync(join(root, file))) failures.push(`缺少 Codex 上下文文件：${file}`);
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (!Number.isInteger(nodeMajor) || nodeMajor < 22) {
  failures.push(`Node.js 需要 22+，当前为 ${process.versions.node}`);
}

const packageJsonPath = join(root, 'package.json');
if (existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  if (packageJson.name !== 'bigmoney') failures.push('仓库根包名不是 bigmoney。');
}

const git = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
  cwd: root,
  encoding: 'utf8'
});
if (git.status !== 0 || git.stdout.trim() !== 'true') {
  warnings.push('当前目录还不是 Git 工作区。解压后请先 git init 或克隆 GitHub 仓库。');
}

if (!existsSync(join(root, 'node_modules'))) {
  warnings.push('尚未安装依赖。首次使用前执行 npm install。');
}

if (failures.length > 0) {
  console.error('Codex 本地项目预检失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Big Money Codex 本地项目预检通过。');
console.log(`Node.js: ${process.versions.node}`);
for (const warning of warnings) console.warn(`提示：${warning}`);
console.log('下一步：npm run check，然后在仓库根目录启动 codex。');
