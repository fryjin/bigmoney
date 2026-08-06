# Big Money

面向 iPad 横屏的 2.5D 本地多人回合制大富翁游戏。

当前版本：**Phase 1.3 部署加固与运行验收**。

## 技术栈

- Vite + TypeScript
- Phaser 4：城市棋盘、棋子、骰子与场景动画
- Vue 3：HUD、上下文面板与阻断式决策
- XState 5：回合和中断流程
- Anime.js：DOM 界面过渡
- Zod：内容配置校验
- IndexedDB：稳定节点快照与领域事件日志

## 本地启动

需要 Node.js 22+ 与 npm 10+。

```bash
npm install
npm run check
npm run dev
```

默认开发地址由 Vite 输出。生产构建目录为：

```text
apps/web/dist
```

## 当前可玩范围

- 两名玩家轮流行动；
- 单枚六面骰；
- 八节点闭环路径与逐格移动；
- 经过股票市场时暂停、购买或跳过后继续移动；
- 无主地产购买；
- 自有地产落地升级一级；
- 对手地产租金；
- 随机事件；
- 免费抽卡与满手“四选三”技术验证；
- 大轮结束时股票倒计时和结算；
- IndexedDB 本地快照。

完整 36 格规则尚未全部接入。规则基线以 `docs/rules-baseline.md` 为准。

## 关键文档

- `AGENTS.md`：开发边界与强制数据流
- `docs/development-guide.md`：综合开发说明
- `docs/design/ui-2.5d-visual-guidelines-v1.0.md`：视觉规范
- `docs/development/phase-1.1-technical-slice.md`：八节点技术切片说明
- `docs/development/phase-1.2-presentation-interface.md`：交互与视觉资产接口升级说明
- `docs/development/phase-1.2-validation.md`：Phase 1.2 校验记录
- `docs/development/phase-1.3-deployment-hardening.md`：部署加固说明
- `docs/development/cloudflare-first-deployment-checklist.md`：首次上线清单
- `docs/development/ipad-runtime-acceptance.md`：iPad 真机验收表
- `docs/development/build-validation.md`：构建校验记录
- `docs/technical-slice-acceptance.md`：验收基线

## Cloudflare Pages

建议配置：

```text
Root directory: /
Build command: npm run build
Build output directory: apps/web/dist
Node version: 22
```

生产部署完成前，不进入36格地图扩展。
