<script setup>
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
} from "vue";
import IconSprite from "./components/IconSprite.vue";
import ForestIcon from "./components/ForestIcon.vue";
import ForestDialog from "./components/ForestDialog.vue";
import {
  scenes,
  phaseNames,
  weatherNames,
  phaseOptions,
  weatherOptions,
  soundOptions,
} from "./data/forest";
import { useForestAudio } from "./composables/useForestAudio";
import { useForestScene3D } from "./composables/useForestScene3D";
import { useSoundPresets } from "./composables/useSoundPresets";
import { useMomentJournal } from "./composables/useMomentJournal";
import { useBreathing } from "./composables/useBreathing";
import { usePostcard } from "./composables/usePostcard";
import {
  readForestPreferences,
  useForestPreferences,
} from "./composables/useForestPreferences";

const savedPreferences = readForestPreferences();
const state = reactive({
  ...savedPreferences,
  playing: false,
  threeAvailable: false,
});
useForestPreferences(state);
const scene = computed(() => scenes[state.scene]);
const sceneEntries = computed(() =>
  Object.entries(scenes).map(([key, item], index) => ({
    key,
    title: item.title,
    number: String(index + 1).padStart(2, "0"),
  })),
);
const currentSceneNumber = computed(
  () => String(Object.keys(scenes).indexOf(state.scene) + 1).padStart(2, "0"),
);
const observationPrompts = {
  morning: [
    "找一束穿过薄雾的光，跟着它慢慢看一会儿。",
    "看看画面里哪里最亮，哪里最安静。",
    "留意树影和小径交界的地方，看看有什么细节。",
  ],
  rain: [
    "找一滴落在苔藓边的雨，看看涟漪如何慢慢散开。",
    "听一听远处和近处的雨声，有什么不同？",
    "在湿润的绿色里，找到一处最柔软的颜色。",
  ],
  night: [
    "跟着一团萤火看它停留，再看它远去。",
    "让目光慢慢适应夜色，找一处微光。",
    "看看森林里最深的阴影旁边，有什么正在发亮。",
  ],
  snow: [
    "看一片雪花落下，感受森林的边缘慢慢柔和起来。",
    "找一处雪落在枝叶上的地方，停留几次呼吸。",
    "看看雪地里最浅和最深的颜色，慢慢分辨它们。",
  ],
  alpine: [
    "从木屋的窗光开始，慢慢看到屋檐上的积雪。",
    "听雪落在屋顶和松枝上，闻一闻木柴和冷空气的味道。",
    "找一找从木屋到冰湖的那条小路，跟着它走一遍。",
  ],
  aurora: [
    "先看冰面，再看极光，比较两种绿色有什么不同。",
    "留意木屋窗光和极光谁更亮，它们之间隔着什么。",
    "在极夜里找一处最暗的地方，等眼睛慢慢适应。",
  ],
};
const roamScenes = ["morning", "rain", "snow", "night", "alpine", "aurora"];
const activePhaseOptions = computed(() =>
  phaseOptions.map((option) => ({
    ...option,
    label: scene.value.phaseLabels?.[option.value] || option.label,
    disabled: scene.value.lockedPhase && option.value !== "night",
  })),
);
const weatherIcon = computed(() => {
  if (state.scene === "aurora") return "aurora";
  if (state.scene === "alpine") {
    if (state.phase === "morning") return "sun";
    if (state.phase === "night") return "moon";
    return "snow";
  }
  return state.weather === "snow"
    ? "snow"
    : state.weather === "rain"
      ? "rain"
      : state.phase === "night"
        ? "moon"
        : "sun";
});
const conditionText = computed(
  () => scene.value.conditions?.[state.phase] || `${phaseNames[state.phase]} · ${weatherNames[state.weather]}`,
);
const interactionHint = computed(() => {
  if (state.scene === "alpine") return "点木屋近看细节；轻触窗、烟囱、火堆或灯串";
  if (state.scene === "aurora") return "点冰墙或科考屋近看；轻触极光触发回应";
  return "点花、树、溪流或雪人近看细节；轻触发现回应";
});
const forestView = ref(null),
  threeCanvas = ref(null),
  mainElement = ref(null);
const immersiveButton = ref(null),
  leaveImmersiveButton = ref(null);
const immersed = ref(false),
  observationOpen = ref(false),
  observationPromptIndex = ref(0),
  breathOpen = ref(false),
  journalOpen = ref(false),
  aboutOpen = ref(false);
