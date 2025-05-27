// src/app/three/coinPresets.ts
// Defines presets for coin appearance and animations

export interface CoinPreset {
  geometry: {
    radiusTop: number;
    radiusBottom: number;
    height: number;
    radialSegments: number;
  };
  material: {
    color: number;
    metalness: number;
    roughness: number;
    envMapIntensity?: number;
  };
  animation: {
    type: 'spin' | 'bounce' | 'flip';
    speed?: number;           // rotation speed for spin/flip
    amplitude?: number;       // bounce amplitude
    frequency?: number;       // bounce frequency
  };
}

export const coinPresets: Record<string, CoinPreset> = {
  default: {
    geometry: { radiusTop: 1, radiusBottom: 1, height: 0.2, radialSegments: 32 },
    material: { color: 0xffd700, metalness: 1.0, roughness: 0.3 },
    animation: { type: 'spin', speed: 0.02 }
  },
  fastSpin: {
    geometry: { radiusTop: 1, radiusBottom: 1, height: 0.2, radialSegments: 32 },
    material: { color: 0xffd700, metalness: 0.8, roughness: 0.2 },
    animation: { type: 'spin', speed: 0.1 }
  },
  bounce: {
    geometry: { radiusTop: 1, radiusBottom: 1, height: 0.2, radialSegments: 32 },
    material: { color: 0x00ff99, metalness: 0.5, roughness: 0.4 },
    animation: { type: 'bounce', speed: 0.0, amplitude: 0.5, frequency: 2 }
  },
  flip: {
    geometry: { radiusTop: 1, radiusBottom: 1, height: 0.2, radialSegments: 32 },
    material: { color: 0x0099ff, metalness: 0.9, roughness: 0.1 },
    animation: { type: 'flip', speed: Math.PI * 2 } // one full flip per second
  }
};

export const presetNames = Object.keys(coinPresets);