# 前端改动清单

日期：2026-11-01  
原仓库：<https://github.com/chujieHong/CreateWorld-Fronted>  
对比基线：`main` / `bc42788945cb654332d8003ed5a56b9763dd9675`  
提交分支：`frontend/plugin-market`

本文记录本分支相对原仓库的最终改动。只涉及前端、对应检查脚本、测试、前端构建产物和本说明；不修改后端接口、数据库结构、游戏生产逻辑或项目技能。合并申请用于审阅，不执行合并。

## 1. 导航与页面结构

- 主导航由原来的首页、探索案例、游戏世界、我的项目，调整为 **首页 → 游戏世界 → 插件市场 → 我的项目**。
- 删除探索案例页面 `Explore.tsx` 和对应页面路由，取消案例介绍、案例切换及制作流程展示入口。
- 首页旧版组件中的案例链接改为游戏世界入口；我的项目页中的案例链接改为插件市场。
- 页脚改为“一起共创”入口，链接到插件市场。
- 保留已有游戏的独立试玩能力，将预览地址从 `#/explore/:id` 改到 `#/games/preview/:id`，复用现有播放器；不恢复原探索案例页面。
- 已移除的案例地址不再展示旧页面，进入现有未找到页面。

## 2. 新增插件市场

地址：`#/plugins`。插件详情：`#/plugins/:id`。

### 2.1 首屏文案与入口

当前标题：**让创作好游戏变得更简单**。

当前说明：

> 找到适合你的 Skill、工具和工作流，解决创作中遇到的问题。  
> 也可以把自己的工具和方法做成插件，分享给其他创作者。

- 保留右侧 Skill、Tool、Workflow 三个装饰卡片。
- 删除三张卡片下方的“每一个好想法，都可以成为下一块拼图。”。
- 首屏只保留一个“共创插件”主按钮，移除原“发现插件”按钮行为、重复共创入口及按钮右侧加号。
- 删除“首批收录 · Create World / 从统一美术，到可运行的游戏”推荐横幅。
- 缩小首屏与下方发现插件区域之间的间距。

### 2.2 分类、搜索与收藏

分类顺序：

1. 全部插件
2. Skill 技能
3. 工具
4. 工作流
5. Agent 模板
6. 素材
7. 资源包
8. 连接器
9. 扩展套件
10. 源码套件
11. 我的收藏

- 根据名称、标识、介绍和能力标签进行前端搜索。
- 类型筛选与搜索可组合；尚未收录内容的分类显示空状态，不填充虚构插件。
- 收藏保存在当前浏览器的 `localStorage`，键为 `cw.plugin-bookmarks`；支持收藏与取消收藏。
- 搜索图标替换为绘制的 SVG 放大镜，图标与文字垂直居中。
- 去掉输入框自身的紫色焦点内框，在整个搜索容器外缘提供轻微焦点高亮。

### 2.3 首批展示内容

根据用户提供的「场景、人物、统一风格技能与游戏 UI 源码」提取包整理描述，未把该包本身上传到仓库或安装到工作台。

| 插件 | 类型 | 展示内容 |
| --- | --- | --- |
| 统一美术风格 | Skill 技能 | 场景、人物、UI / HUD 共用的美术方向与风格契约 |
| 可游玩场景生成 | Skill 技能 | 场景画面、碰撞图、空间碰撞数据 |
| 角色与行走动画 | Skill 技能 | 角色形象、四方向行走与动画资源 |
| 游戏全文润色 | Skill 技能 | 首版可运行后对白、旁白、提示及界面文字的审校 |
| 游戏 UI 与运行时套件 | 源码套件 | 三套模板、共享数据契约、机制内核及装配源码 |

### 2.4 卡片与详情

- 卡片展示插件图标、类型、来源标识、名称、用途、能力标签、收藏和详情入口。
- 能力标签改为浅色圆角胶囊，按标签内容固定配色，不再按绿、紫、蓝的位置顺序循环。同名标签在卡片和详情页保持一致。
- 删除卡片底部“首批收录”及分隔线，将“查看插件”上移，并以圆角笔画的 SVG 右向图标替代字符箭头。
- 详情页提供“介绍 / 包含内容 / 接入说明”三个页签，以及来源、类别、收录日期、发布状态。
- 源码下载和安装入口仍未开放，不把静态展示描述为已经发布的插件服务。
- 详情页新增“基于此插件共创”，跳转时携带原插件标识。
- 支持明暗主题与手机布局。

## 3. 新增共创插件页面

地址：`#/plugins/contribute`。携带来源的入口示例：`#/plugins/contribute?source=art-direction`。

