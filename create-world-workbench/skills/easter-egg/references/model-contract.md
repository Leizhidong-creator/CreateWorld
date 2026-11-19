# 有限世界执行语义 v1

## 必需依赖及精确执行语义

- `state.variables`: `{id,type,initial}`，type 为 bool/int/enum。int 另需整数 min/max，enum 另需不重复非空字符串 values；initial 必须属于定义域。布尔值不能充当整数。
- `state.invariants`: `{id,if:Guard,then:Guard}` 数组。if 满足则 then 必须满足。
- `flow`: `{startScreen,screens:[{id,kind,title}],edges:[{id,from,to,actionId}],terminals:[screenId]}`。kind 为 title/world/dialogue/puzzle/journal/pause/ending；终局必须是 ending。每个交互恰有一条对应 edge，包括同界面动作。
- `interactions`: `{id,screenId,targetScreen,guard,effects,repeat}` 数组。repeat 为 once 或 repeatable。终局不能再改变故事结果。
- Guard 是条件数组（逻辑 AND；空数组为 true），条件为 `{var,op,value}`。op 为 eq/ne/lt/lte/gt/gte；bool/enum 只允许 eq/ne。int 比较值必须是整数，不隐式转换。
- Effect 为 `{var,op,value}`，op 是 set/add；add 仅用于 int；同动作不能重复写同变量。在旧状态上判断 guard、计算全部 effects、检查定义域及不变量，全部合法才一起提交并切换界面；否则原子拒绝。
- once 使用持久完成 ID 集合，只有成功才添加；拒绝/取消不计入；重复成功被拒绝。完成 ID 本身不算选择的叙事后果。

本包 `validate.py` 自带上述语义，不依赖其他技能代码。它只执行数据模型，不执行任意表达式或游戏脚本。

