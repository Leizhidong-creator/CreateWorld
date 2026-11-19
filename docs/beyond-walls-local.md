# 高墙之外本地接入

原仓库：https://github.com/SSxs-wym/Beyond-The-Walls-
本次部署版本：`93cf4540e8c1d64e0b45844ddb1b14eaf06177d5`（main）。

游戏位于 `D:/develop/createworld/beyond-the-walls/Beyond the wall/`，保留完整 Git 仓库、原版代码、素材、许可和存档实现。此目录忽略提交，不将第三方资源并入 Create World 发行包。

首次在其他机器安装：在仓库根运行 `powershell -ExecutionPolicy Bypass -File scripts/install-beyond-walls.ps1`。它只在目录不存在时克隆，不覆盖已有版本。

运行根目录 `start-local.cmd`。登录现有工作台后访问 http://127.0.0.1:8787/#/explore/walls ，点击“开始试玩”。独立入口为 http://127.0.0.1:8790/builtin-walls/ 。这两个入口由同一个工作台进程提供，无须另开游戏服务。工作台升级接入代码后需重启服务并重建前端。

原版游戏在预览端口的 iframe 中运行；沿用其方向键/WASD、E/空格、手机控件与全部流程。工作台提供全屏与退出试玩，退出会移除 iframe 并停止该实例的音画。重新进入从原版标题界面选择继续；存档在 `127.0.0.1:8790` 来源的浏览器本地存储中，原站、不同域名或端口的存档不会自动搬迁。

原版当前版本已下线暂停菜单，接入页不提供暂停按钮或无效的 P 暂停提示。

原版含内联脚本，只有此独立游戏预览路由使用相应 CSP；工作台页面和生成项目的策略保持原有约束。静态资源只开放游戏使用目录，不提供 `.git`、README 或维护脚本。保留原仓库版权声明，未向外部发布。

本次只部署与接入，不制作或替换正式美术，不声称完成全剧情、多结局、美术统一或全部移动端状态验收。

已执行验证：原项目 `npm run check`，工作台 TypeScript 检查、前端生产构建及现有 server/marketplace-preview 测试通过。`create-world-workbench/scripts/walls-local-smoke.mjs` 从登录和现有试玩入口开始，以真实键盘输入推进到院落并验证移动、全屏、退出销毁、重新进入保留原版存档，以及 844×476 视口内 16:9 游戏显示；本次游戏运行未记录脚本错误或失败资源请求。实际查看了桌面与横屏布局的角色、环境和原控件同屏截图，此次部署未修改其视觉资源。未验证完整剧情、多结局与全部触屏交互。

本地证据：`outputs/walls-local-verification.json`、`outputs/walls-integrated-desktop.png`、`outputs/walls-integrated-mobile.png`。浏览器验收使用隔离测试上下文，不改用户日常浏览器存档。需要复跑时，在工作台目录运行 `node scripts/walls-local-smoke.mjs`（本机 Chrome，工作台服务需已启动）。
