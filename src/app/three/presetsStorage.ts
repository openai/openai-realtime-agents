// src/app/three/presetsStorage.ts
import { CoinPreset, coinPresets } from './coinPresets';

const STORAGE_KEY = 'coin_presets';

/**
 * Load user-defined presets from localStorage and merge with defaults.
 */
export function loadPresets(): Record<string, CoinPreset> {
  let user: Record<string, CoinPreset> = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      user = JSON.parse(raw);
    }
  } catch {
    console.warn('Failed to parse user presets');
  }
  return { ...coinPresets, ...user };
}

/**
 * Save only user-defined presets (non-default) to localStorage.
 */
export function saveUserPresets(all: Record<string, CoinPreset>): void {
  // strip defaults
  const user: Record<string, CoinPreset> = {};
  for (const key in all) {
    if (!coinPresets[key]) {
      user[key] = all[key];
    }
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    console.warn('Failed to save user presets');
  }
}