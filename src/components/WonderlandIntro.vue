<script setup>
import { nextTick, onMounted, onUnmounted, ref } from "vue";

const emit = defineEmits(["enter"]);
const root = ref(null);
const scene = ref(null);
const door = ref(null);
const pathRefs = [];
const opened = ref(false);
const zooming = ref(false);
const litFlowers = ref([]);
const vines = ref([
  { id: "vine-a", kind: "frame", color: "#d8a2dc", d: "M205 810 C181 770 221 726 189 686 C159 648 185 621 163 583 C140 545 171 515 156 474 C140 433 174 405 160 367 C146 329 177 298 169 264 C159 221 191 190 219 163 C246 137 270 153 285 177 C301 203 281 222 264 208 C253 199 261 185 272 188" },
  { id: "vine-b", kind: "wrap", color: "#f3b57f", d: "M585 742 C553 713 579 674 552 648 C525 621 495 638 472 617 C449 596 466 574 493 566 C523 558 541 584 526 600 C516 610 502 601 505 590 C507 583 514 584 516 589" },
  { id: "vine-c", kind: "wrap", color: "#e79bb4", d: "M213 592 C247 579 257 546 288 531 C322 514 353 534 378 517 C402 501 395 472 368 467 C344 462 329 481 341 496 C350 507 366 500 360 489" },
  { id: "vine-d", kind: "frame", color: "#efce7d", d: "M600 810 C620 771 577 738 614 701 C651 665 617 631 649 598 C677 569 651 537 667 506 C683 472 656 445 678 415 C700 384 667 352 686 322 C706 290 677 267 665 241 C652 211 624 219 621 241 C618 257 634 266 643 254" },
  { id: "vine-e", kind: "wrap", color: "#91d3bd", d: "M589 463 C553 445 543 416 512 403 C480 390 457 411 433 394 C409 378 421 352 448 346 C470 341 485 359 472 374 C463 384 449 377 454 366" },
  { id: "vine-f", kind: "frame", color: "#f2a1c8", d: "M400 190 C378 163 383 134 363 111 C342 86 320 101 325 120 C329 136 346 137 350 124 C353 115 343 110 338 117" },
]);
const flowers = ref(vines.value.map((vine, index) => ({
  id: vine.id,
  color: vine.color,
  petals: index % 2 ? 6 : 7,
  x: 400,
  y: 200,
  index,
})));
const motes = Array.from({ length: 26 }, (_, index) => ({
  index,
  left: `${(index * 37 + 9) % 100}%`,
  dx: `${((index * 29) % 121) - 60}px`,
  duration: `${9 + ((index * 17) % 90) / 10}s`,
  delay: `${-((index * 23) % 140) / 10}s`,
  size: `${0.65 + ((index * 13) % 60) / 100}`,
}));
const butterflies = ref([]);
const petals = ref([]);
const timers = [];
let frame = 0;
let previousOverflow = "";
let openingStarted = false;

function setPathRef(index, element) {
  if (element) pathRefs[index] = element;
}

function later(callback, delay) {
  const timer = window.setTimeout(callback, delay);
  timers.push(timer);
  return timer;
}

function touchFlower(flower) {
  if (openingStarted || litFlowers.value.includes(flower.index)) return;
  litFlowers.value = [...litFlowers.value, flower.index];
  const vine = vines.value[flower.index];
  if (vine.kind === "wrap") {
    const path = pathRefs[flower.index];
    path?.parentElement?.querySelectorAll(".vine-stroke, .vine-highlight").forEach((line) => {
      line.animate(
        [{ strokeDashoffset: 0 }, { strokeDashoffset: 1 }],
        { delay: 120, duration: 1150, easing: "ease-in-out", fill: "forwards" },
      );
    });
  }
  if (litFlowers.value.length >= 3) later(openDoor, 700);
}

