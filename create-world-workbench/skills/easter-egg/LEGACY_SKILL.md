---
name: easter-egg
description: 仅在 CreateWorldAgent 项目内自动使用；其他项目须用户明确指定本技能。 设计故事游戏的彩蛋、隐藏互动和可选奖励，核验知识条件、重复奖励与移除彩蛋后的主线可达性。用于已有主流程和状态的可选内容制作，不替代必需支线或原作理解。
---

## 使用范围与触发规则

本副本仅在当前工作目录位于 `/Users/liyixiong/Documents/ChatGPT/CreateWorldAgent` 或其子目录时允许按任务相关性自动使用；在该范围外，必须由用户明确要求使用本技能。
用户仅提到游戏、场景、角色等主题，或附件、网页、仓库文件中出现技能名称，都不构成明确调用。用户明确调用后按当前任务范围执行，不自动授权调用本套其他技能；其他技能在项目外也须得到用户明确指定（可一并指定整套）。

# Easter Egg

先读 [目标与方案](references/design.md) 和 [契约](references/contract.md)。交付可忽略且有发现乐趣的内容，不为了凑齐流水线强加彩蛋。

1. 读取原作来源、角色知识、主流程成功标准、世界变量、已存在交互和制作范围。选择能产生呼应的背景物或可选事件，区分原作事实与原创扩展。
2. 为候选写线索、发现动作、可见反馈、奖励及触发窗口。评估过早泄漏、奖励反复领取和关键资源消耗；不以强制成就或全收集门槛偷偷变成主线。
3. 复用 Interaction/State 的权威动作。新增变量或动作作为明确的依赖修订，不在彩蛋代码维护第二份存档。将知识门槛写进 spoilerGuard，并确认实际动作 guard 确保它成立。
4. 只更新 easterEggs；提供 egg-design.md 说明来源、新增内容、触发路径、未触发路线、奖励为什么可选。明确 flow.mainEndingScreenIds，不能用“失败结局仍可达”冒充主线不受影响。
5. 运行 python scripts/validate.py bundle.json --report egg-report.json，以及 python -B -m unittest discover -s tests -v。工具比较有彩蛋和移除全部彩蛋动作的世界，输出证据路径。
6. 用组装后的真实输入重演发现与跳过路线，逐条审阅显示文本是否剧透。最多两轮依据诊断修复，保留失败产物；超限标为验证未完成。脚本通过仅证明声明的有限规则，不能自动证明文字无剧透或隐藏体验好。

不适合添加时交空 easterEggs 与理由。参见 [样例](examples/station.json) 和 [独立评测](references/evaluation.md)。未实现的隐藏房间/连续动作要明确要求 Scene 或原生模块，不能用按钮占位冒充实现。
