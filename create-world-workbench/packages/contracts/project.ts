import { z } from 'zod';

/** Scope is a hard project input contract shared by the API, orchestrator and UI. */
export const projectScope = z
  .object({
    mode: z.enum(['full-game', 'scene-slice']).default('full-game'),
    sceneId: z.string().trim().min(1).max(80).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'scene-slice' && !value.sceneId) {
      ctx.addIssue({ code: 'custom', message: '场景切片必须指定 sceneId', path: ['sceneId'] });
    }
  });

export type ProjectScope = z.infer<typeof projectScope>;

export const projectInput = z
  .object({
    title: z.string().trim().min(1).max(180),
    inputKind: z.enum(['text', 'title']),
    sourceText: z.string().max(2_000_000).default(''),
    sourceFormat: z.enum(['plain-text', 'markdown', 'yaml']).optional().default('plain-text'),
    requirements: z.string().max(20000).default(''),
    scope: projectScope.optional().default({ mode: 'full-game' }),
    fileName: z.string().max(255).optional(),
  })
  .refine(value => value.inputKind === 'title' || value.sourceText.trim().length > 0, {
    message: '请填写故事材料',
  });

export interface ProjectInput {
  title: string;
  inputKind: 'text' | 'title';
  sourceText: string;
  requirements: string;
  sourceFormat?: 'plain-text' | 'markdown' | 'yaml';
  scope?: ProjectScope;
  fileName?: string;
}

export type Status =
  | 'queued'
  | 'running'
  | 'validating'
  | 'passed'
  | 'failed'
  | 'stale'
  | 'cancelled'
  | 'blocked';

export type StageId = 'source' | 'design' | 'content' | 'assets' | 'assembly' | 'review';
