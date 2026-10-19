import winterForestImageUrl from "../assets/winter-forest.png";

export const scenes = {
  morning: {
    title: "晨雾松林",
    subtitle: "光穿过树梢，森林刚刚醒来",
    kicker: "THE FOREST AWAKENS",
    description: "深呼吸。听见风，也听见自己。",
    phase: "morning",
    weather: "mist",
    position: "50% 50%",
  },
  rain: {
    title: "雨落青苔",
    subtitle: "听雨滴轻轻落进绿色里",
    kicker: "A SOFT RAIN, A QUIET MIND",
    description: "让雨声落下，把心事轻轻放下。",
    phase: "afternoon",
    weather: "rain",
    position: "30% 65%",
  },
  night: {
    title: "萤火之境",
    subtitle: "在静谧夜色里，遇见微光",
    kicker: "WHERE LITTLE LIGHTS WANDER",
    description: "世界安静下来，微光慢慢亮起。",
    phase: "night",
    weather: "clear",
    position: "70% 40%",
  },
  snow: {
    title: "雪落松林",
    subtitle: "看雪花慢慢落进安静的森林",
    kicker: "A QUIET WINTER IN THE WOODS",
    description: "围一围暖意，让雪替世界放慢脚步。",
    phase: "morning",
    weather: "snow",
    position: "50% 52%",
    imageUrl: winterForestImageUrl,
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
];
