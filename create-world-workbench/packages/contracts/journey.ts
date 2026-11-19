export interface Journey {
  id: string;
  endingId?: string;
  steps: Array<
    | { action: 'assert'; condition: any }
    | { action: 'reload' }
    | { action: 'interact' | 'exit'; id: string }
    | { action: 'choice'; label: string }
    | {
        action: 'minigame';
        inputs: Array<
          | { type: 'cancel' }
          | { type: 'click'; label: string }
          | { type: 'key'; key: string; durationMs?: number }
          | { type: 'drag'; from: { x: number; y: number }; to: { x: number; y: number } }
        >;
      }
  >;
}
