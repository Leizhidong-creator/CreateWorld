# 场景切片工作流（实现约定）

本文件是实现版合同，补充 [YAML_SCENE_SLICE_WORKFLOW_PROPOSAL.md](YAML_SCENE_SLICE_WORKFLOW_PROPOSAL.md) 中尚未落地的部分。原则只有一句：**完整 YAML 是权威事实源，切片是宿主生成的受限视图，不是第二份事实源。**

## 1. 数据链

```text
sources/game-content.yaml       完整内容档案（只读）
        │  parse + 类型化引用
        ▼
packages/content-model          实体索引 / 反向引用 / 闭包 / 校验
        ├─ sources/content-index.json   完整游戏的 ID 索引（切片不生成）
        ├─ sources/scene-slice.yaml     本次可读的内容子集
        ├─ sources/scene-slice.md       给 Agent 的切片任务说明
        └─ slice.json                   宿主机器记录（哈希、边界、验收）
```

`slice.json` 不包含正文；正文只在 `scene-slice.yaml`，避免两份内容漂移。

## 2. 生成时机

`Workbench.start()` 在创建 run 之前解析 YAML 并生成切片：

- YAML 语法错误、规范版本不支持、场景不存在、无法形成连续事件窗口 → 直接返回 400，不创建失败任务。
- 完整游戏 YAML：只写 `content-index.json`，不生成切片。
- 单场景切片但输入不是 YAML → 拒绝。
- 修改任务会重新生成切片；如果新任务不是切片，会清掉旧 `slice.json` / `scene-slice.*`，避免候选指纹污染。

手动检查：

```sh
npm run content:slice -- content-spec/high-wall-beyond.game.yaml S_LIVING
# 输出到 data/slices/S_LIVING/
```

## 3. 切片合同

`SceneSlice`（`packages/content-model/types.ts`）字段：

| 字段 | 含义 |
| --- | --- |
| `schemaVersion` | 固定 `1`。 |
| `specVersion` | 内容规范版本，目前只接受 `1.0`。 |
| `sceneId` | 本次唯一场景。 |
| `source` | `{path, sha256, chars, lines}`，绑定完整 YAML。 |
| `entry` | `{mode:'runtime-title'\|'scene'\|'prior-summary', eventId, sceneId, payload}`；前两种用于标题/当前场景，`prior-summary` 表示从场景直接开始、前置只作摘要。 |
| `events` | 按主线顺序的事件窗口，例如 `P02 → P03`。 |
| `included` | 按实体类型列出的展开 ID。 |
| `includedIds` | 展开 ID 并集。 |
| `referenced` | 只保留 ID 的外部实体，含原因。 |
| `absent` | `referenced` 中除入口外的部分。 |
| `boundary` | `{sceneId, eventId, mode:'ending', endingId, label, note}`。 |
| `acceptance` | 起点、边界、场景上限、是否要求小游戏、存档恢复、越界引用。 |
| `metrics` | 全文字符、切片字符、比例、粗略 token 估计、实体数。 |
| `hashes` | 切片哈希 + 每个展开实体的哈希。 |
| `warnings` | 已知边界与风险，不阻断生成。 |

## 4. 闭包规则

切片不是“复制场景对象”，而是按类型化引用求最小闭包：

| 引用 | 处理 |
| --- | --- |
| 场景 `出口` / 事件 `后续事件引用` | 只记为 `referenced`，不展开。 |
| 事件 `前置条件` 指向同场景事件 | 递归展开。 |
| 事件 `前置条件` 指向切片外事件 | 作为入口候选，通常由运行时标题承担。 |
| 事件引用的角色 / 物件 / 信息 / 玩法 / 声音 / 状态 | 展开实体。 |
| 角色的 `关系` 与 `阶段变化` 条件 | 不展开，避免把远期人物和剧透拉进来。 |
| 信息的 `获知事件引用`、状态的 `变化来源`、玩法的 `入口事件引用` | 不展开事件；只保留在当前实体正文中。 |
| 全部 `规则` | 作为全局约束展开（11 条，成本可控）。 |
| `V_PHASE` / `V_DONE` / `V_KNOW` | 作为切片记账状态展开。 |
| `CP_START` | 改写为切片起点。 |
| 边界 | 合成 `SLICE_END` 结局 + `CP_SLICE_END` 检查点，标记为非原作内容。 |

`S_LIVING` 的实际结果：

