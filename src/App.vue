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
import WonderlandIntro from "./components/WonderlandIntro.vue";
import {
  scenes,
  phaseNames,
  weatherNames,
  phaseOptions,
  weatherOptions,
  soundOptions,
} from "./data/forest";
import { useForestAudio } from "./composables/useForestAudio";
import { useNatureCanvas } from "./composables/useNatureCanvas";
import { useMomentJournal } from "./composables/useMomentJournal";
import { useBreathing } from "./composables/useBreathing";
import { usePostcard } from "./composables/usePostcard";
import forestImageUrl from "./assets/forest.png";

const state = reactive({
  scene: "morning",
  phase: "morning",
  weather: "mist",
  playing: false,
  master: 60,
  channels: {
    wind: { enabled: true, volume: 55 },
    birds: { enabled: true, volume: 40 },
    water: { enabled: false, volume: 35 },
    rain: { enabled: false, volume: 45 },
  },
});
const introVisible = ref(true);
const scene = computed(() => scenes[state.scene]);
const currentForestImage = computed(
  () => scene.value.imageUrl || forestImageUrl,
);
const weatherIcon = computed(() =>
  state.weather === "snow"
    ? "snow"
    : state.weather === "rain"
      ? "rain"
      : state.phase === "night"
        ? "moon"
        : "sun",
);
const forestView = ref(null),
  forestImage = ref(null),
  natureCanvas = ref(null),
  mainElement = ref(null);
const immersiveButton = ref(null),
  leaveImmersiveButton = ref(null);
const immersed = ref(false),
  breathOpen = ref(false),
  journalOpen = ref(false),
  aboutOpen = ref(false);
const toastMessage = ref(""),
  toastVisible = ref(false);
