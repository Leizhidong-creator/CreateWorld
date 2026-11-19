import { createHash } from 'node:crypto';

/** Deterministic JSON: object keys are sorted so hashes do not depend on insertion order. */
export function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(v => stableStringify(v)).join(',') + ']';
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).filter(key => record[key] !== undefined).sort();
    return '{' + keys.map(key => JSON.stringify(key) + ':' + stableStringify(record[key])).join(',') + '}';
  }
  return 'null';
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hashEntity(data: unknown): string {
  return sha256(stableStringify(data));
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
