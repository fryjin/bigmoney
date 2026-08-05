# Phase 1.1 工程可构建性校验记录

## 已完成的静态校验

- Monorepo根包名已统一为 `bigmoney`；
- 所有工作区包名已统一为 `@bigmoney/*`；
- 旧命名空间扫描已加入 `scripts/verify-structure.mjs`；
- JSON配置可解析；
- SVG资产为合法XML；
- TypeScript配置统一继承根 `tsconfig.base.json`；
- GitHub Actions已配置Node 22、安装、检查、构建和产物上传；
- Cloudflare `_headers` 与 `_redirects` 已保留；
- 关键规则、流程和随机模块已提供Vitest测试。

## 本生成环境限制

生成环境的内部npm镜像未同步全部指定版本，并且无法稳定访问公共npm Registry，因此未能在这里完成真实的：

```bash
npm install
npm run check
```

这不是代码通过构建的证明。上传后必须在GitHub Actions或本地联网环境执行完整安装和构建。

## 上传后的强制命令

```bash
npm install
npm run verify:structure
npm run typecheck
npm run test
npm run build
```

全部通过后提交 `package-lock.json`。此后CI建议改用：

```bash
npm ci
```

## 失败处理原则

- 不降低TypeScript严格度；
- 不删除测试；
- 不更改冻结规则来迁就代码；
- 首先核对依赖版本、Phaser 4 API、XState 5类型和Vue模板类型；
- 修复后重新执行完整 `npm run check`。

## 已执行的补充烟雾校验

生成环境已使用TypeScript编译器API解析全部TypeScript与Vue `<script setup>` 源码：

- 31个TS/Vue脚本；
- 语法错误：0。

同时执行了不依赖浏览器的领域层烟雾测试：

- 初始现金；
- 地产升级费；
- 各级租金；
- 投骰与逐格移动；
- 无主地产决策与购买；
- 回合切换；
- 股票市场路径中断。

以上烟雾测试通过。完整依赖类型检查、Vitest和Vite生产构建仍必须在联网环境执行。