let toastTimer;
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
} = useMomentJournal(state, notify);
const { toggleAudio } = useForestAudio(state, notify);
useNatureCanvas(natureCanvas, forestView, state);
const { saving, downloadPostcard } = usePostcard(forestImage, state, notify);
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
  state.scene = name;
  state.phase = saved?.phase || selected.phase;
  state.weather = saved?.weather || selected.weather;
  state.channels.rain.enabled = state.weather === "rain";
  state.channels.birds.enabled = state.phase !== "night";
}
function revisitMoment(moment) {
  selectScene(moment.scene, moment);
  journalOpen.value = false;
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
const visibleSeconds = ref(0);
const sessionTime = computed(() => {
  const seconds = Math.floor(visibleSeconds.value);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
});
let sessionTimer;
function handleEscape(event) {
  if (event.key === "Escape" && immersed.value) immersed.value = false;
}
watch(immersed, async (value) => {
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
watch(introVisible, async (visible) => {
  if (!visible) {
    await nextTick();
    document.querySelector("#explore-nav")?.focus({ preventScroll: true });
  }
});
onUnmounted(() => {
  clearInterval(sessionTimer);
  clearTimeout(toastTimer);
  document.removeEventListener("keydown", handleEscape);
  document.body.style.overflow = "";
});
</script>

<template>
  <div class="app-shell" :inert="introVisible" :aria-hidden="introVisible">
  <IconSprite />
  <a class="skip-link" href="#main">跳至森林</a>
  <header class="header" :inert="immersed">
    <a class="brand" href="./" aria-label="森间首页"
      ><span class="brand-mark"><ForestIcon name="tree" /></span
      ><span>森间<small>FOREST & STILLNESS</small></span></a
    >
    <nav class="navigation" aria-label="主导航">
      <button id="explore-nav" class="nav-item active" @click="explore">
        <ForestIcon name="leaf" />森林漫游
      </button>
      <button id="breath-nav" class="nav-item" @click="openBreath">
        <span class="breath-mini"></span>呼吸时刻
      </button>
      <button id="journal-nav" class="nav-item" @click="journalOpen = true">
        <ForestIcon name="book" />我的拾光<span
          v-if="moments.length"
          class="saved-count"
          >{{ moments.length }}</span
        >
      </button>
    </nav>
    <button id="about-button" class="header-note" @click="aboutOpen = true">
      <span class="status-dot"></span>留一点时间给自己
      <ForestIcon name="arrow" />
    </button>
  </header>
  <div class="workspace">
    <aside class="sidebar" aria-label="选择森林" :inert="immersed">
      <div class="sidebar-title">
        <span class="eyebrow">YOUR LITTLE ESCAPE</span>
        <h2>寻找你的宁静</h2>
        <p>选一处风景，慢慢待一会儿。</p>
      </div>
      <div class="scene-list">
        <button
          v-for="(item, key, index) in scenes"
          :key="key"
          class="scene-card"
          :class="{ selected: state.scene === key }"
          :data-scene="key"
          :aria-pressed="state.scene === key"
          @click="selectScene(key)"
        >
          <span
            class="scene-thumb"
            :class="`${key}-thumb`"
            :style="{
              backgroundImage: `url(${item.imageUrl || forestImageUrl})`,
            }"
            ><span class="scene-index">{{
              String(index + 1).padStart(2, "0")
            }}</span
            ><span v-if="state.scene === key" class="scene-live">正在漫游</span
            ><span v-if="key === 'night'" class="thumb-fireflies"
              >· &nbsp; · &nbsp; ·</span
            ></span
          >
          <span class="scene-card-body"
            ><span
              ><strong>{{ item.title }}</strong
              ><small>{{ item.subtitle }}</small></span
            ><ForestIcon name="arrow"
          /></span>
        </button>
      </div>
      <div class="sidebar-bottom">
        <ForestIcon name="leaf" />
        <p>自然从不匆忙，<br />却让一切如期生长。</p>
        <span>TAKE IT SLOW.</span>
      </div>
    </aside>
    <main id="main" ref="mainElement">
      <div class="intro" :inert="immersed">
        <div>
          <div class="eyebrow intro-eyebrow">
            <span></span>A QUIET PLACE, JUST FOR YOU
          </div>
          <h1>给自己，一片森林<span>。</span></h1>
          <p>把纷扰留在身后，让心事在风里慢慢散开。</p>
        </div>
        <div class="visit-time">
          <ForestIcon name="clock" /><span
            >已在森林停留<strong id="session-time">{{
              sessionTime
            }}</strong></span
          >
        </div>
      </div>
      <section
        id="forest-view"
        ref="forestView"
        class="forest-view"
        :class="{ playing: state.playing, immersed }"
        :data-phase="state.phase"
        :data-weather="state.weather"
        :aria-label="`${scene.title}风景`"
      >
        <img
          id="forest-image"
          ref="forestImage"
          class="forest-image"
          :src="currentForestImage"
          :style="{ objectPosition: scene.position }"
          :alt="`${phaseNames[state.phase]}${weatherNames[state.weather]}中的松林，青苔与蕨叶围绕着安静的小径`"
        />
        <div class="forest-shade"></div>
        <div class="atmosphere mist"></div>
        <canvas
          id="nature-canvas"
          ref="natureCanvas"
          aria-hidden="true"
        ></canvas>
        <div class="view-top">
          <span class="view-label"
            ><span class="status-dot"></span>此刻，只有你和森林</span
          ><span class="weather-label"
            ><ForestIcon :name="weatherIcon" /><span id="scene-condition"
              >{{ phaseNames[state.phase] }} ·
              {{ weatherNames[state.weather] }}</span
            ></span
          >
        </div>
        <div class="view-actions">
          <button
            id="save-moment"
            class="glass-icon"
            :class="{ saved: currentMoment }"
            :aria-pressed="Boolean(currentMoment)"
            :aria-label="currentMoment ? '取消收藏此刻' : '收藏此刻'"
            title="收藏此刻"
            @click="toggleMoment"
          >
            <ForestIcon name="heart" />
          </button>
          <button
            id="snapshot"
            class="glass-icon"
            :disabled="saving"
            title="下载风景明信片"
            aria-label="下载风景明信片"
            @click="downloadPostcard"
          >
            <ForestIcon name="camera" />
          </button>
        </div>
        <div class="view-bottom">
          <div class="scene-copy">
            <span id="scene-kicker">{{ scene.kicker }}</span>
            <h2 id="scene-title">{{ scene.title }}</h2>
            <p id="scene-description">{{ scene.description }}</p>
          </div>
          <button
            id="immersive"
            ref="immersiveButton"
            class="immersive-button"
            @click="immersed = true"
          >
            <ForestIcon name="expand" /><span>沉浸一下</span>
          </button>
        </div>
        <button
          id="leave-immersive"
          ref="leaveImmersiveButton"
          class="leave-immersive"
          @click="immersed = false"
        >
          <ForestIcon name="close" />退出沉浸
        </button>
        <div class="sound-pill">
          <button
            id="sound-toggle"
            :aria-label="state.playing ? '暂停自然声音' : '播放自然声音'"
            :aria-pressed="state.playing"
            @click="toggleAudio"
          >
            <ForestIcon :name="state.playing ? 'pause' : 'play'" />
          </button>
          <div>
            <span id="sound-status">{{
              state.playing ? "正在听见森林" : "让森林有声音"
            }}</span
            ><small id="sound-subtitle">{{
              state.playing ? "让自然陪你，安静一会儿" : "轻触播放，听见自然"
            }}</small>
          </div>
          <span class="sound-bars"><i v-for="n in 5" :key="n"></i></span>
        </div>
      </section>
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
                v-for="option in phaseOptions"
                :key="option.value"
                :data-phase="option.value"
                :class="{ selected: state.phase === option.value }"
                :aria-pressed="state.phase === option.value"
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
      </section>
      <section class="soundscape" aria-label="声音混合" :inert="immersed">
        <div class="soundscape-heading">
          <h2>听见森林</h2>
          <span>混合你喜欢的自然声音</span>
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
      <footer :inert="immersed">
        <span><ForestIcon name="tree" />不用抵达哪里。在这里，就很好。</span
        ><button id="breath-shortcut" @click="openBreath">
          跟着森林，呼吸一会儿<ForestIcon name="arrow" />
        </button>
      </footer>
    </main>
  </div>
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
    id="journal-dialog"
    v-model="journalOpen"
    class="journal-dialog"
    close-label="关闭我的拾光"
  >
    <span class="eyebrow">LITTLE MOMENTS, KEPT CLOSE</span>
    <h2>我的拾光</h2>
    <p>把让心安静的瞬间，轻轻收好。</p>
    <div id="journal-list">
      <div v-if="!moments.length" class="journal-empty">
        <ForestIcon name="leaf" />
        <p>还没有收好的瞬间</p>
        <small>点击风景右侧的爱心，留下你喜欢的此刻。</small>
      </div>
      <article v-for="moment in moments" :key="moment.id" class="journal-entry">
        <div
          class="journal-entry-thumb"
          :style="{
            backgroundImage: `url(${scenes[moment.scene].imageUrl || forestImageUrl})`,
            filter: momentFilter(moment),
          }"
          aria-hidden="true"
        ></div>
        <div class="journal-entry-copy">
          <strong>{{ scenes[moment.scene].title }}</strong
          ><small>{{ formatMoment(moment) }}</small>
        </div>
        <button @click="revisitMoment(moment)">再看看</button
        ><button
          class="remove-moment"
          :aria-label="`删除${scenes[moment.scene].title}拾光`"
          @click="removeMoment(moment.id)"
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
  <WonderlandIntro v-if="introVisible" @enter="introVisible = false" />
</template>
