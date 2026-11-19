# 接入与扩展 API

## 游戏入口

```js
import {createGame} from './src/engine.js';
import {harbor} from './examples/harbor.js';
const game=createGame(harbor, {target:document.querySelector('#game')});
await game.start();
// 页面/组件卸载时：game.destroy();
```

- start()：校验后加载本地素材，显示标题；重复调用不创建第二个循环。
- pause()/resume()：暂停探索、恢复暂停菜单。不会强行关闭剧情对白。
- getState()：返回隔离的 `{run,profile}` 快照；修改快照不会影响游戏。
- save()：保存当前状态，返回是否成功。
- destroy()：清除帧循环、输入监听、插件、音频和界面。重复调用安全。
- registerAction(id, handler)：注册自定义动作；handler 接收 `{args,state,signal}`，可以返回动作数组，异步也可。
- registerMiniGame(id, loader)：注册小游戏工厂。先在 config.minigames 中声明 `{id,title}`。

如需嵌入其他页面，加载 `src/styles.css` 并给挂载容器明确尺寸；独立模块不依赖入口或示例配置。默认播放器使用逻辑视口 640×360。`hooks.enter(sceneId,game)`、exit、update(sceneId,dt,game)、render(sceneId,context,game) 为代码扩展点；默认故事不需要这些钩子。

## 独立摇杆与按钮

```js
import {mountControls} from './src/controls.js';
const controls=mountControls({
  target:document.querySelector('.your-stage'),
  adapter:{
    onMove({x,y,keys}) { /* x/y in [-1,1], keys has w/a/s/d */ },
    onActionDown() {}, onActionUp() {}
  }
});
controls.setContext({controlsVisible:true,joystickVisible:true,actionVisible:true,
  actionEnabled:true,actionLabel:'调查',actionHighlighted:true});
// controls.setAdapter(...); controls.releaseAll(); controls.destroy();
```

依赖 `styles.css` 内 `.bwc-*` 样式及 `assets/joystick-*.svg`；可用 baseImage/knobImage 覆盖。触控逻辑直接改编自上游，保留按指针区分、pointercancel、失焦和销毁清理。组件不依赖任务和场景。

## 小游戏容器

本包只提供容器和验证夹具，不附带整理图书、调频、迷宫等具体玩法。

```js
game.registerMiniGame('my-challenge',async()=>({
  mount(container,ctx) {
    const completeButton=document.createElement('button');
    completeButton.textContent='完成';
    completeButton.addEventListener('click',()=>ctx.complete({score:1}),{signal:ctx.signal});
    container.append(completeButton);
    // 可选：复用左摇杆+右按钮，而不是自己绘制触控区
    ctx.useControls({actionLabel:'确认',onAction:()=>ctx.complete({score:1})});
    // ctx.input() 获取 {x,y,held}；主场景此时仍暂停。
    return {destroy(){completeButton.remove();}};
  }
}));
```

触发动作：

```js
{type:'minigame',id:'my-challenge',once:true,
 onSuccess:[{type:'flag',id:'challengeDone'}],
 onFailure:[{type:'notice',text:'再试一次，观察提示。'}]}
```

ctx 提供 complete(data)、fail(data)、cancel()、signal、state 快照、input() 和 useControls()。容器只接受第一次结果；取消和加载错误不会完成任务；再次交互可以重试。打开地图等主场景 UI 在小游戏期间无效，Esc 退出插件。

组件必须通过 destroy 清理自己创建的计时器、动画帧和其他外部资源；事件监听使用 ctx.signal 可以自动解除。mount 可以返回 Promise，加载或挂载途中取消不会复活旧组件。未完成小游戏内部状态不自动存档，退出/重载从主场景交互点重试；需要复杂中途存档时由插件明确扩展数据模型。

独立使用：`new MiniGameHost(container,onResult)`，register(id,loader)、open(id,options)、cancel()、close()、destroy()。直接调用 close 不回传取消；cancel 会回传 status:'cancel'。

## 其他独立模块

| 模块 | 导出与责任 |
| --- | --- |
| state.js | StoryStore、initialRun、condition；条件、任务状态、一次性奖励与事件 |
| storage.js | SaveManager；load/save/clearRun/clearAll，支持注入 localStorage 风格对象 |
| geometry.js | moveBody、canStand、cameraFor、worldToMap、nearestInteraction；不依赖 DOM |
| render.js | Renderer 和 drawMap；需要 Canvas、素材服务、配置和状态 |
| resources.js | Resources 和 AudioService；资源载入和音频生命周期 |
| input.js | Input；键盘与控件统一输入、失焦清理 |
| ui.js | UI；主界面与模态管理，需要注入回调 |
| validate.js | validateConfig；启动前错误检查，不会执行配置里的自定义代码 |
| events.js | Events；订阅返回取消函数，避免跨场景泄漏 |

StoryStore 主要方法：test(condition)、commit(actions,onceId?)、currentQuest()、restart()、snapshot()。事件有 change、notice、achievement、command。游戏层消费 command 实现异步 UI 与场景操作。不要让插件直接改 store.run；返回状态动作，保持任务与保存一致。

## 第一版扩展边界

保留模块接口再扩展不同精灵布局、复杂碰撞、多任务追踪或特定小游戏。不要为换对白、角色和场景重新实现底座。没有内置关卡编辑器、寻路器、云服务或通用战斗系统。独立组件示例需要相应 DOM/CSS 环境，不能把浏览器渲染模块当作 Node 后端模块运行。
