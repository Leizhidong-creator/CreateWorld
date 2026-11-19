# 联调说明 · 分支 `leizhidong`

> 这个分支是「可演示版本（Demo）」的一组改动：把创作流程包装成一条能从头演示到尾的路径，
> 补上导出页、一键上架、订阅方案，并统一了页面路由。改动集中在 `create-world-workbench` 的
> `apps/web`，服务端只加了一个删除项目的接口。
>
> 基线：`fc78611`（main 上 `Merge pull request #10 from liiiyiiixiii/codex/fix-marketplace-playable-previews`）。

## 一、这次改了什么

### 1. 首页：只留「创作入口 + 订阅方案」

- 首页（`#/`）现在只有三块：大标题、创作输入框、订阅方案；原来的「探索玩家创造的世界 / 筛选器 / 本周精选 / 刚刚上架 / 玩家热门」整块从首页移除。
- 创作输入框：默认预填「把《三体》中最有意思的一段改编成游戏。」；按钮初始为 **AI 润色**，点击后约 1.5 秒换成约 228 字的《黑暗森林》改编提示词，按钮变为 **开始创造**。
- 新增订阅方案区（三档：小白 / 开发者 / IP 公司），版式参考 OpenAI 定价页：三列卡片、中档抬起 + 金色描边 + 「推荐」标、月/年切换、勾选式权益清单。文案取自《产品文档_市场与商业化方案_已对齐》6.1 节。

涉及文件：`apps/web/src/site/Pricing.tsx`（新增）、`apps/web/src/site/pricing.css`（新增）、`apps/web/src/site/MarketPlacePage.tsx`（首页只渲染 hero + 订阅）。

### 2. 游戏世界：独立成页

- 顶部导航「游戏世界」改为直达 `#/games`；旧链接 `#/?section=worlds` 会自动跳转到 `#/games`。
- `#/games` 去掉顶部创作区，打开就是「探索玩家创造的世界 + 搜索筛选 + 货架」。

涉及文件：`apps/web/src/site/chrome.tsx`、`apps/web/src/site/navigation.ts`、`apps/web/src/site/GameWorld.tsx`、`apps/web/src/site/Portal.tsx`。

### 3. 工作台：7 秒节点画布 + 常驻像素小人

- 「制作」标签替换为一张自动播放的节点画布：8 个节点（灵感 → 拆解 → 剧本 → 关卡 → 素材 → 插件 → 校验 → 构建）、边动画、可拖拽/滚轮缩放、自动跟随，7 秒后自动 fit 到全图。
- 四个像素小人常驻画布上沿，循环工作动画，气泡显示当前分工。
- 「试玩」标签在演示态直接内嵌 `play.html`，不再显示「第一个世界，还在制作中」。

涉及文件：`apps/web/src/demo/DemoCanvas.tsx`、`DemoProduction.tsx`、`DemoPreview.tsx`（新增）、`demo.css`、`apps/web/src/App.tsx`。

### 4. 导出页（新增，独立全屏）

- 路由 `#/export/:projectId`：整页用天文台夜景图做背景（`public/export-assets/night-observatory.png`），左「试玩」右「演示」两个 16:9 画框，各占一半宽度。
- 左框是可玩的手动版（`play.html`），右框是自动演示版（`autoplay.html`）。
- 标题右侧有 **一键上架到商城** 按钮（深底金边金字）。

涉及文件：`apps/web/src/site/Export.tsx`（新增）、`export.css`（新增）、`export-media.ts`（新增）、`apps/web/public/export-assets/three-body/**`（游戏包）。

### 5. 一键上架到商城

- 点击后把作品写入本机记录（`localStorage`，键 `cw.published-games.v1`），跳到 `#/games` 并滚到「本周精选」；新作品排第一位，金色描边呼吸约 2.6 秒 + 「刚刚上架」角标。
- 详情页 `#/games/three-body-dark-forest`：封面、简介、免费、支持二创、点赞/收藏、上架日期、3 条预置评论；「开始试玩」跳回导出页。
- 上架记录绑定 `projectId`：项目在工作台被删除后，商城加载时自动移除并清理记录，详情页显示「已下架」。

涉及文件：`apps/web/src/site/publish-store.ts`（新增）、`apps/web/src/site/marketplace.ts`、`apps/web/src/site/MarketPlacePage.tsx`。

### 6. 项目删除

- 侧边栏项目支持删除，带确认弹窗，硬删除（含磁盘文件）。
- 服务端新增 `DELETE /api/projects/:id`；orchestrator 增加 `deleteProject()`。
- CSP 放开 `frame-src 'self' http://127.0.0.1:8790`，允许同源 iframe 嵌入试玩页。

涉及文件：`apps/server/app.ts`、`packages/orchestrator/service.ts`、`apps/web/src/App.tsx`。

### 7. 演示模式

- `apps/web/src/demo/mode.ts` 里的 `DEMO_MODE = true`：创建项目不触发真实 Codex 制作任务，不消耗模型额度。

## 二、页面与路由对照

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `#/` | 首页 | 大标题 + 创作输入框（AI 润色 / 开始创造）+ 订阅方案 |
| `#/explore` | 探索案例 | 内置世界的试玩入口 |
| `#/games` | 游戏世界 | 作品商城：搜索、筛选、本周精选、刚刚上架、玩家热门 |
| `#/games/:id` | 作品详情 | 介绍、定价、二创、点赞收藏、评论 |
| `#/studio/:id` | 工作台 | 制作（节点画布）/ 试玩 / 素材与插件 / 版本 |
| `#/export/:id` | 导出页 | 左试玩右演示，一键上架 |
| `#/projects` | 我的项目 | 项目列表、删除 |

