# 验收证据契约

输入 bundle 同 [公共交换格式](../examples/station.json)，脚本本身携带验证依赖，支持独立复制安装。`validate.py bundle.json [--artifact-dir DIR] [--evidence FILE] [--require-runtime] [--report FILE]`。缺失 evidence 不能判运行通过；require-runtime 时必须失败。

构建清单每个文件必须实际存在且哈希匹配。证据顶层有 `schemaVersion:1,runner:'playwright-real-input-v1',bundleSha256,manifestSha256,status:'passed'`。两个指纹分别是原 bundle 和 manifest.json 原始字节的 SHA-256。

`journeys` 每项包含 id、actions（交互 ID 数组）、observations、terminalScreenId。observations 数量必须是 actions 数量加一，从初始状态开始；每项是 screenId/values/completed。解释器独立重放全部动作，并逐步比较，末状态必须是声明终局；需要覆盖全部要求终局。

`pageErrors` 与 `consoleErrors` 必须为真实采集的空数组；`checks` 的 saveRestore/restart/mobileLayout/guardRejected/pause/invalidSave/keyboard/touch 必须为真正布尔 true。所有额外检查也必须为 true，不能与 status:passed 矛盾。有媒体时还需 assetsDecoded:true，宿主必须实际检查图片可解码、音频可加载。截图与动作日志由宿主写入构建目录外，不能修改不可变候选来追加 QA 文件。

静态验证还检查 assembly 必需产物是否 passed、媒体引用和当前后端输入能力。缺失 assembly、失败依赖、未实现的手势/按键不能被仅状态规则通过掩盖。

通过的运行证据状态只能解释为 evidence-consistent，即给定证据与模型/构建一致。模型可以伪造 JSON，因此宿主实际执行是额外信任根；对无法核验来源的证据保持未认证说明，不能自动发布。
