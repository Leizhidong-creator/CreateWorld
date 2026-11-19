# 组装契约

完整例 `../examples/station.json`。v1 读取 state/flow/interactions 和 assembly。状态语义与 Game State 相同，但本包携带自己的解释器，不依赖另一个技能安装。

assembly 为 `{entryScreen,requiredArtifactIds,artifactStatus,assets}`；entryScreen 必须等于 flow.startScreen；必需依赖全部 passed。asset 项 `{id,path,sha256}`；路径相对 bundle 所在目录，允许 PNG/JPEG/GIF/WebP/WAV/OGG/MP3 的实际媒体签名，限制单文件及总大小。`flow.screens[].assetIds` 可引用资产，运行时展示图片或音频。assetIds 不存在时不凭空生成资产。

媒体签名只检查格式头，不证明完整解码。宿主浏览器还要实际加载所有声明媒体并检查失败；不能只看文件扩展名或截图。当前参考后端只实现原生按钮 press。若声明 inputSpec，devices 只允许 keyboard/pointer/touch，bindings 对应 keyboard:"Enter"、"Space" 或 "Enter/Space"（先聚焦按钮），pointer:"click"，touch:"tap"。其它按键、hold/drag/sequence/custom、gamepad 或 moduleId 都拒绝构建，需另实现模块。无 inputSpec 的旧规格默认原生按钮并应做实际操作验证。

`build.py` 仅创建新目录：index.html、runtime.js、style.css、game-data.js、声明媒体与 manifest.json。manifest 记录 schemaVersion、bundleSha256、runtimeVersion、candidate 状态以及每个构建文件的相对路径和 SHA-256。构建失败的目录不会自动变成成功候选，也不会覆盖重试。

浏览器只读 `window.__SKILL_GAME_STATE__` 提供 screenId/values/completed/trace/paused。操作按钮是 `[data-action-id]`，状态拒绝不会产生 effects。保存控制在 `#save-panel` 内，需点击 summary 展开；ID 为 export-save/import-save/save-data。暂停/继续/重开为 pause-game/resume-game/restart-game。测试只通过实际 UI 输入。

输出 JSON 与退出码只表明候选构建是否成功，绝不自动表示发布 ready。像素质量、原作忠实、手感和真实资产生产不在该构建器能证明的范围。
