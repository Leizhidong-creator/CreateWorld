import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';
const key = 'cw.appearance';
const change = 'cw:appearance-change';
function saved(): Theme | undefined {
  try { const value = localStorage.getItem(key); return value === 'light' || value === 'dark' ? value : undefined; } catch { return undefined; }
}
let theme: Theme = saved() || 'dark';
function apply(value: Theme) {
  theme = value;
  document.documentElement.dataset.theme = value;
  window.dispatchEvent(new Event(change));
}
apply(theme);
export function setTheme(value: Theme) {
  try { localStorage.setItem(key, value); } catch { /* The choice still works for this tab. */ }
  apply(value);
}
window.addEventListener('storage', event => {
  if (event.key !== key && event.key !== null) return;
  apply(saved() || 'dark');
});
function subscribe(update: () => void) { window.addEventListener(change, update); return () => window.removeEventListener(change, update); }
export function useTheme() { return useSyncExternalStore(subscribe, () => theme); }
