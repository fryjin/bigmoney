# Big Money 本地 Codex 起点

从 **Phase 2.0：Payment / Liquidation / Bankruptcy** 开始，改动会同时跨越 Game Core、XState Flow、Vue 决策界面、存档和测试。建议改为本地 Codex 主导实现，ChatGPT 继续负责规则确认、视觉方案、验收和变更包审查。

## 1. 准备仓库

优先克隆正式仓库，不要在旧压缩包副本上长期开发：

```bash
git clone https://github.com/fryjin/bigmoney.git
cd bigmoney
npm install
npm run codex:preflight
npm run check
```

如尚未安装 Codex CLI：

```bash
npm install -g @openai/codex
```

随后在仓库根目录启动：

```bash
codex
```

## 2. Codex 必须先读取

1. `AGENTS.md`
2. `docs/rules-baseline.md`
3. `docs/development/phase-1.4-technical-slice-closeout.md`
4. `CODEX_TASK_PHASE_2_0.md`
5. `docs/design/ui-2.5d-visual-guidelines-v1.0.md`

## 3. 首次任务提示词

```text
读取 AGENTS.md、docs/rules-baseline.md、docs/development/phase-1.4-technical-slice-closeout.md 和 CODEX_TASK_PHASE_2_0.md。
先运行 npm run check，确认 Phase 1.4 基线通过。
然后只实施 Phase 2.0A：统一强制付款、地产清算和破产淘汰，不扩展监狱、合作项目、36格地图或正式美术。
先输出实施计划和预计修改文件，再执行代码修改。
完成后运行 npm run check，并汇报测试覆盖、未解决风险和 git diff 摘要。
```

## 4. 工作纪律

- 每次只处理一个规则系统。
- 不直接在 `main` 上进行大范围实验。
- 先确认基线测试通过，再开始修改。
- 任何规则计算必须留在 `packages/game-core`。
- XState 只负责编排，动画只消费 `PresentationCue`。
- 不通过删除测试、放宽 TypeScript 或大面积使用 `any` 解决构建错误。
- 提交前必须执行 `npm run check`。

## 5. ChatGPT 与 Codex 分工

| 工作 | 建议执行方 |
|---|---|
| 规则口径确认、阶段拆分、交互方案 | ChatGPT |
| 跨文件实现、重构、测试循环、Git diff | 本地 Codex |
| 视觉稿、HTML原型、体验评审 | ChatGPT |
| CI失败定位与补丁审查 | ChatGPT + Codex |
| 最终合并与部署 | 人工确认后执行 |
