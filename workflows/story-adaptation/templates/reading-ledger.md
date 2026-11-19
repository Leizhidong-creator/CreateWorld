# 阅读账格式

这是内部证据，不是新增 YAML 实体。source/manifest.json 的 units 列表每项含 id、title、path、sha256、paragraphs（正文P编号总数）。每个阅读者的 work/readings/*.json 是列表，各项含 id、sha256、paragraphs_read（闭区间列表，如 [[1,20],[21,35]]）、read_status（read/partial）、note_anchor（指向本作品内笔记）。

没有实际读到不能填写 read。笔记文件每个单元保留标题锚点，描述因果、主角是否在场/何时获知与疑点；无需复制小说全文。当前约定仅用于本工作流的读取覆盖检查，不能把哈希和区间完整说成语义理解通过。