- 市场顶部“共创插件”和底部“了解共创方式”都进入同一个独立页面，不再在市场中展开说明。
- 提供“上传自己的插件”和“基于现有插件共创”两种模式。
- 填写插件名称、类型、版本、作者或团队、许可信息、介绍、标签及使用与接入说明。
- 二次共创可以选择现有插件，自动带入名称、类型、介绍、标签和接入说明，允许编辑，并要求补充本次修改说明。
- 保留原插件标识及名称；不会自动下载、执行或修改原插件源码，也不会覆盖原插件。
- 支持文件选择和拖放，接受 ZIP、Markdown、JSON、YAML；每次一个非空文件，最大 20 MB，多文件需自行打包。
- 支持更换和移除附件、必填检查、文件类型与大小检查、保存失败提示及保存中禁用重复操作。
- 右侧显示随表单更新的插件概览和投稿提示。
- 支持保存草稿、提交到本地、继续编辑、再次提交以及下载已保存附件。
- “我的本地投稿”列出草稿和已提交记录，显示提交次数；再次保存更新当前记录，不是完整历史版本系统。
- 数据及附件通过 IndexedDB 保存在 `cw-plugin-contributions` 数据库的 `contributions` 表中；刷新页面后可恢复。
- 使用统一类型目录，保证市场筛选与投稿类型选项一致。

**范围限制：**当前没有服务器上传、公共发布、用户间同步、自动安装、插件审核、在线源码编辑或远程 GitHub 提交。投稿仅属于当前浏览器；清除网站数据会移除这些本地记录。界面明确显示本地保存状态。

## 4. 删除前端登录与注册系统

- 删除 `Auth.tsx`、`accounts.ts`、`session.ts`。
- 删除登录、注册和退出入口、体验账号初始化、账号密码校验、登录状态监听与登录后跳转逻辑。
- 移除页面访问的登录拦截；我的项目、游戏页面、发布页和创作工作区可以直接访问。
- 清理认证相关样式和已失效的账号、会话测试。
- 移除项目页残留的“当前账号为前端体验状态”提示；现有评论和游戏草稿的默认署名改为“本地创作者”。
- 旧 `#/login` 地址不再提供登录页面，进入现有未找到页面。
- 不修改后端访问控制或项目数据；已存在于浏览器中的旧账号存储不会被主动擦除，但前端不再读取或使用。

## 5. 基础资源与构建

- 增加 SVG 网站图标，HTML 引用该图标，避免原先默认 favicon 请求失败。
- 更新 HTML 页面描述，由案例介绍调整为游戏与创作插件。
- 保持既有依赖和锁文件不变，没有新增第三方运行依赖。
- 更新仓库原本已提交的 `dist/web` 产物，包括 HTML、按内容命名的 JS/CSS、source map 和 favicon；移除过期构建文件。
- 因 `dist/` 在本地忽略规则内，新构建文件需与已追踪产物一起显式纳入提交，防止只更新 HTML 却缺少新资源。
- 不包含 `node_modules`、本地数据库、浏览器投稿数据、运行日志、测试截图、私人源材料及原始提取包。

## 6. 测试与验证

### 本次提交前重新运行

- `npm run check`：通过，包含 TypeScript 检查、**206 项测试通过 / 0 失败**及前端构建。
- `npm run test:frontend`：通过。使用隔离的临时数据库，验证首页、免登录项目列表、工作区、项目材料读写、创建失败处理、二创参数、游戏与草稿页面、390px 手机布局、断线重连和 SSE。
- 更新游戏预览测试中的旧案例地址断言，以匹配独立预览路由。

### 本次开发过程中已完成的浏览器检查

- 插件导航顺序、搜索、分类、收藏、详情页切换、空结果、旧案例和登录页面移除。
- 两个共创入口跳转一致；详情页携带原插件来源。
- 投稿表单、附件选择、草稿保存、刷新恢复、再次提交和附件下载。
- 桌面、手机与明暗主题检查；390px 下没有横向溢出。

### 验证边界

- 没有执行新的模型生成、图片生成或整部游戏制作任务。
- 前端集成检查中的昂贵生产启动使用失败模拟，不证明模型生产能力。
- 构建仍提示旧运行时中 `new URL('./assets/', import.meta.url)` 在构建时无法解析；该提示不阻止构建，不将其视为本次已经完成的全游戏素材验收。

## 7. 文件级变更清单

以下按相对仓库根目录的路径列出本次提交文件。构建文件独立列出，不与手写功能改动混淆。

### 手写源码、文档与验证文件

