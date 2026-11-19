# Canvas Room v1

此后端是单场景自由移动游戏的可复用运行时，与原按钮后端并存。入口为 `python scripts/build_room.py room.json --validate-only` 和 `python scripts/build_room.py room.json --output 新目录`。构建器只执行随技能携带的模板，不执行输入中的代码；输出保持 candidate，目录不可覆盖。

世界坐标与背景 PNG 像素一一对应。声明 `schemaVersion:1, backend:canvas-room-v1, id,title,subtitle,width,height`；`walkable` 是矩形 x/y/width/height，`obstacles` 是带 id 的矩形数组。玩家脚点为 `(x,y)`；脚底碰撞盒为 `[x-width/2,y-height,width,height]`，与整张角色图片的透明边缘分离。NPC 脚底同样是实体。移动使用固定 60 Hz 步进和逐轴连续扫掠，不仅检查终点。斜向归一速度，碰撞可滑动，长帧最多处理 0.1 秒。几何校验使用完整身体与4px保守导航格；不能把几何连通性当视觉贴合证据。

`spawn:{x,y,direction}`；`player:{name,characterId,body:{width,height},speed}`；`characters:[{id,cell:{width,height},footAnchor:{x,y},scale,frameMs,sheets:{down,up,left,right}}]`。每方向4帧横排PNG，空闲用第0帧；图片放大只用最近邻。`npcs:[{id,name,characterId,x,y,direction,body,range,dialogueId}]`。`assets.background` 是场景 PNG 相对路径，`media:[{path,sha256}]` 必须精确覆盖背景和所有方向图。禁止外部URL、穿越、链接路径；构建检查哈希/尺寸，浏览器必须进一步实际解码。没有素材不生成伪完成包。

`hotspots:[{id,kind,label,x,y,range,requires,lockedText,...}]` 的 kind 为 power/guidance/egg/exit。坐标是设备前侧可交互锚点，不能藏在实体障碍内部；交互检查实际距离和视线。power/guidance 各一个并要求 briefed；exit 一个，硬要求 briefed/powerReady/guidanceReady；彩蛋永远不能成为出口门槛。egg 附带 `eggFlag:eggHumor|eggRain` 与 dialogueId。

NPC 与热点的 ID 全局唯一。多个目标同时在范围内时，距离最近者获得 E 交互；距离完全相同时按 ASCII ID 排序。几何检查必须证明每个目标能真正成为被选中的最近目标，不能仅证明它处于范围内。

`dialogues:[{id,branches:[{id,when:{flag:boolean},lines:[{speaker,text}],setFlags:[]}]}]`，首个全部条件满足的分支命中，需要 `when:{}` 兜底。可用flag是 briefed/powerReady/guidanceReady/eggHumor/eggRain。对白只能提交 briefed；实际播放到末行后再次确认才提交，取消无效果。蛋对白读完才由蛋事件记其flag。模块完成独立提交，重复成功不会重复奖励。

`modules.power:{size:2|3,tiles:[{mask,rotation,locked}],start:{row,col,port},goal:{row,col,port}}`。端口 bit 为 N1/E2/S4/W8，rotation为顺时针0..3。玩家旋转未锁块后检测实际双向端口图的起终点连通；错误状态、重置、取消均可运行。构建拒绝初始已解及无解谜题，搜索超过预算报告未验证。

`modules.guidance:{initialAngle,initialVelocity,targetAngle,thrust,brake,angleTolerance,speedTolerance,holdSeconds:1,timeLimit}`。左右输入改变角速度，Space 制动；角度在带内且角速度足够低，连续保持1秒才成功。失败超时可重试，取消保留当次进度，暂停冻结计时。这是新增训练模拟，不能冒充原作发生的真实着陆操作。

角度比较使用环绕后的最短距离，179° 与 -179° 相差2°。构建还独立模拟整个时限的零输入轨迹，拒绝自动漂移即可成功的配置。实际可操作完成仍需浏览器输入证据。

`ending:{title,text}`。Canvas场景始终是同一个房间，对白/终端/暂停/存档只是覆盖层，不追加地点。WASD/箭头连续移动，E交互，Esc关闭覆盖层或暂停。对话期间清空移动输入，结束需新的按键输入；失焦和页面隐藏暂停。触屏方向和推力按住生效，释放/取消/失去捕获时清理。

帮助是独立覆盖层，打开后同样冻结输入。Tab 在当前覆盖层内循环；焦点落在对白取消按钮时，Enter/Space 执行该按钮而非全局继续对白。桌面按照实际页头与视口剩余高度限制场景尺寸，保持背景比例；手机保持全宽。

单背景资源的遮挡采用矩形前景适配：人物实体绘制限于 floor 可见区，脚点位于障碍后侧时重绘该障碍的背景区域。遮挡部分只额外显示实际不透明像素的淡蓝薄轮廓，脚点环与角色名保持定位；正常可见身体保留原色。该方式不修改导航范围，也不等于精细的独立前景遮罩，必须实际检查最北墙面和桌侧截图。

存档格式绑定原room字节SHA256，保存合法玩家位置、朝向、剧情事件历史、线路旋转与姿态输入轨迹。导入通过独立纯规则回放，再整份提交；墙内、异版、篡改完成标记和无效模块轨迹拒绝。导入后回房间或结局，不恢复未提交的半段对白；两个玩法进度保留。观察器 `window.__ROOM_STATE__` 仅返回副本，不提供传送或修改游戏接口。

运行时只为确实改变单调世界事实的事件追加历史；重复闲聊仍正常显示，却不膨胀存档操作证据。2001次无效果对白后继续完成玩法、彩蛋和结局的保存回放必须通过。

代码源在项目 `templates/single-room/`，技能自带镜像 `assets/canvas-room/` 用于独立安装。规则测试用 `node --test tests/single-room.test.mjs`；宿主真实输入测试用 `node scripts/skills/review-room.mjs 候选目录 room.json evidence.json`。测试通过依然不证明美术质量、原作忠实或全部设备兼容。
