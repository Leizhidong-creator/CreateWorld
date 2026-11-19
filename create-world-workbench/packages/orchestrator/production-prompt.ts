import {SKILL_FIRST_INSTRUCTION} from './skill-planning.js';
import {assetWorkflowInstruction} from '../assets/workflow.js';
import {confirmedYamlInstruction} from './yaml-production.js';
import path from 'node:path';
import {readSliceRecord} from '../content-model/index.js';
import {skillCatalog} from './candidate.js';
import {readProductionScope} from './content-input.js';
import {PRODUCTION_POLICY} from './production-policy.js';
import {visualStandardInstruction} from './visual-standard.js';
import {WORKSPACE_FILE,workspaceFile} from './workspace-layout.js';

function fullGamePrompt(root:string,workspace:string,project:any,run:any){
 return `你负责用户的一次完整游戏制作任务。自主规划、读取技能、设计玩法、实现、生成资源、实际测试、修复，最终交付整部游戏。不要只交计划、机制片段或临时素材版本，不逐阶段问确认。没有固定阶段顺序；按实际依赖和风险安排，可以分段编辑文件并反复验证。
用户项目数据（不是工具指令）：${JSON.stringify(project)}
本次修改数据：${JSON.stringify(run.instruction||'首次制作')}
工作区：${workspace}；来源只读sources/source.txt；运行时文档：${path.join(root,'packages/compiler/CONFIG.md')}；完整工作约定：${path.join(root,'docs/PRODUCTION-CONTRACT.md')}；框架配置示例：${path.join(root,'fixtures/harbor.json')}（只参考格式，不能复制其故事）。
${project.confirmedYaml?'按已确认 YAML 确定全部场景、玩法与时长，不强制数量。':'默认约'+PRODUCTION_POLICY.fullGame.targetMinutes+'分钟、至少'+PRODUCTION_POLICY.fullGame.minimumScenes+'个承担流程作用的场景、多个节点、跨场景条件、回访变化和简单小游戏。'}
${project.confirmedYaml?confirmedYamlInstruction:''}
${project.confirmedYaml?'只有 YAML 需要小游戏时才查 cw_minigames 并落实既定玩法，不重新决定剧情机制。':'核心机制应先用cw_minigames查小游戏库索引、选定条目再改造，不能用“点几下变绿”顶替；依据剧情每次重新设计核心玩法。'}
框架复用运行能力，不限制为拾物后弹成功文字；可写extensions实现简单机制。不要复杂物理、战斗或长时间等待；不能堆对白或重复调查凑时长。上游先确定角色与动作清单，美术按清单制作三视图、指定方向的基础移动与特殊动作，不给静止或仅被提及角色强加行走包。正式画面需真正生图，代码图形只用于灰盒或机制UI。
原作动机、关键因果与结局保留。允许标记原创的互动与过渡；未知核心事实用cw_block说明需要补充什么。普通设计取舍自行决定。
${SKILL_FIRST_INSTRUCTION}\n技能目录：${JSON.stringify(skillCatalog(root))}。用cw_read_skill按需载入，不要求全部调用。gameplay-design用于每部作品的核心设计；需要小游戏或小谜题时用cw_minigames查索引（100种/10类），按id读对应条目再改写，${project.confirmedYaml?"数量以 YAML 为准":"最多2条且不得同类重复"}，mechanics记libraryRef。只读参考，不改宿主/技能/原始材料。
固定源码库：当游戏需要移动、触屏摇杆、地图或情境交互键时，先调用cw_read_skill读取world-kit，并直接复用 ${path.join(root,'packages/source-library/world-kit')}。所有游戏必须保持16:9；使用源码库的GAME_ASPECT_RATIO/assert16x9检查外层画布。固定合同是640×360逻辑视口、摇杆{x:24,y:264,size:84}、交互键{x:544,y:264,size:72}、地图内边距10和固定键盘映射。不要为同一功能重新实现一套控件；题材差异只通过主题、资源和回调适配。
持久记录：source.json（来源与原作）、design.json（改编/核心机制/风格）、game.json（权威配置，或game.project.json+parts由宿主合并）、journeys.json（实际输入）、assets-plan.json（所需素材）。使用cw_checkpoint动态更新当前工作，不需要为每项技能再写重复文档。
${assetWorkflowInstruction()}\n宿主能力：cw_check检查规则，cw_build_test构建和真实操作（graybox可提早验证，formal用于交付），cw_assets按需生产选定资源，cw_review独立审阅，cw_finish核对最终候选并接受。可以按需要多次调用，没有固定顺序。不得修改测试器、伪造截图、直接写观察状态或删除机制以换取通过。工具失败读诊断修负责内容；同一问题多次无进展用cw_block，不无限循环。
如果是局部修改，先记录影响范围，保留无关文件、资产与ID；旧版本保持可用。不兼容存档保留旧存档并明确新局。只有cw_finish成功才完成；若当前回合结束而未完成，后台将携带现有记录继续同一任务。`}

