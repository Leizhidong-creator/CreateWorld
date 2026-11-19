import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { Revision } from '../../../packages/contracts/index.js';
import { exportFile } from '../../../packages/orchestrator/workspace-layout.js';
import type { Workbench } from '../../../packages/orchestrator/service.js';

/** Export is a host-owned application service, not an HTTP route detail. */
export class RevisionExportService {
  constructor(
    private readonly workbench: Workbench,
    private readonly root: string,
    private readonly dataRoot: string,
  ) {}

  async zip(revision: Revision): Promise<string> {
    if (revision.status !== 'accepted') throw new Error('只有通过验收的版本可以导出');
    await this.workbench.verifyRevision(revision);
    const exportDir = path.join(this.dataRoot, 'exports');
    fs.mkdirSync(exportDir, { recursive: true });
    const zipPath = exportFile(this.dataRoot, revision.id);
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.env.CW_PYTHON || 'python3', [path.join(this.root, 'scripts', 'export.py'), revision.buildDir, zipPath], {
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      let error = '';
      child.stderr.on('data', data => (error += data));
      child.on('error', reject);
      child.on('exit', code => (code === 0 ? resolve() : reject(new Error(error))));
    });
    return zipPath;
  }
}
