# Canvas Room 原生验收

入口：`python -B scripts/review_room.py room.json --artifact-dir 候选目录 --evidence browser.json --require-runtime --report review.json`。原 `validate.py` 的多界面解释器保持原样；此适配器只处理 `canvas-room-v1`。

先实际执行宿主 `scripts/skills/review-room.mjs`，保留命令与进程输出。它只能读 `__ROOM_STATE__`，通过键盘、点击及浏览器触摸协议操作；不得通过写状态、注入位置或直接调用完成函数通关。运行失败先保存反例，修复后构建新目录；不要覆盖旧候选或旧失败证据。

原生审核核对原 room 原始字节 SHA256、manifest 指纹、清单全部文件实际哈希、媒体与原 room 的哈希一致、嵌入 room-data.js 与原数据一致，以及候选目录没有未列出文件。相对资源路径必须安全，文件不允许软链接或 Windows reparse 路径。它不替代 Assembly 的几何/模块模型验证。

浏览器证据 runner 必须是 `playwright-canvas-room-v1`，绑定 room 与 manifest 两个指纹，所有要求检查必须严格布尔 true，错误与失败数组必须收集为空。检查范围包含真实自由移动、完整桌面视野、3个NPC/2个彩蛋、设备门槛、对白取消及焦点、线路错误/成功、姿态训练/暂停、保存恢复/无效存档、无彩蛋结局、重开、碰撞、手机布局及触屏释放。不能删除失败检查后宣称通过。

每条观察需包含正确指纹、布尔标记和合法玩家脚底盒；不能穿墙或NPC，完成标记必须遵守简报/结局条件。必须含初始状态、NPC交互、两玩法完成、无彩蛋结局与最终两彩蛋观察。截图必须位于证据目录内，PNG签名与哈希匹配，覆盖房间、两玩法、结局、彩蛋、手机、上墙、家具侧面八种画面；还需 wallOcclusion/foregroundOcclusion 检查。截图只保证被引用的文件没变，不证明画面质量。

像素比较通过临时127.0.0.1同源服务器读取画布；服务器仅提供不可变manifest白名单文件，禁止目录浏览与任意路径。file://版本仍可离线游玩，但浏览器会把本地图片画布标为tainted，不能以关闭安全功能来完成像素检查。

成功只返回 `artifactStatus:hash-verified` 和 `runtimeStatus:evidence-consistent`；`releaseReady` 始终 false。JSON和截图可被伪造，脚本不能认证浏览器进程，必须结合可信宿主实跑记录；忠实性、美术遮挡、文字可读与玩家体验分别审阅。不带浏览器报告时可核对静态身份，但运行状态明确 unverified；`--require-runtime` 下缺报告失败。

负例测试：`python -B -m unittest discover -s tests -p test_room_review.py -v`。测试构造的报告仅测试验证逻辑，绝不是实际浏览器证据。
