# 文本流程与游戏制作接入

本接口提供后台能力，工作台页面和小人气泡尚未接入。前端不用组织多个模型服务，只调用同一个工作台 API。

## 用户操作与版本关系

原文 → 创意判断/补全 → 阅读、设计、完整粗剧本、审阅 → 停止等待用户。

粗剧本可下载、保存编辑稿、请求 AI 改稿、采纳候选。用户另行启动 YAML 后，后台完成前置检查、展开、静态检查、状态模拟及内容审阅。此时发出 `yaml.awaiting_confirmation`，只表示 YAML 可以确认，不能显示为游戏完成。

用户查看后明确确认这个 YAML 的版本与哈希。后台保存确认记录，自动向整部游戏制作入口输入该版本并启动任务。没有确认就没有游戏制作任务；历史 YAML 不因升级自动启动。

一个文本项目关联一个游戏项目。确认后文本阶段冻结，正式 YAML 保持只读。游戏后续的 bug、画面和玩法优化使用游戏修改接口，基于当前已接受游戏建立新候选，不默认重跑粗剧本或 YAML。旧的可用游戏不被失败候选替换。若希望改变固定故事事实或结局，制作器须提出冲突问题，不能默改原档案。

## 接口

前缀为 `/api/text/projects/:projectId`。写请求使用 JSON 和 `x-csrf-token`（从 `/api/bootstrap` 获取），沿用 Host/Origin 检查。这里是本地单用户接口；不宣称已经具备多账号认证隔离。

| 方法与后缀 | 用途 |
|---|---|
| `POST /confirmations` | 用户明确确认最终 YAML，并自动启动交接 |
| `GET /handoffs` | 查询交接记录、关联游戏项目及首次游戏任务 |
| `POST /handoffs/:handoffId/stop` | 停止首次交接/制作，保留确认与成果 |
| `POST /handoffs/:handoffId/resume` | 用户继续交接或原游戏任务 |
| `GET /game-questions` | 游戏制作阶段的持久化问题 |
| `POST /game-questions/:questionId/answer` | 回答游戏问题；被主动停止的任务不会因回答自动启动 |
| `POST /game-materials` | 为指定游戏问题补材料，保留原件与提取结果 |
| `GET /events?after=…` | 文本、确认、交接和关联游戏进度；支持 Last-Event-ID |

其他文本接口见 [两阶段接口](TEXT-WORKFLOW-API.md)。正文上传上限 10 MB；sources/game-materials 的 JSON 上限为 1510 万字符、1600 万字节，其他请求沿用 300 万字符、1200 万字节。提取失败会保留原件并标为不可可靠读取，不能据此继续制作。

确认请求必须来自用户明确的确认操作。禁止在 YAML 完成回调、刷新恢复、读取版本或自动化真实样例驱动器中自动发送：

```json
{
  "requestKey": "client-confirm-001",
  "versionId": "textver_example",
  "bodyHash": "从版本响应原样取得的64位SHA256",
  "confirmed": true
}
```

返回 HTTP 202，示意如下（ID 为占位示例）：

```json
{
  "id": "handoff_example",
  "projectId": "text_example",
  "versionId": "textver_example",
  "bodyHash": "最终YAML哈希",
  "sourceScriptId": "textver_script_example",
  "gameProjectId": "game_example",
  "runId": "run_example",
  "status": "generating",
  "gameRun": {
    "id": "run_example",
    "projectId": "game_example",
    "revisionId": "rev_example",
    "mode": "generate",
    "status": "queued"
  }
}
```

HTTP 202 表示请求已处理，不保证游戏已完成。交接可以返回 `failed` 并附 `error`，确认与诊断仍被保留。不得自动循环确认或新建任务来绕过错误。

交接状态包括 `confirmed`、`dispatching`、`generating`、`passed`、`failed`、`blocked`、`cancelled`。查询同时返回真实 `gameRun`，不要只依据初始响应保持旧状态。最终可玩版本以游戏项目的 `currentRevisionId` 和宿主接受结果为准。

| 错误码 | 含义与处理 |
|---|---|
| `invalid_input` / 422 | 缺少明确确认、版本或合法哈希；修正请求 |
| `stale_yaml` / 409 | 粗剧本或当前 YAML 已变化；刷新查看，不代用户确认新版本 |
| `yaml_not_passed` / 409 | 检查未通过或请求哈希不符 |
| `artifact_changed` / 422 | 正式文件与宿主版本哈希不符 |
| `project_locked` / 409 | 尚有运行任务或未解决的问题 |
| `idempotency_conflict` / 409 | 相同 requestKey 携带不同内容 |
| `already_confirmed` / 409 | 已确定另一最终版本；使用游戏修改流程 |
| `final_yaml_confirmed` / 409 | 不能再编辑已进入制作阶段的文本项目 |
| `stale_question` / 409 | 问题不再等待回答，不能影响后来的任务 |
| `stopping` / 409 | 原模型仍在退出，稍后重试相同回答 |
| `not_found` / 404 | 资源不存在或不属于 URL 指定项目 |

