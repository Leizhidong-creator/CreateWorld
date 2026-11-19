# 高墙之外试玩接入

来源：用户提供的《高墙之外_源码版.zip》。原包 SHA-256：`637a3d3082f1c8a33a2ce4c9dbf04e57f17dce0fc3808882205472eaf9d36187`。

- 试玩路由：`/#/games/preview/walls`，静态入口 `/local-games/walls/index.html`。
- 下载：`/downloads/beyond-the-walls-source.zip`，保留原始源码包，未替换为封面。
- 将源码包解压后从根目录 `index.html` 启动；推荐在解压目录运行 `python -m http.server 8080`，访问 `http://localhost:8080`。
- 沿用原游戏剧情、素材、存档与操作。游戏完全在浏览器运行，不调用生成后端。
- 首屏预加载三张菜单图片，脚本 defer 顺序执行。保留原有图片按需加载、160 MB 解码缓存预算及音频 preload=none。
- `.js/.css/.html.gz` 为 gzip 预压缩副本，nginx 在 `/local-games/walls/` 开启 `gzip_static on` 和 `gzip_vary on`。修改原文件时必须重新生成对应压缩副本。
- 图片、音频、字体缓存一小时；HTML 和脚本继续重新验证，避免旧版本错配。
- 本次只接入现有游戏，没有重新制作美术或调整剧情。
