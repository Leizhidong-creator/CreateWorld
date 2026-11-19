# 状态契约与命令

UTF-8 JSON bundle `schemaVersion:1`。完整可运行例见 `../examples/station.json`。验证依赖 `id/title/state/flow/interactions`，未知扩展字段保留但不代表被验证。

`state.variables` 项为 `{id,type,initial}`：bool 要真布尔值；int 要整数 min/max 且初值在界内；enum 要非重复字符串 values。条件数组表示全满足，项为 `{var,op,value}`；eq/ne 可用于全部类型，lt/lte/gt/gte 只对 int。效果项 `{var,op,value}` 使用 set 或 int 的 add，每动作同一变量只写一次。

`state.invariants` 项为 `{id,if:[条件],then:[条件]}`。guard 在旧状态判断，所有 effects 计算后检查不变量，再一次提交。`interactions` 每项声明 id/screenId/targetScreen/guard/effects/repeat；repeat 为 once 或 repeatable。once 仅成功后计入 completed。

`flow` 声明 startScreen、screens、edges、terminals；screen 有 id/kind/title，edge 有 id/from/to/actionId。每动作恰好一条同源同目标边。终局禁止普通动作；重开由宿主全部重建。

`validate.py` 返回 `{skill,passed,errors,warnings,modelCheck}`，exit0/1。默认最大 10,000 状态，可用 `--max-states` 明确调整，最高 100,000。未知、软锁、不可达终局及非法可达效果都不通过。一次模型枚举不能证明时间连续游戏或文本语义。

`simulate.py` 返回状态与每步观察；`--actions` 为逗号分隔的真实动作 ID。`--save` 创建新文件、不覆盖；`--restore` 检验 schemaVersion、bundleSha256、screenId、values、completed 与 trace，完整回放必须一致。改版需要显式迁移策略，v1 工具不会自动迁移。
