import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { resolveAuthority } from '../packages/text-workflow/authorities.js';
import { hashFile } from '../packages/shared/files.js';

test('authority lookup uses repository or configured originals while retaining exact pinned hashes', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-authority-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'standard.md'), 'Pinned authority\n');
  const authority = { path: 'Z:\\unavailable\\standard.md', repoPath: 'standard.md', sha256: hashFile(path.join(root, 'standard.md')) };
  assert.equal(resolveAuthority(root, authority), path.join(root, 'standard.md'));
  assert.equal(resolveAuthority(root, { ...authority, repoPath: undefined }, root), path.join(root, 'standard.md'));
  const local = path.join(root, 'create-world-workbench', 'data', 'text-authorities', 'standard.md');
  fs.mkdirSync(path.dirname(local), { recursive: true }); fs.copyFileSync(path.join(root, 'standard.md'), local);
  assert.equal(resolveAuthority(root, { ...authority, repoPath: undefined }), local);
  fs.rmSync(local);
  fs.writeFileSync(path.join(root, 'standard.md'), 'Unapproved replacement\n');
  assert.throws(() => resolveAuthority(root, authority), (e: any) => e.code === 'authority_changed');
});

test('missing authority reports a repairable setup dependency instead of raw filesystem failure', () => {
  assert.throws(() => resolveAuthority(os.tmpdir(), { path: 'Z:\\unavailable\\execution-standard.md', sha256: 'missing' }),
    (e: any) => e.code === 'authority_missing' && e.status === 422 && e.message.includes('CW_TEXT_AUTHORITY_DIR'));
});
