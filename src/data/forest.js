export const scenes = {
  morning: {
    title: "晨雾松林",
    subtitle: "光穿过树梢，森林刚刚醒来",
    kicker: "THE FOREST AWAKENS",
    description: "深呼吸。听见风，也听见自己。",
    phase: "morning",
    weather: "mist",
    view: { yaw: 0.58, pitch: 0.36, zoom: 1.03, targetY: 0.38, yawRange: 2.6, minPitch: 0.22, maxPitch: 0.82 },
  },
  rain: {
    title: "雨落青苔",
    subtitle: "听雨滴轻轻落进绿色里",
    kicker: "A SOFT RAIN, A QUIET MIND",
    description: "让雨声落下，把心事轻轻放下。",
    phase: "afternoon",
    weather: "rain",
    view: { yaw: 0.48, pitch: 0.4, zoom: 1.02, targetY: 0.32, yawRange: 2.6, minPitch: 0.2, maxPitch: 0.78 },
  },
  night: {
    title: "萤火之境",
    subtitle: "在静谧夜色里，遇见微光",
    kicker: "WHERE LITTLE LIGHTS WANDER",
    description: "世界安静下来，微光慢慢亮起。",
    phase: "night",
    weather: "clear",
    view: { yaw: 0.42, pitch: 0.34, zoom: 1.05, targetY: 0.36, yawRange: 2.6, minPitch: 0.2, maxPitch: 0.8 },
  },
  snow: {
    title: "雪落松林",
    subtitle: "看雪花慢慢落进安静的森林",
    kicker: "A QUIET WINTER IN THE WOODS",
    description: "围一围暖意，让雪替世界放慢脚步。",
    phase: "morning",
    weather: "snow",
    view: { yaw: 0.55, pitch: 0.35, zoom: 1.04, targetY: 0.38, yawRange: 2.6, minPitch: 0.2, maxPitch: 0.8 },
  },
  alpine: {
    title: "雪境木屋",
    subtitle: "雪落在屋檐上，屋里亮着一盏灯",
    kicker: "A CABIN IN THE SNOW",
    description: "把脚步放慢，听雪落在木屋和松枝上。",
    phase: "afternoon",
    weather: "snow",
    conditions: {
      morning: "蓝调清晨 · 飘雪",
      afternoon: "黄昏 · 飘雪",
      night: "夜晚灯火 · 飘雪",
    },
    phaseLabels: { morning: "蓝调清晨", afternoon: "黄昏暖窗", night: "夜晚灯火" },
    icon: "cabin",
    biome: "alpine",
    view: { yaw: 0.34, pitch: 0.22, zoom: 1.0, targetY: 0.46, yawRange: 0.55, minPitch: 0.16, maxPitch: 0.5 },
  },
  aurora: {
    title: "极光冰原",
    subtitle: "冰川尽头，木屋亮着一盏灯",
    kicker: "LIGHTS OVER THE ICE",
    description: "在极夜的冰原上，等一束光慢慢落下。",
    phase: "night",
    weather: "clear",
    conditions: { night: "极夜 · 极光" },
    phaseLabels: { night: "极夜" },
    lockedPhase: true,
    icon: "aurora",
    biome: "antarctic",
    view: { yaw: -0.26, pitch: 0.13, zoom: 1.0, targetY: 0.45, yawRange: 0.5, minPitch: 0.1, maxPitch: 0.42 },
  },
};

export const phaseNames = { morning: "晨间", afternoon: "午后", night: "夜晚" };

export const weatherNames = {
  clear: "晴朗",
  mist: "薄雾",
  rain: "小雨",
  snow: "飘雪",
};

export const phaseOptions = [
  { value: "morning", label: "晨光", icon: "sun" },
  { value: "afternoon", label: "午后" },
  { value: "night", label: "夜晚", icon: "moon" },
];

export const weatherOptions = [
  { value: "clear", label: "晴朗" },
  { value: "mist", label: "薄雾" },
  { value: "rain", label: "小雨", icon: "rain" },
  { value: "snow", label: "雪景", icon: "snow" },
];

export const soundOptions = [
  { value: "wind", label: "林间微风", icon: "wind" },
  { value: "birds", label: "远处鸟鸣", icon: "bird" },
  { value: "water", label: "潺潺溪流", icon: "water" },
  { value: "rain", label: "叶上雨滴", icon: "rain" },
  { value: "white", label: "白噪音", icon: "water" },
  { value: "pink", label: "粉红噪音", icon: "wind" },
  { value: "brown", label: "棕色噪音", icon: "wind" },
  { value: "fire", label: "炉火轻响", icon: "fire" },
  { value: "ocean", label: "远岸潮声", icon: "water" },
];
