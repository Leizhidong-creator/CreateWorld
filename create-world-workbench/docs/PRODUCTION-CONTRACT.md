# 完整游戏自主制作合同 v2

每次制作或修改先检查技能目录，实际读取本次相关入口与必读参考后执行。剧情、玩法、状态和详细资产清单由内容/设计技能落实；美术生产从 `visual-asset-production` 进入，内部按需读取 `art-direction`、`scene-generation`、`character-generation`、`prop-generation`。2026-10-31 整合的新模块覆盖重复旧规则；固定正交斜俯视与像素画法按 `stardew-pixel-profile.md`，人物和物件的相对尺度按剧本规划，不使用固定人物占屏比。保留工作台规格字段、真实合成截图与输入验收接口。技能不扩大用户范围；未执行的检查不得填通过。

用户只提交一次任务，默认约10分钟、至少5个有效场景、多节点、跨场景条件和简单小游戏。自主决定内部工作顺序、加载所需技能、设计剧情驱动的核心玩法、写项目机制、制作素材、测试修复。无固定六阶段，不只交计划或片段。框架复用运行能力，不能固定所有故事的核心玩法。

## 技能优先的适配判断

开始实现前，AI 必须先查看现有技能能力目录、读取相关技能，再判断能否复用、组合或局部扩展。能力说明来自项目 `SKILL.md` front matter 的 description，经 `npm run skills:sync` 写入发行清单；不维护第二套手写能力表。不强制读取全部技能，不为调用技能扩大剧情、资产或玩法范围。

判断复用现有 `cw_checkpoint`：

```json
{
  "summary": "现有玩法和工程技能覆盖主流程，素材按独立美术入口制作",
  "tasks": [{"id":"implementation","title":"实现本次范围","status":"running"}],
  "skillPlan": {
    "decisions": [{
      "id":"story-runtime",
      "requirement":"把既有剧情落实为可操作流程并构建验证",
      "stages":["content","build"],
      "consideredSkills":["gameplay-design","game-assembly"],
      "selectedSkills":["gameplay-design","game-assembly"],
      "strategy":"compose",
      "reason":"玩法技能负责行动设计，工程技能负责接入现有运行时"
    }]
  }
}
```

`stages` 是覆盖的工作范围，不是额外固定流水线：content 内容/机制实现，assets 素材，build 构建测试，review 正式审阅。`targetIds` 可将素材判断限定到相应资产 ID，省略则覆盖该阶段整体范围。素材生产需 content/assets 判断，构建需 content/build 判断，审阅需 review 判断，最终提交核对 content/build/review。`cw_check` 等诊断与资料查询始终可在判断前使用。

`strategy` 为 reuse（直接复用）、compose（组合）、extend（局部扩展）或 custom（现有技能不适用）。extend/custom 必须提供 `gap` 说明具体能力缺口；所有 consideredSkills 都必须通过 `cw_read_skill` 实际读取当前版本，selectedSkills 是其子集。不能只在工作文件中自报已读或选用不存在的技能。

宿主将实际读取版本、需求判断和当前请求标识存于工作区外的原有 autonomous 记录目录；`work.json.skillPlan` 只是可读投影，不能作为宿主证据。生产工具在昂贵操作前调用统一前置判断，缺少准备只返回可补齐反馈，不调用生图、不跑长测试，也不计入执行失败熔断。

普通进度 checkpoint 不重复交 skillPlan。局部变化仅更新受影响 `decisions`；其余可通过 `unchanged:["story-runtime"]` 明确沿用。未变技能不必重读，服务重启保留记录；新请求需确认适配，技能版本变化只使引用该技能的判断失效。工作计划不加入美术或游戏候选指纹，不使已通过素材重生。

此约束证明可观察的“先考察、再选用、再生产”顺序，不证明模型已正确理解或落实技能；最终内容、玩法和同屏证据仍按原验收执行。模型的原生 shell 编辑受提示要求约束，不能仅靠宿主工具门槛声称拦截了所有文件写入。

## 权威数据（按需产生，不是固定步骤）

