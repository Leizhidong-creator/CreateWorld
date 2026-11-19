# Canvas room v1：可执行对白检查

本地扩展日期 2026-10-11。原技能擅长人物、语气、因果和宿主格式，但仅有文字 QA 与 forward-eval 定义，没有知识门槛/重入/取消的可执行检查。此适配器增加有限状态核验，不替代原写作方法，也不更改宿主数据形状。

## 宿主语义

`room.npcs[{id,name,dialogueId}]` 与 `room.hotspots[{id,kind,requires,dialogueId?,eggFlag?}]` 绑定 `room.dialogues[{id,branches:[{id,when,lines:[{speaker,text}],setFlags}]}]`。坐标等扩展字段保留。when 是布尔键值对象，按数组顺序选第一个全匹配分支，空对象是兜底；把兜底放在前面会遮蔽后续分支。

世界初始标志 `briefed,powerReady,guidanceReady,eggHumor,eggRain` 都为 false。设备只在 briefed=true 后成功设置各自标志，彩蛋只在自身 requires 满足且完整播放后设置自身 eggFlag。退出需要 briefed+powerReady+guidanceReady，不读彩蛋。

NPC 和彩蛋打开时显示第一行，后续点击推进；显示最后一行后再确认才提交。任何行取消都不提交剧情状态，也不设置完成标记。setFlags 只允许指定简报 NPC 设置 briefed，其他写入归设备或彩蛋事件；蛋对白里的 setFlags 会被宿主忽略，因此适配器拒绝这种错误声明。所有标志只写 true，重复播放不能重复奖励。

空间距离、遮挡、设备谜题是否真的可完成由 Scene/Gameplay/浏览器验证。本检查器把“设备成功”作为外部事件，仅证明它的剧情门槛；不会把该抽象事件称为真实通关。

## 知识审计旁文件

保持运行时 lines 原样。另交付 `audit.json`：

```json
{
  "schemaVersion":1,
  "profile":"canvas-room-v1",
  "briefingNpcId":"officer",
  "speakers":["值班官","维修员","导航员","终端"],
  "maxLineChars":80,
  "facts":[{"id":"power_fixed","source":"游戏规则：供电模块完成事件",
    "knowledge":{"值班官":{"when":{"powerReady":true},"certainty":"observed"}}}],
  "lineClaims":[{"dialogueId":"officer-talk","branchId":"after-power","lineIndex":0,
    "claims":[{"factId":"power_fixed","certainty":"observed"}]}]
}
```

每行都需且只能有一个 lineClaims 条目；无世界事实的情绪/关系句使用 `claims:[]`，不靠省略来隐藏未审阅台词。fact 的 knowledge 针对说话者而非人类玩家，when 必须只读宿主的五个布尔标志；certainty 为 observed/heard/inferred/established，台词声明不得把传闻升级为事实。源定位和事实是否完整仍由内容审阅负责，不能从注释齐全推导语义真实。

当前适配器在对话入口状态核验所有行。需要“对话中听到一条新信息后立即复述”的游戏，应新增宿主的逐行知识事件适配，或拆成有明确状态提交边界的两段；不能虚造初始知识让检查通过。

## 核验

```text
python scripts/validate_runtime_dialogue.py room.json audit.json --report dialogue-report.json
python -B -m unittest discover -s tests -p "test*.py"
```

脚本枚举可达布尔状态，记录每个 NPC/彩蛋实际选中的分支；拒绝未匹配/遮蔽分支、越权状态写入、错误知识条件、角色无来源事实、重复/失效标注和行长超限。对所有可播放分支逐行取消，再完整播放和重复播放，以模型事务检查取消零写入与完成后幂等。报告固定说明 `runtimeEvidence: unverified`。

随后在宿主真实 UI 检查：未简报时设备拒绝；简报任意行退出后门槛仍锁；完整听完才解锁；重复交谈无重复奖励；彩蛋取消不解锁、读完后保存可恢复；两个设备都完成才开放舱门。观察状态只能读取，不能注入测试完成标志。

正反例见 `tests/fixtures/`。所有夹具是原创确定性模型，不是本次电影对白，也不计为模型生成成功率。
