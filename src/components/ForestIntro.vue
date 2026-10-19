<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import forestImageUrl from "../assets/forest.png";

const emit = defineEmits(["enter"]);
const introRoot = ref(null);
const flowers = [
  { x: 195, y: 490, color: "#e6a8a0", petals: 5 },
  { x: 255, y: 305, color: "#f0d18d", petals: 6 },
  { x: 342, y: 220, color: "#d5bcdf", petals: 5 },
  { x: 466, y: 236, color: "#f1c3a0", petals: 6 },
  { x: 563, y: 350, color: "#e6a8a0", petals: 5 },
  { x: 620, y: 520, color: "#e9d591", petals: 6 },
];
const vines = [
  "M145 790 C179 765 127 737 145 700 C161 666 184 641 159 611 C132 580 154 551 174 527 C198 498 155 472 180 442 C202 416 230 407 210 379 C190 352 163 340 185 314 C202 294 235 288 265 265 C297 241 293 219 325 211 C349 205 364 187 374 166",
  "M650 790 C620 760 679 735 650 700 C625 670 637 641 666 611 C695 581 658 553 631 531 C600 505 646 478 625 447 C604 418 574 405 591 374 C606 348 638 335 616 306 C598 282 567 278 544 258 C514 234 516 214 485 208 C462 203 447 183 435 165",
  "M146 704 C116 730 82 711 96 683 C108 660 136 659 141 679 C146 696 125 702 118 689",
  "M175 533 C140 558 102 541 106 512 C110 488 135 477 151 491 C167 505 152 524 138 519",
  "M186 317 C157 299 147 271 165 247 C183 224 203 239 199 257 C195 270 181 268 178 255",
  "M372 171 C343 154 330 128 342 108 C355 86 379 95 378 112 C377 128 360 132 354 119",
  "M322 225 C300 207 304 181 285 161 C267 143 270 116 258 96 C248 79 256 59 267 43",
  "M207 432 C180 412 148 404 128 379 C107 354 112 331 124 309",
  "M169 571 C136 589 115 619 99 644 C84 668 73 676 57 668",
  "M145 696 C126 721 139 746 119 764 C98 783 67 774 45 751 C32 737 20 729 8 731",
  "M190 388 C222 408 247 437 235 466 C227 484 208 487 198 474",
  "M652 447 C681 422 709 402 712 372 C714 350 702 337 691 326",
  "M649 614 C681 629 704 654 716 683 C727 710 748 711 769 692",
  "M630 526 C664 499 692 469 685 441 C680 420 664 410 652 423 C643 433 649 446 660 448",
  "M431 168 C455 147 466 119 451 99 C438 82 417 88 416 105 C415 120 429 129 438 119",
];
const leaves = [
  { x: 151, y: 710, angle: -31, delay: ".3s" },
  { x: 159, y: 665, angle: 19, delay: ".52s" },
  { x: 151, y: 608, angle: -47, delay: ".68s" },
  { x: 177, y: 540, angle: 28, delay: ".84s" },
  { x: 169, y: 493, angle: -34, delay: "1.08s" },
  { x: 203, y: 424, angle: 21, delay: "1.26s" },
  { x: 185, y: 355, angle: -41, delay: "1.48s" },
  { x: 224, y: 296, angle: 35, delay: "1.65s" },
  { x: 287, y: 246, angle: -24, delay: "1.84s" },
  { x: 349, y: 193, angle: 33, delay: "2s" },
  { x: 638, y: 728, angle: 151, delay: ".42s" },
  { x: 660, y: 670, angle: 203, delay: ".62s" },
  { x: 644, y: 625, angle: 147, delay: ".8s" },
  { x: 620, y: 549, angle: 224, delay: ".98s" },
  { x: 653, y: 490, angle: 164, delay: "1.2s" },
  { x: 609, y: 420, angle: 209, delay: "1.38s" },
  { x: 624, y: 335, angle: 153, delay: "1.58s" },
  { x: 555, y: 273, angle: 206, delay: "1.78s" },
  { x: 482, y: 224, angle: 145, delay: "1.96s" },
  { x: 430, y: 189, angle: 208, delay: "2.12s" },
  { x: 89, y: 687, angle: 218, delay: ".92s" },
  { x: 112, y: 512, angle: 201, delay: "1.12s" },
  { x: 169, y: 254, angle: 226, delay: "1.72s" },
  { x: 256, y: 94, angle: -12, delay: "2.2s" },
  { x: 128, y: 375, angle: 196, delay: "1.04s" },
  { x: 698, y: 367, angle: 161, delay: "1.32s" },
  { x: 700, y: 660, angle: 32, delay: "1.52s" },
  { x: 48, y: 752, angle: 197, delay: "1.7s" },
  { x: 435, y: 105, angle: 188, delay: "2.28s" },
];
const touched = ref([]);
const opened = ref(false);
const progress = computed(() => Math.min(touched.value.length, 3));
const hint = computed(() =>
  opened.value
    ? "蝴蝶正带着你，走进森林深处。"
    : progress.value >= 3
      ? "门后的森林，已经醒来。"
      : progress.value
        ? "光，正一点点醒来。"
        : "轻触三朵花，唤醒森林。",
);
const butterflyPalette = [
  { wing: "#f2a8bf", edge: "#70445e", mark: "#ffedc0" },
  { wing: "#f2c978", edge: "#775535", mark: "#fff1cb" },
  { wing: "#a9c98c", edge: "#425e45", mark: "#f3edba" },
  { wing: "#89c9cb", edge: "#365965", mark: "#e8f4d1" },
  { wing: "#bba7dc", edge: "#59496d", mark: "#fff0cf" },
  { wing: "#e9a178", edge: "#744a3f", mark: "#ffebbb" },
];
const butterflies = ref([]);
const fireflies = Array.from({ length: 18 }, (_, index) => ({
  index,
  x: `${(index * 43 + 7) % 97}%`,
  y: `${(index * 31 + 11) % 87}%`,
}));
let timers = [];
let previousOverflow = "";
let vineFrame = 0;
function bloom(index) {
  if (opened.value || touched.value.length >= 3 || touched.value.includes(index)) return;
  touched.value = [...touched.value, index];
  if (touched.value.length >= 3) {
    timers.push(setTimeout(() => {
      opened.value = true;
      timers.push(setTimeout(() => emit("enter"), 4200));
    }, 650));
  }
}
function skip() {
  timers.forEach(clearTimeout);
  emit("enter");
}
function onKeydown(event) {
  if (event.key === "Escape") {
    skip();
    return;
  }
  if (event.key === "Tab") {
    const items = introRoot.value?.querySelectorAll(
      'button:not([disabled]), [role="button"][tabindex="0"]',
    );
    if (!items?.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
onMounted(() => {
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  window.addEventListener("keydown", onKeydown);
  document.querySelector(".intro-skip")?.focus({ preventScroll: true });
  const door = introRoot.value?.querySelector(".intro-door");
  const rect = door?.getBoundingClientRect();
  if (rect) {
    const centerX = rect.left + rect.width / 2;
    const archCenterY = rect.top + rect.height * 0.32;
    const radiusX = rect.width / 2;
    const radiusY = rect.height * 0.32;
    const perimeter = [];
    for (let index = 0; index < 12; index++) {
      const angle = Math.PI - (index / 11) * Math.PI;
      const normalX = Math.cos(angle) / radiusX;
      const normalY = -Math.sin(angle) / radiusY;
      const magnitude = Math.hypot(normalX, normalY);
      perimeter.push({
        x: centerX + radiusX * Math.cos(angle),
        y: archCenterY - radiusY * Math.sin(angle),
        nx: normalX / magnitude,
        ny: normalY / magnitude,
      });
    }
    for (let index = 1; index <= 12; index++) {
      const y = archCenterY + ((rect.height - (archCenterY - rect.top)) * index) / 13;
      perimeter.push({ x: rect.left, y, nx: -1, ny: 0.03 * (index / 13) });
    }
    for (let index = 1; index <= 12; index++) {
      const y = archCenterY + ((rect.height - (archCenterY - rect.top)) * index) / 13;
      perimeter.push({ x: rect.right, y, nx: 1, ny: 0.03 * (index / 13) });
    }
    const travel = Math.max(window.innerWidth, window.innerHeight) * 0.76;
    butterflies.value = perimeter.map((point, index) => {
      const tangent = (index % 3 - 1) * 0.075;
      const vectorX = point.nx - point.ny * tangent;
      const vectorY = point.ny + point.nx * tangent;
      const length = Math.hypot(vectorX, vectorY);
      const dx = (vectorX / length) * travel;
      const dy = (vectorY / length) * travel;
      return {
        index,
        originX: `${point.x}px`,
        originY: `${point.y}px`,
        x: `${dx}px`,
        y: `${dy}px`,
        midX: `${dx * 0.58}px`,
        midY: `${dy * 0.58}px`,
        delay: `${index * 0.045}s`,
        ...butterflyPalette[index % butterflyPalette.length],
      };
    });
  }
  const paths = introRoot.value?.querySelectorAll(".vine-line") || [];
  paths.forEach((path, index) => {
    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;
    path.style.transition = `stroke-dashoffset 2.4s cubic-bezier(.2,.7,.3,1) ${index * 70}ms`;
  });
  vineFrame = requestAnimationFrame(() => {
    vineFrame = requestAnimationFrame(() => {
      paths.forEach((path) => { path.style.strokeDashoffset = "0"; });
    });
  });
});
onUnmounted(() => {
  timers.forEach(clearTimeout);
  cancelAnimationFrame(vineFrame);
  document.body.style.overflow = previousOverflow;
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <section
    ref="introRoot"
    class="forest-intro"
    :class="{ 'is-opening': opened }"
    role="dialog"
    aria-modal="true"
    aria-labelledby="intro-title"
    aria-describedby="intro-hint"
    :style="{ '--intro-forest': `url('${forestImageUrl}')` }"
  >
    <div class="intro-atmosphere" aria-hidden="true"></div>
    <div class="intro-stars" aria-hidden="true">
      <i v-for="fly in fireflies" :key="fly.index" :style="{ left: fly.x, top: fly.y, '--n': fly.index }"></i>
    </div>
    <div class="intro-heading">
      <span>FOREST &amp; STILLNESS</span>
      <h1 id="intro-title">先停一停，<em>再走进森林。</em></h1>
    </div>

    <div class="intro-arch" aria-hidden="true">
      <div class="intro-view">
        <span class="intro-view-light"></span>
      </div>
      <div class="intro-door"></div>
      <div class="intro-stone"></div>
      <div class="intro-floor-light"></div>
    </div>

    <svg class="intro-vines" viewBox="0 0 800 900" aria-label="藤蔓上的花朵">
      <path v-for="(vine, index) in vines" :key="index" :d="vine" pathLength="1" class="vine-line" />
      <g
        v-for="(leaf, index) in leaves"
        :key="`leaf-${index}`"
        class="vine-leaf"
        :transform="`translate(${leaf.x} ${leaf.y}) rotate(${leaf.angle})`"
        :style="{ '--leaf-delay': leaf.delay }"
        aria-hidden="true"
      >
        <path d="M0 0 C7 -11 20 -12 27 -5 C21 4 9 7 0 0Z" />
        <path class="leaf-vein" d="M1 0 24 -5" />
      </g>
      <g
        v-for="(flower, index) in flowers"
        :key="index"
        class="intro-flower"
        :class="{ bloomed: touched.includes(index) }"
        :transform="`translate(${flower.x} ${flower.y})`"
        role="button"
        tabindex="0"
        :aria-label="`${touched.includes(index) ? '已点亮' : '点亮'}第 ${index + 1} 朵花`"
        :aria-pressed="touched.includes(index)"
        @click="bloom(index)"
        @keydown.enter.prevent="bloom(index)"
        @keydown.space.prevent="bloom(index)"
      >
        <circle class="flower-halo" r="34" :fill="flower.color" />
        <circle class="flower-focus" r="26" />
        <g
          v-for="petal in flower.petals"
          :key="petal"
          :transform="`rotate(${(360 / flower.petals) * petal})`"
        >
          <ellipse class="flower-petal" rx="5.2" ry="10.5" :fill="flower.color" />
        </g>
        <circle r="5" fill="#f7df9e" />
      </g>
    </svg>

    <div class="intro-butterflies" aria-hidden="true">
      <span
        v-for="butterfly in butterflies"
        :key="butterfly.index"
        class="intro-butterfly"
        :style="{
          left: butterfly.originX,
          top: butterfly.originY,
          '--fly-x': butterfly.x,
          '--fly-y': butterfly.y,
          '--fly-mid-x': butterfly.midX,
          '--fly-mid-y': butterfly.midY,
          '--fly-delay': butterfly.delay,
        }"
      >
        <svg viewBox="0 0 100 80" role="img" aria-label="蝴蝶">
          <g class="butterfly-wings" :style="{ '--flap-delay': `${butterfly.index * -0.025}s` }">
            <g>
              <path class="butterfly-wing" d="M49 42 C42 28 34 10 21 8 C11 7 7 17 10 29 C14 40 30 46 47 46Z" :fill="butterfly.wing" :stroke="butterfly.edge" />
              <path class="butterfly-wing" d="M47 46 C34 41 20 43 16 55 C14 65 26 72 37 65 C44 60 47 52 49 46Z" :fill="butterfly.wing" :stroke="butterfly.edge" />
              <path class="butterfly-vein" d="M48 44 17 17 M46 45 13 30 M46 47 21 54 M45 49 29 65" :stroke="butterfly.mark" />
              <circle class="butterfly-eyespot" cx="23" cy="23" r="3.2" :fill="butterfly.mark" />
              <circle class="butterfly-eyespot" cx="26" cy="55" r="2.5" :fill="butterfly.mark" />
            </g>
            <g transform="translate(100 0) scale(-1 1)">
              <path class="butterfly-wing" d="M49 42 C42 28 34 10 21 8 C11 7 7 17 10 29 C14 40 30 46 47 46Z" :fill="butterfly.wing" :stroke="butterfly.edge" />
              <path class="butterfly-wing" d="M47 46 C34 41 20 43 16 55 C14 65 26 72 37 65 C44 60 47 52 49 46Z" :fill="butterfly.wing" :stroke="butterfly.edge" />
              <path class="butterfly-vein" d="M48 44 17 17 M46 45 13 30 M46 47 21 54 M45 49 29 65" :stroke="butterfly.mark" />
              <circle class="butterfly-eyespot" cx="23" cy="23" r="3.2" :fill="butterfly.mark" />
              <circle class="butterfly-eyespot" cx="26" cy="55" r="2.5" :fill="butterfly.mark" />
            </g>
          </g>
          <path class="butterfly-body" d="M50 36 C46 42 47 55 50 62 C53 55 54 42 50 36Z" />
          <circle class="butterfly-head" cx="50" cy="35" r="3" />
          <path class="butterfly-antenna" d="M49 34 Q44 24 39 25 M51 34 Q56 24 61 25" />
        </svg>
      </span>
    </div>

    <div class="intro-footer">
      <p id="intro-hint" aria-live="polite">{{ hint }}</p>
      <div class="intro-progress" aria-label="唤醒进度">
        <i v-for="n in 3" :key="n" :class="{ lit: progress >= n }"></i>
      </div>
    </div>
    <button class="intro-skip" type="button" @click="skip">轻轻跳过 <span aria-hidden="true">↗</span></button>
    <div class="intro-flash" aria-hidden="true"></div>
  </section>
</template>

<style scoped>
.forest-intro {
  --ink: #f4f1dc;
  position: fixed;
  z-index: 100;
  inset: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  color: var(--ink);
  isolation: isolate;
  background:
    radial-gradient(ellipse at 50% 53%, #496a48 0%, #243f35 38%, transparent 73%),
    linear-gradient(180deg, #102b29 0%, #1a392f 67%, #0e211d 100%);
  animation: intro-appear 1.1s ease both;
}
.intro-atmosphere {
  position: absolute;
  inset: -10%;
  opacity: .5;
  background:
    radial-gradient(ellipse at 12% 45%, #adc77e24 0 1%, transparent 32%),
    radial-gradient(ellipse at 87% 42%, #b8ca8124 0 1%, transparent 33%),
    radial-gradient(ellipse at 50% 92%, #101a152c, transparent 62%);
  filter: blur(12px);
}
.intro-stars { position: absolute; inset: 0; pointer-events: none; }
.intro-stars i {
  position: absolute;
  left: calc((var(--n) * 43 + 7) % 97 * 1%);
  top: calc((var(--n) * 31 + 11) % 87 * 1%);
  width: 3px; height: 3px; border-radius: 50%;
  background: #f4eab4; opacity: .38;
  box-shadow: 0 0 10px 3px #f2db9d50;
  animation: firefly 3.8s ease-in-out calc(var(--n) * -0.37s) infinite alternate;
}
.intro-heading {
  position: absolute; z-index: 6; top: max(6vh, 28px); left: 20px; right: 20px;
  text-align: center; animation: rise-in 1s .2s both;
}
.intro-heading > span { font-size: 9px; letter-spacing: .34em; color: #d6d8ae; opacity: .78; }
.intro-heading h1 { margin: 14px 0 0; font: 500 clamp(1.35rem, 3.3vw, 2.5rem)/1.4 var(--serif, Georgia, serif); letter-spacing: .1em; text-shadow: 0 2px 22px #081b15a6; }
.intro-heading em { font-style: normal; color: #e6d59c; }
.intro-arch {
  position: absolute; left: 50%; top: 50%; width: min(82vw, 520px); height: min(70vh, 640px);
  transform: translate(-50%, -46%); perspective: 1200px;
}
.intro-view {
  position: absolute; inset: 4% 17% 0; overflow: hidden;
  border-radius: 50% 50% 0 0 / 32% 32% 0 0;
  background-image: linear-gradient(180deg, #f3d58c22, #12271b44), var(--intro-forest);
  background-size: cover; background-position: center;
  filter: brightness(.73) saturate(.83); box-shadow: inset 0 0 70px #101d16;
}
.intro-view-light { position: absolute; inset: 0; opacity: 0; background: radial-gradient(ellipse at 50% 70%, #fff1c3a6, #edcf8d30 55%, transparent 78%); transition: opacity 1.5s ease; }
.intro-door {
  position: absolute; z-index: 2; inset: 4% 17% 0; transform-origin: left center;
  border-radius: 50% 50% 0 0 / 32% 32% 0 0;
  background:
    linear-gradient(90deg, #18291f99, transparent 25% 80%, #14261e66),
    repeating-linear-gradient(0deg, transparent 0 22%, #10241b4a 23% 23.5%, transparent 24% 25%),
    repeating-linear-gradient(90deg, #65583c, #81734f 9%, #63573e 17%, #4b503a 19%);
  border: 8px solid #738064; box-shadow: inset 0 0 0 3px #b4ac7c55, inset 0 0 32px #101c16, 0 10px 28px #091a1590;
  transition: transform 2.2s cubic-bezier(.2,.75,.18,1), filter 1s ease;
  backface-visibility: hidden;
}
.intro-door::after { content: ""; position: absolute; top: 48%; right: 9%; width: 10px; height: 10px; border-radius: 50%; background: #dfbd78; box-shadow: 0 0 12px #f9df9a; }
.intro-stone {
  position: absolute; z-index: 3; inset: 0 12% -2%; pointer-events: none;
  border: clamp(11px, 2.7vw, 24px) solid #64745d; border-bottom: 0;
  border-radius: 50% 50% 0 0 / 32% 32% 0 0;
  box-shadow: inset 4px 0 8px #c0c89b3d, inset -6px 0 9px #17281eaa, 0 15px 30px #08191377;
}
.intro-stone::before { content: ""; position: absolute; inset: 2% 2% 0; border: 1px solid #c1c69b35; border-bottom: 0; border-radius: inherit; }
.intro-floor-light { position: absolute; z-index: 1; left: 2%; right: 2%; bottom: -8%; height: 18%; opacity: 0; background: radial-gradient(ellipse, #f6d99b91, transparent 70%); filter: blur(9px); transition: opacity 1s ease; }
.intro-vines { position: absolute; z-index: 5; width: min(100vw, 670px); height: min(92vh, 760px); left: 50%; top: 51%; transform: translate(-50%, -48%); overflow: visible; }
.vine-line { fill: none; stroke: #789c68; stroke-width: 6; stroke-linecap: round; filter: drop-shadow(0 2px 5px #0b2019); }
.vine-line:nth-child(2) { stroke: #89a66d; stroke-width: 5.5; }
.vine-line:nth-child(n + 3) { stroke: #83a36b; stroke-width: 3.4; opacity: .94; }
.vine-line:nth-child(4n + 3) { stroke: #779860; stroke-width: 3; }
.vine-line:nth-child(5n + 4) { stroke: #91aa70; stroke-width: 3.8; }
.vine-leaf { transform-box: view-box; transform-origin: 0 0; }
.vine-leaf path:first-child { fill: #88a966; stroke: #bdd09a75; stroke-width: 1; transform-box: fill-box; transform-origin: left center; transform: scaleX(0); animation: leaf-unfurl .55s cubic-bezier(.2,.8,.25,1) var(--leaf-delay) both; filter: drop-shadow(0 1px 3px #11291b); }
.vine-leaf .leaf-vein { fill: none; stroke: #d3dfa477; stroke-width: 1; stroke-linecap: round; opacity: 0; animation: leaf-vein-in .3s ease var(--leaf-delay) both; }
.intro-flower { cursor: pointer; outline: none; transform-box: fill-box; transform-origin: center; transition: transform .4s cubic-bezier(.2,.8,.2,1); }
.intro-flower:hover .flower-halo { opacity: .42; }
.flower-halo { opacity: .17; filter: blur(9px); transition: opacity .6s ease, r .6s ease; }
.flower-focus { fill: transparent; stroke: transparent; }
.intro-flower:focus-visible .flower-focus { stroke: #fff9dc; stroke-width: 2; }
.flower-petal { stroke: #fff4d65c; stroke-width: 1; transform-box: fill-box; transform-origin: center; transform: translateY(-11px) scale(.64); transition: transform .5s cubic-bezier(.1,.8,.3,1), filter .5s ease; }
.intro-flower.bloomed .flower-petal { transform: translateY(-11px) scale(1); }
.intro-flower.bloomed .flower-petal { filter: drop-shadow(0 0 5px #f5dfa0); }
.intro-flower.bloomed .flower-halo { opacity: .68; r: 45px; }
.intro-butterflies { position: absolute; inset: 0; z-index: 8; overflow: hidden; pointer-events: none; opacity: 0; }
.intro-butterfly { position: absolute; display: block; width: clamp(26px, 4vw, 42px); height: clamp(22px, 3.4vw, 36px); opacity: 0; will-change: transform, opacity; filter: drop-shadow(0 2px 4px #07180c88); }
.intro-butterfly svg { display: block; width: 100%; height: 100%; overflow: visible; }
.butterfly-wings { transform-box: view-box; transform-origin: 50px 44px; animation: butterfly-flap .22s ease-in-out var(--flap-delay) infinite alternate; }
.butterfly-wing { stroke-width: 1.35; stroke-linejoin: round; }
.butterfly-vein { fill: none; stroke-width: .8; stroke-linecap: round; opacity: .8; }
.butterfly-eyespot { stroke: #574b46; stroke-width: .9; }
.butterfly-body { fill: #342f2a; }
.butterfly-head { fill: #292922; }
.butterfly-antenna { fill: none; stroke: #39352f; stroke-width: 1.2; stroke-linecap: round; }
.intro-footer { position: absolute; z-index: 7; left: 16px; right: 16px; bottom: max(6vh, 28px); display: grid; justify-items: center; gap: 13px; text-align: center; }
.intro-footer p { margin: 0; font: 500 clamp(1rem, 2vw, 1.3rem)/1.5 var(--serif, Georgia, serif); letter-spacing: .08em; color: #eee8cc; text-shadow: 0 2px 16px #071a14; }
.intro-progress { display: flex; gap: 9px; }
.intro-progress i { width: 7px; height: 7px; border: 1px solid #e9e0bb9c; border-radius: 50%; transition: background .35s ease, box-shadow .35s ease; }
.intro-progress i.lit { background: #ead194; border-color: #ead194; box-shadow: 0 0 12px #f2d38b; }
.intro-skip { position: absolute; z-index: 10; right: max(24px, env(safe-area-inset-right)); top: max(24px, env(safe-area-inset-top)); padding: 10px 14px; border: 1px solid #e4e3c847; border-radius: 99px; color: #f4f1d9; background: #12271c5c; font-size: 12px; letter-spacing: .06em; backdrop-filter: blur(8px); }
.intro-skip span { margin-left: 6px; color: #e7d298; }
.intro-skip:hover { background: #d2ca9b2b; }
.intro-flash { position: absolute; z-index: 9; inset: 0; pointer-events: none; opacity: 0; background: #fff6d6; }
.forest-intro.is-opening .intro-door { transform: rotateY(-110deg); filter: brightness(1.3); }
.forest-intro.is-opening .intro-view-light, .forest-intro.is-opening .intro-floor-light { opacity: 1; }
.forest-intro.is-opening .intro-butterflies { opacity: 1; }
.forest-intro.is-opening .intro-butterfly { animation: butterfly-flight 5.2s cubic-bezier(.18,.72,.35,1) var(--fly-delay) both; }
.forest-intro.is-opening .intro-flash { animation: soft-flash 1.4s 1.1s ease-out both; }
@keyframes intro-appear { from { opacity: 0; } to { opacity: 1; } }
@keyframes rise-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@keyframes firefly { from { transform: translateY(0) scale(.7); opacity: .16; } to { transform: translateY(-18px) scale(1.3); opacity: .78; } }
@keyframes leaf-unfurl { from { transform: scaleX(0); } 70% { transform: scaleX(1.16); } to { transform: scaleX(1); } }
@keyframes leaf-vein-in { from { opacity: 0; } to { opacity: .8; } }
@keyframes butterfly-flight {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(.18) rotate(-18deg); }
  12% { opacity: .95; }
  62% { opacity: .9; transform: translate(calc(-50% + var(--fly-mid-x)), calc(-50% + var(--fly-mid-y))) scale(1) rotate(12deg); }
  100% { opacity: 0; transform: translate(calc(-50% + var(--fly-x)), calc(-50% + var(--fly-y))) scale(.58) rotate(-12deg); }
}
@keyframes butterfly-flap { from { transform: scaleX(.24); } to { transform: scaleX(1); } }
@keyframes soft-flash { 0% { opacity: 0; } 30% { opacity: .3; } 100% { opacity: 0; } }
@media (max-width: 600px) {
  .intro-heading { top: max(11vh, 72px); }
  .intro-arch { width: min(92vw, 420px); height: min(58vh, 510px); transform: translate(-50%, -43%); }
  .intro-vines { width: min(112vw, 620px); height: 72vh; top: 51%; }
  .intro-footer { bottom: max(8vh, 32px); }
  .intro-skip { top: max(16px, env(safe-area-inset-top)); right: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .forest-intro *, .forest-intro *::before, .forest-intro *::after { animation-duration: .01ms !important; animation-delay: 0ms !important; transition-duration: .01ms !important; }
}
</style>
