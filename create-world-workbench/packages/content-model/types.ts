/**
 * Typed model for the 2D pixel story content YAML.
 *
 * The YAML is the authoring format. This package turns it into a stable,
 * queryable entity index and then into a scene slice. A slice is a view over
 * the authoritative document, never a second source of truth.
 */

export type EntityType =
  | 'scene'
  | 'character'
  | 'object'
  | 'information'
  | 'state'
  | 'rule'
  | 'sound'
  | 'mechanic'
  | 'event'
  | 'checkpoint'
  | 'ending'
  | 'collectible'
  | 'source'
  | 'design'
  | 'decision';

/** What a reference points at. `player` is a pseudo-entity and is not indexed. */
export type RefRole = EntityType | 'player' | 'unknown';

export type RefKind =
  | 'reference'
  | 'condition'
  | 'next'
  | 'exit'
  | 'change'
  | 'source'
  | 'design'
  | 'entry';

export interface ContentRef {
  id: string;
  role: RefRole;
  kind: RefKind;
  /** Field path that produced the reference, for diagnostics. */
  via: string;
}

export interface ContentEntity {
  id: string;
  type: EntityType;
  subtype?: string;
  name: string;
  data: Record<string, any>;
  refs: ContentRef[];
  hash: string;
}

export interface IncomingRef {
  from: string;
  ref: ContentRef;
}

export interface ContentDocument {
  specVersion: string;
  sourcePath: string;
  sourceHash: string;
  text: string;
  chars: number;
  lines: number;
  raw: Record<string, any>;
  entities: ContentEntity[];
  byId: Map<string, ContentEntity>;
  incoming: Map<string, IncomingRef[]>;
  mainline: string[];
  warnings: string[];
}

export interface SceneSliceRequest {
  sceneId: string;
  /** Optional explicit window start. Defaults to the first mainline event in the scene. */
  entryEventId?: string;
  /** Optional explicit window end. Defaults to the last event before the scene exit. */
  boundaryEventId?: string;
  /** Synthetic terminal ending used to close the slice. */
  endingId?: string;
}

export interface SliceBoundary {
  sceneId: string;
  eventId: string;
  mode: 'ending';
  endingId: string;
  label: string;
  note: string;
}

export interface SliceReference {
  id: string;
  type: RefRole;
  name?: string;
  reason: string;
}

export interface SliceEntry {
  mode: 'runtime-title' | 'scene' | 'prior-summary';
  eventId: string;
  sceneId: string;
  /** Full record of the entry event, so the agent does not need to query it. */
  payload?: Record<string, any>;
}

export interface SliceAcceptance {
  startScene: string;
  boundaryEventId: string;
  boundaryEndingId: string;
  minScenes: number;
  maxScenes: number;
  minigamesRequired: boolean;
  saveReload: true;
  noOutOfSliceRefs: true;
}

export interface SliceMetrics {
  fullChars: number;
  sliceChars: number;
  ratio: number;
  /** Character based estimate; not a tokenizer measurement. */
  tokenEstimate: number;
  includedEntities: number;
  referencedEntities: number;
}

export interface SceneSlice {
  schemaVersion: 1;
  specVersion: string;
  sceneId: string;
  source: {
    path: string;
    sha256: string;
    chars: number;
    lines: number;
  };
  entry: SliceEntry;
  events: string[];
  included: Record<EntityType, string[]>;
  includedIds: string[];
  referenced: SliceReference[];
  absent: SliceReference[];
  boundary: SliceBoundary;
  acceptance: SliceAcceptance;
  document: Record<string, any>;
  brief: string;
  metrics: SliceMetrics;
  hashes: {
    slice: string;
    entities: Record<string, string>;
  };
  warnings: string[];
}

/** What is persisted to slice.json; the rendered YAML and Markdown are separate files. */
export interface SliceRecord extends Omit<SceneSlice, 'document' | 'brief'> {}

export interface SliceValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
