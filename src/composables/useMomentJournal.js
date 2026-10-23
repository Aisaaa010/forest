import { ref, computed, watch } from "vue";
import { scenes, phaseNames, weatherNames } from "../data/forest";

export function useMomentJournal(state, notify) {
  const moments = ref([]);
  const channelNames = ["wind", "birds", "water", "rain", "white", "pink", "brown", "fire", "ocean"];
  function normalizeMoment(moment) {
    if (
      !moment ||
      !scenes[moment.scene] ||
      !phaseNames[moment.phase] ||
      !weatherNames[moment.weather] ||
      !Number.isFinite(moment.created) ||
      typeof moment.id !== "string" ||
      !moment.id.trim()
    )
      return null;
    const normalized = {
      id: moment.id.slice(0, 100),
      scene: moment.scene,
      phase: moment.phase,
      weather: moment.weather,
      created: moment.created,
      note: typeof moment.note === "string" ? moment.note.slice(0, 300) : "",
    };
    if (Number.isFinite(moment.master))
      normalized.master = Math.min(100, Math.max(0, moment.master));
    if (
      moment.channels &&
      ["wind", "birds", "water", "rain"].every(
        (name) =>
          typeof moment.channels[name]?.enabled === "boolean" &&
          Number.isFinite(moment.channels[name]?.volume),
      )
    ) {
      normalized.channels = Object.fromEntries(
        channelNames.map((name) => [
          name,
          {
            enabled: moment.channels[name]?.enabled === true,
            volume: Number.isFinite(moment.channels[name]?.volume)
              ? Math.min(100, Math.max(0, moment.channels[name].volume))
              : 35,
          },
        ]),
      );
    }
    return normalized;
  }
  try {
    const stored = JSON.parse(localStorage.getItem("senjian-moments") || "[]");
    if (Array.isArray(stored))
      moments.value = stored.map(normalizeMoment).filter(Boolean).slice(0, 100);
  } catch {
    /* Keep the notebook usable when browser storage is unavailable. */
  }
  const currentMoment = computed(() =>
    moments.value.find(
      (m) =>
        m.scene === state.scene &&
        m.phase === state.phase &&
        m.weather === state.weather &&
        (!m.channels ||
          (m.master === state.master &&
            channelNames.every(
              (name) =>
                m.channels[name]?.enabled === state.channels[name].enabled &&
                m.channels[name]?.volume === state.channels[name].volume,
            ))),
    ),
  );
  watch(
    moments,
    (value) => {
      try {
        localStorage.setItem("senjian-moments", JSON.stringify(value));
      } catch {
        notify("浏览器未允许存储，拾光仅保留到本次页面关闭。");
      }
    },
    { deep: true },
  );
  function removeMoment(id) {
    moments.value = moments.value.filter((m) => m.id !== id);
  }
  function toggleMoment() {
    if (currentMoment.value) {
      removeMoment(currentMoment.value.id);
      notify("已从拾光中移除");
    } else {
      moments.value = [
        {
          id: crypto.randomUUID?.() || String(Date.now()),
          scene: state.scene,
          phase: state.phase,
          weather: state.weather,
          created: Date.now(),
          note: "",
          master: state.master,
          channels: Object.fromEntries(
            channelNames.map((name) => [name, { ...state.channels[name] }]),
          ),
        },
        ...moments.value,
      ].slice(0, 100);
      notify("这一刻，已收进你的拾光。");
    }
  }
  function updateNote(id, note) {
    const moment = moments.value.find((item) => item.id === id);
    if (moment) moment.note = String(note || "").slice(0, 300);
  }
  function exportMoments() {
    return JSON.stringify(
      {
        format: "senjian-moments",
        version: 1,
        exportedAt: new Date().toISOString(),
        moments: moments.value.map(normalizeMoment).filter(Boolean),
      },
      null,
      2,
    );
  }
  function importMoments(contents) {
    let parsed;
    try {
      parsed = JSON.parse(contents);
    } catch {
      return { ok: false, message: "文件不是有效的 JSON 备份。" };
    }
    const imported = Array.isArray(parsed)
      ? parsed
      : parsed?.format === "senjian-moments" && parsed.version === 1
        ? parsed.moments
        : null;
    if (!Array.isArray(imported) || imported.length > 1000)
      return { ok: false, message: "备份格式不受支持，或记录数量过多。" };
    const normalized = imported.map(normalizeMoment);
    if (normalized.some((item) => !item))
      return { ok: false, message: "备份中包含无效记录，未导入任何内容。" };
    const existingIds = new Set(moments.value.map((moment) => moment.id));
    const additions = normalized.filter((moment) => {
      if (existingIds.has(moment.id)) return false;
      existingIds.add(moment.id);
      return true;
    });
    const accepted = additions.slice(0, Math.max(0, 100 - moments.value.length));
    moments.value = [...accepted, ...moments.value];
    return { ok: true, imported: accepted.length };
  }
  const formatMoment = (m) =>
    `${phaseNames[m.phase]} · ${weatherNames[m.weather]} · ${new Date(m.created).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}`;
  const momentFilter = (m) =>
    m.phase === "night"
      ? "brightness(.3)"
      : m.weather === "snow"
        ? "brightness(1.05)"
        : m.weather === "rain"
          ? "brightness(.65)"
          : "";
  return {
    moments,
    currentMoment,
    removeMoment,
    toggleMoment,
    formatMoment,
    momentFilter,
    updateNote,
    exportMoments,
    importMoments,
  };
}
