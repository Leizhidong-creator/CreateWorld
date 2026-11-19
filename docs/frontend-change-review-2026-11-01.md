# 前端改动说明与合并核对

日期：2026-11-01。用户已确认：首页采用订阅方案，其余冲突按建议处理。集成分支 `codex/integrate-crossover-marketplace-20261101` 已保留 main 的首页、插件、导出和工作台功能，并将本地共创货架放在游戏世界。本文前半部分记录本地改动来源，后半部分记录冲突处理与验证。

## 仓库与比较基准

- 本地仓库：`liiiyiiixiii/CreateWorldAgent`。
- 本地基线分支：`creatworldagent`，提交 `fc78611`。
- 目标仓库：`chujieHong/CreateWorld-Fronted`。
- 目标分支：`main`，查询时提交 `facd5c168737a93ad4f490a0fe0110492c1a8db8`。
- 本地修改已保存在分支 `codex/frontend-crossover-review-20261101`，功能提交 `a98364b`；尚未与目标主分支合并、未推送远端。
- GitHub 连接返回 404，但本机 Git 重试已成功获取目标代码。共同祖先为 `fc78611544b0e1bc19fd21858d81c6e941fdad87`。

## 本地变更清单

| 模块 | 修改前 | 当前行为 | 主要文件（相对 create-world-workbench） |
| --- | --- | --- | --- |
| 首页货架 | 刚刚上架、玩家热门、免费开始、付费精选 | 保留本周精选；展示原创作品、作品共创；删除后两块；共创默认展示五个条目，支持展开/收起 | apps/web/src/site/MarketPlacePage.tsx |
| 筛选 | 题材和价格横向排列，题材包含二创 | 题材、价格、共创三行对齐；共创含联动、二创、改编、合作；组合筛选和清除筛选生效 | MarketPlacePage.tsx、marketplace.ts、site.css（均位于 apps/web/src/site） |
| 登录入口 | 登录后访问部分路由，导航有登录/退出 | 移除前端登录拦截及导航账号入口；旧登录链接继续跳转原目标；原账号源码未删除 | apps/web/src/site/Portal.tsx、chrome.tsx |
| 共创示例 | 无五组跨界条目 | 新增漫威×三体、孙悟空×林黛玉、雷神×哥斯拉、大秦×罗马、ChatGPT×珍妮纺织机 | apps/web/src/site/crossovers.ts |
| 共创详情 | 通用作品详情 | 独立封面、阵营介绍、故事、玩法说明、拓展内容；二创按钮把设定带入新建工作区 | apps/web/src/site/CrossoverDetail.tsx、crossovers.css |
| 卡片视觉 | 原货架样式 | 卡片圆角、标签、简介、统计图标、浅深主题及窄屏样式；首页主标题字号调整 | apps/web/src/site/shelf-cards.css、site.css |
| 封面资源 | 无新增跨界封面 | 新增八张 WebP；悟空黛玉、珍妮 ChatGPT、大秦罗马使用 v2，其余使用初版 | apps/web/public/worlds/crossovers/ |
| 背景 | WorldAtlas | 当前已恢复 WorldAtlas；main.tsx 与本地基线一致；纸上世界实现仅保留源码备份，未接入页面 | apps/web/src/site/PaperAtlas.tsx、PaperAtlas.css |

## 实现边界

- 五个新增作品属于货架与详情示例，数据中 `playable: false`，没有新增对应可运行游戏。页面“已上架”是展示文案，不能据此认定已有游戏运行时。
- 移除的是本地前端登录流程，不代表已经修改或验证任何远程服务的认证体系。
- 新增卡片统计初始化为零。二创按钮传递故事与玩法提示，不会直接启动完整游戏生成任务。
- 纸质地图背景增强版本另存于 `outputs/atlas-preview/saved-paper-atlas-20261101/`，当前页面没有启用。

## 提交范围

提交应包含前端源码、所引用的 WebP 和本说明。`.npm-cache`、运行日志、node_modules、生成过程原始 PNG 和本地备份不作为源码 PR 内容。仓库已有 dist 构建产物，本次本地构建会产生哈希文件替换；是否纳入目标 PR 需根据目标仓库的发布约定确认，不直接复制旧项目 dist。

## 验证

- 本地 TypeScript 检查已通过。
- 本地 Vite 生产构建已通过，存在原有 `new URL('./assets/', import.meta.url)` 运行时解析提示。
- 上述验证针对本地版本；目标仓库集成后的验证需要在完成比较和冲突处理后另行执行。
- 不自动解决存在产品取舍的冲突，不直接覆盖目标主分支。

## 合并检查记录：冲突已按用户确认处理

检查方式：`git merge-tree --write-tree review-target/main a98364b`。该命令只模拟合并，没有改动当前工作区或目标 main。

