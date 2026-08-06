# Phase 1.2 交互完善与视觉资产接口升级

## 1. 阶段目标

Phase 1.2 不扩展游戏规则，不进入36格完整地图，也不替换最终美术。该阶段在 Phase 1.1 已通过 CI 的基础上，解决以下工程问题：

- 将技术切片视觉资源从 BootScene 中的硬编码加载，升级为统一注册表；
- 为未来透明 WebP、纹理图集与正式角色资产保留稳定接口；
- 增加加载进度和资源失败提示；
- 增加高质量、标准、省电三档显示设置；
- 增加完整动效、减少动态两档动画设置；
- 让 Phaser 动画和 Anime.js 状态动画遵守减少动态设置；
- 强化当前玩家在棋盘中的视觉定位；
- 保持动画只消费 PresentationCue，不参与规则结算。

## 2. 新增模块

### 2.1 Presentation Preferences

路径：

```text
apps/web/src/presentation/preferences.ts
```

职责：

- 定义画面质量和动画偏好；
- 从 `localStorage` 读取和保存设置；
- 自动识别系统的 `prefers-reduced-motion`；
- 将用户偏好转换为场景执行配置；
- 不保存游戏规则状态，不进入领域事件日志。

当前设置：

```text
quality: high | standard | economy
motion: full | reduced
```

### 2.2 Visual Asset Registry

路径：

```text
apps/web/src/phaser/assets/visualAssetRegistry.ts
```

每项资源包含：

- 稳定资源 ID；
- Phaser 纹理 Key；
- SVG、Image 或 Atlas 类型；
- 源文件路径；
- 预加载尺寸；
- 显示尺寸；
- Origin；
- 脚底锚点；
- 深度偏移；
- 资源分类；
- 是否为关键资源；
- 降级策略标记。

正式美术替换时，应优先修改注册表和资源文件，不应在 TownScene 中重新散落尺寸与锚点常量。

## 3. 场景交互改动

### 3.1 加载状态

BootScene 统一读取视觉资源注册表，并向 Vue UI 回传：

```text
加载进度
资源加载错误
场景就绪
场景关闭
```

GameCanvas 在场景未就绪时显示加载遮罩，不再出现空白画布。

### 3.2 当前玩家焦点

TownScene 新增当前玩家脚底焦点环：

- 随当前玩家移动；
- 使用玩家颜色；
- 深度位于棋子下方；
- 只承担视觉提示，不参与碰撞或规则判断。

### 3.3 动效设置

减少动态开启后：

- Phaser Tween 时长缩短至约18%；
- 场景延时同步缩短；
- Vue 状态胶囊不再执行 Anime.js 位移动画；
- PresentationCue 和 `PRESENTATION_DONE` 数据流保持不变。

### 3.4 省电模式

省电模式当前关闭非必要城市车辆显示，并缩短完整动画时长。它不会：

- 改变骰子结果；
- 跳过领域事件；
- 改变路径节点；
- 改变经济参数；
- 改变保存内容。

## 4. 强制数据流保持不变

```text
Vue 操作
→ GameCommand
→ XState Guard
→ Game Core
→ DomainEvent
→ GameState
→ PresentationCue
→ Phaser / Vue 表现
→ PRESENTATION_DONE
```

显示设置只影响最后两项的表现强度，不允许反向修改 GameState。

## 5. 新增测试

新增：

```text
apps/web/src/presentation/preferences.test.ts
apps/web/src/phaser/assets/visualAssetRegistry.test.ts
```

覆盖：

- 偏好配置规范化；
- 减少动态时长配置；
- 省电模式交通开关；
- 视觉资源 Key 唯一性；
- 锚点范围；
- 注册表资源 ID 解析。

## 6. 本阶段不包含

- 36格完整地图；
- 正式 Tiled 地图导入；
- 正式 WebP 或 Atlas 美术资产；
- 四名玩家完整角色资源；
- 监狱、合作项目、小游戏和破产清算；
- Cloudflare Pages 实际上线；
- 规则参数调整。

## 7. 验收条件

### CI

- `npm install` 成功；
- `npm run verify:repository` 成功；
- `npm run verify:structure` 成功；
- 全工作区 TypeScript 检查成功；
- Vitest 成功；
- Vite 生产构建成功；
- `bigmoney-web-dist` 构建产物上传成功。

### 交互

- 首次加载有明确进度反馈；
- 显示设置可以打开和关闭；
- 三档质量切换立即生效；
- 减少动态明显缩短动画；
- 设置刷新后仍保留；
- 当前玩家焦点环位置正确；
- 动画期间重复点击仍被现有流程锁阻止。

### iPad

- Safari 横屏打开无画布变形；
- 设置面板不遮挡主要决策 Modal；
- 标准模式连续运行15分钟无明显卡顿；
- 减少动态模式下没有长时间阻塞；
- 页面刷新后稳定节点存档仍可恢复。