- sources/source.txt：原始只读材料。只给作品名时可实际检索，保存来源定位。原作动机/关键因果/结局未知时cw_block；普通互动过渡可标原创后继续。
- source.json：{records:[{id,path或url,locator,summary}],motives:[],causalChain:[],ending:{status:'verified'|'unknown'|'conflicting',summary,recordIds:[]},canonLocks:[{id,description,recordIds:[]}],gaps:[],originalAdditions:[],blocked:boolean}。不能把模型记忆冒充检索证据。
- design.json：{adaptation:{playerIdentity,scope,canonLockIds,originalAdditions},mechanics:[{id,storyBasis,goal,information,inputs,rules,feedback,success,failure,cancel,implementation:['extensions/radio.js'],tests:['radio-main'],libraryRef?}],flow:{nodes,edges},artDirection:{pixelPolicy,palette,camera,characterSize},characters:[],scenes:[],targetMinutes:10}。规则需对应实际实现，不能空泛地写“调查和收集”。无需每项技能另写报告。mechanism若取自 gameplay-design 的小游戏库（skills/gameplay-design/references/minigame-library.zh-CN.md，100 种），加 libraryRef 记条目ID（如"A03"）；同一作品最多两个，且不得同类重复。
- game.json：运行时唯一GameConfig。阅读packages/compiler/CONFIG.md与fixtures/harbor.json，例子仅参考结构。不要复制例子故事。game.id必须使用project.json的id来隔离项目存档；不兼容修改提升saveVersion并保留旧档。
- 可选game.project.json：{base:<顶层配置>,parts:['parts/room.json',...]}。每个片段只含scenes/dialogues等数组；宿主按顺序合并并校验重复ID，生成game.json。采用分片后它是内容源，不再同时手改game.json；美术补丁由宿主保存。补丁绑定原内容分片；修改分片后先合并仍需保留的素材补丁并移除旧补丁文件，再重新检查。改变几何后应更新对应资源，不能沿用已过时的补丁。
- journeys.json：真实输入路线，见下。覆盖全部声明结局、至少5个场景的实际到访、全部声明机制的输入、中途刷新恢复、取消与失败恢复；无需每个测试都是另一结局。
- assets-plan.json：所需正式素材任务数组，见下。cw_assets可分批指定ID，已合格且输入不变的资源复用。
- work.json：通过cw_checkpoint保存动态安排、决定及待办，属于模型工作记录，不是验收报告。

## 机制与真实输入

