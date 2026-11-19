import { createHash } from 'node:crypto';

export const SKILL_HASH_POLICY = 'text-lf-v1';
const digest = (value: Buffer) => createHash('sha256').update(value).digest('hex');
function textBytes(raw: Buffer): Buffer | undefined {
  if (raw.includes(0)) return;
  try { return Buffer.from(new TextDecoder('utf-8', { fatal: true }).decode(raw).replaceAll('\r\n', '\n')); }
  catch { return; }
}
/** Only skill text ignores checkout line endings; binary and image provenance stay byte-exact. */
export function skillFileHash(value: Buffer | string, policy = SKILL_HASH_POLICY): string {
  const raw = typeof value === 'string' ? Buffer.from(value) : value;
  return digest(policy === SKILL_HASH_POLICY ? textBytes(raw) || raw : raw);
}
/** Migration can retain a semantic revision only when every former byte hash still matches. */
export function matchesPreviousSkillFile(raw: Buffer, previousHash: string): boolean {
  const text = textBytes(raw);
  return digest(raw) === previousHash || !!text && (digest(text) === previousHash || digest(Buffer.from(text.toString('utf8').replaceAll('\n', '\r\n'))) === previousHash);
}
