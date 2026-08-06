# CI Phaser GameConfig 修复 v0.1.5

## 故障

`vue-tsc --noEmit` 报错：

```text
src/phaser/createGame.ts(12,5): error TS2353:
Object literal may only specify known properties,
and 'resolution' does not exist in type 'GameConfig'.
```

## 原因

当前项目使用 Phaser 4.2.1。该版本的 `Phaser.Types.Core.GameConfig` 类型不再接受顶层 `resolution` 字段。

## 修复

删除 `createGame.ts` 中的顶层 `resolution` 配置，保留：

- 1194 × 834 逻辑画布；
- `Phaser.Scale.FIT`；
- `CENTER_BOTH`；
- 抗锯齿与整数像素渲染。

该改动只修正 Phaser 4 配置契约，不改变游戏规则、流程、UI 或内容数据。