重复提交相同确认返回同一交接及游戏任务。换 requestKey 再确认同一个最终版本也不会生成第二个游戏。确认持久化后、任务创建前中断，重启会恢复交接；任务已经创建但未记录回交接时，通过任务上的 `handoffId` 找回原任务。已经停止、失败或被服务中断的模型任务仍等待用户继续，不自动重新调用模型。

## 自然语言修改已有游戏

从 handoff 取得 `gameProjectId`，使用已有接口：

```text
GET  /api/projects/:gameProjectId
POST /api/projects/:gameProjectId/runs
GET  /api/runs/:runId
POST /api/runs/:runId/cancel
POST /api/runs/:runId/resume
GET  /api/revisions/:revisionId
POST /api/projects/:gameProjectId/rollback
```

启动修改的 body：

```json
{"mode":"change","instruction":"修复门口交互范围偏小的问题，保持剧情和结局。"}
```

后台锁定启动时的当前游戏版本作为 `baseRevisionId`。不允许并发修改和切换游戏版本。候选失败或停止时，旧版本指针保持不变。后续修改任务的进度事件也会转发到文本项目，`runId` 区分首次制作和后续修改；停止/继续后续修改时使用其对应的 `/api/runs/:runId` 接口。

## 拟人化问题与事件

文本阶段角色继续为 `reader`、`adapter`、`yaml_author`、`reviewer`；游戏阶段增加职责 `game_maker`。这些是展示职责，不代表并行 Agent。

`question.created` 是必须回答的问题，`task.progress`、`model.*`、`game.*` 进度不是问题。文本阶段问题放在事件 `data.details`，游戏阶段问题放在 `data`；前端统一取 `data.details?.id ? data.details : data` 后判断问题字段。

游戏阶段问题示意：

```json
{
  "id":"game_question_example",
  "projectId":"text_example",
  "runId":"run_example",
  "inputVersionId":"textver_example",
  "inputHash":"最终YAML哈希",
  "batchId":"batch_example",
  "role":"game_maker",
  "shortText":"制作遇到一个需要你确定的问题：这扇门应通向哪里？",
  "details":"这里显示具体冲突、来源位置及影响。",
  "answerMode":"material",
  "choices":[],
  "status":"pending"
}
```

气泡使用 `shortText`；展开显示 `details`。`material` 模式同时允许文字回答与补充材料。答案 body 为 `requestKey`、`text`、`choiceIds`、`sourceIds`；游戏问题当前使用文字/材料，`choiceIds` 应为空。

补材料 body 为 `requestKey`、`questionId`、`fileName`、`base64`。先取得可读 Source，再用返回的 id 提交答案。问题已过期、材料不属于本项目或提取失败时拒绝回答。刷新后重新读取问题，不以界面缓存自动作答。

YAML 完成时显示查看、下载、最终确认入口；最终确认之后显示自动交接、游戏制作和游戏修改入口。仅在明确用户点击时调用确认接口。所有本轮页面行为均为后续接入说明，当前没有修改前端。

## 内容检查与证据

新链路的整作制作按最终 YAML 的规模验收，不沿用五场景或强制小游戏门槛。旧的独立游戏入口和切片入口保持原规则。没有修改正式 YAML 格式。

游戏制作内部的 `design.yamlCoverage` 逐项关联 YAML 场景、事件、玩法、结局与运行配置位置、操作旅程；宿主检查映射完整性、源哈希、目标存在性和旅程引用。正式实际操作必须观察到各运行场景、验证已实现的小游戏（如有）和中途存档恢复。独立审阅另以 `review.yamlReview` 记录逐项语义结论，不能把结构映射当作剧情忠实性的证明。

文本自审、静态映射、状态模型、浏览器实际输入和模型图像审阅分别报告。只有宿主接受正式候选才显示游戏成功；模型自报、HTTP 成功及文件存在都不能替代。

## 两场景真实验证

`node --import tsx scripts/text-game-probe.ts` 启动隔离的原创样例及临时 API 服务。默认真实任务累计运行上限为 30 分钟，等待用户回答和最终确认不占预算。默认数据写入 `data/text-game-probe/<时间>/`，不读写已有作品。

可通过 `--data=<原验证目录>` 恢复服务，通过原任务继续接口恢复中断任务；不会自动重跑失败任务。脚本自动推进已获授权的样例粗剧本和 YAML 阶段，**不调用最终确认接口**。YAML 就绪后输出版本、哈希、查看和确认地址，用户明确确认后才制作游戏。

`probe.json` 记录累计用时、问题、版本和交接；完整结果以该目录中的任务、正式版本与宿主证据为准。到上限即停止实际调用并保留诊断。两场景就是验收范围，不要求扩展为更大的游戏；检查失败或尚未发生的操作不能写成通过。