默认合并报告 5 个冲突文件：`MarketPlacePage.tsx`、`Portal.tsx`、`chrome.tsx`、`marketplace.ts`、`site.css`。
额外使用 `-Xignore-space-at-eol` 排除 CRLF/LF 差异后，剩余 3 个文件的 8 处内容冲突。`chrome.tsx`、`site.css` 可以在忽略行尾差异后自动合并，不能将它们误报为两个独立功能冲突。

以下编号对应排除行尾差异后的冲突块；路径均位于 `create-world-workbench/apps/web/src/site/`。下列建议已按用户确认执行。

| 编号 | 文件 / 冲突块 | main 的内容 | 本地内容 | 已确认处理方式 |
| --- | --- | --- | --- | --- |
| C1 | MarketPlacePage.tsx：模块导入与预设 | 订阅方案、发布记录、项目查询、创作示例润色预设 | 共创详情与共创类型导入 | 合并两侧依赖，保留 main 的润色演示并增加共创依赖；润色目前是定时替换预设文案，并非真实 AI 请求 |
| C2 | MarketPlacePage.tsx：列表加载 | 查询项目并清理失效发布记录，再加载货架 | 增加共创筛选与 finally 结束加载状态 | 保留项目清理，加上共创条件和异常后的加载收尾 |
| C3 | MarketPlacePage.tsx：货架渲染 | 首页显示订阅方案，listing 模式才显示货架；支持新上架高亮 | 首页直接展示货架，三行筛选，原创与共创两块 | 沿用 main 首页订阅、货架放“游戏世界”，使用本地三行筛选和新货架 |
| C4 | MarketPlacePage.tsx：精选卡片 | 刚发布作品高亮、刚刚上架徽章 | 增加分类标签 | 同时保留发布高亮与分类标签 |
| C5 | Portal.tsx：依赖与样式 | 新导航，不再依赖旧登录重定向 | 引入旧 loginDestination、两份新增样式 | 保留 main 路由架构，加载新样式；旧登录链接若需兼容，单独补安全重定向，不能导入 main 已删除的函数 |
| C6 | Portal.tsx：路由判断与标题 | 插件市场、导出、游戏预览路由 | 旧探索页及旧登录链接兼容 | 保留 main 插件/导出/预览；旧探索链接转到适合的新入口，登录链接直接到原目标，无需恢复登录页面 |
| C7 | Portal.tsx：页面渲染 | 插件贡献、插件详情、导出展示、独立试玩页面 | 旧探索页面与旧版页面切换 | 以 main 页面渲染为基础，接入共创样式/详情，不恢复已删除的 Explore.tsx |
| C8 | marketplace.ts：数据初始化 | 发布作品转换、示例评论、allGames 聚合 | 五组共创数据加入初始化 | 同时保留已发布作品和五组共创示例，保留已有 sourceProjectId 关系 |

### 无文本标记但需要同步检查的兼容性

- main 已删除 `Explore.tsx` 与 `navigation.ts` 的 `loginDestination`；直接选择本地整个 Portal 会造成缺失依赖，还会丢失插件和导出路由。
- main 的“游戏世界”导航进入 `#/games`，本地详情返回链接仍为 `#/?section=worlds`。需要统一返回行为，并按 C3 确定首页是否展示货架。
- main 发布条目使用 `sourceProjectId`，本地原创/共创划分使用 `concept` 或 `sourceGameId`。新发布作品应归入哪一类需要结合其来源判断，不能只因自动合并通过就判定展示正确。
- main 新增的工作台节点画布、插件市场、导出流程等不属于本地改动范围，不应通过整目录覆盖删除。
- 背景入口 main.tsx 在本地没有差异；本次不重新启用纸质地图背景。

### 集成验证与提交范围

- TypeScript 检查、Vite 生产构建通过；构建仍有原有 assets URL 运行时解析提示。
- 6 项测试通过：新增共创/发布共存与旧路由兼容测试，已有 marketplace-preview 与 frontend-api 测试。
- Edge 无头浏览器检查通过：首页订阅方案且没有货架；游戏世界展示五组共创；改编筛选显示悟空黛玉与秦罗马；详情返回货架；插件市场打开；旧登录链接直达详情；390px 窄屏无横向溢出；未捕获页面脚本异常。
- 浏览器项目接口使用空列表模拟，以检查前端行为；发布记录与示例共存、清理逻辑另有测试覆盖。本次没有重新验收整个游戏生成或导出流水线。
- 保留旧背景；PaperAtlas 源码仅存档，没有接入入口。
- 仅提交源码、封面、测试与本文；本地缓存、截图、依赖目录和 dist 构建产物不纳入此次变更。
- 目标 main 尚未合并。本分支用于 PR 审阅，正式合并暂不执行。
