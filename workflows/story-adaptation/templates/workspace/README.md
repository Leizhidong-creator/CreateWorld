# 空白作品工作区

将本目录中的 source、work、output 结构复制到 adaptations/新的作品标识/，再由 Codex 填充；不是让用户填写表格。原作已在其他位置时在 source/README.md 指向它，不复制原件。没有真实输入时，不把空模板交作完成稿。

- source/：原作或位置与版本说明。
- work/source-notes.md：逐单元覆盖、人物、因果、信息及结局。
- work/adaptation-notes.md：主要取舍、Agent 来源及影响。
- work/draft-vNNN.md：写作时新增的候选，旧版本保留。
- work/review.md：写作后新增的问题及复查记录。
- work/progress.md：续接入口。
- output/：只有文本审阅通过后放入游戏剧本.md；阻塞候选保存在 work。

默认被 adaptations/.gitignore 隔离，不进入源码提交或公开发布。不要使用工作台 data/projects 的目录或状态格式代替本结构。