const settingsOpen = ref(false);
const sceneMenuOpen = ref(false);
const sceneIcons = { morning: "sun", rain: "rain", night: "moon", snow: "snow", alpine: "cabin", aurora: "aurora" };
const toastMessage = ref(""),
  toastVisible = ref(false);
const journalQuery = ref("");
const journalSceneFilter = ref("all");
const journalFileInput = ref(null);
const focusDuration = ref(10);
const focusRemaining = ref(0);
const focusRunning = ref(false);
const focusPulse = ref(false);
const sleepDuration = ref(30);
const sleepCustomDuration = ref(30);
const sleepRemaining = ref(0);
const sleepRunning = ref(false);
const sleepFinished = ref(false);
let toastTimer, roamTimer, focusTimer, focusPulseTimer, sleepTimer;
const observationPrompt = computed(
  () => observationPrompts[state.scene][observationPromptIndex.value],
);
const focusTimeLabel = computed(() => {
  const seconds = focusRemaining.value || focusDuration.value * 60;
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
});
const sleepTimeLabel = computed(() => {
  const seconds = sleepRemaining.value || (sleepFinished.value ? 0 : sleepDuration.value * 60);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
});
function notify(message) {
  toastMessage.value = message;
  toastVisible.value = true;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastVisible.value = false;
  }, 3200);
}
const {
  moments,
  currentMoment,
  toggleMoment,
  removeMoment,
  formatMoment,
  momentFilter,
  updateNote,
  exportMoments,
  importMoments,
} = useMomentJournal(state, notify);
const filteredMoments = computed(() => {
  const query = journalQuery.value.trim().toLocaleLowerCase("zh-CN");
  return moments.value.filter((moment) => {
    const matchesScene =
      journalSceneFilter.value === "all" ||
      moment.scene === journalSceneFilter.value;
    const matchesQuery =
      !query ||
      `${scenes[moment.scene].title} ${moment.note || ""} ${formatMoment(moment)}`
        .toLocaleLowerCase("zh-CN")
        .includes(query);
    return matchesScene && matchesQuery;
  });
});
const { toggleAudio, setSleepFade } = useForestAudio(state, notify);
const {
  presets: soundPresets,
  customPresets,
  presetName,
  activePresetId,
  applyPreset,
  savePreset,
  removePreset,
} = useSoundPresets(state, toggleAudio, notify);
const {
  focused,
  focusLabel,
  exploreTargets,
  focusTarget,
  resetView,
  hoverName,
  hoverX,
  hoverY,
} = useForestScene3D(threeCanvas, forestView, state, notify);
const { saving, downloadPostcard } = usePostcard(threeCanvas, state, notify);
const {
  duration,
  running,
  phase: breathPhase,
  cue,
  count,
  reset: resetBreath,
  toggle: toggleBreath,
} = useBreathing(notify);

