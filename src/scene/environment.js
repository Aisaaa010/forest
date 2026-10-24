import * as THREE from "three";

// A tiny procedural sky used only for image-based lighting. The visible page
// background stays in CSS, but standard materials still get soft sky fill and
// specular breakup from this environment map.
export function createSkyEnvironment(renderer) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  const sky = context.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, "#a9c8ba");
  sky.addColorStop(0.42, "#d8e6d7");
  sky.addColorStop(0.58, "#c9d4b8");
  sky.addColorStop(0.72, "#7e9178");
  sky.addColorStop(1, "#40564a");
  context.fillStyle = sky;
  context.fillRect(0, 0, 512, 256);

  // Warm low sun on one side, cool bounce on the other.
  const warmth = context.createRadialGradient(150, 112, 0, 150, 112, 170);
  warmth.addColorStop(0, "rgba(255, 232, 178, 0.95)");
  warmth.addColorStop(0.18, "rgba(255, 218, 154, 0.42)");
  warmth.addColorStop(0.55, "rgba(255, 212, 150, 0.08)");
  warmth.addColorStop(1, "rgba(255, 212, 150, 0)");
  context.fillStyle = warmth;
  context.fillRect(0, 0, 512, 256);
  const cool = context.createRadialGradient(380, 104, 0, 380, 104, 150);
  cool.addColorStop(0, "rgba(160, 205, 206, 0.35)");
  cool.addColorStop(1, "rgba(160, 205, 206, 0)");
  context.fillStyle = cool;
  context.fillRect(0, 0, 512, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(texture).texture;
  environment.name = "procedural sky environment";
  texture.dispose();
  pmrem.dispose();
  return environment;
}
