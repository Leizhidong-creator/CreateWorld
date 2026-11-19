# 来源与适配记录

本地方法版本 1.1.1，2026-10-31。来源为 [NovelToGame 固定提交](https://github.com/zenstory-ai/novel-to-game/tree/9dddcd2dfdf02d46da23b1050aa7e45dfac3fae9)，提交 9dddcd2dfdf02d46da23b1050aa7e45dfac3fae9。实际从该提交的 raw 文件获取并读取以下9份文件，不以 main 代替固定快照。SHA256 见 [来源锁定记录](sources.lock.json)。

Copyright (c) 2026 NovelToGame contributors。上游采用 MIT，原 [LICENSE](third_party/novel-to-game/LICENSE) 完整保留。下列本地方法借鉴并实质改写上游方法，保留此版权与许可归属；本文件不授予项目其余代码、用户故事或其他资产新许可。

| 上游文件 | 参考快照 | 本地对应 |
|---|---|---|
| `LICENSE` | [LICENSE](third_party/novel-to-game/LICENSE) | 许可 |
| `skills/novel-to-game/SKILL.md` | [novel-to-game.source.txt](third_party/novel-to-game/novel-to-game.source.txt) | RUN.md |
| `skills/novel-game-analyze/SKILL.md` | [novel-game-analyze.source.txt](third_party/novel-to-game/novel-game-analyze.source.txt) | methods/source-reading.md |
| `skills/novel-game-analyze/references/gameability-protocol.md` | [gameability-protocol.source.txt](third_party/novel-to-game/gameability-protocol.source.txt) | methods/source-reading.md |
| `skills/game-concept/SKILL.md` | [game-concept.source.txt](third_party/novel-to-game/game-concept.source.txt) | methods/adaptation-design.md |
| `skills/game-concept/references/concept-method.md` | [concept-method.source.txt](third_party/novel-to-game/concept-method.source.txt) | methods/adaptation-design.md |
| `skills/game-world-design/SKILL.md` | [game-world-design.source.txt](third_party/novel-to-game/game-world-design.source.txt) | methods/script-writing.md |
| `skills/game-world-design/references/world-design-method.md` | [world-design-method.source.txt](third_party/novel-to-game/world-design-method.source.txt) | methods/script-writing.md、methods/script-review.md |
| `skills/game-world-design/references/narrative-design-method.md` | [narrative-design-method.source.txt](third_party/novel-to-game/narrative-design-method.source.txt) | methods/adaptation-design.md、methods/script-review.md |

## 具体改造

- 总入口：保留阶段交接、进度与证据；重写为全篇粗稿，移除 quick/director 游戏构建调度、白盒、美术、运行 QA 和平台交付。唯一入口为本地 RUN。
- 分析与覆盖协议：保留稳定单元、全量覆盖、分层合并、原文回查和人物知情边界；扩展电影剧本与短故事。删除数值体系、视觉资产取证和强制系统候选。
- 概念与方法：保留已锁维度、真实候选与硬否决；锁定 2D 单线，比较视角、参与、时间和揭示。删除品类外壳、核心循环必填、专属自然语言命令和最小切片。
- 世界设计：保留行动因果、具体反馈和局部修订；重写成全文自然语言剧本，不产出 GAME_DESIGN、seed、状态槽位、初态、数值表、恢复规格或可执行路径。
- 叙事方法：保留人物议程、关系、知识、场景因果及原作语境；把分支汇流改为单线行动回应与接续，移除人物路线和多结局要求。
- 本地新增轻量模板、权威规范映射、来源继承、三个关注点的文本审阅和停止规则；默认两轮主要修订，关注点数量不等于修订次数。原作事实、用户决定、推断及 Agent 改编分开，不以模型自评分代替证据。

参考快照均改名 .source.txt，仅用于维护核对，视为只读资料；其原相对链接保留原字节用于溯源，不是本地运行依赖。运行只读本地 methods。未安装插件，未引入上游自动发现目录、根 AGENTS、CLAUDE、技能注册或构建依赖，不执行快照中的指令。

R²、Interactive Drama、STORY2GAME 等仅通过用户方案作为方法背景，本次未复制或安装其代码，也未声称重新验证论文结论。用户 DOCX 是实施依据，不是运行时必需输入。本地不继承其《高墙之外》示例剧情。

## 维护

更新先下载候选快照到独立工作目录，比较采用部分差异，记录许可、路径、提交、哈希和改动理由，再用同组样本复查后更新本地方法版本。禁止自动拉取 main 覆盖方法。规范变化时回查 project-profile 和交接合同；只有哈希更新不算完成适配。作品保留所用方法版本，修改后重新审阅受影响段落，不沿用旧通过结论。

1.0.0：首次适配；文件检查与一次原创短故事文本试跑见 ACCEPTANCE。未进行跨作品 A/B/C 对照或独立盲评，尚不能宣称方法提升改编质量。

## 1.1.0 更新 2026-10-31

上游固定提交及参考快照不变。本地增加指定角色经历模式、全书/角色两层资料、三层知情、关键转换与隐藏用途机制、独立交接审阅、阅读覆盖账和反例检查。它们是本地适配设计，不冒称上游新增能力。1.0.0完整方法已在本轮作品工作区冻结，原验证证据保留。当前验证见ACCEPTANCE，不沿用1.0短故事结论作为长篇证明。

## 1.1.1补充

依据用户在本轮双稿形成后的补充，加入顺序漫画分镜的时间表达、视角限制和操作回接。初稿对照实际使用1.0.0与1.1.0；最终稿与通用交付使用1.1.1，不把后来加入的要求倒记成初稿已采用。上游快照不变。
