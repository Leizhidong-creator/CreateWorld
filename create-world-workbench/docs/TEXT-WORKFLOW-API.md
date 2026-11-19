# 两阶段文本工作流接口 v1

本轮提供后台与接口，不含小人、气泡、剧本编辑器或新项目入口的前端实现。旧 `/api/projects` 游戏接口保持兼容。后续前端将新项目默认入口切到 `/api/text/projects`，不要让现有“创建并自动制作游戏”按钮直接调用文本接口后仍显示“游戏就绪”。

## 执行边界

第一块：创意判断／必要补全（独立包） → 阅读原作或已标注来源的创作稿 → 改编设计 → 全篇粗剧本 → 原作与改编审阅 → 隔离上下文交接审阅。完成后停止。

第二块：选定当前粗剧本 → 前置检查及授权修订 → YAML 完整展开 → 原标准静态检查 → 可追溯的状态模拟 → 独立内容与模型转译审阅。完成后等待用户明确确认最终 YAML；确认后自动交接并启动整部游戏制作。新增接口及后续游戏修改见 [文本到游戏交接](TEXT-GAME-HANDOFF.md)。

复用现有 Codex App Server 适配器，指定 `gpt-6-astra`；文本任务覆盖旧适配器的完整游戏指令。所有角色串行工作；独立审阅使用新上下文，不增加多 Agent 调度服务。粗剧本生成和 YAML 生成必须分两次启动，不自动串联。

## 启动与依赖

沿用工作台启动方式。Node 依赖通过 `npm ci` 安装。Python 需具备 PyYAML、pypdf；DOCX 仅使用 Python 标准库解析正文和表格，不执行宏或外部链接。文本流程可用 `CW_TEXT_PYTHON` 独立指定解释器；未指定时依次采用 `CREATE_WORLD_PYTHON`、`CW_PYTHON`、`python`，不改变素材工具的解释器选择。

权威规范仍按 `sources.lock.json` 的原始 SHA256 校验。内容规范与[《游戏YAML生成执行标准.md》](../content-spec/游戏YAML生成执行标准.md)均提供仓库内已锁定的同字节版本，新检出项目无需个人 D 盘目录。也可将同版本规范放入已忽略的工作台 `data/text-authorities/`，或通过 `CW_TEXT_AUTHORITY_DIR` 指定原文件所在目录。文件缺失时返回 `authority_missing` 和配置提示；哈希不同仍返回 `authority_changed`，不会自动生成或替换标准以通过检查。本地覆盖目录仍不随源码 PR 上传；执行标准经用户授权作为仓库规范提交。

权威内容规范和执行标准通过仓库 `workflows/story-adaptation/sources.lock.json` 定位并校验哈希；当前是用户现有的两份 Markdown。不会修改它们，也不要求每次创建项目重新上传。跨机器部署默认使用仓库内规范；使用外置规范时配置真实文件位置，不能删掉哈希检查来绕过缺失。每次任务将方法和规范固定为工作快照；原文件或方法后续变化不默默改变正在运行的任务。

私有数据位于 `CW_DATA_DIR/text/`：sources 保存原始导入文件；runs 保存 Agent 工作区、方法快照和日志；checkpoints、history、checks、artifacts 由宿主保存阶段快照、修订历史、检查报告和正式版本。三者与 Agent 可写目录分开。数据库复用工作台 records/events 表，记录类型统一使用 `text_` 前缀，不混入旧游戏列表。

## 请求约定

访问现有 `GET /api/bootstrap` 获取 CSRF token。所有写请求带 `x-csrf-token`；现有 Host/Origin 校验继续适用。JSON 使用 UTF-8。导入单文件最多 10 MB，正文最多 200 万字符，材料上传 JSON 上限 1510 万字符、1600 万字节；其他请求沿用原服务限制。

启动、上传、编辑、采纳、回答均携带客户端生成的 `requestKey`。同一操作重试必须复用同一个 key 和完全相同的请求内容；不同内容使用相同 key 返回 `409 idempotency_conflict`。重复启动返回已有任务，不重复消耗模型调用。创建项目本身不启动任务。