探索采用移动和情境交互键；机制可在场景或小游戏内使用点击/键盘/拖动。extensions/*.js默认导出register(game)，通过game.registerMiniGame或registerAction接入。具体API见CONFIG.md。成功、失败、取消、重试和销毁必须成立，资源/任务结果统一提交。不要通过全局调试对象直接改状态。

journeys示例：[{id:'main',endingId:'home',steps:[{action:'interact',id:'radio'},{action:'minigame',inputs:[{type:'click',label:'连接电池'},{type:'click',label:'测试信号'}]},{action:'exit',id:'to-home'},{action:'interact',id:'finish'}]}]。
其他输入：choice/label，minigame内key/key/durationMs，drag/from{x,y}/to{x,y}；assert/condition（同运行时条件）、reload。必须实际操作，不得evaluate或传送。普通对白自动推进；有选项时必须选择准确文字。取消小游戏可点击容器内自己的取消按钮；公共返回按钮用minigame输入type:cancel。
小游戏测试要包括错误操作/重试/取消和成功；可在同一条通关路线安排。点击成功按钮必须先满足真实规则，不能做自动成功占位模块。

## 资源

正式可见素材生产前必须读取 art-direction，并落实 [统一美术规格与合成验收](../skills/art-direction/references/visual-standard.md)。`design.json.artDirection` 是唯一规格：pixelPolicy、camera、characterSize、palette（至少两个 #RRGGBB 色值）、lighting、detailDensity、assetReuse、referencePaths（工作区内已实际查看的共同视觉参考图片）。单场景和复用资源也适用，灰盒可先验证规则；纯逻辑修改沿用已有规格。角色、背景、烘焙家具应在实际游戏显示尺寸下同屏检查，不得仅换色或只检查各自素材。

宿主在 cw_assets 和正式 checkProject 中检查规格及参考存在性；参考图片内容纳入候选指纹。cw_review 必须按场景关联宿主运行截图，在 review.json.visualConsistency 中逐项记录 pixelScale/projection/proportions/palette/lighting/detailDensity 的 `{passed,observation}`。cw_finish 拒绝缺少覆盖、关联错误、未通过或无观察的审阅。结构检查不自动判断审美；必须实际读图。明显风格冲突不可用通关测试抵消，修复后重新构建与审阅。既有已接受版本不自动重制；下次正式制作/交付执行此合同。

所有图片路径相对assets根，稳定ID引用。基础音频可用ambient.wav/tap.wav/notice.wav/success.wav（宿主自带）；不声明不存在的其他声音。

基础角色任务：{id:'hero-art',kind:'character',method:'direct-grid',entityId:'hero',path:'hero.png',width:192,height:256,prompt:'本作角色身份、服装、比例与风格',frameLayout:{columns:4,rows:{down:0,left:1,right:2,up:3},idleFrame:0,cellWidth:48,cellHeight:64}}。四向基础行走不省略NPC。旧母版工艺可指定method:legacy-sheet。

场景：{id:'room-art',kind:'scene',entityId:'room',path:'scenes/room.png',width:640,height:360,prompt:'本作空间、布局与风格'}。每场背景与玩法布局一致。cw_assets会读取game里的实际站位/碰撞并生成overlay。

追加动作：{id:'hero-hammer',kind:'action',entityId:'hero',actionName:'hammer',path:'hero-hammer.png',width:192,height:64,grid:{columns:4,rows:1,cellWidth:48,cellHeight:64,fps:8},events:[{frame:2,name:'contact'}],prompt:'身份参考和具体动作'}。角色技能说明动作方法。简单机制UI可代码绘制；不得用代码画正式人物或背景冒充生图。

## 素材与内容边界（复用已有审图和审阅）

执行 [共用内容边界](../skills/visual-asset-production/references/content-boundaries.md)：允许正常剧情冲突、武打、少量血迹和正常恋爱，禁止色情及过度血腥、残酷呈现。判断实际图片、动作、文本与互动，不按关键词、武器、服装、露肤或无依据联想拦截。来源包含敏感情节不自动否定改编，也不要求详细展示。

在已有需求阅读中确定相关片段的表达尺度；素材生产/处理后的现有审图同时检查实际结果；最终 `cw_review` 复用运行截图、内容、实现和操作证据检查组合与互动含义。不增加独立审核轮次、模型调用、逐资产审批、确定性 QA 项或验收器。结论与检查状态分开，问题和具体证据缺口使用现有 issues/unverified，普通通过项简记实际查看范围（可用 review.json.contentReview 摘要），不强制新增文件或字段校验。明确越界令已有审阅总 passed=false，不冒充美术六项失败；未查看不等于违规，也不能推定通过。

生成偏差按已定尺度局部返修，需求冲突返回上游，不擅改关键剧情与玩法。不受影响项继续；仅复查受影响表达和必要组合。沿用原有重试额度、候选/证据关联、构建和验收失效规则，不新建缓存、签名或完成门槛，不追溯重制旧可用版本。

## 工具与完成

独立道具静态图现支持正式任务 `{id,kind:'prop',entityId:'O_POSTER',path:'props/poster.png',width:32,height:48,prompt}`。按 prop-generation 生产原生透明或纯白底单图，候选使用 `sourceImage` 和真实 `generationCalls`。宿主验证原生图片来源、透明边界、非空主体、输出尺寸和独立视觉审阅，并写入外部可信收据；道具不得伪报为角色/场景。不同外观或状态分别使用稳定资产 ID。此入口只负责静态图，交互、碰撞与组合由游戏配置及扩展接入；不据此声称实现了道具动画。

cw_read_skill按需阅读，cw_checkpoint记录动态安排；cw_minigames查小游戏库索引（100种/10类，选题后按ID读正文）；cw_check随时检查；cw_build_test(mode:graybox)可先验证规则，formal使用正式素材实测；cw_assets自主选所需ID；cw_review以实际截图和代码独立核对机制/原作/视觉；cw_finish提交当前最终候选；结束本回合后宿主再核验并接受，避免提交后修改仍冒充验收通过。没有固定调用顺序，但最终候选必须有对应的正式实测和独立审阅。改内容后旧测试会失效。

不靠字数、等待或重复往返凑时长；主线必要的情感交流无需发道具。节点说明其信息/状态/目标/操作或叙事作用，检查重复。读图、程序、浏览器和真人证据分开；自动速通不能冒充真人10分钟体验。

同一问题连续失败应读诊断调整方法；无进展或缺少必要外部事实用cw_block精确说明。禁止删需求、删失败测试以换取通过。旧版本不会被候选覆盖。

## 素材返修与检查职责

素材流水线由 `packages/assets` 负责：`workflow.ts` 定义失败归属和资源级持久重试预算，`candidate-checkpoint.ts` 保存宿主确认过的原生来源，`index.ts` 串联处理、验收与发布。通用 `ToolRuntime` 只负责调度和耗时记录，不再对资源失败重复执行会话级计数。

场景任务可声明 `sceneContent:{baked:['床','桌'],runtime:['人物','剧情获得后出现的道具'],state:'当前背景状态'}`。生产与单素材审阅共用此归属。未明确锁定的精确坐标是布局估计；保留剧情拓扑、出口和操作关系，允许按画面适配碰撞。背景审阅不能要求提前烘焙运行时物件。数值可达性由宿主检查，最终人物/背景/家具比例、风格和剧情状态在真实运行同屏审阅中核对。细小且不影响使用的瑕疵列建议。

`cw_assets` 的失败逐资源返回 `code/owner/nextAction`，有原生候选时同时返回 `resumeCandidate`。先修负责层，在该任务中设置 `resumeCandidate:'asset-jobs/<id>/<attempt>/candidate.json'` 再调用工具。修几何可修改原候选的碰撞数据、规范化输出或相应任务说明；母版和方向/帧修复源不能替换。宿主验证候选来源、重新执行必要处理与审阅，不再调用生图。没有宿主来源检查点的旧候选不能据此冒充已验证来源。

同一资源同输入同类失败两次后停止无变化重试；同一美术版本累计最多三次生产尝试，跨 attempt、批次及服务重启计数，取消不计失败。有可复验候选的几何/审阅错误会直接引导修候选，避免再次生图。修正输入仍可验证现有候选；不受影响的资源继续。已通过且输入未变化的资源沿用原有宿主收据与文件校验，不重生或重复审阅。

场景 `render` 已包含原几何验证，不再紧接着重复跑相同的 `validate`；运行时碰撞体转换的独立验证仍保留。只读技能、内容档案和小游戏资料查询不排在长生产步骤后面；配置检查、构建、素材发布等仍走串行通道。任务日志分别记录 `queuedAt/queueDurationMs/executionDurationMs`，不能把队列时间当作实际执行时间。
