# 玩法产物契约 v1

读取完整原作 source.nodes、adaptation 定位、平台输入与实现能力；只拥有 mechanics/mechanicDetails。JSON 顶层 schemaVersion:1、id、title，最多 2 MiB，唯一小写 ID。

mechanics 非空数组，每项 {id,goal,inputs,rules,feedback,failure,recovery,sourceNodeIds}。文本非空，inputs/rules 非空且去空格忽略大小写后不能重复。来源 ID 必须存在。若 constraints.supportedInputs 存在，只能使用其中输入。下游 interaction.mechanicId 必须存在，其 input 必须属于该机制 inputs。

mechanicDetails 建议必写，与 mechanics ID 恰好一一对应：
- successCondition、cancelPolicy：可执行判定与取消边界。
- testScenarios：{success,failureRecovery,alternative} 三条具体玩家情景。
- loop：{startStepId,steps:[{id,playerAction,feedback,nextStepIds}]}；所有步骤从起点可达且能回到起点，不能悬空。
- decisions：[{information,options:[{id,actionId,tradeoff}]}]；每个决策至少两项，不同取舍与不同 effects/targetScreen。若体验本身无分支，可为空并说明理由；不凭加选项宣称有趣。

有 interfaces 之外的模块需求时，另写 native-engine-spec.md：引擎、输入、状态命令、时钟/随机源、取消与存档边界、验收步骤、未实现项。有限后端不能执行连续物理或任意 JavaScript。没有交互时只能核验设计环，动作绑定待完成。

运行 python scripts/validate.py bundle.json --report report.json。输出 skill/passed/errors/warnings，退出 0/1；缺 mechanicDetails 会明确警告。结构通过不等于机制已实现。交付规则、循环、取舍理由、实际测试证据与未确认手感，不把状态模拟叫玩家测试。
