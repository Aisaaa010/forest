import * as THREE from "three";

function hash1(x) {
  const value = Math.sin(x * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function smoothNoise(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash1(i) * (1 - u) + hash1(i + 1) * u;
}

/**
 * A distant mountain range painted onto one transparent plane. It stays behind
 * the island as a camera child, so it never exposes paper-thin ridge ends when
 * the island is orbited.
 */
export function createMountainBackdrop() {
  const width = 2048;
  const height = 512;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);

  const layers = [
    { base: 300, color: "#35536b", alpha: 0.48, seed: 2.1, spread: 1.0 },
    { base: 360, color: "#1b3248", alpha: 0.82, seed: 8.4, spread: 0.82 },
  ];

  for (const layer of layers) {
    const points = [];
    const count = 24;
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const x = t * width;
      const ridge =
        0.5 +
        0.28 * Math.sin(t * 9.0 + layer.seed) +
        0.16 * Math.sin(t * 21.0 + layer.seed * 2.3) +
        (smoothNoise(t * 17.0 + layer.seed) - 0.5) * 0.24;
      const y = layer.base - ridge * 235 * layer.spread;
      points.push([x, y]);
    }
    ctx.save();
    ctx.globalAlpha = layer.alpha;
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, layer.base);
    for (const [x, y] of points) ctx.lineTo(x, y);
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = layer.color;
    ctx.fill();
    // A pale rim along the crest.
    ctx.strokeStyle = "rgba(220,240,250,0.28)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // A cold snow gradient clipped to the range.
    const snow = ctx.createLinearGradient(0, layer.base - 150, 0, layer.base + 20);
    snow.addColorStop(0, "rgba(226,241,249,0.92)");
    snow.addColorStop(0.38, "rgba(190,215,231,0.48)");
    snow.addColorStop(1, "rgba(190,215,231,0)");
    ctx.save();
    ctx.clip();
    ctx.fillStyle = snow;
    ctx.fillRect(0, 0, width, height);
    // Sparse rock facets break up the flat silhouette.
    ctx.strokeStyle = "rgba(6,20,32,0.13)";
    ctx.lineWidth = 2;
    for (let x = 40; x < width; x += 67) {
      ctx.beginPath();
      ctx.moveTo(x, layer.base);
      ctx.lineTo(x + 24, layer.base - 120);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }

  // A low haze band blends the range into the sky.
  const haze = ctx.createLinearGradient(0, 310, 0, height);
  haze.addColorStop(0, "rgba(9,29,48,0)");
  haze.addColorStop(1, "rgba(9,29,48,0.9)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 310, width, height - 310);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    fog: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    opacity: 0.86,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(50, 14), material);
  mesh.position.set(0, -2.6, -30);
  mesh.renderOrder = -2;
  mesh.name = "distant mountain backdrop";
  return mesh;
}
