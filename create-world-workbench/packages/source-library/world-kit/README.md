# Create World World Kit v1

这是 Create World 的固定源码库，供后续 AI 制作游戏时直接复用。所有游戏必须使用 **16:9** 显示比例：

- 固定 640×360 逻辑视口；
- 固定 16:9 画布比例（`GAME_ASPECT_RATIO = 16 / 9`）；
- 固定左下摇杆和右下交互键坐标；
- 固定键盘映射；
- 固定世界坐标到地图坐标的投影；
- 固定地图绘制、任务区域提示和玩家位置标记；
- 固定交互目标排序、距离判定和交互按钮状态接口。

## 入口

```js
import {
  VIEWPORT,
  CONTROL_LAYOUT,
  mountWorldControls,
  mountJoystick,
  mountInteractionKey,
  drawWorldMap,
  worldToMap,
  nearestInteraction,
} from './index.js';
import './styles.css';
```

## 固定坐标合同

所有游戏使用 `640×360` 的逻辑坐标和 16:9 画布比例。宿主容器可以缩放，但不能改变逻辑坐标或拉伸画面。使用 `assert16x9(width, height)` 检查外层画布尺寸。

| 元素 | x | y | 宽高 |
| --- | ---: | ---: | ---: |
| 摇杆 | 24 | 264 | 84×84 |
| 交互键 | 544 | 264 | 72×72 |
| 地图内边距 | 10 | 10 | 由场景缩放 |

角色位置、场景碰撞、交互矩形和地图标记都使用世界坐标。地图只负责显示，不修改游戏状态。

## 推荐接入

```js
const controls = mountWorldControls({
  target: gameRoot,
  onMove: ({x, y, keys}) => input.setMove(x, y, keys),
  onActionDown: () => input.actionDown(),
  onActionUp: () => input.actionUp(),
});

// The composite control starts hidden and input-disabled. Enable it only when
// the game is in active play. Its target must be a positioned 16:9 surface
// (for example, the runtime `.psk` element). Add class `cw-source-surface`
// when using the standalone library CSS.
controls.setContext({ visible: true, actionEnabled: Boolean(target), keyboardEnabled: true });

// Keyboard actions use mountKeyboard directly, or pass onAction/onKeyDown
// to mountWorldControls so the fixed keyboard map is mounted once.

controls.setContext({
  visible: true,
  actionVisible: true,
  actionEnabled: Boolean(target),
  actionLabel: target?.label || '交互',
});

drawWorldMap(canvas, {
  scene,
  player: state.player,
  quest,
  config,
  test: condition => store.test(condition),
  explored: state.explored,
  expanded: true,
});
```

## 复用规则

1. 需要移动、触屏交互或地图时，先读取本目录和 `SKILL.md`，再调用这里的模块。
2. 不复制一份新的摇杆、地图或交互按钮实现；题材定制放在参数、主题和回调中。
3. 不改变 `VIEWPORT`、`CONTROL_LAYOUT`、键盘映射和地图投影。确实需要改变时，应建立新版本目录，而不是偷偷修改 v1。
4. 交互按钮只发送输入事件，不直接修改剧情状态；剧情事务仍由游戏运行时处理。
5. 地图只读场景和状态快照，不通过调试对象、全局变量或传送修改玩家位置。

## 文件

- `index.js`：稳定入口；
- `layout.js`：视口、固定坐标和坐标换算；
- `joystick.js`：触屏摇杆；
- `interaction-key.js`：交互按钮；
- `keyboard.js`：固定键盘映射和键盘监听；
- `interaction.js`：最近目标排序；
- `controls.js`：组合控件并管理统一生命周期；
- `map.js`：地图投影和绘制；
- `styles.css`：固定控件样式；
- `assets/`：摇杆底图和摇杆旋钮；
- `provenance.md`：来源与修改边界。

独立打包文件位于仓库根目录 `releases/CreateWorldWorldKit-v1-20261030.zip`，压缩包内路径保持为 `world-kit/`。
