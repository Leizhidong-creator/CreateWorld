# 内容配置指南

本工作台接收纯 JSON GameConfig。推荐从 `fixtures/harbor.json` 复制。assets[].src 相对资产目录；编译器指定 assetBase，内容不要设置 assetBase、alternate 或 hooks。下面为兼容的旧字段；新增约定见文末。

## 顶层字段

| 字段 | 用途 |
| --- | --- |
| `id`、`saveVersion` | 每个游戏唯一 ID；不兼容改动提升 saveVersion。不同 ID 完全隔离存档。 |
| `title`、`subtitle`、`description` | 标题与介绍；`alternate` 为示例切换链接，可删除。 |
| `theme.accent`、`theme.world` | 界面强调色和默认场景色板。场景 `palette` 可覆盖。 |
| `assetBase`、`assets` | 素材基础 URL；数组项 `{id,type:'image'或'audio',src}`。支持浏览器可解码的图片与音频。 |
| `player` | `{character,speed,radius}`，速度为世界像素/秒，radius 是脚部碰撞半径。 |
| `start` | `{scene,position:{x,y}}`。 |
| `scenes`、`characters`、`dialogues`、`quests`、`items`、`clues`、`achievements`、`endings`、`minigames` | 必须提供数组；未启用的项目使用空数组，至少一个场景、角色和结局。 |
| `features` | `map`、`fog`、`tutorial`、`clueNotebook`。省略时默认有地图、有引导，无迷雾和线索笔记。 |
| `music`、`sounds` | 音乐资源 ID；声音对象支持 interact、notice、achievement。 |

世界色板字段：floor、floorAlt、seam、detail、wall、wallTop、shadow、wood、woodLight、woodDark、cloth、trim、water、wave、leaf、leafLight、roof、roofLight。使用背景图时，仍保留色板用于小地图和未换掉的基础对象。

## 场景坐标

统一逻辑视口为 **640×360（16:9）**，Canvas 和素材在屏幕上等比放大，禁止拉伸。场景至少等于视口；小场景 640×360 镜头固定，大场景跟随角色。角色位置是**脚部中心**，矩形均为 `{x,y,w,h}`，不使用屏幕坐标配置碰撞或地图。

场景字段：

- `id,name,width,height,palette,background?`：背景可引用图片 ID，按场景尺寸绘制。
- `collisions`：静态矩形墙体；`objects[].solid`：随对象显示条件生效的矩形障碍。
- `objects`：`id,x,y,w,h,kind?,asset?,layer?,when?,solid?`。`asset` 优先绘制图片；`layer:'floor'` 适合地毯/地面，否则按 y+h 排序遮挡。
- 基础 `kind` 包含 desk、shelf、bed、crate、sign、building、tree、lamp、rug、water，主要供样例与原型使用。
- `npcs`：`id,character,x,y,facing,when?`；朝向 down/left/right/up。NPC 对话由独立 interactions 配置。
- `interactions`：可主动交互的对象。
- `exits`：`id,rect,to,spawn,label,when?,lockedText?,automatic?`。默认靠近后按交互键；automatic=true 时踏入触发。切换后有短暂出口冷却，避免立即返回。
- `regions`：具有 ID 的矩形区域，用于任务引导；进入目标区域后停止精确引导。
- `landmarks`：`x,y,label,when?`，显式已知地标；不要把未发现的彩蛋放进去。
- `triggers`：`id,rect,when?,wait?,once?,actions`；wait 单位秒，离开区域重新计时。默认只触发一次。
- `onEnter`：该场景首次进入时执行的动作，记录在本局 once 中；每次进出逻辑可用注册钩子。

角色精灵表：`{id,asset,frameWidth,frameHeight,width,height}`。当前渲染器使用四行（下、左、右、上）×三列，待机用中间帧，行走循环三帧。可直接换同布局的透明 PNG/WebP/SVG；不同帧布局需要扩展渲染器并保留接口。