function buildVineDetails() {
  const allVines = vines.value.map((vine, index) => {
    const path = pathRefs[index];
    if (!path) return vine;
    const length = path.getTotalLength();
    const count = Math.max(8, Math.floor(length / 31));
    const leaves = [];
    const branches = [];
    for (let leafIndex = 1; leafIndex <= count; leafIndex++) {
      const t = leafIndex / (count + 1);
      const point = path.getPointAtLength(t * length);
      const before = path.getPointAtLength(Math.max(0, t * length - 3));
      const after = path.getPointAtLength(Math.min(length, t * length + 3));
      const angle = Math.atan2(after.y - before.y, after.x - before.x) * 180 / Math.PI;
      const side = (leafIndex + index) % 2 ? 1 : -1;
      const sway = ((leafIndex * 13 + index * 7) % 31) - 15;
      leaves.push({
        id: `${vine.id}-leaf-${leafIndex}`,
        x: point.x.toFixed(1),
        y: point.y.toFixed(1),
        angle: (angle + side * (48 + ((leafIndex * 17 + index * 11) % 25)) + sway).toFixed(0),
        scale: (0.42 + ((leafIndex * 19 + index * 13) % 44) / 100).toFixed(2),
        delay: `${300 + index * 250 + Math.round(t * 1500)}ms`,
        color: ["#3d8a48", "#4e9c52", "#2f7a40", "#76a852"][(leafIndex + index) % 4],
      });
      if (leafIndex % 4 === (index % 3)) {
        const sideBend = side * (15 + ((leafIndex * 9 + index * 5) % 15));
        branches.push({
          id: `${vine.id}-branch-${leafIndex}`,
          d: `M${point.x.toFixed(1)} ${point.y.toFixed(1)} q${sideBend} -19 ${sideBend + side * 10} -8 t${side * 11} 14`,
          delay: `${850 + index * 180 + leafIndex * 34}ms`,
        });
      }
    }
    const end = path.getPointAtLength(length);
    flowers.value[index].x = Number(end.x.toFixed(1));
    flowers.value[index].y = Number(end.y.toFixed(1));
    return { ...vine, leaves, branches };
  });
  vines.value = allVines;
}

function growVines() {
  pathRefs.forEach((path, index) => {
    if (!path) return;
    path.parentElement?.querySelectorAll(".vine-stroke, .vine-highlight").forEach((line) => {
      line.style.strokeDasharray = "1";
      line.style.strokeDashoffset = "1";
      line.animate(
        [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
        { delay: 300 + index * 230, duration: 1600, easing: "cubic-bezier(.4,.1,.3,1)", fill: "forwards" },
      );
    });
  });
}

function releaseButterflies() {
  const bounds = root.value?.getBoundingClientRect();
  const doorway = scene.value?.querySelector(".doorway")?.getBoundingClientRect();
  if (!bounds || !doorway) return;
  const centerX = doorway.left + doorway.width / 2 - bounds.left;
  const centerY = doorway.top + doorway.height * 0.45 - bounds.top;
  const travel = Math.hypot(bounds.width, bounds.height) * 0.76;
  butterflies.value = Array.from({ length: 36 }, (_, index) => {
    const angle = -Math.PI / 2 + index * 2.399963 + ((index % 5) - 2) * 0.11;
    const distance = travel * (0.78 + ((index * 17) % 25) / 100);
    return {
      id: `butterfly-${index}`,
      x: `${centerX}px`,
      y: `${centerY}px`,
      dx: `${Math.cos(angle) * distance}px`,
      dy: `${Math.sin(angle) * distance}px`,
      midX: `${Math.cos(angle) * distance * 0.58}px`,
      midY: `${Math.sin(angle) * distance * 0.58}px`,
      delay: `${index * 48}ms`,
      flap: `${0.14 + ((index * 11) % 15) / 100}s`,
      palette: index % 6,
      turn: `${((index * 37) % 36) - 18}deg`,
    };
  });
}

function makePetals() {
  petals.value = Array.from({ length: 32 }, (_, index) => ({
    id: `petal-${index}`,
    x: `${((index * 67) % 480) + 160}`,
    y: `${((index * 47) % 410) + 280}`,
    dx: `${((index * 31) % 150) - 75}px`,
    duration: `${1400 + ((index * 97) % 900)}ms`,
    delay: `${(index * 79) % 950}ms`,
    color: vines.value[index % vines.value.length].color,
    turn: `${(index * 73) % 360}deg`,
  }));
}

function openDoor() {
  if (openingStarted) return;
  openingStarted = true;
  opened.value = true;
  makePetals();
  litFlowers.value = flowers.value.map((flower) => flower.index);
  later(() => {
    releaseButterflies();
    later(() => {
      zooming.value = true;
      later(() => emit("enter"), 1700);
    }, 6500);
  }, 1350);
}

function skip() {
  timers.forEach(window.clearTimeout);
  emit("enter");
}

function onKeydown(event) {
  if (event.key === "Escape") skip();
}

onMounted(async () => {
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  window.addEventListener("keydown", onKeydown);
  await nextTick();
  buildVineDetails();
  frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(growVines);
  });
  root.value?.querySelector(".intro-skip")?.focus({ preventScroll: true });
});

