# UI设计规范 v1.0

## 画布

- 设计基准：1194×834横屏
- 安全边距：左右24，上下20
- 场景区域优先，UI常驻覆盖面积应受控

## 层级

1. 城市和棋子
2. 其他玩家简略状态
3. 当前玩家摘要
4. 当前阶段提示
5. 底部操作台
6. ContextPanel
7. 阻断Modal
8. Toast和短时结果

## 常驻组件

- OtherPlayerChip
- CurrentPlayerSummary
- TurnStatus
- HandEntry
- DicePrimaryAction
- AssetEntry

## 上下文面板

统一容器，不同内容复用：

- PropertyPanel
- StockPanel
- ProjectPanel
- EventPanel
- JailPanel
- PaymentPanel
- AssetPanel

## Modal

- PropertyDecisionModal
- ProjectInviteModal
- DefenseModal
- CardReplacementModal
- LiquidationModal

## 状态

所有可操作组件至少包含：默认、按下、禁用、等待、成功、错误。不能只设计静态默认态。

## 动效节奏

- 按钮反馈：80～140ms
- 小面板：180～260ms
- Modal：220～320ms
- 棋子单步：180～260ms
- 结果强调：350～700ms
- 长动画必须可加速