## 交互与分支

```js
{
  id: 'door-console',
  rect: {x: 280, y: 180, w: 60, h: 30},
  range: 30,
  label: '调查', name: '门边的控制器',
  branches: [
    {when: {flag:'doorOpen'}, actions:[{type:'notice',text:'门已经打开。'}]},
    {when: {item:'key'}, actions:[{type:'flag',id:'doorOpen'}]},
    {actions:[{type:'notice',text:'需要一把钥匙。'}]}
  ]
}
```

branches 从上到下匹配第一个条件，省略 when 表示默认分支。没有 branches 时执行 actions。`once:true` 防止重复发奖，`repeatText` 配置再次操作提示。`hold:1.5` 表示长按 1.5 秒后触发，完成一次后必须松开才能再次触发。多个目标同时接近时先按 priority 降序，再按距离，再按 ID 排序。

`when` 决定目标是否可见/可交互；需要显示“条件不足”的目标请用 branches，而不是直接用 when 隐藏。

## 条件与动作

条件每层只有一个操作；复合使用 all/any/not：

```js
{all:[{quest:'get-key'}, {item:'key'}, {not:{flag:'doorOpen'}}]}
```

支持：flag（可带 equals，默认 true）、item（count 默认 1）、clue、quest（status 默认 done）、visited（count 默认 1）、discovered、counter（atLeast 默认 1）、scene。每次有效交互会增加以 interaction.id 命名的 counter。计数条件在本次交互开始前判断，因此“第三次调查触发”使用 `atLeast:2`。

| 动作 | 作用 |
| --- | --- |
| `{type:'flag',id,value?}` | 修改剧情标记，默认 true |
| `{type:'give'/'take',id,count?}` | 增加/消耗物品；数量正整数，默认 1 |
| `{type:'clue',id}` | 记录信息线索 |
| `{type:'quest',id,status?}` | 激活/完成任务；已完成任务不重新激活 |
| `{type:'discover',id}` | 记录发现 |
| `{type:'count',id,amount?}` | 增加计数 |
| `{type:'achievement',id}` | 解锁成就 |
| `{type:'notice',text}` | 非阻塞提示 |
| `{type:'dialogue',id}` | 打开对白 |
| `{type:'scene',id,position}` | 切换场景 |
| `{type:'ending',id}` | 满足结局条件时播放 |
| `{type:'minigame',id,onSuccess?,onFailure?,once?}` | 进入已注册插件，详见 API |
| `{type:'custom',id,args?}` | 执行显式注册处理函数 |

状态动作在 commit 时执行；界面、转场等命令进入队列，当前模态结束后处理。需要“对话结束后才交物品”时，把 give 放到 dialogue.onComplete，不要和打开对话放在同一批中。关键选择的后果放在 choice.actions。

消耗数量不足会令整批事务失败并回滚；仍建议将 `{item:'id'}` 写进分支/选项条件以提供可理解反馈。重要交付要用明确的对白选项，不要靠近就消耗。

## 对话、任务和物品

对白：`{id,lines:[{speaker,text}],choices?:[{label,when?,actions}],onComplete?:[],once?:true}`。线性内容结束后执行 onComplete；存在选项时选完再执行 onComplete 与该选项动作。once 防止奖励重复，仍可重看对白；要避免重复关键选择，在 NPC 的交互分支中切换到完成后的对白。

任务：`{id,title,initial?,optional?,unlock?,complete?,target?:{scene,region},onComplete?:[]}`。初始任务用 initial；其余由 unlock 启用。状态 locked → active → done，完成奖励仅执行一次。已提前拿到道具的任务，解锁时会立即判定完成。UI 只显示第一个 active 非 optional 任务。任务不应构成相互依赖且无法启动的环。

物品：`{id,name,icon?,description,content?}`，icon 为短文本符号，content 用于展开阅读。信息线索：`{id,name,description}`。不启用 clueNotebook 时线索仍被记录并参与剧情判断。

