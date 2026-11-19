# 本地受控修订

2026-10-11。在只读研究快照基础上复制为项目技能；`references/create-world-skills` 原文件不变。

1. 原三张 SVG 的声明哈希属于 Git blob 的 LF 字节；Windows `core.autocrlf=true` 将工作树检出为 CRLF，导致 4 个相关测试失败。仅本地测试夹具恢复为已核对 Git HEAD 的原始字节，`.gitattributes` 对这些哈希绑定文件设 `-text`。验证器仍对原始字节计算 SHA-256，CRLF 漂移和内容篡改都必须失败，不归一化、不自动重算声明。
2. 增加 `prototype-production` 独立路径与临时风格契约，解决用户明确要求有界可玩版本时被正式玩家偏好流程阻断的问题。原正式视觉决策脚本、门槛与 schema 不变，不造玩家样本。
3. 本地增加 PNG/WebP/JPEG 解码依赖 Pillow，以避免样板只带合法文件头却不能显示。SVG 样板仍需人工查看，XML 结构有效不等于视觉品质通过。