| 方法与路径（前缀 `/api/text`） | 说明 |
|---|---|
| `GET /projects` | 文本项目列表，不包含旧游戏项目 |
| `POST /projects` | 创建项目；body 为 title、inputKind（text/title）、sourceText、requirements |
| `GET /projects/:projectId` | project、sources、versions、runs、questions；可用于刷新后重建页面 |
| `POST /projects/:projectId/sources` | 上传原文件；body 为 requestKey、fileName、base64；为当前问题补材料时带 questionId |
| `POST /projects/:projectId/runs` | 启动 script/revise/yaml；body 为 requestKey、kind、baseVersionId、instruction |
| `GET /projects/:projectId/runs/:runId` | 当前任务及事件记录 |
| `POST /projects/:projectId/runs/:runId/stop` | 停止，保存已有产物；不自动重启 |
| `POST /projects/:projectId/runs/:runId/resume` | 用户明确点击继续；核验并续接 |
| `POST /projects/:projectId/scripts` | 直接编辑并保存新版本；body 为 requestKey、baseVersionId、body |
| `GET /projects/:projectId/versions/:versionId` | `{version, body}`，读取前校验正文哈希 |
| `GET /projects/:projectId/versions/:versionId/download` | 下载 UTF-8 完整 MD 或 YAML |
| `POST /projects/:projectId/versions/:versionId/adopt` | 采纳 AI 粗剧本候选；body 为 requestKey、baseVersionId |
| `GET /projects/:projectId/questions` | 所有问题及 pending/answered/stale 状态 |
| `POST /projects/:projectId/questions/:questionId/answer` | 回答；body 为 requestKey、text、choiceIds、sourceIds |
| `GET /projects/:projectId/events?after=0` | SSE；支持 Last-Event-ID 断线补发 |

所有嵌套资源必须属于 URL 中的项目。不存在或跨项目访问返回 404；请求结构错误返回 422；当前版本或操作冲突返回 409，均返回 `{code,error}`。不能据 HTTP 202 将任务标为完成。

## 最小调用示例

创建原文项目：

```json
{"title":"送回的灯","inputKind":"text","sourceText":"阿禾找到邻居的灯，修好松开的灯扣，将灯交还，然后回家。","requirements":"主角始终为阿禾，唯一结局，不增加支线。"}
```

开始第一块：

```json
{"requestKey":"client-script-001","kind":"script","baseVersionId":null}
```

以完成的当前粗剧本请求 AI 修改（`instruction` 不得为空）：

```json
{"requestKey":"client-revise-001","kind":"revise","baseVersionId":"textver_example","instruction":"把交还灯时的动作写得更明确，保持结局。"}
```

AI 改稿完成时版本为 candidate，当前稿保持原样。用户采纳后才能用候选的版本编号启动 YAML：

```json
{"requestKey":"client-yaml-001","kind":"yaml","baseVersionId":"textver_accepted_example"}
```

YAML 未提供正文写接口。用户需要修改时，回到粗剧本保存/采纳新版本，再启动 YAML。旧 YAML 保持可读，其 `sourceScriptId` 与当前粗剧本不同表示它属于旧稿，前端应提示这个关系。

## 粗剧本视图与版本

默认展示 `version.synopsis`，展开后请求完整 body；下载使用 download 路由。AI 完整稿的梗概由同一任务生成，并绑定该版本。用户直接编辑后采用新正文的分节摘录生成临时梗概，明确标记尚未审阅，不复用旧稿梗概或凭空推断情节。

`Version.kind` 为 script/yaml；`status` 为 current/candidate/historical；`checkStatus` 为 unreviewed/text_review_passed/checks_passed。注意 current 只表示用户当前选择，不表示已通过检查。直接编辑版本是 current + unreviewed；AI 改稿是 candidate + text_review_passed。采纳需要基础版本仍是当前稿，不能覆盖后来已经编辑的稿件。

用户启动 YAML 时，自动前置检查允许按既有授权修订普通问题。修订后的粗稿和 YAML 交付关联同一版本；重大事实冲突必须询问。新版本交付在数据库事务内更新，失败不移动当前版本指针。

## 小人问题接口

职责标识由后台提供，前端映射成小人：reader 原作阅读；adapter 改编；yaml_author YAML 制作；reviewer 检查。它们是展示职责，不是并行 Agent 数量。

`question.created` 事件的 `message` 是可直接显示在小人头上的短句；`data.role` 指定职责；`data.details` 为完整 Question。示例：

