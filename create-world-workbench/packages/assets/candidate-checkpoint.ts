import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Json = Record<string, any>;
export interface CandidateCheckpoint {
  identity: { id: string; kind: string; path: string; width: number; height: number };
  artFingerprint: string;
  record: Json;
  nativeEvidence: Json;
}

/** Saves native provenance before downstream QA, so geometry/review repairs need no new image. */
export class CandidateCheckpoints {
  constructor(private readonly root: string, private readonly workspace: string) {}
  private filename(candidate: string) {
    const key = createHash('sha256').update(JSON.stringify([path.resolve(this.workspace).toLowerCase(), candidate.replaceAll('\\', '/').toLowerCase()])).digest('hex');
    return path.join(this.root, 'candidate-checkpoints', key + '.json');
  }
  async save(candidate: string, checkpoint: CandidateCheckpoint) {
    const filename = this.filename(candidate);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, JSON.stringify(checkpoint, null, 2) + '\n');
  }
  async read(candidate: string): Promise<CandidateCheckpoint> { return JSON.parse(await readFile(this.filename(candidate), 'utf8')); }
}
