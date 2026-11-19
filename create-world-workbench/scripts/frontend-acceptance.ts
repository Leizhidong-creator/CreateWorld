/** Real frontend + HTTP + SSE integration against an isolated local database.
 * Only expensive production launch is simulated; no Codex/image jobs are started.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { chromium } from 'playwright';
import { createWorkbenchApp } from '../apps/server/app.js';
import { browserExecutable } from '../packages/browser-runner/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(process.env.CW_FRONTEND_EVIDENCE || path.join(root, '../outputs/frontend-integration'));
await fs.mkdir(output, { recursive: true });
const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cw-frontend-integration-'));
let origin = '', previewOrigin = '';
const token = 'isolated-frontend-integration-token';
const app = createWorkbenchApp({ root, dataRoot, token, origin: () => origin, previewOrigin: () => previewOrigin, allowedOrigins: [] });
const server = http.createServer(app.handler), preview = http.createServer(app.previewHandler);
const listen = (target: http.Server) => new Promise<number>(resolve => target.listen(0, '127.0.0.1', () => resolve((target.address() as AddressInfo).port)));
origin = `http://127.0.0.1:${await listen(server)}`;
previewOrigin = `http://127.0.0.1:${await listen(preview)}`;
const browser = await chromium.launch({ headless: true, executablePath: browserExecutable() });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(12000);
const errors: string[] = [], failures: string[] = [], checks: string[] = [];
let streamResponses = 0, launchAttempts = 0, createdId = '';
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {
  const pathname = new URL(response.url()).pathname;
  if (pathname.endsWith('/events') && response.status() === 200) streamResponses++;
  if (response.status() >= 400 && !pathname.endsWith('/runs') && pathname !== '/api/bootstrap') failures.push(`${response.status()} ${response.url()}`);
});
await page.route('**/api/projects/*/runs', route => {
  if (route.request().method() !== 'POST') return route.continue();
  launchAttempts++;
  return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '回归测试：生产服务暂不可用' }) });
});
const sourceText = '这是前后端集成测试专用故事：旅人来到海边的小镇，寻找遗失的信件，帮助同伴，最终一起回家。';
async function api(pathname: string, body?: unknown, method = 'POST') {
  const response = await fetch(origin + pathname, body === undefined ? undefined : { method, headers: { 'content-type': 'application/json', 'x-csrf-token': token }, body: JSON.stringify(body) });
  assert.ok(response.ok, `${pathname}: ${response.status} ${await response.clone().text()}`);
  return response.json();
}
async function go(route: string) { await page.goto(origin + '/#' + route); await page.locator('.portal, .workbench').waitFor(); }
async function noOverflow() {
  const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(size.scroll <= size.width + 1, 'Horizontal overflow: ' + JSON.stringify(size));
}
try {
  const fixture = await api('/api/projects', { title: '前后端联调项目', inputKind: 'text', sourceText, requirements: '保留原作结局' });
  await go('/');
  await page.getByRole('heading', { name: '你的故事，世界的开始。' }).waitFor();
  await noOverflow();
  await page.screenshot({ path: path.join(output, 'home-desktop.png'), fullPage: true });
  assert.equal(await page.locator('a[href="#/login"], a[href="#/explore"]').count(), 0);
  assert.equal(await page.locator('link[rel="icon"]').getAttribute('href'), '/favicon.svg');
  await page.getByRole('button', { name: 'AI 润色', exact: true }).click();
  await page.getByRole('button', { name: '开始创造', exact: true }).waitFor();
  await page.locator('.site-nav').getByRole('link', { name: '游戏世界', exact: true }).click();
  await page.waitForURL(url => url.hash === '#/games');
  await page.locator('#market-discover').waitFor();
  await go('/?section=worlds');
  await page.waitForURL(url => url.hash === '#/games');
  checks.push('SVG图标、无登录与探索入口、AI润色、独立游戏世界和旧链接跳转');

  await go('/projects');
  await page.waitForURL(url => url.hash === '#/projects');
  await page.getByText(fixture.title, { exact: true }).waitFor();
  checks.push('无需登录直接访问项目列表和真实项目列表API');

  await go('/studio/' + fixture.id);
  await page.locator('.page-heading h1').filter({ hasText: fixture.title }).waitFor();
  await page.getByRole('button', { name: '试玩', exact: true }).click();
  await page.getByRole('button', { name: '查看故事材料', exact: true }).click();
  const sourceDialog = page.getByRole('dialog');
  await sourceDialog.getByLabel(/补充要求/).fill('联调已更新：复用已有技能，保留原作结局');
  await sourceDialog.getByRole('button', { name: '保存材料', exact: true }).click();
  await sourceDialog.waitFor({ state: 'hidden' });
  assert.equal((await api('/api/projects/' + fixture.id)).project.requirements, '联调已更新：复用已有技能，保留原作结局');
  checks.push('工作台真实bootstrap、项目详情、CSRF及PATCH材料保存');
  await page.screenshot({ path: path.join(output, 'workspace-desktop.png'), fullPage: true });

  await go('/studio/new');
  const createDialog = page.getByRole('dialog');
  await createDialog.getByRole('radio', { name: /使用我的文字材料/ }).check();
  await createDialog.getByPlaceholder('为这个游戏取个名字').fill('界面创建联调');
  await createDialog.getByPlaceholder('粘贴故事正文、剧本、梗概或字幕。保留章节和时间标记有助于追溯来源。').fill(sourceText);
  const createdResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/projects' && response.request().method() === 'POST');
  await createDialog.getByRole('button', { name: '创建并自动制作' }).click();
  const response = await createdResponse; assert.equal(response.status(), 201);
  createdId = (await response.json()).id;
  // 演示态（DEMO_MODE）下创建项目不会启动真实制作任务：既不请求 /runs，也不消耗模型额度。
  await page.getByText(/演示项目已创建/).waitFor();
  assert.equal(launchAttempts, 0);
  assert.equal((await api('/api/projects')).length, 2);
  assert.equal(app.service.store.list('run').length, 0);
  checks.push('界面创建真实项目；演示态不启动真实制作任务，不消耗模型额度');

  await go('/studio/new?sourceGameId=quiet-harbor');
  await page.getByRole('dialog').getByText('quiet-harbor', { exact: true }).waitFor();
  assert.match(await page.getByRole('dialog').getByPlaceholder('例如：侧重探索与人物关系，保留原作结局，适合手机横屏游玩。').inputValue(), /quiet-harbor/);
  await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
  checks.push('二创来源参数贯通Portal、App与创建表单');

  for (const route of ['/games', '/games/mine', '/publish']) {
    await go(route); await page.locator('.site-route-loading').waitFor({ state: 'hidden' }); await noOverflow();
  }
  checks.push('作品、本地游戏和草稿发布页面可打开');
  await go('/plugins');
  await page.getByRole('heading', { name: '让创作好游戏变得更简单' }).waitFor();
  await page.getByRole('textbox', { name: '搜索插件', exact: true }).fill('统一美术');
  assert.equal(await page.locator('.plugin-card').count(), 1);
  await page.getByRole('button', { name: '收藏统一美术风格', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: '我的收藏', exact: true }).click();
  assert.equal(await page.locator('.plugin-card').count(), 1);
  await page.getByRole('link', { name: '统一美术风格', exact: true }).click();
  await page.getByRole('link', { name: '基于此插件共创', exact: true }).click();
  await page.getByLabel('插件名称', { exact: true }).fill('合并回归共创插件');
  await page.getByLabel('作者 / 团队', { exact: true }).fill('回归测试');
  await page.getByLabel('许可信息', { exact: true }).fill('MIT');
  await page.getByLabel('本次修改说明', { exact: true }).fill('验证两分支整合后的投稿持久化');
  await page.getByLabel('插件文件', { exact: true }).setInputFiles({ name: 'skill.md', mimeType: 'text/markdown', buffer: Buffer.from('# Integration fixture') });
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '草稿与附件已保存' }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: '继续编辑', exact: true }).click();
  assert.equal(await page.getByLabel('插件名称', { exact: true }).inputValue(), '合并回归共创插件');
  await page.getByRole('button', { name: '提交到本地', exact: true }).click();
  await page.getByText('本地已提交 · 第 1 次', { exact: true }).waitFor();
  await page.getByRole('button', { name: '再次提交到本地', exact: true }).click();
  await page.getByText('本地已提交 · 第 2 次', { exact: true }).waitFor();
  checks.push('插件搜索、收藏持久化、详情到共创、附件草稿恢复与二次提交');
  await page.screenshot({ path: path.join(output, 'plugin-contribution-desktop.png'), fullPage: true });

  await go('/games/preview/harbor');
  await page.locator('.site-route-loading').waitFor({ state: 'hidden' });
  await page.locator('.demo-player').waitFor();
  // Export and publish use a real project in the isolated test database.
  await go('/export/' + fixture.id);
  await page.getByRole('heading', { name: fixture.title, exact: true }).waitFor();
  assert.equal(await page.locator('iframe[title="游戏试玩"], iframe[title="游戏自动演示"]').count(), 2);
  await page.frameLocator('iframe[title="游戏试玩"]').locator('body').waitFor();
  await page.frameLocator('iframe[title="游戏自动演示"]').locator('body').waitFor();
  await page.screenshot({ path: path.join(output, 'export-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: '一键上架到商城', exact: true }).click();
  await page.waitForURL(url => url.hash === '#/games');
  await page.locator('a[href="#/games/three-body-dark-forest"]').first().waitFor();
  await go('/games/three-body-dark-forest');
  await page.locator('a[href="#/export/' + fixture.id + '"]').first().waitFor();
  checks.push('无登录导出双iframe、本机上架、独立游戏世界与导出试玩链接贯通');

  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['/', '/games', '/plugins', '/plugins/contribute', '/export/' + fixture.id, '/projects', '/studio/' + fixture.id]) {
    await go(route); await page.locator('.site-route-loading').waitFor({ state: 'hidden' }); await noOverflow();
  }
  await page.screenshot({ path: path.join(output, 'workspace-mobile.png'), fullPage: true });
  checks.push('390px首页、游戏世界、插件市场、共创、导出、项目列表和工作台无横向溢出');

  await page.route('**/api/bootstrap', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '回归测试：服务暂不可用' }) }));
  await go('/studio/' + createdId);
  await page.getByRole('button', { name: '重新连接', exact: true }).waitFor();
  await page.unroute('**/api/bootstrap');
  await page.getByRole('button', { name: '重新连接', exact: true }).click();
  await page.locator('.page-heading h1').filter({ hasText: '界面创建联调' }).waitFor();
  checks.push('真实服务恢复后重新连接成功');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: '删除项目 ' + fixture.title, exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认删除', exact: true }).click();
  await page.getByRole('button', { name: '删除项目 ' + fixture.title, exact: true }).waitFor({ state: 'hidden' });
  assert.ok(!(await api('/api/projects')).some((project: {id: string}) => project.id === fixture.id));
  await go('/games');
  await page.locator('.market-feature-card').first().waitFor();
  assert.equal(await page.locator('a[href="#/games/three-body-dark-forest"]').count(), 0);
  checks.push('隔离测试项目删除成功，上架记录自动清理');
  await page.waitForTimeout(300);
  assert.ok(streamResponses > 0, 'No real SSE connection observed');
  assert.deepEqual(errors, []); assert.deepEqual(failures, []);
  checks.push('SSE真实连接，无浏览器异常或非预期HTTP错误');
  await fs.writeFile(path.join(output, 'acceptance.json'), JSON.stringify({ status: 'passed', scope: 'real isolated backend; only production-launch failure mocked', checks, errors, failures }, null, 2));
  console.log(JSON.stringify({ status: 'passed', checks, output }));
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
  await fs.writeFile(path.join(output, 'acceptance.json'), JSON.stringify({ status: 'failed', checks, error: String(error), errors, failures }, null, 2));
  throw error;
} finally {
  await browser.close();
  await app.close();
  await Promise.all([new Promise<void>(resolve => server.close(() => resolve())), new Promise<void>(resolve => preview.close(() => resolve()))]);
  assert.equal(path.resolve(path.dirname(dataRoot)).toLowerCase(), path.resolve(os.tmpdir()).toLowerCase());
  assert.ok(path.basename(dataRoot).startsWith('cw-frontend-integration-'));
  await fs.rm(dataRoot, { recursive: true, force: true });
}
