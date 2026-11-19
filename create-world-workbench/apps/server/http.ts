import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg; codecs=opus',
  '.ico': 'image/x-icon',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

/** Maximum decoded characters accepted from one request, matching the old limit. */
export const MAX_BODY_CHARS = 3_000_000;
/** A byte ceiling prevents a malicious client from buffering unbounded input. */
export const MAX_BODY_BYTES = 12_000_000;

export function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(JSON.stringify(data));
}

/**
 * Collect the request before decoding. Decoding each stream chunk separately
 * corrupts multi-byte UTF-8 characters that straddle a chunk boundary.
 */
export async function readJsonBody(req: IncomingMessage, limits={chars:MAX_BODY_CHARS,bytes:MAX_BODY_BYTES}): Promise<any> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > limits.bytes) throw new Error('材料过大，请缩小到本次改编范围');
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.length > limits.chars) throw new Error('材料过大，请缩小到本次改编范围');
  return text ? JSON.parse(text) : {};
}

export function sendFile(res: ServerResponse, file: string): void {
  const stat = fs.statSync(file);
  if (!stat.isFile()) throw new Error('不是文件');
  res.writeHead(200, {
    'content-type': MIME[path.extname(file)] || 'application/octet-stream',
    'content-length': stat.size,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  fs.createReadStream(file).pipe(res);
}