| 状态 | 文件 |
| --- | --- |
| 修改 | `create-world-workbench/apps/web/index.html` |
| 新增 | `create-world-workbench/apps/web/public/favicon.svg` |
| 删除 | `create-world-workbench/apps/web/src/site/Auth.tsx` |
| 删除 | `create-world-workbench/apps/web/src/site/Explore.tsx` |
| 修改 | `create-world-workbench/apps/web/src/site/Home.tsx` |
| 新增 | `create-world-workbench/apps/web/src/site/PluginContribute.css` |
| 新增 | `create-world-workbench/apps/web/src/site/PluginContribute.tsx` |
| 新增 | `create-world-workbench/apps/web/src/site/PluginMarket.css` |
| 新增 | `create-world-workbench/apps/web/src/site/PluginMarket.tsx` |
| 修改 | `create-world-workbench/apps/web/src/site/Portal.tsx` |
| 修改 | `create-world-workbench/apps/web/src/site/Projects.tsx` |
| 删除 | `create-world-workbench/apps/web/src/site/accounts.ts` |
| 修改 | `create-world-workbench/apps/web/src/site/chrome.tsx` |
| 修改 | `create-world-workbench/apps/web/src/site/daylight.css` |
| 修改 | `create-world-workbench/apps/web/src/site/marketplace.ts` |
| 修改 | `create-world-workbench/apps/web/src/site/navigation.ts` |
| 新增 | `create-world-workbench/apps/web/src/site/plugin-contributions.ts` |
| 新增 | `create-world-workbench/apps/web/src/site/plugins.ts` |
| 删除 | `create-world-workbench/apps/web/src/site/session.ts` |
| 修改 | `create-world-workbench/apps/web/src/site/site.css` |
| 修改 | `create-world-workbench/scripts/frontend-acceptance.ts` |
| 删除 | `create-world-workbench/tests/frontend-accounts.test.ts` |
| 删除 | `create-world-workbench/tests/frontend-session.test.ts` |
| 修改 | `create-world-workbench/tests/game-library.test.ts` |
| 修改 | `create-world-workbench/tests/marketplace-preview.test.ts` |
| 新增 | `docs/frontend-changes-20261101.md` |

### 前端构建产物

| 状态 | 文件 |
| --- | --- |
| 删除 | `create-world-workbench/dist/web/assets/App-EbrAoLNW.js` |
| 删除 | `create-world-workbench/dist/web/assets/App-EbrAoLNW.js.map` |
| 新增 | `create-world-workbench/dist/web/assets/App-z2P9f1Uv.js` |
| 新增 | `create-world-workbench/dist/web/assets/App-z2P9f1Uv.js.map` |
| 删除 | `create-world-workbench/dist/web/assets/DemoPlayer-Dk1AOIiP.js` |
| 删除 | `create-world-workbench/dist/web/assets/DemoPlayer-Dk1AOIiP.js.map` |
| 新增 | `create-world-workbench/dist/web/assets/DemoPlayer-HTE2hiSl.js` |
| 新增 | `create-world-workbench/dist/web/assets/DemoPlayer-HTE2hiSl.js.map` |
| 删除 | `create-world-workbench/dist/web/assets/Explore-B1vctm9H.js` |
| 删除 | `create-world-workbench/dist/web/assets/Explore-B1vctm9H.js.map` |
| 删除 | `create-world-workbench/dist/web/assets/GameWorld-Bl64aPLp.js` |
| 删除 | `create-world-workbench/dist/web/assets/GameWorld-Bl64aPLp.js.map` |
| 新增 | `create-world-workbench/dist/web/assets/GameWorld-DQxQuC0o.js` |
| 新增 | `create-world-workbench/dist/web/assets/GameWorld-DQxQuC0o.js.map` |
| 新增 | `create-world-workbench/dist/web/assets/PluginContribute-BMqwBUbG.css` |
| 新增 | `create-world-workbench/dist/web/assets/PluginContribute-BZCaf91X.js` |
| 新增 | `create-world-workbench/dist/web/assets/PluginContribute-BZCaf91X.js.map` |
| 新增 | `create-world-workbench/dist/web/assets/PluginMarket-Dg4nHd0l.js` |
| 新增 | `create-world-workbench/dist/web/assets/PluginMarket-Dg4nHd0l.js.map` |
| 新增 | `create-world-workbench/dist/web/assets/PluginMarket-rll0faJV.js` |
| 新增 | `create-world-workbench/dist/web/assets/PluginMarket-rll0faJV.js.map` |
| 新增 | `create-world-workbench/dist/web/assets/PluginMarket-wnXbQNi0.css` |
| 删除 | `create-world-workbench/dist/web/assets/Projects-C598EOiB.js` |
| 删除 | `create-world-workbench/dist/web/assets/Projects-C598EOiB.js.map` |
| 新增 | `create-world-workbench/dist/web/assets/Projects-D_HyffTk.js` |
| 新增 | `create-world-workbench/dist/web/assets/Projects-D_HyffTk.js.map` |
| 新增 | `create-world-workbench/dist/web/assets/index-79FSCGeA.css` |
| 删除 | `create-world-workbench/dist/web/assets/index-CnYgacji.js` |
| 删除 | `create-world-workbench/dist/web/assets/index-CnYgacji.js.map` |
| 删除 | `create-world-workbench/dist/web/assets/index-DbHzA4f8.css` |
| 新增 | `create-world-workbench/dist/web/assets/index-Dcbm1T8x.js` |
| 新增 | `create-world-workbench/dist/web/assets/index-Dcbm1T8x.js.map` |
| 新增 | `create-world-workbench/dist/web/favicon.svg` |
| 修改 | `create-world-workbench/dist/web/index.html` |

