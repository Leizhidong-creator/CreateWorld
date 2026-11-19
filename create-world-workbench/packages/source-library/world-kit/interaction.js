/** Select the nearest eligible interaction without mutating game state. */
export function nearestInteraction(point, entries, test = (_condition) => true) {
  const distance = entry => {
    const rect = entry.rect;
    const x = Math.max(rect.x, Math.min(point.x, rect.x + rect.w));
    const y = Math.max(rect.y, Math.min(point.y, rect.y + rect.h));
    return Math.hypot(point.x - x, point.y - y);
  };
  return entries.filter(entry => test(entry.when) && distance(entry) <= (entry.range ?? 30))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0) || distance(a) - distance(b) || a.id.localeCompare(b.id))[0] || null;
}
