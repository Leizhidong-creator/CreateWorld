# content-model

把 `content-spec` 的 2D 像素剧情 YAML 解析成稳定实体索引，并生成单场景切片。

```ts
import { buildContentModel, buildSceneSlice, writeSceneSlice } from './index.js';

const document = buildContentModel(yamlText, 'sources/game-content.yaml');
const slice = buildSceneSlice(document, { sceneId: 'S_LIVING' });
writeSceneSlice(workspace, slice);
```

## 约束

- YAML 是作者格式，也是唯一权威事实源；切片只是视图。
- 解析拒绝多文档、重复键、未知规范版本和别名炸弹。
- 切片按类型化引用求闭包；场景出口和事件后续只保留 ID，不展开。
- 角色关系、远期阶段条件、未使用素材不进入切片。
- 边界是合成的 `SLICE_END` 结局和 `CP_SLICE_END` 检查点，明确不算原作结局。
- 每个切片带源哈希、切片哈希和实体哈希；完整 YAML 变化后必须重新生成。

## 文件

| 文件 | 作用 |
| --- | --- |
| `parse.ts` | YAML 解析、版本/大小/重复键检查。 |
| `extract.ts` | 章节到实体类型、类型化引用抽取。 |
| `model.ts` | 实体索引、反向引用、主线和查询。 |
| `slice.ts` | 事件窗口、闭包、切片文档与说明生成。 |
| `validate.ts` | 切片内部一致性、游戏契约、旅程覆盖。 |
| `files.ts` | `content-index.json`、`scene-slice.yaml/md`、`slice.json` 落盘。 |
| `types.ts` | 实体、引用、切片和校验类型。 |

详细合同见 `../docs/SCENE-SLICE.md`。
