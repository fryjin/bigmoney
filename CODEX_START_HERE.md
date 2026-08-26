# Big Money 本地 Codex 起点

当前阶段为 **Phase 3.0：36-Tile Full Map & Content**。改动会分阶段覆盖内容、Core、存档、Phaser、Vue/Session 与浏览器回归；本地 Codex 负责实现与验证，产品规则、视觉方案和验收边界以项目文档为准。

## 1. 准备仓库

优先克隆正式仓库，不要在旧压缩包副本上长期开发：

```bash
git clone https://github.com/fryjin/bigmoney.git
cd bigmoney
npm ci
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
3. `CODEX_SKILLS_SETUP.md`
4. `CODEX_TASK_PHASE_3_0.md`
5. `docs/design/ui-2.5d-visual-guidelines-v1.0.md`

## 3. 首次任务提示词

```text
读取 AGENTS.md、docs/rules-baseline.md、CODEX_SKILLS_SETUP.md 和 CODEX_TASK_PHASE_3_0.md。
先运行 npm run codex:preflight 与 npm run check，确认已合并的 Phase 2.1 基线通过。
然后只实施 Phase 3.0：按任务书的分阶段激活顺序，将既有 8-node technical slice 扩展为正式 36 格地图与内容；不得在 Step 5 Integration 之前切换 production default，也不得扩展监狱、设施、合作项目、小游戏、正式美术、AI 或联网系统。
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
