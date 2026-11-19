# 彩蛋契约 v1

输入完整公共 bundle，schemaVersion:1、id/title，UTF-8 ≤ 2 MiB。依赖 source.nodes、state、flow、interactions，拥有 easterEggs。复制包内 model-contract.md 的状态与动作语义；与主游戏共享同一初态和迁移规则。

每项 {id,sourceNodeIds,interactionIds,reward,optional:true,spoilerGuard}：
- 来源与动作引用真实存在；数组非空，动作不能重复或属于多个彩蛋。
- reward 为真实显示的奖励/呼应说明，不能描述尚未实现的功能。
- optional 必须为布尔 true，不能用字符串或 1。
- spoilerGuard 是 AND 条件数组；每个可达触发前状态都必须满足，而不只是文字声称没有剧透。
- 明确 flow.mainEndingScreenIds（成功主结局子集）。移除所有彩蛋动作后，所有声明主结局仍需可达。未给此字段只证明仍有某个结局并产生警告。

校验会检查所有可达状态仍能达到一个终局、彩蛋可触发、可重复正数奖励不会立即再领取、无越界/不变量破坏。反复离开重入或与其他动作组合的经济漏洞仍需轨迹测试与审阅；文字剧透无法自动理解。

easterEggs 可为空；说明缺席理由。超过 20,000 状态或 250,000 边失败并标明验证未完成。命令 python scripts/validate.py bundle.json --report report.json 返回 skill/passed/errors/warnings/metrics，退出 0/1。metrics 包含移除后状态数与通关路径；不等于浏览器证据。