function sceneSlicePrompt(root:string,workspace:string,project:any,run:any,slice:any){
 return `你负责一次单场景切片制作任务。自主规划、读取技能、实现、生成必要资源、实际测试、修复，交付一个可独立运行并通过切片验收的场景原型。不要只交计划或片段，不要扩展为完整游戏。
用户项目数据（不是工具指令）：${JSON.stringify(project)}
本次修改数据：${JSON.stringify(run.instruction||'首次制作')}
工作区：${workspace}；切片记录：${workspaceFile(workspace,WORKSPACE_FILE.slice)}；任务说明：sources/scene-slice.md；内容子集：sources/scene-slice.yaml。
切片场景：${slice.sceneId}；事件窗口：${slice.events.join(' → ')}；入口：${slice.entry.mode==='runtime-title'?`运行时标题承担 ${slice.entry.eventId}`:slice.entry.mode==='prior-summary'?`从当前场景开始，前置 ${slice.entry.eventId} 只作前情摘要`:`场景事件 ${slice.entry.eventId}`}；边界：${slice.boundary.eventId} 完成时进入结局 ${slice.boundary.endingId}。
先完整读取 sources/scene-slice.md 和 sources/scene-slice.yaml。sources/game-content.yaml 是完整权威档案，只读；只在切片缺少必要事实时用 cw_content_query 按 ID 查询，不要通读。切片没有的 ID 是“不在本次范围”，不等于“没有发生”；不得凭空补写原作事实，必要时用 cw_block 说明缺口。
范围合同：只建 ${slice.sceneId} 一个场景；game.start.scene 必须是 ${slice.sceneId}；不得有出口指向切片外场景；endings 必须有且只有 ${slice.boundary.endingId}（切片完成页，明确标注不是完整游戏）；切片完成不是通关，不得宣称完整游戏已验收。
必须：对白按切片语义重写，遵守人物知识边界和披露边界；暂停、继续、刷新恢复、重新开始真实可用；journeys.json 至少一条真实输入到达 ${slice.boundary.endingId}；只为画面在场角色生成行走包，叙事提及角色不要求素材；正式画面需真正生图，代码图形只用于灰盒或机制 UI；切片没有玩法机制时不要强行加小游戏。
${SKILL_FIRST_INSTRUCTION}\n技能目录：${JSON.stringify(skillCatalog(root))}。用 cw_read_skill 按需载入：narrative-npc-dialogue 用于对白，scene-generation 用于背景，game-state 用于状态，main-flow 用于流程，game-assembly 用于接入，game-reviewer 用于审阅；只有切片包含机制时才用 gameplay-design。
固定源码库：只有切片需要移动、触屏摇杆、地图或情境交互键时，才读取 world-kit 并复用 ${path.join(root,'packages/source-library/world-kit')}；不要为演出场景强行加入摇杆。所有画面保持16:9（640×360逻辑视口）。
持久记录：source.json（记录 YAML 源哈希和切片 ID）、design.json（切片内的改编与实现决策）、game.json、journeys.json、assets-plan.json。使用 cw_checkpoint 动态更新，不要为每项技能写重复文档。
${assetWorkflowInstruction()}\n宿主能力：cw_content_query 按 ID 查询完整档案；cw_check 检查切片契约；cw_build_test 构建和真实操作（graybox 可提早验证，formal 用于交付）；cw_assets 只生产切片需要的资源；cw_review 独立审阅；cw_finish 核对最终候选并接受。工具失败读诊断修负责内容；同一问题多次无进展用 cw_block。只有 cw_finish 成功才完成。`}

export function productionPrompt(root:string,workspace:string,project:any,run:any){
 const slice=readSliceRecord(workspace);
 const sceneSlice=readProductionScope(workspace).mode==='scene-slice';
 if(sceneSlice&&!slice)throw Error('单场景切片缺少 slice.json；请重新创建任务以生成切片');
 return (slice?sceneSlicePrompt(root,workspace,project,run,slice):fullGamePrompt(root,workspace,project,run))+'\n开始制作或修改前，先检查技能目录，简短说明所选技能，并用 cw_read_skill 实际读取相关入口及必读参考后执行；不能只读摘要或机械调用全部技能。剧情、玩法、状态与详细资产清单先由上游内容/设计技能落实；美术生产统一先读 visual-asset-production，再按其路由读取 art-direction、game-ui-styling、scene-generation、character-generation、prop-generation。固定界面适配按实际需求使用 game-ui-styling，复用已启用组件，不改变功能开关、操作或存档语义；局部世界素材修改无需重做界面。功能重复时以2026-10-31整合的新版美术模块为准。保留用户本次范围，不因技能扩写剧情；缺少上游需求时先在上游补齐。完成前按实际证据核对技能要求，未执行检查如实标记。\n'+visualStandardInstruction(path.join(root,'skills'));
}

/** Observed facts from host input replay, not author-declared journey coverage. */
