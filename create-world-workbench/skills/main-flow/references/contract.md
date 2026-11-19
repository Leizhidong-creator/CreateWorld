# 主流程契约 v1

UTF-8 JSON ≤ 2 MiB，schemaVersion 为整数 1、id/title 非空。拥有 flow/flowDetails；引用 interactions 的稳定 ID，不能私改机制或复制世界状态。

flow：
- startScreen：存在且非终局。
- screens：非空唯一 {id,kind,title}；kind 为 title/world/dialogue/puzzle/journal/pause/ending。
- edges：非空唯一 {id,from,to,actionId}；每个动作恰一条边，from/to 分别等于动作 screenId/targetScreen，包括同界面操作。
- terminals：非空唯一 ID，恰好列出 ending 界面。终局不能包含普通动作，重开由运行时恢复初态。
- mainEndingScreenIds：建议明确列出成功主结局；这是 Easter Egg 验证可选性所需的成功标准。

所有界面从入口可达，所有节点拓扑上都有去终局的路线。移除彩蛋动作仍至少有一个结构终局是本检查的下限；带条件的成功主线需要 Game State/Easter Egg 的状态证明。

建议写 flowDetails：
- restartPolicy:"reset-all"。
- screens：与 flow.screens 恰好覆盖，{id,playerGoal,entryFeedback,completionFeedback,overlay}。
- overlay=true 时另需 returnToScreenIds、stateOwner:"world"、pausesWorld 布尔值；返回所有者须有直接边。
- tutorialScreenIds 非空、advancedScreenIds 数组；移除教学节点后进阶节点不得仍可达。
- failureRecovery：[{from,to}]，须有实际直接恢复边。

未写 flowDetails 时报告教学、焦点/覆盖生命周期、重开和恢复未验证。顶层还有 state/branches 等其他 section，但本工具不证明 guard 可满足或存档正确。

运行 python scripts/validate.py bundle.json --report report.json。报告 skill/passed/errors/warnings，退出 0/1。交付流程图、界面表、动作需求、成功/失败旅程和剩余假设。用 Game State 的合法路径驱动浏览器真实输入再验收，不能用拓扑连通替代通关。
