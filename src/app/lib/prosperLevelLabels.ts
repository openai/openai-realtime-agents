export const PROSPER_LEVEL_LABELS = [
  'Triage',        // L1
  'Surviving',     // L2
  'Steady',        // L3
  'Starter',       // L4
  'Buffer',        // L5
  'Builder',       // L6
  'Resilient',     // L7
  'Secure',        // L8
  'Work-Optional', // L9
  'Abundant',      // L10
] as const;

export type ProsperLevelCode = `L${1|2|3|4|5|6|7|8|9|10}`;

export function getProsperLevelLabel(level: string | number | undefined): string {
  // Accept 'L1'..'L10', or numeric values 1..10 (or 0..9 as index fallback)
  let levelNum: number | null = null;
  if (typeof level === 'string') {
    const m = level.match(/(\d{1,2})/);
    levelNum = m ? Number(m[1]) : null;
  } else if (typeof level === 'number') {
    levelNum = level;
  }
  if (levelNum == null || !Number.isFinite(levelNum)) return PROSPER_LEVEL_LABELS[0];
  // If passed as 0..9, treat as index; if 1..10, convert to index
  if (levelNum >= 1 && levelNum <= 10) return PROSPER_LEVEL_LABELS[levelNum - 1];
  if (levelNum >= 0 && levelNum <= 9) return PROSPER_LEVEL_LABELS[levelNum];
  return PROSPER_LEVEL_LABELS[Math.max(0, Math.min(9, Math.round(levelNum) - 1))];
}
