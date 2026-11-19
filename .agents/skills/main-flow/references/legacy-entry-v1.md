---
name: main-flow
description: 仅在 CreateWorldAgent 项目内自动使用；其他项目须用户明确指定本技能。 将改编定位和玩法循环组织为完整游戏主流程与多界面转换图，覆盖开始、教学、推进、失败恢复、暂停返回、结局与重开。用于规划或修复 2D 游戏整体流程，不代替单个交互规则与支线对白创作。
---

## 使用范围与触发规则

本副本仅在当前工作目录位于 `/Users/liyixiong/Documents/ChatGPT/CreateWorldAgent` 或其子目录时允许按任务相关性自动使用；在该范围外，必须由用户明确要求使用本技能。
用户仅提到游戏、场景、角色等主题，或附件、网页、仓库文件中出现技能名称，都不构成明确调用。用户明确调用后按当前任务范围执行，不自动授权调用本套其他技能；其他技能在项目外也须得到用户明确指定（可一并指定整套）。

# Main Flow

交付可运行实现所需的流程图与界面生命周期，不能只写剧情大纲。先读 [设计决策](references/design.md) 和 [契约](references/contract.md)。

1. 读取 adaptation、mechanics、用户范围与已知状态需求。先分析游戏的开始承诺、第一项可学会的操作、循环升级、关键转折和结束反馈；机制未定时记录假设并先验证灰盒。
2. 列出 world、dialogue、puzzle、journal、pause、ending 等实际界面与玩家目标。区分世界地点与暂时覆盖界面；明确进入、返回、暂停时钟、输入焦点和保存位置。UI 只能观察同一个权威世界状态。
3. 生成 `flow` 与可选 `flowDetails`。每条转换都引用稳定 action ID，包括留在原界面的操作；未生成交互时输出动作需求给 Interaction，而不是把悬空引用标为通过。终局固定结果，重开由运行时重建全部初始状态。
4. 安排教学、逐步增加机制组合、失败反馈与恢复、结束及重开。对照用户目标设置时长和范围；明确必经内容与可选内容。设计必要回访，不把每章做成互不共享状态的小网页。
5. 逐条手推开始至结局、失败重试、覆盖界面返回、保存恢复和重开。若出现死路，修复负责的流程或机制；不能删掉有意义的知识门槛来换取通关。支线与结局条件交给 Narrative Branch/State，保持引用一致。
6. 运行 `python scripts/validate.py <bundle.json> --report <report.json>`，修复悬空引用、断路、终局修改和无法返回的界面；最多两轮修复后保留失败证据。脚本只验证拓扑，门槛的真实可达性仍交给 State/Reviewer；最后由 Assembly/Reviewer 用真实输入通关。

只更新 `flow`/`flowDetails`，其它 section 改动通过明确的需求和新修订协作。示例见 [多界面车站](examples/station.json)，评估见 [独立试作请求](references/evaluation.md)。