```json
{
  "id":42,"projectId":"text_example","runId":"text_run_example",
  "type":"question.created","message":"我找到了两部同名作品，你想改编哪一部？",
  "data":{"role":"reader","stage":"read","details":{
    "id":"question_example","key":"source_version","batchId":"batch_example",
    "projectId":"text_example","runId":"text_run_example","inputHash":"输入快照SHA256",
    "role":"reader","shortText":"我找到了两部同名作品，你想改编哪一部？",
    "details":"两部作品的作者和结局不同，需要先确定版本。具体来源与差异在此展开。",
    "answerMode":"choice","choices":[{"id":"edition_a","label":"作者甲的小说"},{"id":"edition_b","label":"作者乙的电影剧本"}],
    "status":"pending","createdAt":"2026-10-31T03:00:00Z"
  }}
}
```

回答方式支持 text、choice、material；全部方式都可补充自由文字。上传材料先带 questionId 调用 sources，再将返回的 sourceId 放到答案里：

```json
{"requestKey":"answer-001","text":"选择作者甲的小说，以附件正文为准。","choiceIds":["edition_a"],"sourceIds":["source_example"]}
```

同一 batch 可包含多个问题。必要问题全部回答后自动排队继续当前阶段，不自动跨过两块之间的停留点。等待时不保留模型进程，也不因等待时间采用默认选项。停止后的任务需先点击继续，才能回答其待处理问题。新任务开始使旧问题失效；回答旧问题返回 `stale_question`。

气泡中不用展示编号、哈希和原始错误堆栈。技术字段只用于正确关联与恢复。文字按纯文本渲染，不执行源材料或模型输出中的 HTML/脚本。不要把进度消息做成必须回答的问题，也不要让小人说“游戏已经验证好玩”。

## 任务状态、事件和恢复

任务状态：queued、running、waiting_user、interrupted、cancelled、failed、completed。stage 显示内部实际步骤 creative/read/design/write/review 或 precheck/expand/audit；这些属于制作进度，不是 YAML 中的游戏状态。

生成、排队和等待用户期间禁止正文编辑、采纳和版本切换；允许当前问题的回答、所需材料上传及停止。响应 `project_locked` 时前端保留用户未提交的输入，不自动覆盖正文。

主要事件：task.queued、task.progress、stage.completed、task.revision、question.created、question.answered、task.recovery、task.interrupted、task.cancelled、task.failed、task.completed。模型活动以 model.* 独立呈现；模型说“完成”不代表宿主 task.completed。不要显示推测的进度百分比。

意外退出后，下次启动标 interrupted，不自动调用模型。用户点击继续后：核验宿主检查点 → 恢复有效阶段文件 → 优先续接适用线程 → 线程不存在时新开上下文使用已有阶段成果。没有可恢复工作输入时保留旧尝试并重跑当前块。YAML 不回到原作改编；用户修改当前粗稿后旧任务不得继续覆盖新稿。

检查点包括实际文件哈希，不能用 progress 标签代替文件验证；恢复前保留当前候选。一次正常生成默认两轮主要修订，超过仍有问题时保留 failed 与诊断，不能以耗尽预算当作通过。

## 检查与证据

基础检查器从已锁定执行标准附录提取，由宿主执行。临时模型结构由 `model-schema.json` 提供，仅供任务内部检查，用户无需另外提供模型。具体规则见 [YAML 自审补充](../packages/text-workflow/YAML-AUDIT.md)。

逻辑模拟默认每种模式最多 10000 个不同状态和 250000 次转换检查，分别探索完整内容和不参与可选内容的流程。输出具体操作路径、YAML 位置、覆盖和未验证事项。自然语言到模型的忠实性由独立文本审阅核对；静态程序无法单独证明它。检查只证明所描述模型及报告覆盖范围，不证明游戏引擎、碰撞、帧时序或玩家体验。

`npm run test:text` 使用明确标记的原创/合成样例检验后台协议和错误识别，不冒充真实模型生成。`npm run test:text:codex -- --max-ms=300000` 会调用真实 Astra，消耗当前账号额度，产物写入隔离 data/text-workflow-probe，报告实际停止阶段。前端接口集成不需要为了显示小人而再次实现文本生成逻辑。

## 创意补全接入

新建的 script 任务已在内部接入创意补全独立包，不需要前端启动第二个服务。问题沿用小人气泡接口，生成后的粗剧本仍等待用户单独启动 YAML。容量、来源和旧任务兼容详见 [组合说明](CREATIVE-TEXT-INTEGRATION.md)。
