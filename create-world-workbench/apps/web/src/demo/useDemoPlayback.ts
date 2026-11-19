import { useEffect, useState } from 'react';
import { DEMO_TOTAL_MS, playbackAt, type DemoPlayback } from './three-body.js';

/**
 * 5 秒固定时间线：每 80ms 采样一次，生成当前进度。
 * 重新创建项目时传入新的 restartKey 即可从头播放。
 */
export function useDemoPlayback(active: boolean, restartKey = ''): DemoPlayback {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    if (!active) return;
    const started = performance.now();
    const timer = window.setInterval(() => {
      const value = Math.min(DEMO_TOTAL_MS, performance.now() - started);
      setElapsed(value);
      if (value >= DEMO_TOTAL_MS) window.clearInterval(timer);
    }, 80);
    return () => window.clearInterval(timer);
  }, [active, restartKey]);

  return playbackAt(elapsed);
}
