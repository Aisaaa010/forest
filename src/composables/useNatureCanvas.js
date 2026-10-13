import { onMounted, onUnmounted } from "vue";

export function useNatureCanvas(canvasRef, viewRef, state) {
  let frame, cleanup;
  onMounted(() => {
    // Small atmospheric details are drawn on a single canvas.
    const canvas = canvasRef.value;
    const view = viewRef.value;
    const context = canvas.getContext("2d");
    let width = 0,
      height = 0,
      lastFrame = 0;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const particles = Array.from({ length: 85 }, () => ({
      x: Math.random(),
      y: Math.random(),
      speed: 0.4 + Math.random(),
      size: 1 + Math.random() * 1.6,
      offset: Math.random() * Math.PI * 2,
    }));
    const observer = new ResizeObserver(() => {
      const rect = view.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    observer.observe(view);
    function animate(time) {
      frame = requestAnimationFrame(animate);
      if (document.hidden || time - lastFrame < 33) return;
      const delta = Math.min(time - lastFrame, 80) / 1000;
      lastFrame = time;
      context.clearRect(0, 0, width, height);
      if (state.weather === "rain") {
        context.strokeStyle =
          state.phase === "night" ? "#c9dde329" : "#e0ece864";
        context.lineWidth = 0.6;
        for (const p of particles) {
          if (!reducedMotion.matches) {
            p.y += delta * p.speed * 0.5;
            p.x -= delta * 0.018;
            if (p.y > 1.05) p.y = -0.05;
            if (p.x < 0) p.x = 1;
          }
          context.beginPath();
          context.moveTo(p.x * width, p.y * height);
          context.lineTo(p.x * width - 3, p.y * height + 12 * p.speed);
          context.stroke();
        }
      } else if (state.phase === "night") {
        for (const p of particles.slice(0, 24)) {
          const t = reducedMotion.matches ? p.offset : time / 2200 + p.offset;
          const x = p.x * width + Math.sin(t * 0.3) * 15,
            y = height * 0.28 + p.y * height * 0.65 + Math.cos(t * 0.4) * 13;
          const opacity = 0.15 + (Math.sin(t * p.speed) + 1) * 0.25;
          const glow = context.createRadialGradient(x, y, 0, x, y, 9);
          glow.addColorStop(0, `rgba(225,244,140,${opacity})`);
          glow.addColorStop(1, "rgba(225,244,140,0)");
          context.fillStyle = glow;
          context.fillRect(x - 9, y - 9, 18, 18);
          context.fillStyle = `rgba(240,251,170,${opacity + 0.15})`;
          context.beginPath();
          context.arc(x, y, p.size * 0.6, 0, Math.PI * 2);
          context.fill();
        }
      } else {
        for (const p of particles.slice(0, 16)) {
          const t = reducedMotion.matches ? p.offset : time / 12000 + p.offset;
          context.fillStyle = "#f5edc34d";
          context.beginPath();
          context.arc(
            p.x * width + Math.sin(t) * 20,
            p.y * height + Math.cos(t) * 15,
            p.size * 0.5,
            0,
            Math.PI * 2,
          );
          context.fill();
        }
      }
    }
    frame = requestAnimationFrame(animate);

    cleanup = () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  });
  onUnmounted(() => cleanup?.());
}
