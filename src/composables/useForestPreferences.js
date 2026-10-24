import { onUnmounted, watch } from "vue";
import { scenes, phaseNames, weatherNames } from "../data/forest";

const STORAGE_KEY = "senjian-preferences";

const defaultChannels = {
  wind: { enabled: true, volume: 55 },
  birds: { enabled: true, volume: 40 },
  water: { enabled: false, volume: 35 },
  rain: { enabled: false, volume: 45 },
  white: { enabled: false, volume: 28 },
  pink: { enabled: false, volume: 34 },
  brown: { enabled: false, volume: 34 },
  fire: { enabled: false, volume: 32 },
  ocean: { enabled: false, volume: 36 },
};

const freshChannels = () =>
  Object.fromEntries(
    Object.entries(defaultChannels).map(([name, value]) => [name, { ...value }]),
  );

function clamp(value, min, max, fallback) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export function readForestPreferences() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {
      scene: "morning",
      phase: "morning",
      weather: "mist",
      master: 60,
      channels: freshChannels(),
      autoRoam: false,
      roamInterval: 3,
    };
  }

  const scene = scenes[saved.scene] ? saved.scene : "morning";
  const allowPhase = !scenes[scene].lockedPhase && phaseNames[saved.phase];
  const channels = Object.fromEntries(
    Object.entries(defaultChannels).map(([name, fallback]) => {
      const value = saved.channels?.[name];
      return [
        name,
        {
          enabled:
            typeof value?.enabled === "boolean" ? value.enabled : fallback.enabled,
          volume: clamp(value?.volume, 0, 100, fallback.volume),
        },
      ];
    }),
  );

  return {
    scene,
    phase: allowPhase ? saved.phase : scenes[scene].phase,
    weather: weatherNames[saved.weather] ? saved.weather : scenes[scene].weather,
    master: clamp(saved.master, 0, 100, 60),
    channels,
    autoRoam: saved.autoRoam === true,
    roamInterval: [2, 3, 5].includes(saved.roamInterval)
      ? saved.roamInterval
      : 3,
  };
}

export function useForestPreferences(state) {
  let saveTimer;

  function save() {
    clearTimeout(saveTimer);
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          scene: state.scene,
          phase: state.phase,
          weather: state.weather,
          master: state.master,
          channels: state.channels,
          autoRoam: state.autoRoam,
          roamInterval: state.roamInterval,
        }),
      );
    } catch {
      // The forest still works when browser storage is unavailable.
    }
  }

  watch(
    state,
    () => {
      clearTimeout(saveTimer);
      saveTimer = window.setTimeout(save, 180);
    },
    { deep: true },
  );
  window.addEventListener("pagehide", save);
  onUnmounted(() => {
    save();
    window.removeEventListener("pagehide", save);
  });
}
