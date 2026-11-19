import type { IncomingMessage, ServerResponse } from 'node:http';
import type { WorkEvent } from '../../packages/contracts/index.js';
import type { Store } from '../../packages/orchestrator/store.js';

/** Server-sent events with replay and a per-project filter. */
export class EventStream {
  private subscribers = new Set<ServerResponse>();

  constructor(private readonly store: Store) {}

  subscribe(req: IncomingMessage, res: ServerResponse, projectId: string, after: number): void {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    this.subscribers.add(res);
    for (const event of this.store.events(projectId, undefined, after)) this.write(res, event);
    const handler = (event: WorkEvent) => {
      if (event.projectId === projectId) this.write(res, event);
    };
    this.store.on('update', handler);
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 20000);
    req.on('close', () => {
      clearInterval(heartbeat);
      this.subscribers.delete(res);
      this.store.off('update', handler);
    });
  }

  closeAll(): void {
    for (const response of this.subscribers) response.end();
    this.subscribers.clear();
  }

  private write(res: ServerResponse, event: WorkEvent): void {
    res.write(`id: ${event.id}\nevent: update\ndata: ${JSON.stringify(event)}\n\n`);
  }
}
