# 独立游戏编译器

```ts
import {compileGame,verifyBuild} from './index.js';
const result=await compileGame({config,assetDir,outDir,revisionId,extensionsDir});
const check=await verifyBuild(outDir);
```

`outDir` 必须不存在；父目录可以不存在。返回 `{manifest,entryPath,configHash}`，entryPath 是绝对 index.html。输出 config.json、bootstrap.js、runtime/、assets/、可选 extensions/ 和 manifest.json；静态 HTTP 服务即可运行，无 CDN、无构建依赖。直接 file:// 不适用于 ESM/fetch，请用本地 HTTP。失败候选保留 BUILD_FAILED.txt，不产生成功清单，不覆盖旧构建。

输入资源相对 assetDir；拒绝绝对/远程/编码穿越/反斜杠/符号链接、伪装图片和可执行 SVG；实际解码图片并核验图集范围。支持 PNG/JPEG/WebP/GIF/SVG，音频 WAV/OGG/Opus/MP3/M4A/MP4（浏览器能否解码仍须运行验证）。最大单资源 64MB。扩展只复制本地 js/json/css，缺失插件声明不静默生成空壳。

manifest.status 恒为 candidate，列出除 manifest.json 自身外的全部文件路径、字节数、sha256，以及 configHash、runtimeVersion、revisionId。`verifyBuild` 重新检查所有文件、拒绝未声明文件和链接、校验配置哈希；返回 `{valid,errors,manifest?}`。这证明文件与清单一致，不能证明清单来源可信：工作台应在可信数据库另存构建清单哈希，拒绝模型覆盖可信证据。通过编译或哈希检查不等于故事忠实、实际可玩或正式验收通过。

每次构建还包括 `启动说明.txt`、`SOURCE-NOTICE.zh-CN.md`、`provenance/source.json` 与原样保留的 `provenance/legacy-kit-license-notice.txt`，全部纳入 SHA-256 清单。导出不改变上游或派生源码许可范围。打包工具只能复制构建内容，不应再向 ZIP 追加清单外文件。
