# Phase 1.4 八节点技术切片收口

## 目标

Phase 1.4 不新增正式规则系统，专门处理同设备多人游戏的回合交接、重复操作保护和稳定存档恢复，使八节点技术切片能够持续运行并作为 Phase 2.0 的可信基线。

## 已实现范围

### 1. 玩家交接状态

XState 新增稳定状态：

```text
presentingTurnEnd
→ awaitingHandoff
→ HANDOFF_CONFIRMED
→ turnReady
```

- 回合结束动画完成后不再直接开放下一玩家投骰。
- 下一玩家必须在交接遮罩中确认“已准备好”。
- `awaitingHandoff` 与 `turnReady` 均属于可写入存档的稳定状态。
- 从 `awaitingHandoff` 刷新时，仍会恢复到玩家交接遮罩，不会跳过隐私保护。

### 2. 私有信息保护

交接期间：

- 关闭手牌面板；
- 关闭资产面板；
- 隐藏当前玩家现金、位置和私有入口；
- 隐藏底部操作台；
- 只显示上一玩家到下一玩家的设备交接信息；
- 下一玩家确认后才恢复私有信息和投骰入口。

公开的棋盘、建筑和玩家公共状态仍可保留，符合本地桌游的共享信息模型。

### 3. 回合结束提示

原“结束回合”按钮升级为：

```text
结束回合
交给玩家二
```

按钮仅在 `turnEnd` 出现，并使用轻量强调动画。减少动态模式下动画自动关闭。

### 4. 重复操作保护

保护层包含：

- UI 命令锁；
- XState 流程状态校验；
- Session 重入保护；
- 动画播放期间禁用领域命令；
- 决策按钮提交后立即锁定；
- 场景表现失败或超时后仍执行 `presentationDone`，避免永久卡死。

动画和界面仍不能直接修改 `GameState`。

### 5. 存档 Schema v2

新存档结构：

```ts
interface TechnicalSliceSave {
  schemaVersion: 2;
  game: GameState;
  random: RandomSnapshot;
  flow: 'turnReady' | 'awaitingHandoff';
  handoffFromPlayerId: string | null;
  savedAt: string;
  integrity: string;
}
```

写入前校验：

- GameState 基础结构；
- 玩家索引和位置；
- 地产所有者与等级；
- 随机数算法和状态；
- 稳定回合边界；
- 不允许未完成交互、剩余步数或已投骰状态写入。

读取时校验：

- Schema 版本；
- 稳定 Flow；
- 存档时间；
- FNV-1a 完整性标记；
- GameState 与 RNG 结构。

### 6. 旧存档迁移与损坏隔离

- Schema v1 稳定存档自动迁移到 v2；
- 无法识别或完整性失败的存档移动到隔离槽；
- 主存档槽清空后使用新游戏启动；
- 用户界面显示恢复提示，不以白屏或启动异常结束。

### 7. 继续游戏 / 重新开始

检测到有效存档时显示启动入口：

- 当前大轮；
- 当前玩家；
- 保存时间；
- 恢复节点；
- 继续游戏；
- 重新开始。

存档只恢复到稳定边界，不恢复到骰子、移动、弹窗或动画中间。

## 测试覆盖

新增或扩展：

- 玩家交接必须显式确认；
- 交接前不能投骰；
- `awaitingHandoff` 刷新恢复；
- 连续八个玩家回合无流程卡死；
- Schema v2 写入和读取；
- Schema v1 自动迁移；
- 损坏存档隔离；
- 玩家交接边界保存。

## 未包含内容

- iPad Safari 真机验收：继续挂起；
- 强制付款、清算和破产：Phase 2.0A；
- 监狱、合作项目和完整卡牌响应；
- 2～4人创建流程；
- 36格正式地图；
- 正式美术替换。

## 下一阶段

Phase 2.0A 将跨越 Game Core、Game Flow、Web UI、Persistence 和测试。建议从该阶段开始使用本地 Codex，入口文件：

- `CODEX_START_HERE.md`
- `CODEX_TASK_PHASE_2_0.md`
- `AGENTS.md`
