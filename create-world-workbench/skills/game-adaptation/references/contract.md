# 改编产物契约 v1

输入 UTF-8 JSON 不超过 2 MiB；顶层 schemaVersion 为整数 1、id 符合 [a-z][a-z0-9_-]{0,63}、title 为非空字符串。输出保留其它 section，不能重写原作以迎合方案。

source.complete 必须为 true，source.nodes 为非空唯一 ID 数组，每项 {id,summary,locator,invariant}。locator 指向实际原材料的段落/时间或分镜；invariant 记录不可改事实，脚本不替代语义核对。

adaptation 必需字段：
- playerRole、coreExperience、genre：非空文本；targetMinutes：正整数。
- preservedNodeIds：保留的来源 ID。
- changes：{sourceNodeId,change,reason}。
- excludedNodeIds：{id,reason}。
三类必须无重叠覆盖全部来源，不能全部省略。
- 建议必写 experiences：{id,experience,sourceNodeIds,playerActions:[{verb,decision,consequence}]}。未写时核心结构仍可检验，但体验到行为的完整性为未验证。
- 可选 inventions：{id,provenance:"original",summary,reason}；不得复用原作 ID。
- platform 可与用户 constraints.platform 对应。

可选 constraints 是用户的硬限制；playerRole/genre/platform 要精确相同，minMinutes/maxMinutes 为时长边界，requiredPreservedNodeIds 禁止改写或省略。无法满足时保留失败，不删限制。

示例是 examples/station.json 中的 adaptation；不要照抄其题材。交付完整候选 bundle 及 adaptation-rationale.md，说明两种方案取舍、估时依据、实现模块、来源与新增区分、待灰盒验证假设。

运行 python scripts/validate.py bundle.json --report report.json。JSON 报告有 skill/passed/errors/warnings，退出 0/1。最多两轮有证据修复。通过表示覆盖与声明一致；人物理解、因果忠实、玩法吸引力和工期估计仍须审阅。
