import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { writeJson } from '../../packages/shared/files.js';
import { createWorkbenchApp } from './app.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dataRoot = path.resolve(process.env.CW_DATA_DIR || path.join(root, 'data'));
const token = crypto.randomBytes(32).toString('hex');
let origin = process.env.CW_PUBLIC_ORIGIN || '';
let previewOrigin = process.env.CW_PUBLIC_PREVIEW_ORIGIN || '';
const allowedOrigins = (process.env.CW_ALLOWED_ORIGINS || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);
const app = createWorkbenchApp({
  root,
  dataRoot,
  token,
  origin: () => origin,
  previewOrigin: () => previewOrigin,
  allowedOrigins,
});
const server = http.createServer(app.handler);
const preview = http.createServer(app.previewHandler);
const listenHost = process.env.CW_HOST || '127.0.0.1';

await new Promise<void>(resolve => server.listen(Number(process.env.CW_PORT || 8787), listenHost, resolve));
if (!origin) origin = 'http://' + listenHost + ':' + (server.address() as any).port;
await new Promise<void>(resolve => preview.listen(Number(process.env.CW_PREVIEW_PORT || 8790), listenHost, resolve));
if (!previewOrigin) previewOrigin = 'http://' + listenHost + ':' + (preview.address() as any).port;
writeJson(path.join(dataRoot, 'server.json'), { origin, previewOrigin, pid: process.pid, startedAt: new Date().toISOString() });
console.log('Create World 工作台已启动：' + origin);
console.log('游戏预览：' + previewOrigin);

let closing = false;
const stop = async () => {
  if (closing) return;
  closing = true;
  await app.close();
  await Promise.all([
    new Promise<void>(resolve => server.close(() => resolve())),
    new Promise<void>(resolve => preview.close(() => resolve())),
  ]);
  process.exit(0);
};
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
