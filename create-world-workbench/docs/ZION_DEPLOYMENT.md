# Zion 部署说明

本项目包含两部分：`apps/web` 是完整 React/Vite 工作台前端，`apps/server` 是提供项目、制作任务、事件流、版本、预览和导出的 Node 服务。Zion 的 Web 应用可以托管前端静态资源，但不能直接提供当前服务端依赖的本机 Codex CLI、浏览器自动验收、SQLite 和持久化文件目录。

## 构建完整前端

```sh
npm ci
npm run build
```

构建输出在仓库根目录的 `dist/web`。它包含首页、案例、登录、游戏世界、我的项目和工作区等完整前端页面，不是单个游戏页面。

## 指向独立后端

如果 Node 服务部署在单独的 HTTPS 域名，构建前设置：

```sh
VITE_API_BASE_URL=https://api.example.com npm run build
```

前端 API 基地址集中在 `apps/web/src/api.ts`，不会把部署地址散落到组件中。独立后端还需要配置 CORS、CSRF、SSE（事件流）、预览资源域名和持久化 `CW_DATA_DIR`。

## Zion 上能否完整运行

只上传 `dist/web` 可以显示完整前端界面；未提供可访问后端时，项目创建、Codex 生成、实时进度、版本回退、素材和 ZIP 导出会提示服务不可用。要保持完整功能，必须同时运行支持 Node 24、持久化磁盘、Codex CLI 和自动化浏览器的后端，再把 `VITE_API_BASE_URL` 指向它。

## 需要你提供/操作的内容

1. 在 Zion Web 应用中上传 `deploy/create-world-workbench-frontend.zip` 并发布，得到前端公开地址。
2. 把这个公开地址填入后端环境变量 `CW_ALLOWED_ORIGINS`。
3. 提供后端公开 HTTPS 地址和预览 HTTPS 地址，分别设置 `CW_PUBLIC_ORIGIN`、`CW_PUBLIC_PREVIEW_ORIGIN`。
4. 在后端服务器运行 `npm ci && npm start`，并确保 `CW_DATA_DIR` 使用持久化磁盘。
5. 记录后端地址后，以 `VITE_API_BASE_URL=<后端地址> npm run build` 重新构建并重新上传前端包。

如果你把 Zion 发布后的前端地址、可运行 Node 服务的服务器地址（或服务器控制台/部署平台名称）发给我，我可以继续给出对应的逐项配置值和验证命令。不要把 Codex 登录令牌、API key 或密码发给我。
