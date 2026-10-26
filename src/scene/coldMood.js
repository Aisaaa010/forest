// Two deliberately distinct lighting recipes for the European cabin. Blue hour
// is pre-dawn: dim, cool, low contrast and almost no warm spill. Dusk is a low
// amber sun with a strong warm/cool split and bright windows.
export const ALPINE_MOODS = {
  morning: {
    ambient: { intensity: 0.26, color: 0x6b93c2, ground: 0x10263e },
    sun: { intensity: 0.5, color: 0xa8c9ff, x: 6, y: 6.4, z: -2.2 },
    fill: { intensity: 0.15, color: 0x426c9c },
    back: { intensity: 0.14, color: 0x355c8a },
    fog: { color: 0x0a2238, density: 0.013 },
    environment: 0.04,
    exposure: 0.84,
    window: { color: 0xffc98f, intensity: 0.55, factor: 0.32 },
    groundLight: 0.22,
    pool: 0.16,
    halo: 0.08,
  },
  afternoon: {
    ambient: { intensity: 0.42, color: 0xa38286, ground: 0x352e46 },
    sun: { intensity: 1.8, color: 0xffb36b, x: -5.8, y: 3.4, z: 4.8 },
    fill: { intensity: 0.28, color: 0x9c6f78 },
    back: { intensity: 0.3, color: 0xc98a6a },
    fog: { color: 0x4a3d52, density: 0.0105 },
    environment: 0.09,
    exposure: 1.0,
    window: { color: 0xffb45e, intensity: 1.45, factor: 1 },
    groundLight: 0.85,
    pool: 0.34,
    halo: 0.06,
  },
  night: {
    ambient: { intensity: 0.18, color: 0x5d7ba0, ground: 0x101f33 },
    sun: { intensity: 0.28, color: 0x9bb9db, x: -3, y: 6, z: -3 },
    fill: { intensity: 0.2, color: 0x4e7198 },
    back: { intensity: 0.16, color: 0x3f5b7a },
    fog: { color: 0x07182a, density: 0.011 },
    environment: 0.05,
    exposure: 0.82,
    window: { color: 0xffb45e, intensity: 1.6, factor: 0.82 },
    groundLight: 0.9,
    pool: 0.4,
    halo: 0.08,
  },
};

export const POLAR_MOOD = {
  ambient: { intensity: 0.12, color: 0x5d83aa, ground: 0x0d2034 },
  sun: { intensity: 0.22, color: 0x8fb6e8, x: -4, y: 7, z: -3 },
  fill: { intensity: 0.12, color: 0x42678e },
  back: { intensity: 0.1, color: 0x345674 },
  fog: { color: 0x03111d, density: 0.009 },
  environment: 0.03,
  exposure: 0.72,
  window: { color: 0xffc477, intensity: 1.9, factor: 0.9 },
  groundLight: 1.3,
  pool: 0.32,
  halo: 0.24,
};
