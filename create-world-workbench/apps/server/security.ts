import type { IncomingMessage, ServerResponse } from 'node:http';

export interface OriginPolicy {
  /** Filled in after the server binds to an ephemeral port. */
  origin: () => string;
  allowedOrigins: string[];
}

const DEV_WEB_ORIGIN = 'http://127.0.0.1:5173';

function parseOrigin(value: string): string | undefined {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

export function acceptedHosts(policy: OriginPolicy): Set<string> {
  const origin = policy.origin() || 'http://127.0.0.1';
  return new Set([
    new URL(origin).host,
    ...policy.allowedOrigins.flatMap(value => {
      try {
        return [new URL(value).host];
      } catch {
        return [];
      }
    }),
  ]);
}

export function hostAllowed(req: IncomingMessage, policy: OriginPolicy): boolean {
  return !req.headers.host || acceptedHosts(policy).has(req.headers.host);
}

export function apiOriginAllowed(req: IncomingMessage, policy: OriginPolicy): boolean {
  const requestOrigin = req.headers.origin;
  if (!requestOrigin) return true;
  const origin = policy.origin();
  return requestOrigin === origin || requestOrigin === DEV_WEB_ORIGIN || policy.allowedOrigins.includes(requestOrigin);
}

/** Apply credentials/CORS only for explicitly configured extra origins. */
export function applyCors(req: IncomingMessage, res: ServerResponse, policy: OriginPolicy): void {
  const requestOrigin = req.headers.origin;
  if (requestOrigin && policy.allowedOrigins.includes(requestOrigin)) {
    res.setHeader('access-control-allow-origin', requestOrigin);
    res.setHeader('access-control-allow-credentials', 'true');
    res.setHeader('access-control-allow-headers', 'content-type,x-csrf-token');
    res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,OPTIONS');
  }
}

export function csrfValid(req: IncomingMessage, token: string): boolean {
  return req.headers['x-csrf-token'] === token;
}

export function frameAncestors(policy: OriginPolicy): string {
  const extra = parseOrigin(policy.origin());
  return [extra, DEV_WEB_ORIGIN, ...policy.allowedOrigins].filter(Boolean).join(' ');
}
