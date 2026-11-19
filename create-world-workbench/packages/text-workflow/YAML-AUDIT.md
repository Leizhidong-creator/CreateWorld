# YAML 配套自审：版本 1

此文件是执行标准第七阶段的补充，不改变内容规范、正式 YAML 格式或设计授权。只检查描述及临时模型，不生成游戏，不作运行时验收。原规范未规定的日常细节按授权补全；核心事实冲突集中提问。

## 工作产物

在工作区保存 game.yaml、model.json、review.json。模型仅为临时检查材料，不能成为下游必需输入。宿主执行原标准内嵌检查器及 simulation.ts；不得编辑检查器以获得通过。

model.json 使用宿主提供的 model-schema.json：version=1；yamlHash 为 game.yaml 的 SHA256；coverage 逐项绑定初始配置、全部事件、物件、状态、检查点、玩法和结局的 JSON Pointer 路径（数组以零开始）及 expected 原值。每个变量、转换、检查点、目标和不变量均须有 trace.path 与 trace.expected。

变量只允许有限域标量，初值必须在域内。域不足是检查缺口，不得截断效果或偷偷封顶。条件支持 all/any/not 和 variable/op/value；效果依次执行 set/add/save/restore，条件读操作前状态，整段效果成功才提交。每个操作可以拆为实际有意义的内部步骤，如已取物未交付、小游戏成功尚未返回；这不要求改变原 YAML 的事件边界。

transitions.kind 区分 action、repeat、exit_continue、failure、restart、skip。退出继续用 preserve 声明应保持的变量；跳过用 equivalentTo 关联正常成功转换，用 compare 指定应相同的剧情结果（行为记录可不同）。检查点显式定义保存变量及 save/restore。整部游戏重开必须标 progressScope=new_game，不计入当前流程可恢复的证明，不能用从头重玩掩盖死路；小游戏局部重开保持 normal。不要用“重开”替代“退出继续”，不要用跳过路径掩盖正常成功的死路。

invariants 逐项表达物件归属/唯一性、奖励上限/一次性、状态一致性。recoveryCoverage 为每个独立小游戏分别关联四类恢复转换。模型未知规则放入 unknowns，不能将条件设为真或伪造流程绕过。宿主对完整可达状态和排除可选动作的状态分别探索，并记录无法到达结局的操作路径。

`unknowns` 用于本轮逻辑检查中仍不能解释或尚未覆盖的规则，不用于重复列出本轮之外的真实游戏实测。像素级碰撞、动画视觉效果、声音实际播放和真人阅读效果尚未实测，应在 YAML 的验收及 review 的未实测说明中保留，不把它们伪装成已经验证，也不要求先制作游戏才能通过 YAML 逻辑自审。涉及这些表现的**状态后果**仍在本轮范围内：例如动画中暂停是否提前交付物件、对白中退出是否跳过认知更新、无存档/损坏存档如何恢复，都必须按 YAML 建立可判断的抽象状态或明确保留为逻辑缺项。不能因为规则提到动画或音效，就删除其状态检查。将条目归为范围外时，审阅须逐条给出依据，并确认没有遗漏剧情或恢复条件。

## 内容审阅

独立审阅只读取最终粗稿、两份规范、当前 YAML、临时模型及检查结果，不读取上游作者笔记。review.json 必须含 verdict（passed/revise）、inputHashes（每个被审文件与实际 SHA256）、issues 数组和 checks 数组；每项检查含 name、locations、finding。粗剧本至少检查 source_fidelity、perspective、causality、handoff；YAML 至少检查 script_coverage、causality、knowledge、model_translation、recovery、optional_independence。

model_translation 必须核对模型条件、动作、初值和恢复是否忠实对应 YAML，不能只核对路径存在。模型有误修模型；内容含混修 YAML 或按既有规则提问，再生成模型和复查。review 的通过是模型文本审阅意见，不是宿主对故事质量的独立证明。

基础检查器的 review_required 逐条写入 review.json.manualChecks，每项保留 code、path、status（resolved/not_applicable/unverified）与 evidence。宿主核对每项都有处理依据；缺少处理或仍未验证时不交付通过版本。不能只记录总括性的“人工检查已通过”。

审阅指出硬问题时返回 revise；最多两轮主要修订，仍不通过则保留候选与问题。不依靠字数、旧游戏事件数量或固定时长冒充完整性。所有覆盖不完整、探索达到上限或未解决事项均不得标为已验证。最终 YAML 的验收模块需区分静态检查、内容审阅、状态模拟及尚未开展的游戏实测。
