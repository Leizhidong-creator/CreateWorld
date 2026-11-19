import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJson } from '../shared/files.js';
import { HOST_RECORD_FILE } from './workspace-layout.js';

const load = (file: string): any => (fs.existsSync(file) ? readJson(file) : null);

/** Durable build/review/session records for one revision. */
export class CandidateRecordStore {
  readonly root: string;
  latest: any;
  reviewed: any;
  session: any;

  constructor(root: string) {
    this.root = root;
    fs.mkdirSync(root, { recursive: true });
    this.latest = load(this.file(HOST_RECORD_FILE.build));
    this.reviewed = load(this.file(HOST_RECORD_FILE.review));
    this.session = load(this.file(HOST_RECORD_FILE.session)) || {};
  }

  file(name: string): string {
    return path.join(this.root, name);
  }

  saveBuild(value: any): void {
    this.latest = value;
    writeJson(this.file(HOST_RECORD_FILE.build), value);
  }

  saveReview(value: any): void {
    this.reviewed = value;
    writeJson(this.file(HOST_RECORD_FILE.review), value);
  }

  saveSession(value: any): void {
    this.session = value;
    writeJson(this.file(HOST_RECORD_FILE.session), value);
  }

  saveCheck(value: any): void {
    writeJson(this.file(HOST_RECORD_FILE.check), value);
  }
}
