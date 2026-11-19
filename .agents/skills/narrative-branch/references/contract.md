# 分支产物契约 v1

输入是 UTF-8 JSON（最多 2 MiB），顶层 `schemaVersion:1, id, title`。ID 为 `[a-z][a-z0-9_-]{0,63}`。输出保留未知扩展字段；本技能拥有 `branches`，其余 sections 为只读依赖，变更必须明确列出。

## 必需依赖及精确执行语义

- `state.variables`: `{id,type,initial}`，type 为 bool/int/enum。int 另需整数 min/max，enum 另需不重复非空字符串 values；initial 必须属于定义域。布尔值不能充当整数。
- `state.invariants`: `{id,if:Guard,then:Guard}` 数组。if 满足则 then 必须满足。
- `flow`: `{startScreen,screens:[{id,kind,title}],edges:[{id,from,to,actionId}],terminals:[screenId]}`。kind 为 title/world/dialogue/puzzle/journal/pause/ending；终局必须是 ending。每个交互恰有一条对应 edge，包括同界面动作。
- `interactions`: `{id,screenId,targetScreen,guard,effects,repeat}` 数组。repeat 为 once 或 repeatable。终局不能再改变故事结果。
- Guard 是条件数组（逻辑 AND；空数组为 true），条件为 `{var,op,value}`。op 为 eq/ne/lt/lte/gt/gte；bool/enum 只允许 eq/ne。int 比较值必须是整数，不隐式转换。
- Effect 为 `{var,op,value}`，op 是 set/add；add 仅用于 int；同动作不能重复写同变量。在旧状态上判断 guard、计算全部 effects、检查定义域及不变量，全部合法才一起提交并切换界面；否则原子拒绝。
- once 使用持久完成 ID 集合，只有成功才添加；拒绝/取消不计入；重复成功被拒绝。完成 ID 本身不算选择的叙事后果。

本包 `validate.py` 自带上述语义，不依赖其他技能代码。它只执行数据模型，不执行任意表达式或游戏脚本。

## 本技能 section

```json
{"branches":[{"id":"evacuate","decisionScreenId":"platform",
 "options":[{"id":"rescue","actionId":"leave_together","consequence":"救援后全员离开"},
            {"id":"alone","actionId":"leave_alone","consequence":"保全自己但遗留旅客"}],
 "endingScreenIds":["together","alone"]}]}
```

每项至少两个唯一选项及不同动作，动作起点必须是 decisionScreenId。每项选项至少存在一条从初始状态可到达的合法触发路径；在任何可触发状态，执行后都要存在去往本分支声明终局的合法路径。所有声明终局都要实际可达。相同效果与相同目标界面的两个选项会被拒绝，即便按钮/后果文字不同。数值修改或目标不同只是可执行差异，还需创作者审阅它是否产生有意义的后果。

空数组合法；解释为何不添加分支。需要多任务合流、顺序差异或角色知识证明时，将设计记录写在 `branch-design.md`，用有限变量显式表达并提供路径，不在 `consequence` 写未实现的承诺。

## 输出与范围

命令 `python scripts/validate.py bundle.json [--report path]` 输出 `{skill,passed,errors,warnings,metrics}`，0=通过、1=失败。metrics 包含状态数、边数、选项证据路径。上限 20,000 状态或 250,000 边，超限是失败/验证未完成，不能推出无缺陷。报告中的路径是模型动作 ID；组装验证必须另用真实玩家输入。

本版不自动证明文案忠实、所有汇合不会丢失叙事意义或优先级式隐式结局的正确性。隐式结局须先显式化为确定动作，或使用原生引擎证明，不假装当前检查器理解它。
