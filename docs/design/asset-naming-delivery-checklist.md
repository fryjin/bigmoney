# 资产命名与交付清单

## 每个资产必须提供

- assetId
- 文件名
- 类型
- 状态
- 源文件位置
- 运行时文件位置
- 宽高
- anchorX / anchorY
- 所属图集
- 推荐 scale
- Tiled objectId
- 是否可在节能模式隐藏
- 预览图

## 命名模板

```text
{category}_{identity}_{state}_{frame}.{ext}
```

示例：

```text
property_a1_l0.webp
property_a1_l3.webp
stock_market_01_active.webp
pawn_cat_move_03.webp
fx_property_flag_raise_04.webp
```

## 交付目录

```text
assets/source/{category}/
assets/runtime/{category}/
assets/atlases/
assets/previews/
assets/maps/
```

## 验收

- [ ] 透明边缘无黑边
- [ ] 阴影未裁切
- [ ] 脚底锚点正确
- [ ] 同系列状态画布一致
- [ ] 运行时文件无内嵌文字
- [ ] 缩略显示仍可识别
- [ ] 文件名与 manifest 一致
- [ ] 图集内无重复空白
