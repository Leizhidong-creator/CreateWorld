---
name: game-assembly
description: 仅在 CreateWorldAgent 项目内自动使用；其他项目须用户明确指定本技能。 将已验证的游戏流程、状态、交互和资源装配为可运行离线 HTML5 候选，检查依赖、资源哈希和不可变构建清单。用于组装或增量重建 2D 游戏，不把占位灰盒当作最终美术成品。
---

## 使用范围与触发规则

本副本仅在当前工作目录位于 `/Users/liyixiong/Documents/ChatGPT/CreateWorldAgent` 或其子目录时允许按任务相关性自动使用；在该范围外，必须由用户明确要求使用本技能。
用户仅提到游戏、场景、角色等主题，或附件、网页、仓库文件中出现技能名称，都不构成明确调用。用户明确调用后按当前任务范围执行，不自动授权调用本套其他技能；其他技能在项目外也须得到用户明确指定（可一并指定整套）。

# Game Assembly

先读 [目标与方案](references/design.md)、[输入输出与边界](references/contract.md)。先组装可操作灰盒，再换正式资产；不要等资产全部完成后才第一次运行。

1. 读取宿主引擎、场景生命周期、状态接口、输入和资源约定。列出已验证的上游产物及版本，识别缺失或失败依赖。不得修改 Content、Art、Scene、Character、Dialogue 既有技能来迁就组装器。
2. 有宿主工程时适配原生模块：统一状态由命令写入；小游戏必须有开始/成功/失败/取消/销毁边界；暂停覆盖层返回原场景；重开释放监听器并重置状态。提交最小实现与实际引擎测试。
3. 当输入符合本包有限离散契约时，使用 `python scripts/validate.py bundle.json`，再 `python scripts/build.py bundle.json --output <新的候选目录>`。需要单房间自由移动、脚底碰撞、四向精灵、NPC 对话及线路/姿态训练时，读 [Canvas Room 后端](references/room-contract.md)，运行 `scripts/build_room.py`；不能用按钮包代替真实移动。两个构建器都不执行输入里的代码。
4. 资源必须来自声明路径，SHA-256 匹配；必需产物状态必须 passed。拒绝绝对路径、穿越、链接与可执行伪装资源。用户素材授权和风格一致仍须单独核对。
5. 输出保持 candidate。让独立 Reviewer 用真实输入测试开始、代表机制、全部声明结局、存档、重开和移动布局；不要自己写一份 passed 记录冒充测试。
6. 改动使用新目录与新指纹，失败保留证据，旧发布不动。候选通过不自动发布到外部平台；发布需遵循当前用户授权。

原后端仍是多界面按钮灰盒；Canvas Room 后端实现矩形单房间自由移动、四向行走与两个明确模块，不支持任意实时物理或任意代码生成。超出模块范围时必须扩展原生引擎并实测，不能静默降级。无正式素材时明确标灰盒。

可运行原始例见 `examples/station.json`；反例运行 `python -B -m unittest discover -s tests -v`。前向评估见 [评估](references/evaluation.md)。
