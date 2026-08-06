import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = decodeURIComponent(new URL('..', import.meta.url).pathname);
const requiredRepositoryFiles = [
  '.editorconfig',
  '.env.example',
  '.gitignore',
  '.github/workflows/ci.yml'
];

const missing = requiredRepositoryFiles.filter((file) => !existsSync(join(root, file)));

if (missing.length > 0) {
  console.error('Big Money 仓库激活校验失败：');
  for (const file of missing) console.error(`- 缺少 ${file}`);
  process.exit(1);
}

console.log('Big Money 仓库激活校验通过。');
console.log(`已确认 ${requiredRepositoryFiles.length} 个仓库级配置文件。`);