## 彩蛋与结局

成就：`{id,title,icon?,description,when?}`。条件达成或 achievement 动作触发时解锁，长期保存。面板中未发现的成就隐藏标题与说明。彩蛋表现使用普通对白/notice/custom，发现条件使用 trigger 或 interaction；不强制彩蛋发成就。

结局：`{id,title,when?,pages:[{title?,text,image?}]}`。结束后记录结局 ID，保留最后进度；标题不提供继续一个已完成的故事。重开保留长期记录。结局选择完全由任务/对白动作决定，不内置原作证据阈值。图像页面支持同一素材清单。

## 存档与兼容

本地 key 为 `pixel-story:<id>:run` 与 `pixel-story:<id>:profile`。run 包含角色位置、任务、物品、线索、剧情标记、计数、探索与一次性记录；profile 包含成就、结局列表和音量。

结构版本不兼容或损坏时拒绝恢复，并保留原记录直到用户主动开新局；不尝试读取原游戏存档。新内容删除了仍在存档中的场景、物品或任务时，提升 saveVersion。单纯改对白和视觉通常无需提升。存储不可用时仍可本页游玩，并提示无法保存。


# 工作台2.0增量契约（优先于上述旧格式描述）

# Create World runtime 2

原生 ES Modules、Canvas 2D、DOM，浏览器运行不依赖工作台或 Codex。`createGame(config,{target,storage?})` 返回 `start/pause/resume/save/destroy/getState/observe/registerAction/registerMiniGame`。实例 API 不暴露在 window；独立编译包只提供深拷贝冻结的 `window.__CREATE_WORLD_OBSERVE__()` 和 `__CREATE_WORLD_STATE__` getter。观察值包含 `{run,profile,ui:{kind},target:{id,label}|null,revision,trace}`；测试只能真实键鼠/触屏操作，不能改观察值通关。

## JSON 配置

完整输入见 `../../fixtures/harbor.json`、`station.json`。保持旧版 Pixel Story Kit 内容字段兼容；编译输入必须为 JSON，`hooks` 中函数改为显式扩展模块。顶层有 `id,title,description,theme,player,start,assets,characters,scenes,dialogues,quests,items,clues,achievements,endings,minigames`。数组为空必须写 `[]`；资源 `{id,type:'image'|'audio',src}` 的 src 相对调用编译器时的 assetDir。assets 不含运行时自带摇杆素材；编译器自动附带。可选 `durationMinutes` 是制作预算/标签，不是测试结论；两个技术夹具约 5 分钟且标记 prototype，不冒充正式 10–20 分钟成品。

- 固定逻辑视口 640×360（16:9）；世界坐标始终以角色脚底中心为基准。`player.radius` 为圆形脚底碰撞半径，和显示尺寸无关。
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

运行时存档包含 `pendingCommands`，用于刷新后恢复尚未确认的对白/小游戏。确认奖励与队列移除在同一 run 快照保存；异常事务不确认队列。对白从段首恢复，小游戏重新挂载，插件外部副作用须自行幂等。

## 剧情特殊动作（v2.1）

角色可声明 animations:{hammer:{asset:'hammer-art',frames:[{x,y,w,h}],fps:8,anchor:{x:.5,y:.9},events:[{frame:2,name:'contact'}]}}。项目custom handler可 await game.playAnimation('player'或当前NPC实例id,'hammer',{onEvent:name=>...})，然后返回剧情效果数组。动画暂停与主场景一致，销毁取消，不负责改变任务或位置。禁止把onEvent的画面效果当作已提交的剧情事实。基础行走和动作资产相互独立；观察器不提供修改状态接口。

小游戏complete(data)的可序列化结果会作为onSuccess中custom动作的args.result保存；custom处理器校验后返回统一状态效果，避免只保存在内存闭包导致刷新丢失。
