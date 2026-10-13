import { ref, onUnmounted } from "vue";

export function useBreathing(notify) {
  const duration = ref(60);
  const running = ref(false);
  const phase = ref("");
  const cue = ref("准备好了吗");
  const count = ref("跟随光圈，缓慢呼吸");
  let timer;
  let startedAt;
  function reset() {
    clearInterval(timer);
    timer = undefined;
    running.value = false;
    phase.value = "";
    cue.value = "准备好了吗";
    count.value = "跟随光圈，缓慢呼吸";
  }
  function tick() {
    const elapsed = (performance.now() - startedAt) / 1000;
    const remaining = Math.max(0, duration.value - elapsed);
    if (!remaining) {
      reset();
      cue.value = "做得很好";
      count.value = "把这份平静，带回生活里";
      notify("呼吸练习完成，慢慢睁开眼睛。");
      return;
    }
    const inhale = elapsed % 10 < 4;
    phase.value = inhale ? "inhale" : "exhale";
    cue.value = inhale ? "轻轻吸气" : "慢慢呼气";
    count.value = `还剩 ${Math.ceil(remaining)} 秒`;
  }
  function toggle() {
    if (running.value) {
      reset();
      return;
    }
    startedAt = performance.now();
    running.value = true;
    timer = setInterval(tick, 100);
    tick();
  }
  onUnmounted(reset);
  return { duration, running, phase, cue, count, reset, toggle };
}
