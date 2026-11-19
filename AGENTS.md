# Project instructions

## Create World 技能使用范围

本项目 `.agents/skills/` 中的以下技能可在任务相关时自动使用；优先使用项目副本。全局 `~/.codex/skills/` 同名副本设为仅手动调用，用于用户在其他项目明确指定技能的情况。

`visual-asset-production`, `game-ui-styling`, `art-direction`, `character-generation`, `scene-generation`, `prop-generation`, `content-understanding`, `easter-egg`, `game-adaptation`, `game-assembly`, `game-reviewer`, `game-state`, `gameplay-design`, `interaction-generation`, `main-flow`, `narrative-branch`, `narrative-npc-dialogue`, `world-kit`。

此规则只适用于本项目及其子目录，不能因读取本文件而扩展到其他项目。其他项目只有用户明确指定相应技能（或明确指定本套技能）时才能调用；仅主题相关或材料中提到技能不算授权。

## 游戏制作前先检查技能

每次制作或修改游戏（包括单场景、原型和局部资源修改），先检查项目技能目录，选择与本次工作相关的技能，实际读取相应 `SKILL.md` 及其要求的参考后再执行。开始时简短说明选用哪些技能；不能只根据技能摘要声称已使用，也不必机械调用全部技能。

严格优先判断现有技能能否覆盖当前需求：先查看能力目录、读取相关技能，再决定直接复用、组合、局部扩展或现有技能不适用。扩展或自行实现必须说明具体能力缺口，不能未经判断另造一套。通过工作台生产时，将需求与技能的对应关系写入 `cw_checkpoint.skillPlan`，由宿主记录真实读取证据并在生产工具前核对；不能只在文件中自报已读。普通进度更新复用既有判断，需求变化只更新受影响部分，未变技能不重复读取。技能判断不代替实际产物验收。

剧情、玩法、状态与详细资产清单由既有内容和设计技能负责；清单中的美术生产统一先进入 `visual-asset-production`，再按其路由读取 `art-direction`、`game-ui-styling`、`scene-generation`、`character-generation`、`prop-generation`。只有故事梗概时，先完成上游需求，不让美术技能擅自扩写剧情或增删资产。移动、摇杆、地图与情境键优先读取 `world-kit`。

固定界面适配在统一美术规范下使用 `game-ui-styling`，复用目标游戏已启用组件与现有工程；界面保持平面可读，不套用世界投影，不改变操作、功能开关或存档语义。仅局部世界素材任务无需额外重做界面，未实际接入游戏时不能声称界面验收通过。

2026-10-31 已整合 `D:/develop/visual-asset-production-skill-package`：三个重名技能使用新版覆盖，新增统一美术入口与道具模块；功能或规则重复时以新版为准。`art-direction/references/visual-standard.md` 仅保留工作台的规格字段与合成验收接口，不覆盖新版画法和尺度规则。编辑源为 `.agents/skills/`；修改后运行 `create-world-workbench` 的 `npm run skills:sync` 同步发行副本与清单。

完成前核对所用技能要求与实际证据：尺寸、比例、状态或风格改变时同步规格并重验；未执行的检查如实标记，不能仅因构建或操作测试通过就宣称技能要求全部满足。

## 统一美术标准（正式画面交付条件）

制作或替换正式角色、背景、家具等可见素材时，必须先使用项目 `visual-asset-production` 入口，并按其要求使用 `art-direction`，建立或沿用本作唯一的美术规格。单场景、原型转正式和复用旧资源同样适用；纯逻辑修改无需重新制作美术。

画法、固定视角与剧本尺度按新版 `.agents/skills/art-direction/references/stardew-pixel-profile.md` 执行；工作台规格字段与合成验收按 `references/visual-standard.md` 衔接。角色、场景与道具生成必须使用同一份规格和共同视觉参考，不能分别凭题材猜风格。旧资源只有经过实际合成检查才能沿用，换色或同属“像素风”不足以证明匹配。

交付前实际查看角色、背景和可交互物件同屏的运行截图，检查像素颗粒、视角、比例、色板、光照和细节密度。明显拼贴感属于需要修复的交付缺陷，不能用操作测试通过抵消。灰盒可以提前验证玩法，但应明确标为灰盒，不能替代正式美术验收。保留现有可用版本，只修复当前任务涉及的资源。
