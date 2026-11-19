# 交互契约 v1

输入完整公共 bundle，schemaVersion:1、id/title，UTF-8 ≤ 2 MiB。依赖 source.nodes、mechanics、flow、state；拥有 interactions/interactionTests。状态执行语义见本包 model-contract.md。

每个 interaction 为 {id,screenId,label,input,mechanicId,sourceNodeIds,guard,effects,targetScreen,feedback,failure,cancel,repeat}。文本非空；来源非空且存在；mechanicId 存在；起止界面存在。repeat 仅 once/repeatable。每个动作要有一条对应 flow edge，包括同界面动作。失败/取消是原子拒绝，成功才记 once。世界 guard/effect 必须严格类型化。

建议 inputSpec：{devices,gesture,bindings}：
- devices 为不重复的 keyboard/pointer/touch/gamepad。
- gesture 为 press/hold/drag/sequence/custom；bindings 按声明设备给具体输入说明。
- hold 需整数 durationMs 1..60000；drag/sequence/custom 需 moduleId。
这些是实现要求，校验器不执行手势。未声明映射会警告。

可选 outcomes：{failure:{effects:[],targetScreen,feedback},cancel:{effects:[],targetScreen,feedback}}。本版两种结果必须保留源界面和状态；实际失败代价须另建可执行命令并修订契约，不把成功奖励放进 cancel。

interactionTests：[{actions:[id],expect:{screenId,values:{变量:期望值}},rejectedActions:[id]}]。从初态重放，再断言；拒绝动作不能产生状态变化。轨迹不能包含不可用动作。程序还枚举所有声明动作可达性、门槛拒绝、once 重复和原子效果。

命令 python scripts/validate.py bundle.json --report report.json 返回 skill/passed/errors/warnings/metrics，0/1。超过 20,000 状态或 250,000 边失败并说明验证未完成。此证明不包含真实设备、碰撞、焦点和动画，需另运行浏览器旅程。交付交互设计说明和具体模块阻塞项。