onUnmounted(() => {
  timers.forEach(window.clearTimeout);
  cancelAnimationFrame(frame);
  document.body.style.overflow = previousOverflow;
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <section ref="root" class="wonder-intro" :class="{ 'is-opening': opened, 'is-zooming': zooming }" role="dialog" aria-modal="true" aria-labelledby="wonder-title" aria-describedby="wonder-hint">
    <div class="wall" aria-hidden="true"></div>
    <div class="motes" aria-hidden="true">
      <i v-for="mote in motes" :key="mote.index" :style="{ left: mote.left, '--dx': mote.dx, animationDuration: mote.duration, animationDelay: mote.delay, transform: `scale(${mote.size})` }"></i>
    </div>

    <div ref="scene" class="scene">
      <svg class="frame" viewBox="0 0 800 900" aria-hidden="true">
        <defs>
          <linearGradient id="wonder-stone" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5b6a5c"/><stop offset=".5" stop-color="#7d8b7c"/><stop offset="1" stop-color="#526156"/></linearGradient>
          <radialGradient id="wonder-floor"><stop offset="0" stop-color="#ffd98a" stop-opacity=".4"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
          <filter id="wonder-shadow"><feGaussianBlur stdDeviation="14"/></filter>
        </defs>
        <ellipse cx="400" cy="835" rx="330" ry="34" fill="#000" opacity=".4" filter="url(#wonder-shadow)"/>
        <path d="M200 812V330A200 200 0 0 1 600 330V812Z" fill="url(#wonder-stone)"/>
        <path d="M200 330A200 200 0 0 1 600 330 M200 392H250M550 422H600M200 516H250M550 546H600M200 640H250M550 670H600M200 764H250M550 794H600" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="2"/>
        <path d="M200 812V330A200 200 0 0 1 600 330V812Z" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="3"/>
        <rect x="170" y="800" width="460" height="38" rx="6" fill="#4a5749"/><rect x="170" y="800" width="460" height="6" fill="rgba(255,255,255,.12)"/>
        <ellipse class="floor-glow" cx="400" cy="830" rx="250" ry="42" fill="url(#wonder-floor)"/>
      </svg>
      <div class="doorway"><div class="sway"></div></div>
      <div class="leak"></div>
      <div ref="door" class="door">
        <div class="door-face front">
          <svg viewBox="0 0 300 620" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="wonder-wood" x1="0" x2="1"><stop offset="0" stop-color="#8d5b30"/><stop offset=".5" stop-color="#a06a3a"/><stop offset="1" stop-color="#7a4b28"/></linearGradient>
              <filter id="wonder-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012 .24" numOctaves="3" seed="4"/><feColorMatrix values="0 0 0 0 .22 0 0 0 0 .12 0 0 0 0 .05 0 0 0 1.1 -.3"/></filter>
              <radialGradient id="wonder-brass" cx=".35" cy=".3"><stop offset="0" stop-color="#fff0a8"/><stop offset=".5" stop-color="#d9a73a"/><stop offset="1" stop-color="#8a6420"/></radialGradient>
            </defs>
            <rect width="300" height="620" fill="url(#wonder-wood)"/><rect width="300" height="620" filter="url(#wonder-grain)" opacity=".75"/>
            <g stroke="#2b1709" stroke-width="3" opacity=".75"><path d="M50 0V620M100 0V620M150 0V620M200 0V620M250 0V620"/></g>
            <g stroke="#c48a52" stroke-width="1.2" opacity=".45"><path d="M52 0V620M102 0V620M152 0V620M202 0V620M252 0V620"/></g>
            <g fill="#2a2625"><rect y="170" width="300" height="20"/><rect y="440" width="300" height="20"/></g>
            <g fill="#6d6560"><circle cx="20" cy="180" r="3.4"/><circle cx="80" cy="180" r="3.4"/><circle cx="140" cy="180" r="3.4"/><circle cx="200" cy="180" r="3.4"/><circle cx="260" cy="180" r="3.4"/><circle cx="20" cy="450" r="3.4"/><circle cx="80" cy="450" r="3.4"/><circle cx="140" cy="450" r="3.4"/><circle cx="200" cy="450" r="3.4"/><circle cx="260" cy="450" r="3.4"/></g>
            <circle cx="262" cy="325" r="24" fill="#2a2625"/><circle cx="262" cy="325" r="19" fill="url(#wonder-brass)"/><circle cx="256" cy="319" r="5" fill="#fff6c0" opacity=".7"/>
          </svg>
          <div class="door-shade"></div>
        </div>
        <div class="door-face back"></div>
      </div>
      <div class="keyglow"></div>
      <svg class="vines" viewBox="0 0 800 900" aria-label="绕着门生长的藤蔓">
        <g v-for="(vine, index) in vines" :key="vine.id" :data-kind="vine.kind">
          <path :ref="(el) => setPathRef(index, el)" class="vine-stroke" :d="vine.d" pathLength="1"/>
          <path class="vine-highlight" :d="vine.d" pathLength="1"/>
          <path v-for="branch in vine.branches || []" :key="branch.id" class="tendril" :d="branch.d" :style="{ '--branch-delay': branch.delay }"/>
          <g v-for="leaf in vine.leaves || []" :key="leaf.id" class="leaf-wrap" :transform="`translate(${leaf.x} ${leaf.y}) rotate(${leaf.angle}) scale(${leaf.scale})`" :style="{ '--leaf-delay': leaf.delay }">
            <path class="leaf" d="M0 0C6-10 18-10 27 0C18 10 6 10 0 0Z" :fill="leaf.color"/>
            <path class="leaf-vein" d="M1 0 24 0"/>
          </g>
          <g v-for="flower in [flowers[index]]" :key="flower.id" class="flower" :class="{ bloom: litFlowers.includes(index) }" :style="{ '--halo-delay': `${-index * 0.5}s` }" :transform="`translate(${flower.x} ${flower.y})`" role="button" tabindex="0" :aria-label="`${litFlowers.includes(index) ? '已点亮' : '点亮'}第 ${index + 1} 朵花`" :aria-pressed="litFlowers.includes(index)" @click="touchFlower(flower)" @keydown.enter.prevent="touchFlower(flower)" @keydown.space.prevent="touchFlower(flower)">
            <defs><radialGradient :id="`flower-halo-${index}`"><stop offset="0" stop-color="#fff3b0" stop-opacity=".95"/><stop offset="1" stop-color="#ffd36a" stop-opacity="0"/></radialGradient></defs>
            <circle class="halo" r="36" :fill="`url(#flower-halo-${index})`"/>
            <circle class="flower-ring" r="28"/>
            <g class="flower-petals"><ellipse v-for="petal in flower.petals" :key="petal" cx="0" cy="-12" rx="8.5" ry="14" :transform="`rotate(${petal * 360 / flower.petals})`" :fill="flower.color" stroke="rgba(0,0,0,.18)" stroke-width=".8"/></g>
            <circle r="5.5" fill="#e8b13a" stroke="rgba(0,0,0,.2)" stroke-width=".8"/>
            <circle r="30" fill="transparent"/>
          </g>
        </g>
        <ellipse v-for="petal in petals" :key="petal.id" class="falling-petal" :cx="petal.x" :cy="petal.y" rx="4" ry="7" :fill="petal.color" :style="{ '--petal-dx': petal.dx, '--petal-duration': petal.duration, '--petal-delay': petal.delay, '--petal-turn': petal.turn }"/>
      </svg>
    </div>

    <div class="hint" :class="{ fading: opened }" aria-live="polite">
      <p id="wonder-hint">{{ opened ? "门后的森林，已经醒来。" : litFlowers.length ? "藤蔓正慢慢松开，光也亮了起来。" : "轻触三朵花，唤醒森林。" }}</p>
      <div class="dots" aria-hidden="true"><i v-for="n in 3" :key="n" :class="{ on: litFlowers.length >= n }"></i></div>
    </div>
    <div class="rays" :class="{ shining: opened }" aria-hidden="true"></div>
    <div class="flock" aria-hidden="true">
      <div v-for="butterfly in butterflies" :key="butterfly.id" class="bf" :class="`palette-${butterfly.palette}`" :style="{ left: butterfly.x, top: butterfly.y, '--fly-x': butterfly.dx, '--fly-y': butterfly.dy, '--fly-mid-x': butterfly.midX, '--fly-mid-y': butterfly.midY, '--fly-delay': butterfly.delay, '--flap-speed': butterfly.flap, '--turn': butterfly.turn }">
        <svg viewBox="-32 -28 64 56">
          <g class="wings">
            <g><path d="M0 -2C-8-24-32-28-30-9C-29 0-12 3 0 0Z" class="upper-wing"/><path d="M0 1C-10 2-24 6-21 17C-18 26-6 22 0 7Z" class="lower-wing"/><circle cx="-19" cy="-11" r="3.4" class="wing-mark"/><circle cx="-12" cy="-4" r="2" class="wing-mark small"/><circle cx="-12" cy="13" r="2.6" class="wing-mark medium"/></g>
            <g transform="scale(-1 1)"><path d="M0 -2C-8-24-32-28-30-9C-29 0-12 3 0 0Z" class="upper-wing"/><path d="M0 1C-10 2-24 6-21 17C-18 26-6 22 0 7Z" class="lower-wing"/><circle cx="-19" cy="-11" r="3.4" class="wing-mark"/><circle cx="-12" cy="-4" r="2" class="wing-mark small"/><circle cx="-12" cy="13" r="2.6" class="wing-mark medium"/></g>
          </g>
          <ellipse cx="0" cy="0" rx="1.8" ry="10" class="butterfly-body"/><path d="M-1-9-6-19M1-9 6-19" class="antennae"/>
        </svg>
      </div>
    </div>
    <div class="flash" :class="{ shining: zooming }" aria-hidden="true"></div>
    <button class="intro-skip" type="button" @click="skip">轻轻跳过 <span aria-hidden="true">↗</span></button>
  </section>
</template>

<style scoped>
.wonder-intro{--night:#0e2428;--night-2:#153a33;--gold:#ffe6a8;position:fixed;inset:0;z-index:100;overflow:hidden;background:var(--night);color:#fff;font-family:var(--sans,system-ui,sans-serif);isolation:isolate;animation:stage-in .8s ease both}
.wall{position:absolute;inset:0;background:radial-gradient(90vmax 70vmax at 50% 48%,#ffe2a021,transparent 62%),linear-gradient(#10262a,var(--night-2) 62%,#0b1c1a)}
.wall:before{content:"";position:absolute;inset:0;opacity:.4;background:repeating-linear-gradient(0deg,transparent 0 78px,#09181638 79px 81px,transparent 82px 160px),repeating-linear-gradient(90deg,transparent 0 78px,#09181625 79px 81px,transparent 82px 160px);mask-image:radial-gradient(80vmax 70vmax at 50% 45%,#000 20%,transparent 85%)}
.motes{position:absolute;inset:0;pointer-events:none}.motes i{position:absolute;bottom:-10px;width:4px;height:4px;border-radius:50%;background:#ffeaa0;box-shadow:0 0 8px 2px #ffe696b3;opacity:0;animation:mote linear infinite}
.scene{position:absolute;left:50%;top:50%;width:min(800px,125vw,74.66vh);aspect-ratio:8/9;perspective:1500px;perspective-origin:50% 45%;transform:translate(-50%,-47%);transform-origin:50% 53%;transition:transform 1.7s cubic-bezier(.65,0,.9,.45);flex:none}
.scene>svg.frame,.scene>svg.vines{position:absolute;inset:0;width:100%;height:100%;overflow:visible}.scene>svg.vines{z-index:5;pointer-events:none}
.doorway{position:absolute;left:30.75%;top:19.56%;width:38.5%;height:69.78%;overflow:hidden;border-radius:50% 50% 0 0;background:radial-gradient(circle at 50% 65%,#fffdf0,#fff0bf 30%,#ffd98a 62%,#f7a85d);box-shadow:0 0 0 0 #ffd278;transition:filter 1.8s ease,box-shadow 1s ease}
.doorway:before{content:"";position:absolute;inset:0;background:#1a2a24;transition:opacity .6s ease}.is-opening .doorway:before{opacity:0}.sway{position:absolute;inset:-20%;background:conic-gradient(from 0deg at 50% 62%,transparent 0 8%,#ffffff8c 10%,transparent 14% 30%,#ffffff66 32%,transparent 36% 58%,#ffffff80 60%,transparent 65% 80%,#ffffff59 82%,transparent 88%);animation:spin 26s linear infinite;opacity:0;transition:opacity 1s ease .4s}.is-opening .sway{opacity:1}
.leak{position:absolute;left:30.75%;top:19.56%;width:38.5%;height:69.78%;border-radius:50% 50% 0 0;pointer-events:none;z-index:3;box-shadow:inset 0 0 0 0 #ffdc8c;transition:box-shadow .8s ease}.is-opening .leak{box-shadow:inset 0 0 18px 6px #ffdc8ca6}
.door{position:absolute;left:31.25%;top:20%;width:37.5%;height:68.89%;transform-origin:0 50%;transform-style:preserve-3d;z-index:4;transition:transform 1.8s cubic-bezier(.5,0,.2,1)}.door-face{position:absolute;inset:0;border-radius:50% 50% 0 0;overflow:hidden;backface-visibility:hidden}.door-face.front svg{position:absolute;inset:0;width:100%;height:100%;display:block}.door-face.front:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#0006,#ffdc1614 40%,#0004);pointer-events:none}.door-face.back{transform:rotateY(180deg);background:linear-gradient(90deg,#3a2414,#4b2f1b)}.door-shade{position:absolute;inset:0;background:#0a0604;opacity:0;z-index:2;transition:opacity 1.8s ease}.keyglow{position:absolute;left:52.5%;top:40%;width:2.75%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,#fff2b8,#ffdc7800 70%);opacity:.55;z-index:4;pointer-events:none}
.vines .vine-stroke{fill:none;stroke:#2c6a3a;stroke-width:7;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;filter:drop-shadow(0 1px 2px #102d19)}.vines [data-kind="wrap"] .vine-stroke{stroke:#357d43}.vines .vine-highlight{fill:none;stroke:#70ae68;stroke-width:2.4;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;pointer-events:none}.vines .tendril{fill:none;stroke:#3f8a49;stroke-width:2;stroke-linecap:round;opacity:0;animation:tend-in .6s ease var(--branch-delay) both}.leaf-wrap{transform-box:view-box;transform-origin:center}.leaf{stroke:#1c542c66;stroke-width:1;transform-box:fill-box;transform-origin:left center;transform:scaleX(0);animation:leaf-unfurl .55s cubic-bezier(.2,.8,.3,1) var(--leaf-delay) both}.leaf-vein{fill:none;stroke:#c6dc8b8f;stroke-width:1;stroke-linecap:round}.flower{pointer-events:auto;cursor:pointer;outline:none}.flower .halo{transform-box:fill-box;transform-origin:center;animation:halo 2.6s ease-in-out infinite;animation-delay:var(--halo-delay,0s)}.flower-ring{fill:none;stroke:transparent}.flower:focus-visible .flower-ring{stroke:#fff;stroke-width:2.5}.flower-petals{transform-box:fill-box;transform-origin:center;transform:scale(.45);transition:transform .75s cubic-bezier(.2,.8,.3,1)}.flower.bloom .flower-petals{transform:scale(1) rotate(24deg)}.flower.bloom .halo{animation:none;opacity:.8}.floor-glow{opacity:0;transition:opacity 1.5s ease}.is-opening .floor-glow{opacity:1}
.hint{position:absolute;left:0;right:0;bottom:max(26px,env(safe-area-inset-bottom));z-index:6;display:grid;justify-items:center;gap:12px;padding:0 16px;text-align:center;transition:opacity .6s ease}.hint p{margin:0;font:italic 500 clamp(1.1rem,2.4vw,1.55rem)/1.3 var(--serif,Georgia,serif);color:#f6e8c4;letter-spacing:.02em;text-shadow:0 2px 16px #0008}.hint.fading{opacity:0}.dots{display:flex;gap:10px}.dots i{width:10px;height:10px;border-radius:50%;border:1.5px solid #f6e8c4b3;transition:background .4s ease,box-shadow .4s ease}.dots i.on{background:#ffd36a;border-color:#ffd36a;box-shadow:0 0 10px #ffc94a}
.rays{position:fixed;inset:0;z-index:2;pointer-events:none;opacity:0;mix-blend-mode:screen;background:conic-gradient(from 170deg at 50% 50%,transparent 0 4%,#ffe9aa47 6%,transparent 9% 20%,#ffe9aa38 23%,transparent 27% 36%,#ffe9aa40 40%,transparent 45% 56%,#ffe9aa38 60%,transparent 64% 100%);mask-image:radial-gradient(circle at 50% 50%,#000,transparent 75%);transition:opacity 1.5s ease}.rays.shining{opacity:1}
.flock{position:absolute;inset:0;z-index:8;pointer-events:none;overflow:hidden}.bf{position:absolute;width:clamp(34px,5vw,64px);height:clamp(30px,4.4vw,56px);margin:-28px 0 0 -32px;opacity:0;will-change:transform,opacity;filter:drop-shadow(0 2px 3px #07180c88)}.bf svg{width:100%;height:100%;overflow:visible;display:block}.bf .wings{transform-box:view-box;transform-origin:0 0;animation:flap var(--flap-speed) ease-in-out infinite alternate}.upper-wing,.lower-wing{stroke-width:1.2;stroke-linejoin:round}.palette-0 .upper-wing{fill:#7fc8ff;stroke:#4a8fe0}.palette-0 .lower-wing{fill:#4a8fe0;stroke:#4a8fe0}.palette-1 .upper-wing{fill:#ff9ecb;stroke:#e0529a}.palette-1 .lower-wing{fill:#e0529a;stroke:#e0529a}.palette-2 .upper-wing{fill:#ffd166;stroke:#f29a3a}.palette-2 .lower-wing{fill:#f29a3a;stroke:#f29a3a}.palette-3 .upper-wing{fill:#b39cff;stroke:#7a5be0}.palette-3 .lower-wing{fill:#7a5be0;stroke:#7a5be0}.palette-4 .upper-wing{fill:#5fe0c4;stroke:#2fae9a}.palette-4 .lower-wing{fill:#2fae9a;stroke:#2fae9a}.palette-5 .upper-wing{fill:#ff8f7a;stroke:#e05a4a}.palette-5 .lower-wing{fill:#e05a4a;stroke:#e05a4a}.wing-mark{fill:#fff;opacity:.8}.wing-mark.small{opacity:.7}.wing-mark.medium{opacity:.6}.butterfly-body{fill:#2a1d24}.antennae{fill:none;stroke:#2a1d24;stroke-width:1}.is-opening .bf{animation:butterfly-flight 5.2s cubic-bezier(.18,.72,.35,1) var(--fly-delay) both}.is-opening .door{transform:rotateY(-112deg)}.is-opening .door-shade{opacity:.82}.is-opening .doorway{filter:brightness(1.2);box-shadow:0 0 50px 14px #ffd27877}.is-opening .hint.fading{opacity:0}.is-zooming .scene{transform:translate(-50%,-47%) scale(2.8)}
.falling-petal{opacity:0}.is-opening .falling-petal{animation:petal-fall var(--petal-duration) ease-in var(--petal-delay) both}.flash{position:fixed;inset:0;z-index:9;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 50%,#fffdf2,#fff0c9 55%,#ffe2a8)}.flash.shining{animation:flash-in 1.7s ease-out both}
.intro-skip{position:absolute;z-index:10;right:max(24px,env(safe-area-inset-right));top:max(24px,env(safe-area-inset-top));padding:10px 14px;border:1px solid #e4e3c847;border-radius:99px;color:#f4f1d9;background:#12271c5c;font-size:12px;letter-spacing:.06em;backdrop-filter:blur(8px)}.intro-skip span{margin-left:6px;color:#e7d298}.intro-skip:focus-visible{outline:2px solid #ffe6a8;outline-offset:3px}
@keyframes stage-in{from{opacity:0}to{opacity:1}}@keyframes mote{0%{opacity:0;transform:translate(0,0)}15%{opacity:.9}85%{opacity:.8}100%{opacity:0;transform:translate(var(--dx),-105vh)}}@keyframes spin{to{transform:rotate(360deg)}}@keyframes halo{0%,100%{transform:scale(.7);opacity:.3}50%{transform:scale(1.15);opacity:.95}}@keyframes leaf-unfurl{0%{transform:scaleX(0)}70%{transform:scaleX(1.15)}100%{transform:scaleX(1)}}@keyframes tend-in{to{opacity:1}}@keyframes flap{from{transform:scaleX(1)}to{transform:scaleX(.18)}}@keyframes butterfly-flight{0%{opacity:0;transform:translate(-50%,-50%) scale(.12) rotate(-18deg)}12%{opacity:1}62%{opacity:.95;transform:translate(calc(-50% + var(--fly-mid-x)),calc(-50% + var(--fly-mid-y))) scale(1) rotate(12deg)}100%{opacity:0;transform:translate(calc(-50% + var(--fly-x)),calc(-50% + var(--fly-y))) scale(.58) rotate(var(--turn))}}@keyframes petal-fall{0%{opacity:0;transform:translate(0,0) rotate(0)}15%{opacity:.95}100%{opacity:0;transform:translate(var(--petal-dx),180px) rotate(var(--petal-turn))}}@keyframes flash-in{0%{opacity:0}30%{opacity:.9}100%{opacity:0}}
@media(max-width:640px){.scene{width:min(800px,125vw,62vh);transform:translate(-50%,-46%)}.hint{bottom:max(8vh,32px)}.intro-skip{top:max(16px,env(safe-area-inset-top));right:16px}}
@media(prefers-reduced-motion:reduce){.wonder-intro *, .wonder-intro *:before,.wonder-intro *:after{animation-duration:.01ms!important;animation-delay:0ms!important;transition-duration:.01ms!important}.bf{opacity:1}}
</style>
