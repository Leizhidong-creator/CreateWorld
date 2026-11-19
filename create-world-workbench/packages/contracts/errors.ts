export class BlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlockedError';
  }
}

export class CancelledError extends Error {
  constructor() {
    super('制作已停止，已验证的结果已保留，可继续。');
    this.name = 'CancelledError';
  }
}

/** A missing preparatory step is actionable feedback, not a repeated execution failure. */
export class ToolPreconditionError extends Error {
  constructor(message: string) { super(message); this.name = 'ToolPreconditionError'; }
}
