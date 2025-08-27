export const PROSPER_LEVEL_LABELS = [
  "Needs help",
  "Getting started",
  "Building basics",
  "Finding stability",
  "Gaining momentum",
  "On track",
  "Growing strong",
  "Wealth builder",
  "Almost there",
  "Financial freedom",
] as const;

export type ProsperLevelCode = `L${0|1|2|3|4|5|6|7|8|9}`;

export function getProsperLevelLabel(level: string | number | undefined): string {
  let idx: number = 0;
  if (typeof level === "string") {
    const m = level.match(/L?(\d)/i);
    idx = m ? Number(m[1]) : 0;
  } else if (typeof level === "number") {
    idx = level;
  }
  idx = Math.max(0, Math.min(9, idx));
  return PROSPER_LEVEL_LABELS[idx];
}