function selectScene(name, saved) {
  const selected = scenes[name];
  if (!selected) return;
  sceneMenuOpen.value = false;
  state.scene = name;
  state.phase = saved?.phase || selected.phase;
  state.weather = saved?.weather || selected.weather;
  state.channels.rain.enabled = state.weather === "rain";
  state.channels.birds.enabled = state.phase !== "night";
}
function openObservation() {
  const prompts = observationPrompts[state.scene];
  observationPromptIndex.value = Math.floor(Math.random() * prompts.length);
  observationOpen.value = true;
}
function changeObservationPrompt() {
  const prompts = observationPrompts[state.scene];
  if (prompts.length < 2) return;
  let next = observationPromptIndex.value;
  while (next === observationPromptIndex.value)
    next = Math.floor(Math.random() * prompts.length);
  observationPromptIndex.value = next;
}
function advanceForest() {
  if (
    document.hidden ||
    immersed.value ||
    observationOpen.value ||
    breathOpen.value ||
    journalOpen.value ||
    aboutOpen.value ||
    focusRunning.value
  )
    return;
  const index = roamScenes.indexOf(state.scene);
  selectScene(roamScenes[(index + 1 + roamScenes.length) % roamScenes.length]);
}
function setFocusDuration(minutes) {
  if (focusRunning.value) return;
  focusDuration.value = minutes;
  focusRemaining.value = 0;
}
function stopFocus(reset = false) {
  clearInterval(focusTimer);
  focusTimer = undefined;
  focusRunning.value = false;
  if (reset) focusRemaining.value = 0;
}
function toggleFocus() {
  if (focusRunning.value) {
    stopFocus();
    return;
  }
  if (!focusRemaining.value) focusRemaining.value = focusDuration.value * 60;
  focusRunning.value = true;
  focusTimer = window.setInterval(() => {
    focusRemaining.value = Math.max(0, focusRemaining.value - 1);
    if (focusRemaining.value === 0) {
      stopFocus();
      focusPulse.value = true;
      notify("这段安静时间结束了。慢慢回到此刻。");
      clearTimeout(focusPulseTimer);
      focusPulseTimer = window.setTimeout(() => (focusPulse.value = false), 2600);
    }
  }, 1000);
}
function setSleepDuration(minutes) {
  if (sleepRunning.value) return;
  sleepDuration.value = Math.min(180, Math.max(1, Number(minutes) || 30));
  sleepRemaining.value = 0;
  sleepFinished.value = false;
}
function setCustomSleepDuration() {
  setSleepDuration(sleepCustomDuration.value);
  sleepCustomDuration.value = sleepDuration.value;
}
function stopSleepTimer(reset = false) {
  clearInterval(sleepTimer);
  sleepTimer = undefined;
  sleepRunning.value = false;
  if (reset) {
    sleepRemaining.value = 0;
    sleepFinished.value = false;
  }
  setSleepFade(1);
}
function toggleSleepTimer() {
  if (sleepRunning.value) {
    stopSleepTimer();
    return;
  }
  if (!state.playing) {
    notify("请先播放森林声音，再开启睡眠计时。");
    return;
  }
  if (!sleepRemaining.value) {
    sleepRemaining.value = sleepDuration.value * 60;
    sleepFinished.value = false;
  }
  sleepRunning.value = true;
  sleepTimer = window.setInterval(() => {
    sleepRemaining.value = Math.max(0, sleepRemaining.value - 1);
    setSleepFade(sleepRemaining.value < 60 ? sleepRemaining.value / 60 : 1);
    if (sleepRemaining.value === 0) {
      stopSleepTimer();
      sleepFinished.value = true;
      state.playing = false;
      setSleepFade(1);
      notify("睡眠计时结束，森林声音已轻轻停下。");
    }
  }, 1000);
}
function revisitMoment(moment) {
  selectScene(moment.scene, moment);
  if (Number.isFinite(moment.master)) state.master = moment.master;
  if (moment.channels)
    for (const sound of soundOptions)
      state.channels[sound.value] = { ...moment.channels[sound.value] };
  journalOpen.value = false;
}
function confirmRemoveMoment(moment) {
  if (!window.confirm(`确定删除「${scenes[moment.scene].title}」这条拾光吗？`))
    return;
  removeMoment(moment.id);
  notify("这条拾光已删除。");
}
function formatMomentSound(moment) {
  if (!moment.channels) return "声音设置未记录";
  const active = soundOptions
    .filter((sound) => moment.channels[sound.value]?.enabled)
    .map((sound) => `${sound.label} ${moment.channels[sound.value].volume}%`);
  return active.length
    ? `环境音 ${moment.master ?? "—"}% · ${active.join(" · ")}`
    : "静音氛围";
}
function downloadJournalBackup() {
  const blob = new Blob([exportMoments()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `senjian-moments-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify("拾光备份已下载。");
}
async function importJournalBackup(event) {
  const input = event.target;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const result = importMoments(await file.text());
    notify(
      result.ok
        ? `备份导入完成，新增 ${result.imported} 条记录。`
        : result.message,
    );
  } catch {
    notify("无法读取这个备份文件。");
  } finally {
    input.value = "";
  }
}
function openBreath() {
  resetBreath();
  breathOpen.value = true;
}
function explore() {
  mainElement.value?.scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
  });
}
const rangeStyle = (value) => ({ "--range": `${value}%` });
watch(
  () => [state.autoRoam, state.roamInterval],
  () => {
    clearInterval(roamTimer);
    if (state.autoRoam)
      roamTimer = window.setInterval(advanceForest, state.roamInterval * 60_000);
  },
  { immediate: true },
);
watch(
  () => state.playing,
  (playing) => {
    if (!playing && sleepRunning.value) stopSleepTimer();
    else if (playing && sleepRemaining.value && !sleepRunning.value)
      setSleepFade(1);
  },
);
watch(
  () => state.scene,
  () => {
    if (!observationOpen.value) observationPromptIndex.value = 0;
  },
);
const visibleSeconds = ref(0);
const sessionTime = computed(() => {
  const seconds = Math.floor(visibleSeconds.value);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
});
let sessionTimer;
function handleEscape(event) {
  if (event.key !== "Escape") return;
  if (sceneMenuOpen.value) {
    sceneMenuOpen.value = false;
    return;
  }
  if (immersed.value) immersed.value = false;
}
watch(immersed, async (value) => {
  if (value) sceneMenuOpen.value = false;
  document.body.style.overflow = value ? "hidden" : "";
  await nextTick();
  (value ? leaveImmersiveButton.value : immersiveButton.value)?.focus();
});
onMounted(() => {
  let previous = performance.now();
  sessionTimer = setInterval(() => {
    const now = performance.now();
    if (!document.hidden)
      visibleSeconds.value += Math.min((now - previous) / 1000, 2);
    previous = now;
  }, 1000);
  document.addEventListener("keydown", handleEscape);
});
onUnmounted(() => {
  clearInterval(sessionTimer);
  clearInterval(roamTimer);
  stopFocus();
  stopSleepTimer(true);
  clearTimeout(toastTimer);
  clearTimeout(focusPulseTimer);
  document.removeEventListener("keydown", handleEscape);
  document.body.style.overflow = "";
});
</script>

<template>
  <div class="island-app" :class="{ 'is-immersed': immersed, playing: state.playing }">
    <IconSprite />
    <a class="skip-link" href="#forest-3d-canvas">跳至岛屿</a>
    <main id="main" ref="mainElement" class="island-stage">
      <section
        id="forest-view"
        ref="forestView"
        class="forest-view"
        :class="{ playing: state.playing, 'is-focused': focused }"
        :data-phase="state.phase"
        :data-weather="state.weather"
        :data-scene="state.scene"
        :data-focus-complete="focusPulse"
        :aria-label="scene.title + '岛屿'"
      >
        <canvas
          id="forest-3d-canvas"
          ref="threeCanvas"
          tabindex="0"
          aria-label="单击触发互动，双击或使用探索细节近看；拖动旋转，右键拖动平移，滚轮朝光标缩放；Esc 或 Home 返回整岛视角。"
        ></canvas>
        <div class="island-global-snow" aria-hidden="true"></div>
        <div v-if="focused" class="island-focus-bar island-chrome" role="status" aria-live="polite" :inert="immersed">
          <span><em>正在看</em><strong>{{ focusLabel }}</strong></span>
          <button type="button" @click="resetView">返回全岛</button>
        </div>
        <div v-if="exploreTargets.length" class="island-explore island-chrome" :inert="immersed" aria-label="探索细节">
          <span>探索细节</span>
          <button v-for="target in exploreTargets" :key="target.id" type="button" @click="focusTarget(target.id)">{{ target.label }}</button>
        </div>
        <span v-if="hoverName" class="island-hover-label" :style="{ left: hoverX + 'px', top: hoverY + 'px' }" aria-hidden="true">{{ hoverName }}</span>
        <div v-if="!state.threeAvailable" class="island-unavailable" role="status">
          <ForestIcon name="tree" />
          <p>岛屿正在准备中</p>
          <small>如果始终没有出现，请开启浏览器硬件加速后刷新。</small>
        </div>
      </section>

      <header class="island-header island-chrome" :inert="immersed">
        <a class="island-brand" href="./" aria-label="森间首页">
          <ForestIcon name="tree" />
          <span>森间<small>A LITTLE ISLAND OF CALM</small></span>
        </a>
        <nav class="island-header-actions" aria-label="岛屿工具">
          <button id="breath-nav" @click="openBreath" aria-label="呼吸练习"><span class="breath-mini"></span><span>呼吸</span></button>
          <button id="journal-nav" @click="journalOpen = true" aria-label="我的拾光"><ForestIcon name="book" /><span>拾光</span><small v-if="moments.length">{{ moments.length }}</small></button>
          <button id="about-button" @click="aboutOpen = true" aria-label="关于森间"><ForestIcon name="leaf" /></button>
        </nav>
      </header>

      <section class="island-story island-chrome" :inert="immersed" aria-live="polite">
        <p class="island-overline">一座小岛，六种风景</p>
        <h1 id="scene-title">{{ scene.title }}</h1>
        <p id="scene-description">{{ scene.description }}</p>
        <div class="island-condition"><ForestIcon :name="weatherIcon" /><span id="scene-condition">{{ conditionText }}</span></div>
        <div v-if="state.scene === 'alpine'" class="island-time-switch" aria-label="切换木屋时光">
          <button :class="{ selected: state.phase === 'morning' }" :aria-pressed="state.phase === 'morning'" @click="state.phase = 'morning'">蓝调清晨</button>
          <button :class="{ selected: state.phase === 'afternoon' }" :aria-pressed="state.phase === 'afternoon'" @click="state.phase = 'afternoon'">黄昏暖窗</button>
        </div>
      </section>

      <aside class="island-actions island-chrome" aria-label="此刻的岛屿" :inert="immersed">
        <button id="save-moment" :class="{ saved: currentMoment }" :aria-pressed="Boolean(currentMoment)" :aria-label="currentMoment ? '取消收藏此刻' : '收藏此刻'" title="收藏此刻" @click="toggleMoment"><ForestIcon name="heart" /></button>
        <button id="snapshot" :disabled="saving || !state.threeAvailable" title="下载岛屿明信片" aria-label="下载岛屿明信片" @click="downloadPostcard"><ForestIcon name="camera" /></button>
        <button id="observation-toggle" title="静心观察" aria-label="静心观察" @click="openObservation"><ForestIcon name="eye" /></button>
      </aside>

      <div v-if="sceneMenuOpen" class="island-scene-scrim" @click="sceneMenuOpen = false"></div>
      <div class="island-bottom island-chrome" :inert="immersed">
        <div class="island-scene-control">
          <button
            class="island-scene-trigger"
            type="button"
            aria-haspopup="listbox"
            aria-controls="island-scene-menu"
            :aria-expanded="sceneMenuOpen"
            @click="sceneMenuOpen = !sceneMenuOpen"
          >
            <span class="island-scene-icon"><ForestIcon :name="sceneIcons[state.scene]" /></span>
            <span class="island-scene-copy">
              <small>风景 {{ currentSceneNumber }} / 06</small>
              <strong>{{ scene.title }}</strong>
            </span>
            <span class="island-scene-chevron" aria-hidden="true"></span>
          </button>
          <Transition name="island-scene-menu">
            <div v-if="sceneMenuOpen" id="island-scene-menu" class="island-scene-menu" role="listbox" aria-label="选择风景">
              <button
                v-for="item in sceneEntries"
                :key="item.key"
                type="button"
                role="option"
                :data-scene="item.key"
                :class="{ selected: state.scene === item.key }"
                :aria-selected="state.scene === item.key"
                @click="selectScene(item.key)"
              >
                <ForestIcon :name="sceneIcons[item.key]" />
                <span>{{ item.title }}</span>
                <small>{{ item.number }}</small>
              </button>
            </div>
          </Transition>
        </div>
        <div class="island-bottom-tools">
          <button id="sound-toggle" class="island-play" :class="{ active: state.playing }" :aria-label="state.playing ? '暂停自然声音' : '播放自然声音'" :aria-pressed="state.playing" @click="toggleAudio"><ForestIcon :name="state.playing ? 'pause' : 'play'" /><span>{{ state.playing ? '正在听见森林' : '听见森林' }}</span><span class="sound-bars" aria-hidden="true"><i v-for="n in 5" :key="n"></i></span></button>
          <button id="atmosphere-toggle" aria-haspopup="dialog" aria-controls="island-settings" @click="settingsOpen = true"><ForestIcon name="wind" /><span>氛围与声音</span></button>
          <button id="immersive" ref="immersiveButton" @click="immersed = true"><ForestIcon name="expand" /><span>沉浸</span></button>
        </div>
      </div>
      <p v-if="!focused && !sceneMenuOpen" class="island-gesture-hint island-chrome" :inert="immersed">拖动环绕 · 右键拖动平移 · 滚轮朝光标缩放<br /><span>{{ interactionHint }} · 单击互动，双击细看 · Esc 返回</span></p>
      <div v-if="!focused && !sceneMenuOpen" class="island-session island-chrome" :inert="immersed"><span>在岛上停留</span><strong id="session-time">{{ sessionTime }}</strong><small v-if="focusRunning">专注 {{ focusTimeLabel }}</small><small v-if="sleepRunning">声音将在 {{ sleepTimeLabel }} 后停止</small></div>
      <button v-show="immersed" id="leave-immersive" ref="leaveImmersiveButton" class="island-exit" @click="immersed = false"><ForestIcon name="close" />显示控件</button>
    </main>

    <ForestDialog id="island-settings" v-model="settingsOpen" class="island-settings" close-label="关闭氛围与声音">
      <span class="eyebrow">MAKE YOURSELF AT HOME</span>
      <h2>岛上的这一刻</h2>
      <p>调一调天色，也调一调心情。</p>
      <section
        class="environment-panel"
        aria-label="调整森林氛围"
        :inert="immersed"
      >
        <div class="panel-heading">
          <div>
            <ForestIcon name="leaf" />
            <h2>让这一刻，刚刚好</h2>
          </div>
          <span>你的森林，由你调节</span>
        </div>
        <div class="environment-row">
          <div class="setting-block">
            <span class="setting-label">森林时光</span>
            <div id="phase-options" class="segmented">
              <button
                v-for="option in activePhaseOptions"
                :key="option.value"
                :data-phase="option.value"
                :class="{ selected: state.phase === option.value }"
                :aria-pressed="state.phase === option.value"
                :disabled="option.disabled"
                @click="state.phase = option.value"
              >
                <ForestIcon v-if="option.icon" :name="option.icon" />{{
                  option.label
                }}
              </button>
            </div>
          </div>
          <div class="setting-block weather-setting">
            <span class="setting-label">天气心情</span>
            <div id="weather-options" class="segmented">
              <button
                v-for="option in weatherOptions"
                :key="option.value"
                :data-weather="option.value"
                :class="{ selected: state.weather === option.value }"
                :aria-pressed="state.weather === option.value"
                @click="state.weather = option.value"
              >
                <ForestIcon v-if="option.icon" :name="option.icon" />{{
                  option.label
                }}
              </button>
            </div>
          </div>
          <div class="master-setting">
            <label class="setting-label" for="master-volume"
              ><ForestIcon name="volume" />环境音量<span id="master-value"
                >{{ state.master }}%</span
              ></label
            ><input
              id="master-volume"
              v-model.number="state.master"
              type="range"
              min="0"
              max="100"
              :style="rangeStyle(state.master)"
              aria-label="环境音量"
            />
          </div>
        </div>
        <div class="quiet-tools">
          <section class="quiet-tool" aria-label="森林自动漫游设置">
            <div class="quiet-tool-heading">
              <strong>森林自动漫游</strong>
              <small>让风景替你慢慢流动</small>
            </div>
            <div class="quiet-tool-controls">
              <div class="mini-segmented" aria-label="场景切换间隔">
                <button
                  v-for="minutes in [2, 3, 5]"
                  :key="minutes"
                  :class="{ selected: state.roamInterval === minutes }"
                  :aria-pressed="state.roamInterval === minutes"
                  @click="state.roamInterval = minutes"
                >
                  {{ minutes }} 分
                </button>
              </div>
              <button
                id="auto-roam-toggle"
                class="quiet-toggle"
                :class="{ active: state.autoRoam }"
                :aria-pressed="state.autoRoam"
                @click="state.autoRoam = !state.autoRoam"
              >
                {{ state.autoRoam ? "漫游中" : "开启漫游" }}
              </button>
            </div>
          </section>
          <section class="quiet-tool" aria-label="专注计时设置">
            <div class="quiet-tool-heading">
              <strong>专注一会儿</strong>
              <small>留一段完整的安静时间</small>
            </div>
            <div class="quiet-tool-controls focus-controls">
              <div class="mini-segmented" aria-label="专注时长">
                <button
                  v-for="minutes in [5, 10, 20]"
                  :key="minutes"
                  :class="{ selected: focusDuration === minutes }"
                  :aria-pressed="focusDuration === minutes"
                  :disabled="focusRunning"
                  @click="setFocusDuration(minutes)"
                >
                  {{ minutes }} 分
                </button>
              </div>
              <strong class="focus-clock" role="status" aria-live="polite">{{ focusTimeLabel }}</strong>
              <button
                id="focus-toggle"
                class="quiet-toggle"
                :class="{ active: focusRunning }"
                :aria-pressed="focusRunning"
                @click="toggleFocus"
              >
                {{ focusRunning ? "暂停" : focusRemaining ? "继续" : "开始" }}
              </button>
              <button
                v-if="focusRemaining && !focusRunning"
                class="focus-reset"
                aria-label="结束专注计时"
                @click="stopFocus(true)"
              >
                结束
              </button>
            </div>
          </section>
          <section class="quiet-tool" aria-label="睡眠声音计时设置">
            <div class="quiet-tool-heading">
              <strong>睡眠计时</strong>
              <small>结束前一分钟渐弱</small>
            </div>
            <div class="sleep-presets mini-segmented" aria-label="睡眠计时时长">
              <button
                v-for="minutes in [15, 30, 45, 60]"
                :key="minutes"
                :class="{ selected: sleepDuration === minutes }"
                :aria-pressed="sleepDuration === minutes"
                :disabled="sleepRunning"
                @click="setSleepDuration(minutes)"
              >{{ minutes }}分</button>
              <label
                class="custom-sleep-duration"
                :class="{ selected: ![15, 30, 45, 60].includes(sleepDuration) }"
              >
                <span class="sr-only">自定义睡眠时长（分钟）</span>
                <input
                  v-model.number="sleepCustomDuration"
                  type="number"
                  min="1"
                  max="180"
                  step="5"
                  :disabled="sleepRunning"
                  aria-label="自定义睡眠时长，分钟"
                  @change="setCustomSleepDuration"
                  @keydown.enter.prevent="setCustomSleepDuration"
                />
                <span>自定</span>
              </label>
            </div>
            <div class="sleep-timer-controls">
              <strong class="focus-clock" role="timer" aria-live="off">{{ sleepTimeLabel }}</strong>
              <button
                class="quiet-toggle"
                :class="{ active: sleepRunning }"
                :aria-pressed="sleepRunning"
                @click="toggleSleepTimer"
              >{{ sleepRunning ? "暂停" : sleepRemaining ? "继续" : "开始" }}</button>
              <button
                v-if="sleepRemaining && !sleepRunning"
                class="focus-reset"
                aria-label="取消睡眠计时"
                @click="stopSleepTimer(true)"
              >取消</button>
            </div>
          </section>
        </div>
      </section>
      <section class="soundscape" aria-label="声音混合" :inert="immersed">
        <div class="soundscape-heading">
          <h2>听见森林</h2>
          <span>混合你喜欢的自然声音</span>
        </div>
        <div class="sound-presets" aria-label="声音氛围预设">
          <div class="preset-list">
            <template v-for="preset in soundPresets" :key="preset.id">
              <button
                class="preset-chip"
                :class="{ selected: activePresetId === preset.id }"
                :aria-pressed="activePresetId === preset.id"
                @click="applyPreset(preset)"
              >{{ preset.name }}</button>
              <button
                v-if="preset.id.startsWith('custom:')"
                class="preset-remove"
                :aria-label="`删除${preset.name}预设`"
                @click="removePreset(preset)"
              >×</button>
            </template>
          </div>
          <form class="preset-save" @submit.prevent="savePreset">
            <label class="sr-only" for="sound-preset-name">自定义氛围名称</label>
            <input
              id="sound-preset-name"
              v-model="presetName"
              type="text"
              maxlength="24"
              placeholder="自定义名称"
            />
            <button type="submit">保存当前混音</button>
          </form>
        </div>
        <div class="sound-channels">
          <div
            v-for="sound in soundOptions"
            :key="sound.value"
            class="sound-channel"
          >
            <button
              :data-sound="sound.value"
              :class="{ enabled: state.channels[sound.value].enabled }"
              :aria-pressed="state.channels[sound.value].enabled"
              @click="
                state.channels[sound.value].enabled =
                  !state.channels[sound.value].enabled
              "
            >
              <ForestIcon :name="sound.icon" /><span>{{ sound.label }}</span
              ><span class="channel-state">{{
                state.channels[sound.value].enabled ? "开启" : "关闭"
              }}</span></button
            ><input
              v-model.number="state.channels[sound.value].volume"
              type="range"
              :data-volume="sound.value"
              min="0"
              max="100"
              :style="rangeStyle(state.channels[sound.value].volume)"
              :aria-label="`${sound.label}音量`"
            />
          </div>
        </div>
      </section>

    </ForestDialog>
  <ForestDialog
    id="breath-dialog"
    v-model="breathOpen"
    class="breath-dialog"
    close-label="关闭呼吸练习"
    @close="resetBreath"
  >
    <span class="eyebrow">BREATHE WITH THE FOREST</span>
    <h2>慢下来，回到此刻。</h2>
    <p>找到舒适的姿势，让呼吸自然发生。</p>
    <div class="breath-orbit">
      <div class="breath-circle" :class="breathPhase">
        <span id="breath-cue">{{ cue }}</span
        ><small id="breath-count">{{ count }}</small>
      </div>
    </div>
    <div class="duration-options" aria-label="呼吸练习时长">
      <button
        v-for="seconds in [60, 180, 300]"
        :key="seconds"
        :data-duration="seconds"
        :class="{ selected: duration === seconds }"
        :aria-pressed="duration === seconds"
        :disabled="running"
        @click="duration = seconds"
      >
        {{ seconds / 60 }} 分钟
      </button>
    </div>
    <button id="start-breath" class="primary-button" @click="toggleBreath">
      {{ running ? "结束练习" : "开始呼吸" }}</button
    ><span class="breath-hint">无需刻意用力，按自己舒服的节奏就好。</span>
  </ForestDialog>
  <ForestDialog
    id="observation-dialog"
    v-model="observationOpen"
    class="observation-dialog"
    close-label="关闭静心观察"
  >
    <span class="eyebrow">A MOMENT TO NOTICE</span>
    <div class="observation-mark"><ForestIcon name="eye" /></div>
    <h2>静心观察</h2>
    <p>{{ observationPrompt }}</p>
    <span class="observation-scene">此刻 · {{ scene.title }}</span>
    <button class="primary-button" @click="changeObservationPrompt">换一个观察角度</button>
    <span class="breath-hint">不必寻找答案，只要让目光停一会儿。</span>
  </ForestDialog>
  <ForestDialog
    id="journal-dialog"
    v-model="journalOpen"
    class="journal-dialog"
    close-label="关闭我的拾光"
  >
    <span class="eyebrow">LITTLE MOMENTS, KEPT CLOSE</span>
    <h2>我的拾光</h2>
    <p>把让心安静的瞬间，轻轻收好。</p>
    <div class="journal-tools">
      <label class="sr-only" for="journal-search">搜索拾光</label>
      <input
        id="journal-search"
        v-model="journalQuery"
        type="search"
        placeholder="搜索场景或备注"
      />
      <label class="sr-only" for="journal-scene-filter">按场景筛选拾光</label>
      <select id="journal-scene-filter" v-model="journalSceneFilter">
        <option value="all">所有场景</option>
        <option v-for="(item, name) in scenes" :key="name" :value="name">{{ item.title }}</option>
      </select>
      <button @click="downloadJournalBackup">导出备份</button>
      <button @click="journalFileInput?.click()">导入备份</button>
      <input
        ref="journalFileInput"
        class="sr-only"
        type="file"
        accept=".json,application/json"
        aria-label="选择拾光 JSON 备份文件"
        @change="importJournalBackup"
      />
    </div>
    <div id="journal-list">
      <div v-if="!moments.length" class="journal-empty">
        <ForestIcon name="leaf" />
        <p>还没有收好的瞬间</p>
        <small>点击风景右侧的爱心，留下你喜欢的此刻。</small>
      </div>
      <div v-else-if="!filteredMoments.length" class="journal-empty">
        <p>没有找到符合条件的拾光</p>
        <small>试试更换场景或搜索词。</small>
      </div>
      <article v-for="moment in filteredMoments" :key="moment.id" class="journal-entry">
        <div
          class="journal-entry-thumb"
          :data-scene="moment.scene"
          :style="{ filter: momentFilter(moment) }"
          aria-hidden="true"
        ><span class="island-thumb-art"><i></i><b></b><em></em></span></div>
        <div class="journal-entry-copy">
          <strong>{{ scenes[moment.scene].title }}</strong
          ><small>{{ formatMoment(moment) }}</small>
          <small>{{ formatMomentSound(moment) }}</small>
          <label class="sr-only" :for="`moment-note-${moment.id}`">编辑{{ scenes[moment.scene].title }}拾光备注</label>
          <textarea
            :id="`moment-note-${moment.id}`"
            :value="moment.note || ''"
            maxlength="300"
            rows="2"
            placeholder="写下一点此刻的心情……"
            @input="updateNote(moment.id, $event.target.value)"
          ></textarea>
        </div>
        <button @click="revisitMoment(moment)">再看看</button
        ><button
          class="remove-moment"
          :aria-label="`删除${scenes[moment.scene].title}拾光`"
          @click="confirmRemoveMoment(moment)"
        >
          <ForestIcon name="close" />
        </button>
      </article>
    </div>
    <span class="local-note">拾光记录保存在当前浏览器中。</span>
  </ForestDialog>
  <ForestDialog
    id="about-dialog"
    v-model="aboutOpen"
    class="about-dialog"
    close-label="关闭介绍"
  >
    <span class="brand-mark"><ForestIcon name="tree" /></span>
    <h2>一片随时可以回来的森林。</h2>
    <p>
      森间是一个小小的放松空间。选一处风景，打开自然声音，或者跟着光圈做一次缓慢的呼吸。
    </p>
    <p>这里没有待办，也不用打卡。你只需要在这里待一会儿。</p>
    <span class="local-note"
      >景色为艺术化森林场景，声音由浏览器合成。收藏仅保存在本机。</span
    >
  </ForestDialog>
  <div
    id="toast"
    :class="{ show: toastVisible }"
    role="status"
    aria-live="polite"
  >
    {{ toastMessage }}
  </div>

  </div>
</template>
