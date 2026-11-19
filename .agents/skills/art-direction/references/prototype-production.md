# 有界原型的美术生产

这是本地新增的独立模式。目标是在用户给定范围和画风下，让场景、角色与 UI 使用同一套可见、可检查的规则开始制作。它不回答市场偏好，也不降低原有盲测流程的门槛。

## 实际工作

1. 从当前请求记录原型范围、原作情绪、平台、原生分辨率、镜头、瓦片/角色尺寸、交互可读性和制作限制。单舱小版本至少检查角色与操作物体的尺度关系；不要仅写“像素风”。
2. 选择一个符合约束的临时方向，并写下理由与未验证假设。生成或制作真实的综合样板，至少展示 `gameplay_scene`、`native_character`、`ui_hud` 三面板。场景图可以是生成栅格；文字/UI 由代码叠加，不能把生成图片上的伪文字当游戏 UI。
3. 查看原生尺寸的样板，逐项记录五类检查：来源叙事功能、制作工艺、可读性、技术规格、可生产性。每项要有检查方法和可见证据。无法检查写 pending，不编写不存在的玩家反馈。需要改进时修复样板后重建新的哈希与修订记录，保留旧记录。
4. 保存 `prototype-direction.yaml`，计算实际样板字节 SHA-256。校验后导出 `style-contract.yaml`；把它和样板交给 Scene/Character/UI。若下游只接受正式 v1 契约或 `art-direction.yaml`，明确建立适配文件并保留原型状态，不能悄悄改为 approved/player_supported。
5. 在实际游戏截图中复核路径、NPC/道具区分、交互提示、遮挡、文字和缩放。初始样板通过不代表所有资产通过；增量资产仍需按这份契约验收。

```text
python scripts/prototype_production.py validate prototype-direction.yaml
python scripts/prototype_production.py export-contract prototype-direction.yaml --output style-contract.yaml
```

两条命令都核对真实文件的原始字节哈希和图像尺寸；PNG/WebP/JPEG 经 Pillow 解码，SVG 仅支持不含 script/外部引用的本地样板。输出 JSON 报告、失败退出 1。导出拒绝覆盖已有契约，修改需新的修订目录。

## 输入格式

```yaml
schema_version: prototype-1.0
mode: prototype-production
status: prototype_selected_unvalidated
revision: 1
project_slug: station-prototype
brief:
  user_request: 先做一个单场景像素风可玩小版本
  scope: 一个舱室、三位 NPC、两种玩法
  rationale: 固定俯视角使操作站位与角色轮廓容易区分
  native_resolution: [640, 360]
  camera: 固定俯视
  tile_size: 32
  character_size: [24, 40]
  constraints: [最近邻整数缩放, 中文 UI 由代码绘制]
sample:
  path: candidates/prototype.png
  sha256: 实际文件的64位小写SHA256
  width: 1280
  height: 720
  panels: [gameplay_scene, native_character, ui_hud]
  origin: generated
checks:
  - category: source_function
    status: pass
    method: 原作功能与样板逐项对照
    evidence: 说明具体面板和观察
  # 还需 craft/readability/technical/production 各一项；均通过才导出
style_system:
  style_anchor: 冷色舱壁与暖色操作台构成明确的可玩层次
  pixel_policy: 角色与地图使用最近邻，UI 原生分辨率绘制
  palette: [深蓝灰背景, 米白人物亮面, 琥珀交互强调]
  shape_language: [清晰硬边, 角色轮廓与舱壁分离]
  lighting: [环境低对比, 操作台局部强调]
  camera: [固定俯视，不用透视纹理暗示可进入的侧壁]
  ui: [中文无衬线字体, 实底对话框, 移动端文字另验]
  motion: [角色脚底锚点稳定, 操作反馈即时]
  negative_rules: [不让装饰和可操作物使用同样强调色]
  asset_overrides:
    gameplay_environment: [先验证通道净宽再增加细节]
    characters: [所有角色共用脚底与动作尺寸]
    ui_hud: [文本不烘焙进背景图]
assumptions: [目标用户尚未参与偏好测试]
limitations: [仅临时原型方向，不证明吸引力或长期资产一致性]
```

完整可运行示例见 `tests/fixtures/prototype/prototype-direction.yaml`。它是确定性测试夹具，不是用户游戏美术或真实玩家反馈。

## 输出契约

`schema_version: prototype-1.0` 与 `decision_status: prototype_selected_unvalidated` 固定；含 contract_id、revision、project_slug、原生几何尺寸、样板路径及真实哈希、style_system 各字段、assumptions/limitations、输入来源及哈希。`player_evidence` 固定为 null，`selection_authority` 为 engineering_constraints。该契约与正式视觉决策 v1 的状态空间刻意区分。后续正式选型创建新 revision，不覆盖或伪装此前证据。
