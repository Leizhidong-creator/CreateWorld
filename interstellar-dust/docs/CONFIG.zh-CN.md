# 内容配置指南

配置是 JavaScript 模块，默认导出/命名导出一个对象；不是任意 JSON 脚本解释器。推荐从 `examples/harbor.js` 复制。所有素材通过 `assetBase` 解析，适合整目录移动。

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

统一逻辑视口为 **640×360**，Canvas 和素材在屏幕上等比放大。场景至少等于视口；小场景 640×360 镜头固定，大场景跟随角色。角色位置是**脚部中心**，矩形均为 `{x,y,w,h}`，不使用屏幕坐标配置碰撞或地图。

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

消耗动作不会产生负数，但**不负责判断能否消耗**：将 `{item:'id'}` 写进分支/选项条件。重要交付要用明确的对白选项，不要靠近就消耗。

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

## 人物动画扩展（尘埃之外）

characters 支持可选 frameCount（默认 3）、idleFrame（默认 1）、frameDuration（毫秒，默认 125）、footAnchor（帧内坐标，默认底边中心）。图集行依次 down、left、right、up。四帧 skill 包设置 frameCount:4、idleFrame:0、frameDuration:170、footAnchor:{x:24,y:61}，帧尺寸 48×64。静态 NPC 使用一列并设置 frameCount:1、idleFrame:0。所有字段在加载配置时校验。
