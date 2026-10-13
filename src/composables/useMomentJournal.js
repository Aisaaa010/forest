import { ref, computed, watch } from "vue";
import { scenes, phaseNames, weatherNames } from "../data/forest";

export function useMomentJournal(state, notify) {
  const moments = ref([]);
  try {
    const stored = JSON.parse(localStorage.getItem("senjian-moments") || "[]");
    if (Array.isArray(stored))
      moments.value = stored
        .filter(
          (m) =>
            m &&
            scenes[m.scene] &&
            phaseNames[m.phase] &&
            weatherNames[m.weather] &&
            Number.isFinite(m.created) &&
            typeof m.id === "string",
        )
        .slice(0, 100);
  } catch {
    /* Keep the notebook usable when browser storage is unavailable. */
  }
  const currentMoment = computed(() =>
    moments.value.find(
      (m) =>
        m.scene === state.scene &&
        m.phase === state.phase &&
        m.weather === state.weather,
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
        },
        ...moments.value,
      ].slice(0, 100);
      notify("这一刻，已收进你的拾光。");
    }
  }
  const formatMoment = (m) =>
    `${phaseNames[m.phase]} · ${weatherNames[m.weather]} · ${new Date(m.created).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}`;
  const momentFilter = (m) =>
    m.phase === "night"
      ? "brightness(.3)"
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
  };
}
