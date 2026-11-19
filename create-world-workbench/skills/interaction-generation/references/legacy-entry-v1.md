---
name: interaction-generation
description: 仅在 CreateWorldAgent 项目内自动使用；其他项目须用户明确指定本技能。 把剧情事件和玩法规则转成可操作交互，定义输入、门槛、原子效果、反馈、失败、取消和重复策略。用于场景与世界状态已确定后的行为绑定，不替代玩法定位或资产生成。
---

## 使用范围与触发规则

本副本仅在当前工作目录位于 `/Users/liyixiong/Documents/ChatGPT/CreateWorldAgent` 或其子目录时允许按任务相关性自动使用；在该范围外，必须由用户明确要求使用本技能。
用户仅提到游戏、场景、角色等主题，或附件、网页、仓库文件中出现技能名称，都不构成明确调用。用户明确调用后按当前任务范围执行，不自动授权调用本套其他技能；其他技能在项目外也须得到用户明确指定（可一并指定整套）。

# Interaction Generation

先读 [目标与方案](references/design.md) 和 [契约](references/contract.md)。交付真正可绑定输入的动作协议及测试轨迹。

1. 读取原作因果、机制、场景锚点、角色动作、流程和权威状态。把“修好设备”等剧情结果分解为玩家能观察、判断、执行的步骤；不擅改玩家身份或核心机制。
2. 每个动作写清起点、输入、前置条件、成功效果、目标界面和反馈。输入必须能被已有运行模块接收；拖放、按住、连续动作等缺少实现时明确提出 moduleId 和实现任务。
3. 在旧状态判断 guard，再原子提交 effects；失败/取消不得提交成功效果，一次性完成只在成功记录。定义重复、重入、焦点离开、暂停与输入取消。文字声明不会自动实现设备行为。
4. 只更新 interactions 和 interactionTests。新变量交 State，新边交 Main Flow，新动画交 Character；保持稳定 ID，明确依赖修订，不能私设 DOM 或动画状态作为真相。
5. 交付 interaction-design.md 与完整候选 bundle，包括成功、条件不足、取消、重复、重入的预期及动作序列。运行 python scripts/validate.py bundle.json --report interaction-report.json；再运行 python -B -m unittest discover -s tests -v。
6. 将证据路径交 Assembly/Reviewer，以真实鼠标、键盘或触屏操作核对焦点、反馈与状态。只读观察接口不得用于直接改状态。保留失败产物，最多两轮按诊断修复；超限或未绑定输入写未验证。

有限后端支持离散命令；自定义物理、实时机关、手势模块必须另行实现并实际测量。脚本通过不代表这些模块存在。参见 [正例](examples/station.json) 和 [独立评测](references/evaluation.md)。
