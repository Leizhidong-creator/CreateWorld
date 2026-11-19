# 纯前端演示部署

当前前端保留 `apps/web/src/demo/mode.ts` 中的 `DEMO_MODE = true`。
新建、修改、删除、版本回退通过 `demo/local-api.ts` 读写浏览器 localStorage；上传的本地附件使用浏览器存储，不会上传到服务器。不同浏览器配置相互隔离，同一配置的标签页共享本地数据。

制作进度和试玩使用已有演示内容，不调用 Codex，不生成真实游戏。下载与导出入口提供三体封面概念图 PNG，不提供游戏 ZIP。

## 构建

使用 Node.js 24+，在仓库根目录执行：

```sh
cd create-world-workbench
npm ci
npm run typecheck
node --import tsx --test tests/demo-local-api.test.ts
npm run build
```

将 `create-world-workbench/dist/web` 作为静态站点托管。不要运行 `npm start` 或 `npm run dev`，它们是原工作台的后端启动命令；不要设置 `VITE_API_BASE_URL` 指向真实服务。

## 服务器配置

- 不配置 `/api/` 到真实后端的反向代理，不开放生成工作台端口。
- `/api/projects` 的写入操作及其他生成接口由静态服务器拒绝。
- 导出 API 和旧 `/export-assets/three-body/demo.zip` 地址返回或跳转到 `/downloads/three-body-concept.png`。
- 概念图下载响应使用 `Content-Type: image/png` 和 `Content-Disposition: attachment; filename="three-body-concept.png"`。
- 不上传游戏 ZIP、数据目录、私钥或环境配置。线上已有旧包时应移出公开目录；仅更新前端按钮不能关闭旧包地址。
- 网页试玩仍需公开加载脚本与素材，不能据此声称客户端资源不可提取。

## 已验证范围

2026-11-01，使用两个独立浏览器上下文验证线上项目创建、修改、刷新保留和删除：各自数据独立；操作过程中没有 API 请求、非 GET/HEAD 请求或 WebSocket 连接。直接请求创建、修改、删除和生成接口均被拒绝，操作前后静态发布目录文件哈希一致。

浏览器本地记录并非服务端账户隔离；清除网站数据会删除本机体验记录。正常静态访问可能写入服务器访问日志，不会修改项目文件。

## 当前合并版

以线上联系页、套餐、项目封面、创建预填和页面样式为基础，保留浏览器本地演示接口。新建弹窗直接在故事材料框接收文件拖入，补充要求初始高度 64px；本周精选依次为三体、高墙之外。联系页说明保持居中。

三体首屏不等待后续分镜预加载；42 张无损 WebP 副本随源码保存。线上继续使用既有 nginx 的 Accept 协商配置提供 WebP，保留 PNG 回退。构建只生成静态前端，不启动真实后端。

合并版发布前完成 TypeScript 检查、浏览器本地接口测试及两个独立浏览器环境中的新建、修改、刷新、删除、拖入文本文件和封面 PNG 下载验证，未出现创作 API 请求或 WebSocket 连接。