```text
事件窗口      P02 → P03
入口          P01（运行时标题，不建 S_MENU）
边界          P03 完成 → SLICE_END
展开          1 场景 + 2 事件 + 3 角色 + 1 信息 + 3 状态
              + 11 规则 + 2 声音 + 2 检查点 + 1 结局
              + 3 来源 + 2 设计 + 5 用户决定 = 36 个实体
仅引用        P01 / P04 / S_MENU / S_YARD
正文          158,400 字符 → 15,670 字符（含说明），约 9.8k token 估计
```

> 该指标不含 `content-spec` 规范全文（约 27KB）。`scene-slice.md` 已指定必读章节（§2/3/4/5/13/14/15/23/24），但目前仍靠提示词约束；下一步应把章节内容真正裁出来注入。

## 5. 编译与验收语义

切片必须能独立编译、独立验收，而不是“提示模型缩小范围”：

- `game.start.scene` 必须等于 `sceneId`。
- 只能有 1 个场景，且不能有出口指向切片外场景。
- `endings` 必须包含且只包含 `boundary.endingId`。
- `journeys.json` 至少一条真实输入到达该结局。
- 正式构建必须满足 `evidence.checks['ending:SLICE_END']` 和 `midRunReload`；**不再要求 5 场景或小游戏**。
- `checkProject()` 校验 `slice.json` 存在、`scope.sceneId` 一致、源哈希一致、场景/结局/出口/旅程符合切片。
- `candidateHash()` 纳入 `scope.json`、`slice.json` 和 `sources/`；YAML 或切片变化会使候选和已验收证据失效。

## 6. Agent 输入与查询

切片任务不拼接完整游戏提示词。`autonomous-contract.ts` 分为：

- `fullGamePrompt`：原有完整游戏要求（5 场景、小游戏、整部交付）。
- `sceneSlicePrompt`：只要求切片场景、边界结局、存档恢复和真实输入；明确不要求 5 场景/小游戏。

Agent 的读取顺序：

1. `sources/scene-slice.md`
2. `sources/scene-slice.yaml`
3. 只有缺失事实时才调用 `cw_content_query({id})`

`cw_content_query` 返回实体正文、类型化引用和反向引用，并标记 `included`。完整 YAML 仍在 `sources/`，但提示词明确要求不要通读；如果将来需要强制，可把完整 YAML 移到候选工作区之外，只保留查询工具。

## 7. 失效与回写

v1 采用**保守失效**：

- `slice.source.sha256` 绑定完整 YAML。
- `cw_check` / `checkProject` 发现源哈希不一致 → 报错，要求重新生成切片。
- `candidateHash` 覆盖 `sources/`、`scope.json`、`slice.json`，任何变化都会使旧候选指纹失效。
- 尚未实现“只重算受影响场景”的语义 diff；内容变化后重新调用 `buildSceneSlice` 即可，成本是先接受一次全量切片生成。

## 8. 测试

```sh
node --import tsx --test tests/content-model.test.ts tests/scene-slice.test.ts
```

覆盖：

- 解析 15 场景 / 69 事件、类型化引用、ID 唯一性。
- `S_LIVING` 闭包、入口/边界、仅引用集合、场景出口清理、事件后续清理。
- YAML 回读、切片体积比例、确定性哈希。
- 非法版本、重复键、未知场景。
- 单场景游戏的起点/结局/场景数/出口/旅程校验。
- 切片证据不要求 5 场景，完整游戏证据仍要求。

## 9. 已知边界

- `S_LIVING` 是纯演出切片，只能验证解析、对白投影、转场、存档和构建；它证明不了交互、碰撞和素材生产。切片器已能生成 `S_CELL`（约 17.3k 字符，`prior-summary` 入口，事件 P06–P08），但还没完成垂直切片的真实运行验收。下一步应做 `S_CELL` 或 `S_YARD` 的垂直切片（1 交互 + 1 状态 + 1 素材 + 1 条件）。
- 还没有多切片合并成完整游戏的装配层；v1 明确“一个切片一个项目”，不把切片宣称为完整游戏。
- 还没有运行时节点到 YAML 事件的 `sourceRefs` 追溯校验；当前只能保证输入闭包和结构验收，不能保证每条对白都来自对应事件。这是下一阶段的 P1。
- 受影响场景的增量重算、切片版本历史、切片比较视图尚未实现。
