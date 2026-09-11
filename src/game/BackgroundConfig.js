/**
 * BackgroundConfig
 *
 * Configures the 6 original arcade stage environments:
 * - Cosmic Astral (Deep blue / cosmic arcade atmosphere)
 * - Sunset Pagoda (Warm orange / sunset pagoda atmosphere)
 * - Mystic Cavern (Teal / mysterious cavern atmosphere)
 * - Volcanic Magma (Dark volcanic / energetic environment)
 * - Sky Temple (Bright sky / fantasy atmosphere)
 * - Neon Cyber (Purple / futuristic neon arcade atmosphere)
 *
 * Each stage defines:
 * - image: URL to high-resolution cropped artwork
 * - colors: primary, accent, ambient glow pools, matched particle colors
 * - atmospheric haze, vignette depth, and clarity contrast tuning
 *
 * Zero emojis.
 */

export const BACKGROUND_IDS = Object.freeze({
  COSMIC: 'cosmic',
  SUNSET: 'sunset',
  MYSTIC: 'mystic',
  VOLCANIC: 'volcanic',
  SKY: 'sky',
  NEON: 'neon',
});

export const RANDOM_STAGE_ID = 'random';
export const DEFAULT_BACKGROUND_ID = BACKGROUND_IDS.COSMIC;

export const BACKGROUND_CONFIGS = Object.freeze({
  [BACKGROUND_IDS.COSMIC]: Object.freeze({
    id: BACKGROUND_IDS.COSMIC,
    name: 'Cosmic Astral',
    tagline: 'Celestial rings & astral nebula',
    image: '/backgrounds/bg_cosmic.png',
    primaryColor: '#38BDF8',
    accentColor: '#A855F7',
    glow1: { r: 56, g: 189, b: 248, a: 0.12 },
    glow2: { r: 168, g: 85, b: 247, a: 0.10 },
    particleColors: [
      { r: 56, g: 189, b: 248 },
      { r: 168, g: 85, b: 247 },
      { r: 192, g: 132, b: 252 },
      { r: 255, g: 255, b: 255 },
    ],
    hazeRgb: { r: 6, g: 10, b: 25 },
    vignetteStrength: 0.70,
    clarityMaskStrength: 0.25,
  }),

  [BACKGROUND_IDS.SUNSET]: Object.freeze({
    id: BACKGROUND_IDS.SUNSET,
    name: 'Sunset Pagoda',
    tagline: 'Evening lanterns & cherry blossom horizon',
    image: '/backgrounds/bg_sunset.png',
    primaryColor: '#F97316',
    accentColor: '#EF4444',
    glow1: { r: 249, g: 115, b: 22, a: 0.13 },
    glow2: { r: 239, g: 68, b: 68, a: 0.09 },
    particleColors: [
      { r: 251, g: 146, b: 60 },
      { r: 249, g: 115, b: 22 },
      { r: 252, g: 211, b: 77 },
      { r: 254, g: 243, b: 199 },
    ],
    hazeRgb: { r: 28, g: 10, b: 6 },
    vignetteStrength: 0.68,
    clarityMaskStrength: 0.28,
  }),

  [BACKGROUND_IDS.MYSTIC]: Object.freeze({
    id: BACKGROUND_IDS.MYSTIC,
    name: 'Mystic Cavern',
    tagline: 'Bioluminescent moss & hanging cavern flora',
    image: '/backgrounds/bg_mystic.png',
    primaryColor: '#10B981',
    accentColor: '#06B6D4',
    glow1: { r: 16, g: 185, b: 129, a: 0.12 },
    glow2: { r: 6, g: 182, b: 212, a: 0.10 },
    particleColors: [
      { r: 52, g: 211, b: 153 },
      { r: 6, g: 182, b: 212 },
      { r: 167, g: 243, b: 208 },
      { r: 255, g: 255, b: 255 },
    ],
    hazeRgb: { r: 4, g: 20, b: 16 },
    vignetteStrength: 0.72,
    clarityMaskStrength: 0.26,
  }),

  [BACKGROUND_IDS.VOLCANIC]: Object.freeze({
    id: BACKGROUND_IDS.VOLCANIC,
    name: 'Volcanic Magma',
    tagline: 'Obsidian crags & fiery molten rivers',
    image: '/backgrounds/bg_volcanic.png',
    primaryColor: '#EF4444',
    accentColor: '#F59E0B',
    glow1: { r: 239, g: 68, b: 68, a: 0.14 },
    glow2: { r: 245, g: 158, b: 11, a: 0.11 },
    particleColors: [
      { r: 239, g: 68, b: 68 },
      { r: 245, g: 158, b: 11 },
      { r: 251, g: 191, b: 36 },
      { r: 255, g: 237, b: 213 },
    ],
    hazeRgb: { r: 25, g: 6, b: 6 },
    vignetteStrength: 0.75,
    clarityMaskStrength: 0.30,
  }),

  [BACKGROUND_IDS.SKY]: Object.freeze({
    id: BACKGROUND_IDS.SKY,
    name: 'Sky Temple',
    tagline: 'Floating isles & sunlit azure ruins',
    image: '/backgrounds/bg_sky.png',
    primaryColor: '#0EA5E9',
    accentColor: '#38BDF8',
    glow1: { r: 14, g: 165, b: 233, a: 0.12 },
    glow2: { r: 56, g: 189, b: 248, a: 0.10 },
    particleColors: [
      { r: 56, g: 189, b: 248 },
      { r: 125, g: 211, b: 252 },
      { r: 253, g: 230, b: 138 },
      { r: 255, g: 255, b: 255 },
    ],
    hazeRgb: { r: 8, g: 20, b: 32 },
    vignetteStrength: 0.65,
    clarityMaskStrength: 0.24,
  }),

  [BACKGROUND_IDS.NEON]: Object.freeze({
    id: BACKGROUND_IDS.NEON,
    name: 'Neon Cyber',
    tagline: 'Futuristic synth grid & hyper-speed vortex',
    image: '/backgrounds/bg_neon.png',
    primaryColor: '#A855F7',
    accentColor: '#EC4899',
    glow1: { r: 168, g: 85, b: 247, a: 0.13 },
    glow2: { r: 236, g: 72, b: 153, a: 0.11 },
    particleColors: [
      { r: 168, g: 85, b: 247 },
      { r: 236, g: 72, b: 153 },
      { r: 56, g: 189, b: 248 },
      { r: 255, g: 255, b: 255 },
    ],
    hazeRgb: { r: 18, g: 6, b: 28 },
    vignetteStrength: 0.72,
    clarityMaskStrength: 0.26,
  }),
});

export const BACKGROUND_LIST = Object.freeze(Object.values(BACKGROUND_CONFIGS));

/**
 * Returns stage config for given ID. Defaults to Cosmic Astral if not found.
 */
export function getBackgroundConfig(stageId) {
  if (stageId && BACKGROUND_CONFIGS[stageId]) {
    return BACKGROUND_CONFIGS[stageId];
  }
  return BACKGROUND_CONFIGS[DEFAULT_BACKGROUND_ID];
}

/**
 * Returns a random stage ID from the 6 stage environments.
 */
export function getRandomBackgroundId() {
  const ids = Object.values(BACKGROUND_IDS);
  const randomIndex = Math.floor(Math.random() * ids.length);
  return ids[randomIndex];
}
