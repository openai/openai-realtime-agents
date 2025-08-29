export const ENGINE_VERSION = (process.env.NEXT_PUBLIC_PROSPER_ENGINE || process.env.PROSPER_ENGINE || "v1").toLowerCase();

export const DEFAULTS = {
  growth_real: 0.03, // g_real
  swr_real: 0.04,    // swr
} as const;

