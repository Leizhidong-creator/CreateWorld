import {TextWorkflow} from '../../packages/text-workflow/service.js';
import {TextGameHandoff} from '../../packages/text-workflow/handoff.js';
import {textRoutes} from '../../packages/text-workflow/routes.js';
import { type IncomingMessage, type ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Workbench } from '../../packages/orchestrator/service.js';
import { projectInput } from '../../packages/contracts/index.js';
import { safeId, safePath } from '../../packages/shared/files.js';
import { codexVersion } from '../../packages/codex-adapter/index.js';
import { browserExecutable, selectedBrowser } from '../../packages/browser-runner/index.js';
import { EventStream } from './events.js';
import { json, readJsonBody, sendFile } from './http.js';
import {
  apiOriginAllowed,
  applyCors,
  csrfValid,
  frameAncestors,
  hostAllowed,
  type OriginPolicy,
} from './security.js';
import { ProjectQueryService } from './services/projects.js';
import { RevisionQueryService } from './services/revisions.js';
import { RevisionExportService } from './services/export.js';

export interface AppOptions {
  root: string;
  dataRoot: string;
  token: string;
  origin: () => string;
  previewOrigin: () => string;
  allowedOrigins: string[];
}

export interface WorkbenchApp {
  service: Workbench;
  text: TextWorkflow;
  handoff: TextGameHandoff;
  handler: (req: IncomingMessage, res: ServerResponse) => void;
  previewHandler: (req: IncomingMessage, res: ServerResponse) => void;
  close: () => Promise<void>;
}

/**
 * Wire transport adapters to application services. Routes only parse/validate
 * transport input and delegate; filesystem and acceptance rules live in services.
 */
