/**
 * 导出页的两块展示素材。
 * - gameUrl：可运行的 HTML 入口（iframe，键盘可直接玩）
 * - demoUrl：自动演示版 HTML（iframe，打开后自动播放）——二选一，和 videoUrl 互斥
 * - videoUrl：演示视频（mp4 / webm）
 * 留空时页面显示占位框。
 */
export interface ExportMedia {
  gameUrl?: string;
  demoUrl?: string;
  videoUrl?: string;
  posterUrl?: string;
}

export const EXPORT_MEDIA: ExportMedia = {
  gameUrl: '/export-assets/three-body/play.html',
  demoUrl: '/export-assets/three-body/autoplay.html',
};
