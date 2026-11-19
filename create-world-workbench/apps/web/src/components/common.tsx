import { useEffect, useRef, type ReactNode } from 'react';
import { failureStatuses, humanStatus, isBusy, passedStatuses } from '../utils.js';

const paths: Record<string, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />, close: <path d="m6 6 12 12M18 6 6 18" />,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />, chevron: <path d="m9 5 7 7-7 7" />, 'chevron-left': <path d="m15 5-7 7 7 7" />,
  play: <path d="m8 5 11 7-11 7Z" />, pause: <><path d="M8 5v14M16 5v14" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  layers: <><path d="m12 3 10 6-10 6L2 9Zm-9 11 9 5 9-5M3 18l9 5 9-5" /></>,
  folder: <path d="M3 7V5h7l2 3h9v12H3Z" />,
  check: <path d="m5 12 4 4L19 6" />, refresh: <><path d="M20 10a8 8 0 1 0-2 8M20 3v7h-7" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  file: <><path d="M14 2H5v20h14V7ZM14 2v6h5M8 12h8M8 16h8" /></>,
  upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6" /></>,
  download: <><path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
  link: <><path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7" /></>,
  warning: <><path d="m12 3 10 18H2Z" /><path d="M12 9v5m0 3h.01" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 6-6 4 4 3-3 5 5" /></>,
  edit: <><path d="m4 16 12-12 4 4L8 20H4ZM13 7l4 4" /></>,
  history: <><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l4 2" /></>,
  monitor: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8m-4-4v4" /></>,
  phone: <><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M18 10v4" /></>,
  menu: <path d="M3 5h18M3 12h18M3 19h18" />,
  spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4" /></>,
  trash: <><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
  heart: <path d="M20.8 8.8c0 5.5-8.8 10-8.8 10s-8.8-4.5-8.8-10A4.8 4.8 0 0 1 12 6.3a4.8 4.8 0 0 1 8.8 2.5Z" />,
  bookmark: <path d="M6 4.5A2.5 2.5 0 0 1 8.5 2h7A2.5 2.5 0 0 1 18 4.5V21l-6-3-6 3Z" />,
  message: <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 9.3 9.3 0 0 1-3.8-.8L4 20l1.2-3A7.4 7.4 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" />,
};
export function Icon({ name, size = 18, className = '' }: { name: string; size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.file}</svg>;
}
export function StatusBadge({ status }: { status?: string }) {
  const tone = isBusy(status) ? 'active' : passedStatuses.has(status || '') ? 'success' : failureStatuses.has(status || '') ? 'danger' : 'neutral';
  return <span className={`status-badge ${tone}`}><span className="status-dot" />{humanStatus(status)}</span>;
}
export function EmptyState({ icon = 'folder', title, children, action }: { icon?: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><Icon name={icon} size={26} /></div><h3>{title}</h3>{children && <div className="empty-description">{children}</div>}{action && <div className="empty-action">{action}</div>}</div>;
}
export function Loading({ label = '正在读取项目…' }: { label?: string }) {
  return <div className="loading-state" role="status"><span className="spinner" />{label}</div>;
}
export function Modal({ title, badge, onClose, children, wide = false }: { title: string; badge?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusables = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex="0"]') || []);
    const auto = ref.current?.querySelector<HTMLElement>('[data-autofocus]');
    (auto || focusables()[0] || ref.current)?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const nodes = focusables();
      if (!nodes.length) { event.preventDefault(); return; }
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div className={`modal ${wide ? 'wide' : ''}`} ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}><div className="modal-heading"><h2>{title}</h2>{badge && <span className="modal-badge">{badge}</span>}<button type="button" className="icon-button" onClick={onClose} aria-label="关闭对话框"><Icon name="close" /></button></div>{children}</div></div>;
}
export function JsonDetails({ title, value }: { title: string; value: unknown }) {
  if (value === undefined || value === null) return null;
  return <details className="json-details"><summary>{title}</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>;
}