## 三、文件清单

新增：

```
create-world-workbench/apps/web/src/site/Pricing.tsx
create-world-workbench/apps/web/src/site/pricing.css
create-world-workbench/apps/web/src/site/Export.tsx
create-world-workbench/apps/web/src/site/export.css
create-world-workbench/apps/web/src/site/export-media.ts
create-world-workbench/apps/web/src/site/publish-store.ts
create-world-workbench/apps/web/src/demo/DemoPreview.tsx
create-world-workbench/apps/web/public/export-assets/three-body/**   （游戏包，约 45MB）
create-world-workbench/apps/web/public/worlds/three-body.png
```

修改：

```
create-world-workbench/apps/server/app.ts
create-world-workbench/apps/web/src/App.tsx
create-world-workbench/apps/web/src/site/Portal.tsx
create-world-workbench/apps/web/src/site/chrome.tsx
create-world-workbench/apps/web/src/site/navigation.ts
create-world-workbench/apps/web/src/site/GameWorld.tsx
create-world-workbench/apps/web/src/site/MarketPlacePage.tsx
create-world-workbench/apps/web/src/site/marketplace.ts
create-world-workbench/apps/web/src/demo/DemoCanvas.tsx
create-world-workbench/apps/web/src/demo/DemoProduction.tsx
create-world-workbench/apps/web/src/demo/demo.css
本地启动说明.md
```

## 四、怎么跑起来

```powershell
cd create-world-workbench
npm install
npm run dev          # 开发服务：http://127.0.0.1:8787
```

- 体验账号：`creator` / `createworld`
- 生产构建：`npm run build`（产物在 `dist/`，**不入库**，clone 后需要自己构建一次）
- 类型检查：`npm run typecheck`
- 前端验收：`npm run test:frontend`（9 项检查，使用本机 Chrome）

## 五、联调要点

### 1. 前端联调（改 UI）

- 页面都在 `apps/web/src/site/`（门户）与 `apps/web/src/demo/`（演示数据与画布）。
- 路由是 hash 路由，逻辑在 `site/Portal.tsx` 的 `path` 分支里，新增页面在这里挂。
- 首页与游戏世界共用 `MarketPlacePage.tsx` 的 `Marketplace` 组件：`listing` 为真时渲染商城列表，否则渲染首页（hero + 订阅）。
- 样式：`site.css`（深色底）+ `daylight.css`（浅色覆盖，选择器多为 `:root[data-theme=light]`），新页面的样式写在各自的 css 里（`export.css`、`pricing.css`）。

### 2. 后端联调（改接口）

- 服务端入口 `apps/server/app.ts`，业务在 `packages/orchestrator/`。
- 本次新增的接口只有：

```
DELETE /api/projects/:id     需要 X-CSRF-Token 头
```

- 前端用到的其它接口（未改动）：`GET /api/bootstrap`、`GET /api/projects`、`GET /api/projects/:id`、`PATCH /api/projects/:id`。

### 3. 与商城对接

- 商城的静态数据在 `apps/web/src/site/marketplace.ts` 的 `games` 数组。
- 本机上架的作品不进这个数组，而是每次 `listGames()` 时把 `localStorage` 里的记录合并进来并排在最前（`publishedAsGames()`）。
- 如果要做成真实上架，需要：新建 `POST /api/marketplace/games`（写库）+ 让 `listGames` 走接口，`publish-store.ts` 可以整体替换成 API 调用。

### 4. 与游戏运行时对接

- 试玩页是静态包：`apps/web/public/export-assets/three-body/`，入口 `play.html`（手动）与 `autoplay.html`（自动演示）。
- 导出页通过 `site/export-media.ts` 配置这两个地址，改路径只动这一处。
- iframe 需要 CSP 允许：服务端 `frame-src 'self' http://127.0.0.1:8790`。

### 5. 演示开关

- `apps/web/src/demo/mode.ts` 的 `DEMO_MODE`：`true` 时创建项目不触发真实制作任务（不消耗额度）；接真实流程时改成 `false`。
- 演示数据（8 个节点、小人分工、7 秒时间线）在 `apps/web/src/demo/three-body.ts` 与 `useDemoPlayback.ts`。

## 六、验收

```powershell
cd create-world-workbench
npm run typecheck
npm run build
npm run test:frontend
```

`test:frontend` 覆盖：首页加载、登录跳转、项目列表、工作台接口、演示态不消耗额度、二创参数贯通、作品/本地游戏/草稿发布页可开、390px 无横向溢出、SSE 连接。

手工过一遍这条链路：

1. 首页输入框点「AI 润色」→ 变成「开始创造」→ 点击创建项目（项目名预填「三体」）；
2. 进入工作台「制作」看 7 秒画布 →「试玩」直接玩；
3. 右上「导出游戏」→ 导出页（左玩右演示）→ 点「一键上架到商城」；
4. 落到游戏世界「本周精选」第一位，带「刚刚上架」高亮 → 点进去看详情；
5. 回到项目列表删除项目 → 重新进游戏世界，作品消失。

## 七、已知限制

- 上架记录存本机 `localStorage`，换浏览器/清缓存会丢失；不是服务端数据。
- 「下载 ZIP」按钮在演示项目上仍是禁用态（没有构建包）。
- 价格是占位（¥69/月、¥690/年），真实定价未定。
- `public/export-assets/three-body` 是打包好的静态游戏（约 45MB），仓库因此偏大。
- `dist/` 与 `node_modules/`、`data/` 不入库。
