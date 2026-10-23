import { computed, ref, watch } from "vue";

const STORAGE_KEY = "senjian-sound-presets";
const channelNames = [
  "wind",
  "birds",
  "water",
  "rain",
  "white",
  "pink",
  "brown",
  "fire",
  "ocean",
];
const channelDefaults = {
  white: { enabled: false, volume: 28 },
  pink: { enabled: false, volume: 34 },
  brown: { enabled: false, volume: 34 },
  fire: { enabled: false, volume: 32 },
  ocean: { enabled: false, volume: 36 },
};

export const builtInSoundPresets = [
  {
    id: "sleep",
    name: "雨夜入睡",
    master: 38,
    playing: true,
    channels: {
      wind: { enabled: true, volume: 28 },
      birds: { enabled: false, volume: 0 },
      water: { enabled: false, volume: 30 },
      rain: { enabled: true, volume: 48 },
      ...channelDefaults,
    },
  },
  {
    id: "reading",
    name: "林间阅读",
    master: 44,
    playing: true,
    channels: {
      wind: { enabled: true, volume: 38 },
      birds: { enabled: true, volume: 22 },
      water: { enabled: true, volume: 26 },
      rain: { enabled: false, volume: 30 },
      ...channelDefaults,
    },
  },
  {
    id: "morning",
    name: "清晨醒神",
    master: 54,
    playing: true,
    channels: {
      wind: { enabled: true, volume: 43 },
      birds: { enabled: true, volume: 52 },
      water: { enabled: true, volume: 34 },
      rain: { enabled: false, volume: 30 },
      ...channelDefaults,
    },
  },
];

function normalizePreset(value) {
  if (!(
    value &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    Number.isFinite(value.master) &&
    typeof value.playing === "boolean" &&
    value.channels &&
    ["wind", "birds", "water", "rain"].every(
      (name) =>
        typeof value.channels[name]?.enabled === "boolean" &&
        Number.isFinite(value.channels[name]?.volume),
    )
  )) {
    return null;
  }
  const channels = Object.fromEntries(
    channelNames.map((name) => {
      const saved = value.channels[name];
      const fallback = channelDefaults[name] || { enabled: false, volume: 35 };
      return [
        name,
        {
          enabled:
            typeof saved?.enabled === "boolean"
              ? saved.enabled
              : fallback.enabled,
          volume: Number.isFinite(saved?.volume)
            ? Math.min(100, Math.max(0, saved.volume))
            : fallback.volume,
        },
      ];
    }),
  );
  return {
    ...value,
    id: value.id.slice(0, 100),
    name: value.name.slice(0, 24),
    channels,
  };
}

export function useSoundPresets(state, toggleAudio, notify) {
  const customPresets = ref([]);
  const presetName = ref("");
  const editingPresetId = ref("");
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(saved))
      customPresets.value = saved.map(normalizePreset).filter(Boolean).slice(0, 20);
  } catch {
    customPresets.value = [];
  }

  const presets = computed(() => [...builtInSoundPresets, ...customPresets.value]);
  const activePresetId = computed(() => {
    const match = presets.value.find(
      (preset) =>
        preset.master === state.master &&
        preset.playing === state.playing &&
        channelNames.every(
          (name) =>
            preset.channels[name].enabled === state.channels[name].enabled &&
            preset.channels[name].volume === state.channels[name].volume,
        ),
    );
    return match?.id || "";
  });

  async function applyPreset(preset) {
    if (!preset) return;
    state.master = preset.master;
    for (const name of channelNames) {
      state.channels[name].enabled = preset.channels[name].enabled;
      state.channels[name].volume = preset.channels[name].volume;
    }
    editingPresetId.value = preset.id.startsWith("custom:") ? preset.id : "";
    presetName.value = editingPresetId.value ? preset.name : "";
    if (preset.playing !== state.playing) {
      const played = await toggleAudio();
      if (!played) return;
    }
    notify(`已切换到「${preset.name}」氛围。`);
  }

  function savePreset() {
    const name = presetName.value.trim().slice(0, 24);
    if (!name) {
      notify("先为自定义氛围填写一个名称。");
      return;
    }
    const preset = {
      id: `custom:${name}`,
      name,
      master: state.master,
      playing: state.playing,
      channels: Object.fromEntries(
        channelNames.map((channel) => [
          channel,
          { ...state.channels[channel] },
        ]),
      ),
    };
    const nextPresets = [...customPresets.value];
    const editingIndex = nextPresets.findIndex(
      (item) => item.id === editingPresetId.value,
    );
    if (editingIndex >= 0) nextPresets.splice(editingIndex, 1);
    const existing = nextPresets.findIndex((item) => item.id === preset.id);
    if (existing >= 0) nextPresets.splice(existing, 1, preset);
    else if (nextPresets.length >= 20) {
      notify("最多保存 20 个自定义氛围，请先删除一个。");
      return;
    } else nextPresets.push(preset);
    customPresets.value = nextPresets;
    editingPresetId.value = preset.id;
    notify(`已保存「${name}」氛围。`);
  }

  function removePreset(preset) {
    customPresets.value = customPresets.value.filter(
      (item) => item.id !== preset.id,
    );
    if (editingPresetId.value === preset.id) {
      editingPresetId.value = "";
      presetName.value = "";
    }
    notify(`已删除「${preset.name}」氛围。`);
  }

  watch(
    customPresets,
    (value) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch {
        notify("浏览器存储空间不足，自定义氛围未能保存。");
      }
    },
    { deep: true, flush: "sync" },
  );

  return {
    presets,
    customPresets,
    presetName,
    activePresetId,
    applyPreset,
    savePreset,
    removePreset,
  };
}
