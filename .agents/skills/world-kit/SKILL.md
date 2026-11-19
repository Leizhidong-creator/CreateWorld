---
name: world-kit
description: 复用 Create World 固定的摇杆、地图和交互键源码库；需要移动、触屏交互或地图时优先读取。
---

# World Kit 固定源码库

当游戏需要玩家移动、手机摇杆、情境交互按钮或区域地图时，优先复用工作台的固定源码库，不重新发明一套控件。所有游戏画面必须保持 16:9，禁止使用 4:3、1:1 或拉伸画布。

## 源码位置

在工作台中读取：`packages/source-library/world-kit/`。

入口是 `index.js`，包含 `layout.js`、`joystick.js`、`interaction-key.js`、`map.js`、`styles.css` 和 `assets/`。`mountWorldControls` 同时提供摇杆、交互键和固定键盘映射；也可以单独使用 `mountKeyboard`。

## 固定合同

- 逻辑视口永远是 `640×360`，比例永远是 `16:9`；
- 使用 `GAME_ASPECT_RATIO`、`is16x9` 和 `assert16x9` 检查画布，不在各模块重复写比例数字；
- 摇杆逻辑坐标为 `{x:24,y:264,size:84}`；
- 交互键逻辑坐标为 `{x:544,y:264,size:72}`；
- 地图内边距为 `10`；
- 世界坐标用于角色、碰撞、交互矩形和地标；
- 地图使用 `worldToMap` 和 `mapFrame` 投影；
- 键盘映射固定为 WASD/方向键移动，E/空格交互，M 地图，I 物品，J 成就，Esc/P 暂停。

## 接入规则

1. 先复制或导入 `packages/source-library/world-kit/index.js` 和 `styles.css`，再连接当前游戏的输入和状态回调；外层容器加 `cw-source-surface` 并验证 16:9。
2. 用 `mountWorldControls`、`mountKeyboard`、`drawWorldMap` 和 `nearestInteraction`，不要复制运行时旧实现并另起名字；模态界面出现时将 `keyboardEnabled` 设为 `false`。
3. 控件只发出移动和交互输入，不直接修改剧情状态；剧情变更必须通过运行时事务。
4. 地图只读取状态快照，不能用地图按钮传送角色或写入全局调试状态。
5. 题材差异通过调色、资源和回调适配；不要改变固定坐标、投影规则或键位。
6. 如果确实需要不同布局，创建 `world-kit-v2` 并记录迁移原因，不能静默改写 v1。

## 最小示例

```js
import { mountWorldControls, drawWorldMap, nearestInteraction } from './packages/source-library/world-kit/index.js';

const controls = mountWorldControls({
  target: gameRoot,
  onMove: input.onMove,
  onActionDown: input.onActionDown,
  onActionUp: input.onActionUp,
});

controls.setContext({
  visible: true,
  actionVisible: true,
  actionEnabled: Boolean(target),
  actionLabel: target?.label || '交互',
});

drawWorldMap(mapCanvas, { scene, config, player: state.player, quest });
```

来源边界见 `packages/source-library/world-kit/provenance.md`。它继承了现有运行时和 Pixel Story Kit 的来源记录，不改变原有授权范围。
