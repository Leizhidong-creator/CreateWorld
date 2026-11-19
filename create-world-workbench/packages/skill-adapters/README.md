# 共用数据检查与历史适配

生产调度入口是 `packages/orchestrator/autonomous.ts`，通过按需工具完成整部游戏任务。这里的 `index.ts` 只暴露当前制作仍需要的数据检查、资源路径检查和修改范围辅助函数，不调度固定阶段。

`validateStageOutput('source', source)` 保留了历史函数名，但只用于检查原作来源合同；`validateAssetPlan` 与 `validateJourneys` 检查资源和输入记录。它们的成功不能代替运行时配置检查、素材实测或浏览器通关。

`legacy-stage-adapter.ts` 保存旧六阶段入口，用于历史兼容测试。旧 `buildStagePrompt` / `stageDefinitions` 不再从当前入口导出，也不在新任务中调用。

技能以 `skills/manifest.json` 的发行文件为准。当前17个入口按需读取，不要求依次全部执行；美术统一先读 `visual-asset-production`，再读取其内部模块。修改项目副本后运行 `npm run skills:sync`；独立下载包没有上层项目副本时，该命令可对包内技能重新生成清单。同步按实际目录发现入口，新技能无需维护固定名称白名单。

数据合同、机制接口与真实操作格式见 `docs/PRODUCTION-CONTRACT.md` 和 `packages/compiler/CONFIG.md`。
