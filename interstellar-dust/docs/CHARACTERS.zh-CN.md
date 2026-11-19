# 人物重新生成记录

2026-10-14，按用户要求使用 character-generation skill。原 SVG 小人已退出运行时，保存在 assets/legacy 供追溯。

## 生成与验收

| 人物 | 模式 / 图像生成调用数 | 交付状态 | 游戏实际使用 |
| --- | --- | --- | --- |
| 库珀 | balanced / 1 | 完整人物包 QA 通过，staging 已完成 | 四方向 × 四帧，170ms，neutral 待机 |
| 墨菲 | balanced / 3 | production + down/right 定向补生成；完整包仍未通过 down/right 行走 QA | 原生成稿的 neutral 帧，四个朝向，静态 QA 通过 |
| 布兰德 | balanced / 2 | production + right 定向补生成；完整包仍未通过 right 行走 QA | 原生成稿的 neutral 帧，四个朝向，静态 QA 通过 |

遵循技能“Stop after that supplement or retry round”要求停止补生成，没有降低腿部相位检查阈值。墨菲、布兰德未标记为完整动画包或完成的 skill job。两位 NPC 在原游戏内即为站立交谈，不播放行走动画。静态帧检查覆盖尺寸、二值透明度、64 色限制、基线与裁切；它不能证明行走正确。失败 staging 保存在项目旁 output/character-generation/.work/。

所有工作为本轮新建，无复用旧人物任务。图像均由 imagegen 生成，再使用技能脚本确定性处理透明、调色板、分帧与脚点。未通过程序手绘人物补救。

## 参考来源与保守补全

- [库珀参考剧照 / CinemaBlend](https://www.cinemablend.com/movies/watched-interstellar-first-time-glad-waited-christopher-nolan-movie-until-kids)：中年男性、短棕发、棕色工作外套、灰色内搭。裤子、鞋和背面衣物以工作服风格保守补全。
- [少年墨菲参考剧照 / Looper](https://www.looper.com/354107/whatever-happened-to-young-murph-from-interstellar/)：儿童、赤棕色束发、蓝色外套。背面发束、牛仔裤和棕鞋为未完整可见部分的补全。
- [布兰德参考剧照 / IMDb](https://www.imdb.com/title/tt0816692/mediaviewer/rm620536066/)：年长男性、灰白短发与白胡须、浅蓝衬衫。深色裤与棕鞋为保守补全；没有添加眼镜。

参考照片只用于生成输入，未放入角色包和游戏 ZIP。像素脸为风格化演绎，并非精确肖像。左朝向由右朝向镜像，口袋等不对称衣物细节也会镜像。

## 文件与接入

- character-prompts/：本轮实际 production 与补生成提示词。
- assets/characters/cooper/：完整技能输出，附加 atlas.png 供引擎读取。
- assets/characters/murph-static/、brand-static/：仅静态朝向图、views、manifest 与独立 QA，明确包含 full_walk_pack_passed: false。
- 引擎图集行顺序为 down / left / right / up；每帧 48×64，脚点 (24,61)。库珀四列，NPC 一列；库珀游戏显示 36×48，墨菲 30×40，布兰德 36×48。

引擎通过 frameCount / idleFrame / frameDuration / footAnchor 读取新图集。旧内容未指定这些字段时仍采用三帧、待机第 2 列、125ms、底边脚点。新增行为测试覆盖动画完整周期、四方向映射、脚点位置、NPC 单列边界和旧格式兼容。