export function createWorkbenchApp(options: AppOptions): WorkbenchApp {
  const service = new Workbench({ root: options.root, dataRoot: options.dataRoot, previewOrigin: options.previewOrigin });
  const text = new TextWorkflow({root:options.root,dataRoot:options.dataRoot,store:service.store});
  const handoff = new TextGameHandoff(text,service);
  const policy: OriginPolicy = { origin: options.origin, allowedOrigins: options.allowedOrigins };
  const events = new EventStream(service.store);
  const revisions = new RevisionQueryService(options.origin, options.previewOrigin);
  const projects = new ProjectQueryService(service, revisions);
  const exporter = new RevisionExportService(service, options.root, options.dataRoot);
  const staticRoot = path.join(options.root, 'dist', 'web');

  const handler = (req: IncomingMessage, res: ServerResponse): void => {
    void (async () => {
      const url = new URL(req.url || '/', options.origin() || 'http://127.0.0.1');
      const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
      const method = req.method || 'GET';
      if (!hostAllowed(req, policy)) {
        json(res, 403, { error: '无效工作台地址' });
        return;
      }
      if (parts[0] === 'api') {
        if (!apiOriginAllowed(req, policy)) {
          json(res, 403, { error: '此来源不能访问工作台' });
          return;
        }
        applyCors(req, res, policy);
        if (parts.join('/') === 'api/builtin-games/walls' && method === 'GET') {
          const installed = fs.existsSync(path.resolve(options.root, '../beyond-the-walls/Beyond the wall/index.html'));
          json(res, installed ? 200 : 503, installed
            ? { previewUrl: options.previewOrigin() + '/builtin-walls/' }
            : { error: '高墙之外尚未安装，请按本地部署说明拉取原项目。' });
          return;
        }
        if (method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }
        if (!['GET', 'HEAD'].includes(method) && !csrfValid(req, options.token)) {
          json(res, 403, { error: '会话已更新，请刷新页面后重试' });
          return;
        }
        if (await textRoutes(text,req,res,parts,url,()=>readJsonBody(req,['sources','game-materials'].includes(parts[4])?{chars:15_100_000,bytes:16_000_000}:undefined),handoff)) return;
        if (parts[1] === 'bootstrap' && method === 'GET') {
          json(res, 200, {
            csrfToken: options.token,
            version: '0.2.0-autonomous',
            capabilities: {
              codex: await codexVersion(),
              browser: {
                available: !!browserExecutable(),
                kind: selectedBrowser(),
                supported: ['chromium', 'firefox', 'webkit'],
                touch: 'chromium',
              },
              image: { status: '按任务实测记录；服务异常会保留诊断' },
              storage: { available: true },
            },
            projects: projects.list(),
          });
          return;
        }
        if (parts[1] === 'projects') {
          if (parts.length === 2) {
            if (method === 'GET') {
              json(res, 200, projects.list());
              return;
            }
            if (method === 'POST') {
              const parsed = projectInput.safeParse(await readJsonBody(req));
              if (!parsed.success) {
                json(res, 400, { error: parsed.error.issues.map(issue => issue.message).join('；') });
                return;
              }
              json(res, 201, service.create(parsed.data));
              return;
            }
          }
          const project = service.project(parts[2]);
          if (parts.length === 3 && method === 'PATCH') {
            json(res, 200, service.updateProject(project.id, await readJsonBody(req)));
            return;
          }
          if (parts.length === 3 && method === 'GET') {
            json(res, 200, projects.detail(project.id));
            return;
          }
          if (parts.length === 3 && method === 'DELETE') {
            json(res, 200, service.deleteProject(project.id));
            return;
          }
          if (parts[3] === 'runs' && method === 'POST') {
            const value = await readJsonBody(req);
            if (!['generate', 'change'].includes(value.mode)) throw new Error('无效任务类型');
            json(res, 201, service.start(project.id, value.mode, String(value.instruction || '')));
            return;
          }
          if (parts[3] === 'rollback' && method === 'POST') {
            const value = await readJsonBody(req);
            json(res, 200, await service.rollback(project.id, safeId(value.revisionId)));
            return;
          }
          if (parts[3] === 'events' && method === 'GET') {
            events.subscribe(req, res, project.id, Number(req.headers['last-event-id'] || url.searchParams.get('after') || 0));
            return;
          }
        }
        if (parts[1] === 'runs') {
          const run = service.run(parts[2]);
          if (parts.length === 3 && method === 'GET') {
            json(res, 200, projects.runDetail(run.id));
            return;
          }
          if (parts[3] === 'cancel' && method === 'POST') {
            json(res, 200, service.cancel(run.id));
            return;
          }
          if (parts[3] === 'resume' && method === 'POST') {
            json(res, 200, service.resume(run.id));
            return;
          }
        }
        if (parts[1] === 'revisions') {
          const revision = service.revision(parts[2]);
          if (parts.length === 3 && method === 'GET') {
            json(res, 200, revisions.detail(revision));
            return;
          }
          if (parts[3] === 'files' && method === 'GET') {
            const category = parts[4];
            const relative = parts.slice(5).join('/');
            sendFile(res, revisions.artifactFile(revision, category, relative));
            return;
          }
          if (parts[3] === 'export' && method === 'GET') {
            const zipPath = await exporter.zip(revision);
            res.setHeader(
              'Content-Disposition',
              `attachment; filename="${revision.id}.zip"; filename*=UTF-8''${encodeURIComponent(revision.title + '.zip')}`,
            );
            res.writeHead(200, { 'content-type': 'application/zip', 'content-length': fs.statSync(zipPath).size });
            fs.createReadStream(zipPath).pipe(res);
            return;
          }
        }
        json(res, 404, { error: '接口不存在' });
        return;
      }

      const target = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1);
      let file = safePath(staticRoot, target);
      if (!fs.existsSync(file) && !path.extname(target)) file = path.join(staticRoot, 'index.html');
      if (!fs.existsSync(file)) {
        json(res, 503, { error: '请先运行 npm run build 生成工作台界面' });
        return;
      }
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src 'self' " +
          options.previewOrigin() +
          "; connect-src 'self'; object-src 'none'; base-uri 'self'",
      );
      sendFile(res, file);
    })().catch(error => {
      if (!res.headersSent) json(res, 400, { error: error instanceof Error ? error.message : String(error) });
      else res.end();
    });
  };

  const previewHandler = (req: IncomingMessage, res: ServerResponse): void => {
    try {
      if (req.headers.host !== new URL(options.previewOrigin()).host) throw new Error('Invalid host');
      const url = new URL(req.url || '/', options.previewOrigin());
      const [, revisionId, ...parts] = url.pathname.split('/');
      if (revisionId === 'builtin-walls') {
        const gameRoot = path.resolve(options.root, '../beyond-the-walls/Beyond the wall');
        const name = decodeURIComponent(parts.join('/') || 'index.html');
        if (!/^(index\.html|favicon\.ico|(?:game|assets|shared|齿轮校准互动空间|整理图书互动空间|地下水管迷宫|一结局|音效|四张图片)\/)/u.test(name)) {
          throw new Error('非游戏资源');
        }
        res.setHeader('Content-Security-Policy', "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'self'; frame-ancestors " + frameAncestors(policy) + "; object-src 'none'; base-uri 'self'");
        sendFile(res, safePath(gameRoot, name));
        return;
      }
      if (!revisionId) {
        res.writeHead(404);
        res.end();
        return;
      }
      const revision = service.revision(revisionId);
      const name = parts.join('/') || 'index.html';
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors " +
          frameAncestors(policy) +
          "; object-src 'none'",
      );
      sendFile(res, safePath(revision.buildDir, decodeURIComponent(name)));
    } catch {
      res.writeHead(404);
      res.end('预览不存在');
    }
  };

  return {
    service,
    text,
    handoff,
    handler,
    previewHandler,
    close: async () => {
      handoff.close();
      service.store.emit('text-closing');
      await text.close();
      events.closeAll();
      await service.close();
    },
  };
}
