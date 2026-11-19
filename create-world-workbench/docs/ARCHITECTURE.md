# 整部游戏自主制作 v2

用户一次提交完整故事任务。Workbench使用真实Codex App Server持久线程，提供工具，Codex自己确定工作顺序、按需读取14个技能、设计剧情驱动机制、写内容与扩展、生成资源并测试修复。没有固定六阶段状态机；旧阶段适配器保留为兼容回归资料，不用于生产调度。

## 分工

- 工作台：项目、动态工作、实际工具记录、试玩、修改、回退与导出。
- autonomous.ts：完整任务生命周期、可恢复会话、串行宿主工具、结果验证、失败保存。连续无进展或有界续作耗尽明确失败，不冒充完成。
- Codex：整体设计、内部任务安排、必要技能选择、机制实现和依据诊断修复。可分文件或分段完成，但不能只交付片段。
- runtime/compiler：复用输入、场景、状态与界面能力；确定性构建。项目机制由extensions接入，不固定为收集/对白。
- assets：原生生成证据、确定性图像工艺、读图复核与局部缓存。直接4×4图集及追加动作新增；旧3×4兼容工艺保留。新工艺质量必须通过真实生产积累证据，不假设优于旧工艺。
- browser-runner：真实键鼠输入和只读状态观察，支持小游戏、断言、中途刷新；不直接写状态通关。

## 模块边界

- `packages/contracts`：纯契约层，拥有 `Project/Run/Task/Revision/WorkEvent/Journey`、项目输入 schema 与前后端 DTO；不依赖素材实现或文件系统。
- `packages/shared/files`：宿主文件、哈希、原子写与路径安全，属于基础设施，不被契约层反向依赖。
- `packages/orchestrator/workspace-layout`：唯一工作区文件清单。初始化、候选指纹、模型只读保护、API 产物投影与导出都从该定义派生。
- `packages/orchestrator/tool-runtime`：串行宿主工具、任务记录、重复失败熔断与最终验收闸门；`autonomous.ts` 只保留工具定义和任务循环。
- `packages/orchestrator/candidate-records`、`production-policy`：候选 build/review/session 记录，以及提示词与校验器共用的场景数、回合数、重试阈值。
- `apps/server/app.ts`：只做 HTTP 路由与传输适配；`services/projects`、`services/revisions`、`services/export` 分别负责查询、产物投影与导出；`http/security/events` 为适配器。版本 DTO 不包含物理工作区路径。
- `packages/runtime/scene-transition`：唯一场景转场事务；手动出口、自动出口和场景命令共用，先校验目标与 `onEnter`，失败恢复旧 run。
- `apps/web/workspace/useWorkspace`：项目、Run、Revision 资源状态、SSE 失效与动作；`App.tsx` 只保留视图状态和渲染。

请求体先收集字节再统一 UTF-8 解码，避免中文跨分块损坏；列表页面和规范化在 `apps/web/src/api.ts` 完成，组件不再处理多种响应外形。

## 持久化与版本

SQLite保存项目、运行、动态任务、事件、候选和当前版本。项目原始材料只读，工作任务可自由组织内容。持久线程ID保存在宿主目录；工作记录和产物能在中断后继续使用。旧失败项目仍保留，继续时采用新完整任务执行器，不伪造旧阶段通过。

新版本采用构建manifest哈希、候选指纹和实测证据绑定，不再给整个工作区叠加HMAC认证。旧HMAC版本保持可读兼容。动态工作“完成”为模型自报，和工具执行及整部游戏验收分开显示。

只有对应当前内容的正式构建、真实操作、独立审阅和正式资源记录齐全才接受。读取/检查工具成功不代表游戏通过。候选失败不更新当前可玩版本。

## 安全与来源

本机API校验Host/Origin/CSRF，游戏预览独立来源。Codex仅能写候选工作区，源材料不是执行指令；编译与可信测试目录由宿主持有。导出为独立HTML5，无Codex、工作台或远程CDN依赖。保留原游戏来源声明，不给无许可原代码重新许可。

## 接入参考

实际配置见 packages/compiler/CONFIG.md；制作合同见 PRODUCTION-CONTRACT.md；项目技能源在 ../.agents/skills，运行包由 npm run skills:sync 同步至skills。全局同名技能不修改。

官方App Server文档：https://developers.openai.com/codex/app-server/ 。本机实际验证了动态工具和thread/resume；没有改登录方式、模型或接入额外付费服务。
