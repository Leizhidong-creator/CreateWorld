# 当前运行时源码映射

以下路径相对CreateWorldAgent仓库根目录。执行时重新核实文件与调用关系，不能根据本文假定已有主题API。技能包可以独立搬运，实际接入仍需调用方提供目标工程。

## 当前工作台采用的源码

主要源码是 `create-world-workbench/packages/runtime/`。`create-world-workbench/packages/compiler/index.ts` 会把运行时JS/CSS/SVG复制进独立构建，并引用 `runtime/styles.css`；因此只修改旧底座 `pixel-story-kit/src/` 或某个已导出的副本，不代表正式制作已采用修改。

| 源码 | 相关入口与职责 |
| --- | --- |
| `styles.css` | `.psk`、HUD、工具栏、面板、对话、背包、成就、暂停、`.bwc-*`控件、响应式和减少动态效果规则 |
| `controls.js` | `mountControls()`构建摇杆和按钮；底座/摇杆头通过图形设置及CSS变量引用；指针行为不属于换肤内容 |
| `assets/joystick-base.svg`、`assets/joystick-knob.svg` | 原有摇杆图形；优先复用或修改当前游戏引用，不能无依据另生成同类图形 |
| `input.js` | 键位、触控适配、`context()`和输入隔离；当前`Input`未将可选摇杆图片配置暴露为游戏主题字段 |
| `ui.js` | `title()`、`pause()`、`dialogueView()`、`map()`、`inventory()`、`achievements()`、`toast()`及帮助设置；保留DOM语义和焦点行为 |
| `render.js` | `drawMap()`绘制地图内容；Canvas内部有直接颜色值，CSS背景或根节点主色不会自动改写它们 |
| `engine.js` | `createGame()`、组件串联、暂停恢复和保存；当前主题接入包括根节点`--accent`/`--accent-soft`，不能据此假定所有UI已有主题接口 |
| `state.js`、`storage.js` | 统一剧情、物品、发现、成就和存档语义；界面适配不得改写 |

## 接入判断

- 优先使用已存在的 `config.theme`、根节点变量和目标游戏项目级CSS；不要凭空增加字段并假定运行时会读取。
- 当前编译器能打包声明的扩展及其JS/JSON/CSS，扩展会在游戏启动前加载；CSS是否真正引用仍需实现并验证。必须沿用配置中的扩展声明和当前编译检查，不能假定把文件放进目录就会生效。
- 核对当前内容安全策略和本地资源限制，避免外链字体、CDN和未打包资源；优先系统中文字体或项目已有可用字体。
- 需要补充图形时，CSS/SVG优先用于边框、按钮和图标；复杂原创装饰才调用图像工具。装饰层不能截获点击或覆盖焦点标识。
- 缺少地图配色、摇杆配置或主题加载接口时，列明缺口。不要用遮挡地图、覆盖交互层、重画另一张不一致地图或修改全局源码假装完成。
- 若调用方随后授权宿主适配，按目标工程做最小可选扩展并保留旧默认行为，测试两个不同游戏的主题隔离；这不是本次新建技能时自动执行的任务。
