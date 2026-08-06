import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync
} from 'node:fs';
import { join, relative } from 'node:path';

const root = decodeURIComponent(new URL('..', import.meta.url).pathname);
const dist = join(root, 'apps/web/dist');
const failures = [];

const requiredFiles = [
  'index.html',
  'manifest.webmanifest',
  'registerSW.js',
  'sw.js',
  '_headers',
  '_redirects'
];

for (const file of requiredFiles) {
  if (!existsSync(join(dist, file))) failures.push(`构建产物缺少: ${file}`);
}

function walk(directory) {
  const files = [];
  if (!existsSync(directory)) return files;

  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }

  return files;
}

const files = walk(dist);
const relativeFiles = files.map((file) => relative(dist, file).replaceAll('\\', '/'));
const sourceMaps = relativeFiles.filter((file) => file.endsWith('.map'));
const javascript = relativeFiles.filter((file) => file.endsWith('.js'));

if (sourceMaps.length > 0) {
  failures.push(`生产构建不应公开 Source Map: ${sourceMaps.join(', ')}`);
}

if (javascript.length < 2) {
  failures.push('Phaser 场景应通过动态导入拆分为独立 JavaScript Chunk。');
}

const totalBytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
if (totalBytes > 15 * 1024 * 1024) {
  failures.push(`技术切片构建体积超过15MB: ${Math.round(totalBytes / 1024)} KiB`);
}

const headersPath = join(dist, '_headers');
if (existsSync(headersPath)) {
  const headers = readFileSync(headersPath, 'utf8');
  for (const header of [
    'X-Content-Type-Options: nosniff',
    'Permissions-Policy:',
    'Cache-Control: public, max-age=31536000, immutable'
  ]) {
    if (!headers.includes(header)) failures.push(`_headers 缺少: ${header}`);
  }
}

const redirectsPath = join(dist, '_redirects');
if (
  existsSync(redirectsPath) &&
  !readFileSync(redirectsPath, 'utf8').includes('/* /index.html 200')
) {
  failures.push('_redirects 缺少 SPA 回退规则。');
}

if (failures.length > 0) {
  console.error('Big Money 部署产物校验失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Big Money 部署产物校验通过。');
console.log(`已确认 ${requiredFiles.length} 个关键产物、${javascript.length} 个 JS Chunk。`);
console.log(`构建总大小：${Math.round(totalBytes / 1024)} KiB。`);
