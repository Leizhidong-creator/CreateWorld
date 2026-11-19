/** Shared validators and compatibility helpers; autonomous production has no stage scheduler. */
export {isSafeRelativeAssetPath,validateAssetPlan,validateJourneys,validMiniGameInputs,validateStageOutput,sourceBlockers,normalizeChange,classifyChange,computeAffectedStages} from './legacy-stage-adapter.js';
export type {ChangeInput,ChangeSet,ValidationResult} from './legacy-stage-adapter.js';
export const ADAPTER_VERSION='0.2.0-autonomous.1';
