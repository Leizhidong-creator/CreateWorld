/**
 * Machine-checkable production policy. Prompts, structural checks and evidence
 * checks read the same numbers so a threshold cannot drift between owners.
 */
export const PRODUCTION_POLICY = {
  fullGame: {
    minimumScenes: 5,
    targetMinutes: 10,
    maximumTurns: 12,
    maximumMinigames: 2,
  },
  sceneSlice: {
    maximumScenes: 1,
  },
  tools: {
    repeatedFailureLimit: 3,
  },
  review: {
    minimumScreenshots: 8,
  },
  codex: {
    hostToolTimeoutMs: 3_600_000,
    modelTimeoutMs: 1_800_000,
  },
} as const;
