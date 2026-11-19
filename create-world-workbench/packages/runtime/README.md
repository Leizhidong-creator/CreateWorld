# Create World runtime 2

原生 ES Modules、Canvas 2D、DOM，浏览器运行不依赖工作台或 Codex。`createGame(config,{target,storage?})` 返回 `start/pause/resume/save/destroy/getState/observe/registerAction/registerMiniGame`。实例 API 不暴露在 window；独立编译包只提供深拷贝冻结的 `window.__CREATE_WORLD_OBSERVE__()` 和 `__CREATE_WORLD_STATE__` getter。观察值包含 `{run,profile,ui:{kind},target:{id,label}|null,revision,trace}`；测试只能真实键鼠/触屏操作，不能改观察值通关。

## JSON 配置

完整输入见 `../../fixtures/harbor.json`、`station.json`。保持旧版 Pixel Story Kit 内容字段兼容；编译输入必须为 JSON，`hooks` 中函数改为显式扩展模块。顶层有 `id,title,description,theme,player,start,assets,characters,scenes,dialogues,quests,items,clues,achievements,endings,minigames`。数组为空必须写 `[]`；资源 `{id,type:'image'|'audio',src}` 的 src 相对调用编译器时的 assetDir。assets 不含运行时自带摇杆素材；编译器自动附带。可选 `durationMinutes` 是制作预算/标签，不是测试结论；两个技术夹具约 5 分钟且标记 prototype，不冒充正式 10–20 分钟成品。

- 固定逻辑视口 640×360（16:9）；运行时画布必须保持 16:9，不得拉伸。世界坐标始终以角色脚底中心为基准。`player.radius` 为圆形脚底碰撞半径，和显示尺寸无关。
- `scene.width/height` 至少 640×360。`scene.camera:{mode:'fixed'|'follow',x?,y?}`；省略时小场景固定、大场景跟随。
- `scene.background` 引用素材ID，按世界尺寸画；`sourceSize:{width,height}` 描述原图尺寸供 `imageToWorld/worldToImage` 转换。内容几何统一提交世界坐标，禁止混用源图像素或屏幕坐标。
- `scene.walkPolygon:[{x,y},...]` 是可走区边界；`collisions` 是障碍列表，支持原矩形 `{x,y,w,h}`、`{type:'circle',x,y,r}`、`{type:'polygon',points:[{x,y}]}`。脚底圆必须整体处于走区内且不与障碍相交。
- `objects[].solid` 使用同一形状协议；`when` 控制物件及障碍。`layer:'floor'` 先绘制，普通物体按 `depthY??y+h` 排序，`layer:'foreground'` 最后遮挡。背景图存在时碰撞不会自动绘制成墙；灰盒无背景时原矩形墙体表现保留。
- 角色 `{id,asset,width,height,frameWidth,frameHeight}`：旧四行三列不变。四向四帧使用 `atlas:{columns:4,rows:{down:0,left:1,right:2,up:3},fps:8,idleFrame:0}`。不规则图集使用 `atlas:{directions:{down:[{x,y,w,h}],left:[...],right:[...],up:[...]},fps:8,idleFrame:0}`；`anchor:{x:.5,y:1}` 是绘制区域内的归一化脚点。编译器按实际图片尺寸检查所有帧，不自动猜测方向。

## 剧情与事务

条件为 `{flag,equals?}`、`{item,count?}`、`{clue}`、`{quest,status?}`、`{counter,atLeast?}`、`{scene}`、`{visited,count?}`、`{discovered}` 或 `all/any/not` 组合。交互 `branches` 自上而下选择首个满足条件的分支，省略分支条件为默认。任务 `initial/unlock/complete/onComplete/target`；对白 `lines:[{speaker,text}],choices:[{label,when?,actions}],onComplete,once`。

动作：flag、give、take、clue、quest、count、discover、achievement、notice、dialogue、scene、ending、minigame、custom。`StoryStore.commit(actions,onceId?,guard?)` 在旧状态检查 guard，在候选副本计算状态和任务奖励，检查全部变量/不变量后一次替换权威状态，最后发送界面命令和通知。失败抛错，run/profile/revision/once/事件均不变化；guard 拒绝或重复 once 返回 false。take 不足不再静默截断为 0。

可选 `state:{strict?,variables:[{id,type:'bool'|'int'|'enum',initial,min?,max?,values?}],invariants:[{id,if:[condition],then:[condition]}]}`；声明变量映射到 run.flags。新增 `{var,op:'eq'|'ne'|'lt'|'lte'|'gt'|'gte',value}` 条件。strict 禁止未声明 flag。该运行时执行校验不等于穷举证明，有限模型验证由 game-state 工作流另行提供。

玩家实时坐标和UI临时态不混进剧情事务；插件收到 state 副本，只能通过动作结果影响剧情。run 与 profile 存档独立；saveVersion 不兼容时拒绝旧档，保留原记录，不自动虚构迁移。

## 扩展

`extensions:[{id,entry:'my-module.js'}]`，编译时传 `extensionsDir`。模块 `export default function register(game){ game.registerAction('id',handler); game.registerMiniGame('id',loader); }`。custom handler 接收 `{args,state,signal}` 并返回动作数组；小游戏 mount 收到 `complete/fail/cancel/signal/state/input/useControls`，返回 destroy。完整结束、失败、取消、异步迟到和重复回调由主机隔离；插件负责释放自身计时器，推荐事件用 signal。

扩展代码是明确授权的本地模块，不来自故事正文；只能相对导入扩展目录内文件。CSP 禁止远程资源。编译检查扩展声明/文件/导入边界；实际注册和玩法仍须浏览器验证，不能靠存在 .js 文件判定玩法已实现。

## 稳定测试选择器

`[data-testid=start-game]`、continue-game、tutorial-done、dialogue-next、choice-0（按顺序）、map-open、pause-open、save-game、resume-game、ending-next、return-title、game-canvas、joystick、action-button。选择项也可按可访问按钮文字操作。`../../fixtures/journeys.json` 提供真实输入旅程，不包含状态注入。

## 恢复尚未完成的剧情

运行时把已排队、正在显示的对白/互动指令保存在本局 `pendingCommands`。刷新后点击继续会恢复未完成对白（从该段第一句开始），小游戏则重新挂载。确认奖励与移除待处理指令合并写入同一份 run 快照；奖励事务拒绝时保留指令且不标记奖励 once。普通对话仍不要求配置 once，一次性奖励应明确使用 dialogue/mini 的 once。插件自定义副作用必须自行做到幂等，运行时仅保证其返回的状态效果与队列确认。
