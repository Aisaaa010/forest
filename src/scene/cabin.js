import * as THREE from "three";
import { enhanceMaterial, sceneUniforms } from "./materials.js";

const TAU = Math.PI * 2;

function makeSmoke(timeUniform, height = 0.9) {
  const count = 26;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 0.05;
    positions[i * 3 + 1] = Math.random() * 0.05;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
    seeds[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: timeUniform,
      uColor: { value: new THREE.Color(0xcbd0cd) },
      uOpacity: { value: 0.42 },
    },
    vertexShader: `uniform float uTime;
attribute float aSeed;
varying float vAlpha;
void main() {
  float cycle = fract(uTime * (0.06 + aSeed * 0.035) + aSeed * 4.7);
  vec3 p = position;
  p.y += cycle * ${height.toFixed(2)};
  p.x += sin(uTime * 0.4 + aSeed * 12.0) * 0.07 * cycle;
  p.z += cos(uTime * 0.33 + aSeed * 9.0) * 0.05 * cycle;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (26.0 + aSeed * 18.0) * (0.7 + cycle) / -mv.z;
  gl_Position = projectionMatrix * mv;
  vAlpha = smoothstep(0.0, 0.12, cycle) * (1.0 - cycle) * 0.75;
}`,
    fragmentShader: `uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = 1.0 - smoothstep(0.1, 1.0, d);
  gl_FragColor = vec4(uColor, a * a * vAlpha * uOpacity);
}`,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.name = "chimney smoke";
  return points;
}

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinder(radiusTop, radiusBottom, height, material, x = 0, y = 0, z = 0, sides = 6) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, sides), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Rounded log ends read much softer than flat cylinders at this scale.
function logCapsule(radius, length, material, x = 0, y = 0, z = 0, axis = "x") {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 10), material);
  mesh.position.set(x, y, z);
  if (axis === "x") mesh.rotation.z = Math.PI / 2;
  else if (axis === "z") mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// A soft additive pool of warm light on the snow around a doorway.
function makeWarmPool(width = 2.6, depth = 1.9, color = 0xffa452, opacity = 0.34) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader: `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5;
  float d = length(p * vec2(1.0, 1.5));
  float a = 1.0 - smoothstep(0.05, 0.5, d);
  gl_FragColor = vec4(uColor, a * a * uOpacity);
}`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2), material);
  mesh.position.y = 0.035;
  mesh.position.z = 0.35;
  mesh.renderOrder = 1;
  return mesh;
}

function makeWindowHalo(width, height, z, color = 0xffa452, opacity = 0.2) {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.position.set(0, 0.34, z);
  return mesh;
}

// A log chalet for the alpine scene: warm windows, snow-laden roof and a
// chimney that feeds a small GPU smoke plume.
export function createAlpineCabin() {
  const group = new THREE.Group();
  group.name = "alpine log cabin";
  const wood = enhanceMaterial(new THREE.MeshStandardMaterial({ color: 0x604634, roughness: 0.92 }), {
    detail: { scale: 15, normalStrength: 0.1, stretch: [1, 2.2, 1] },
  });
  const woodLight = enhanceMaterial(new THREE.MeshStandardMaterial({ color: 0x7b5a40, roughness: 0.9 }), {
    detail: { scale: 18, normalStrength: 0.08, stretch: [1, 2.4, 1] },
  });
  const stone = new THREE.MeshStandardMaterial({ color: 0x716e60, roughness: 0.96, flatShading: true });
  const snow = new THREE.MeshStandardMaterial({ color: 0xe9f0ef, roughness: 0.72 });
  const roofDark = new THREE.MeshStandardMaterial({ color: 0x4e3b2f, roughness: 0.95 });
  const windowMaterial = new THREE.MeshBasicMaterial({ color: 0xffc477 });
  const door = enhanceMaterial(new THREE.MeshStandardMaterial({ color: 0x3e2e24, roughness: 0.9 }), {
    detail: { scale: 20, normalStrength: 0.1, stretch: [1, 2.6, 1] },
  });
  const metal = new THREE.MeshStandardMaterial({ color: 0x4e5558, roughness: 0.45, metalness: 0.35 });

  group.add(box(0.92, 0.08, 0.7, stone, 0, 0.04, 0));
  group.add(box(0.74, 0.42, 0.54, wood, 0, 0.29, 0));
  // Exposed log courses on the front and back.
  for (const z of [-0.29, 0.29]) {
    for (let i = 0; i < 4; i++) {
      group.add(logCapsule(0.027, 0.72, woodLight, 0, 0.14 + i * 0.09, z, "x"));
    }
  }
  for (const x of [-0.39, 0.39]) {
    for (let i = 0; i < 3; i++) {
      group.add(logCapsule(0.025, 0.52, woodLight, x, 0.17 + i * 0.1, 0, "z"));
    }
  }
  // Gable roof and snow layer.
  for (const side of [-1, 1]) {
    const slab = box(0.92, 0.05, 0.42, roofDark, 0, 0.61, side * 0.16);
    slab.rotation.x = side * 0.58;
    group.add(slab);
    const snowSlab = box(0.94, 0.055, 0.4, snow, 0, 0.66, side * 0.16);
    snowSlab.rotation.x = side * 0.58;
    group.add(snowSlab);
  }
  group.add(box(0.76, 0.16, 0.06, woodLight, 0, 0.5, 0.27));
  // Chimney, cap and smoke.
  group.add(box(0.1, 0.42, 0.1, stone, 0.22, 0.78, -0.12));
  group.add(box(0.14, 0.05, 0.14, metal, 0.22, 1.0, -0.12));
  const smoke = makeSmoke(sceneUniforms.uTime, 1.1);
  smoke.position.set(0.22, 1.02, -0.12);
  group.add(smoke);
  // Warm windows with simple frames, mounted proud of the log wall so the
  // log courses do not swallow the panes.
  for (const x of [-0.19, 0.19]) {
    group.add(box(0.17, 0.13, 0.018, windowMaterial, x, 0.34, 0.322));
    group.add(box(0.2, 0.16, 0.02, woodLight, x, 0.34, 0.314));
    group.add(box(0.14, 0.11, 0.025, windowMaterial, x, 0.34, 0.329));
  }
  group.add(box(0.14, 0.24, 0.025, door, 0, 0.2, 0.325));
  // Door frame and porch.
  group.add(box(0.012, 0.26, 0.025, woodLight, -0.082, 0.21, 0.333));
  group.add(box(0.012, 0.26, 0.025, woodLight, 0.082, 0.21, 0.333));
  group.add(box(0.176, 0.018, 0.03, woodLight, 0, 0.34, 0.333));
  group.add(box(0.58, 0.035, 0.16, woodLight, 0, 0.11, 0.34));
  group.add(box(0.42, 0.025, 0.1, woodLight, 0, 0.085, 0.43));
  // Window mullions over the warm panes.
  for (const x of [-0.19, 0.19]) {
    group.add(box(0.014, 0.112, 0.01, wood, x, 0.34, 0.337));
    group.add(box(0.14, 0.014, 0.01, wood, x, 0.34, 0.337));
  }
  // Stacked firewood and a snow shovel beside the porch.
  for (let i = 0; i < 7; i++) {
    group.add(logCapsule(
      0.021,
      0.2,
      i % 2 ? woodLight : wood,
      -0.52,
      0.07 + Math.floor(i / 3) * 0.04,
      0.12 + (i % 3) * 0.045,
      "x",
    ));
  }
  const shovel = cylinder(0.007, 0.009, 0.36, woodLight, 0.52, 0.24, 0.3, 5);
  shovel.rotation.z = 0.22;
  group.add(shovel);
  group.add(box(0.07, 0.11, 0.015, metal, 0.57, 0.07, 0.3));
  // Irregular foundation stones break up the straight base.
  for (let i = 0; i < 6; i++) {
    const stoneChunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.045 + (i % 2) * 0.012, 0), stone);
    stoneChunk.position.set(-0.4 + i * 0.16, 0.035, 0.33 + (i % 2) * 0.03);
    stoneChunk.rotation.set(i, i * 1.7, i * 0.4);
    stoneChunk.scale.y = 0.55;
    group.add(stoneChunk);
  }
  // A few snow chunks on the eaves and step.
  for (const [x, y, z, s] of [[-0.42, 0.7, 0.3, 0.07], [0.12, 0.68, 0.33, 0.05], [0.4, 0.7, -0.28, 0.06]]) {
    const chunk = new THREE.Mesh(new THREE.SphereGeometry(s, 7, 5), snow);
    chunk.position.set(x, y, z);
    chunk.scale.y = 0.5;
    group.add(chunk);
  }
  // A small lantern beside the door.
  group.add(box(0.035, 0.06, 0.035, new THREE.MeshBasicMaterial({ color: 0xffd58f }), -0.25, 0.25, 0.34));
  // Icicles under the eaves.
  const ice = new THREE.MeshPhysicalMaterial({ color: 0xcfeaf2, roughness: 0.2, transparent: true, opacity: 0.8 });
  for (let i = 0; i < 5; i++) {
    const x = -0.32 + i * 0.16;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.07 + (i % 3) * 0.025, 5).rotateX(Math.PI), ice);
    spike.position.set(x, 0.55, 0.34);
    group.add(spike);
  }
  const light = new THREE.PointLight(0xffb45e, 1.4, 4.2, 2);
  light.position.set(0, 0.36, 0.42);
  group.add(light);
  const groundLight = new THREE.PointLight(0xff9b4a, 1.0, 2.8, 2);
  groundLight.position.set(0, 0.08, 0.55);
  group.add(groundLight);
  const pool = makeWarmPool(2.8, 2.0, 0xffa452, 0.42);
  group.add(pool);
  const halo = makeWindowHalo(0.34, 0.25, 0.34);
  group.add(halo);
  // A few warm bulbs along the porch edge, like a quiet string of lights.
  for (let i = 0; i < 9; i++) {
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.011, 6, 4),
      new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xffd98b : 0xffa64d }),
    );
    bulb.position.set(-0.34 + i * 0.085, 0.54 + Math.sin(i * 1.7) * 0.012, 0.3);
    group.add(bulb);
  }
  return { group, windowMaterial, light, groundLight, smoke, pool, halo };
}

// A smaller but fully detailed sauna-like cabin on the right side of the
// alpine clearing. It is deliberately built from the same rounded log language
// as the main cabin, with a porch, shutters, stone footings and a side porthole.
export function createSmallCabin() {
  const group = new THREE.Group();
  group.name = "small alpine cabin";
  const wood = enhanceMaterial(new THREE.MeshStandardMaterial({ color: 0x59412f, roughness: 0.94 }), {
    detail: { scale: 16, normalStrength: 0.11, stretch: [1, 2.2, 1] },
  });
  const woodLight = enhanceMaterial(new THREE.MeshStandardMaterial({ color: 0x78573e, roughness: 0.9 }), {
    detail: { scale: 20, normalStrength: 0.09, stretch: [1, 2.4, 1] },
  });
  const stone = new THREE.MeshStandardMaterial({ color: 0x706d60, roughness: 0.96, flatShading: true });
  const snow = new THREE.MeshStandardMaterial({ color: 0xe9f0ef, roughness: 0.74 });
  const roofDark = new THREE.MeshStandardMaterial({ color: 0x4a392d, roughness: 0.95 });
  const windowMaterial = new THREE.MeshBasicMaterial({ color: 0xffc477 });
  const door = enhanceMaterial(new THREE.MeshStandardMaterial({ color: 0x3b2b20, roughness: 0.92 }), {
    detail: { scale: 18, normalStrength: 0.1, stretch: [1, 2.4, 1] },
  });
  const metal = new THREE.MeshStandardMaterial({ color: 0x4e5558, roughness: 0.45, metalness: 0.35 });
  const ice = new THREE.MeshPhysicalMaterial({ color: 0xcfeaf2, roughness: 0.2, transparent: true, opacity: 0.82 });

  // Stone footing and the inner timber body.
  group.add(box(0.86, 0.08, 0.68, stone, 0, 0.04, 0));
  group.add(box(0.7, 0.44, 0.52, wood, 0, 0.3, 0));
  for (const z of [-0.265, 0.265]) {
    for (let i = 0; i < 4; i++) {
      group.add(logCapsule(0.028, 0.62, woodLight, 0, 0.13 + i * 0.1, z, "x"));
    }
  }
  for (const x of [-0.36, 0.36]) {
    for (let i = 0; i < 3; i++) {
      group.add(logCapsule(0.026, 0.44, woodLight, x, 0.17 + i * 0.1, 0, "z"));
    }
  }
  // Thick snow roof with a proper eave overhang.
  for (const side of [-1, 1]) {
    const slab = box(0.88, 0.05, 0.4, roofDark, 0, 0.56, side * 0.15);
    slab.rotation.x = side * 0.52;
    group.add(slab);
    const snowSlab = box(0.92, 0.07, 0.38, snow, 0, 0.6, side * 0.15);
    snowSlab.rotation.x = side * 0.52;
    group.add(snowSlab);
  }
  group.add(box(0.64, 0.2, 0.06, woodLight, 0, 0.49, 0.27));
  // Stone chimney with a metal cap.
  group.add(box(0.1, 0.4, 0.1, stone, 0.23, 0.69, -0.12));
  group.add(box(0.14, 0.045, 0.14, metal, 0.23, 0.9, -0.12));
  // Porch deck, posts and a small snow-covered awning.
  group.add(box(0.5, 0.035, 0.2, woodLight, -0.02, 0.105, 0.38));
  for (const x of [-0.23, 0.19]) {
    group.add(cylinder(0.014, 0.016, 0.27, woodLight, x, 0.24, 0.47, 6));
    group.add(box(0.036, 0.026, 0.036, snow, x, 0.38, 0.47));
  }
  const awning = box(0.54, 0.035, 0.2, woodLight, -0.02, 0.38, 0.4);
  awning.rotation.x = 0.12;
  group.add(awning);
  const awningSnow = box(0.56, 0.04, 0.19, snow, -0.02, 0.41, 0.4);
  awningSnow.rotation.x = 0.12;
  group.add(awningSnow);
  // Door with frame, threshold and iron handle.
  group.add(box(0.14, 0.26, 0.022, door, -0.12, 0.27, 0.3));
  group.add(box(0.012, 0.28, 0.028, woodLight, -0.195, 0.27, 0.306));
  group.add(box(0.012, 0.28, 0.028, woodLight, -0.045, 0.27, 0.306));
  group.add(box(0.16, 0.016, 0.03, woodLight, -0.12, 0.405, 0.306));
  group.add(box(0.17, 0.022, 0.1, woodLight, -0.12, 0.12, 0.35));
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), metal);
  handle.position.set(-0.08, 0.26, 0.318);
  group.add(handle);
  // Window, frame, muntins and timber shutters.
  group.add(box(0.18, 0.15, 0.02, windowMaterial, 0.16, 0.33, 0.3));
  group.add(box(0.22, 0.19, 0.024, woodLight, 0.16, 0.33, 0.29));
  group.add(box(0.15, 0.12, 0.022, windowMaterial, 0.16, 0.33, 0.312));
  group.add(box(0.008, 0.12, 0.008, wood, 0.16, 0.33, 0.318));
  group.add(box(0.15, 0.008, 0.008, wood, 0.16, 0.33, 0.318));
  for (const x of [0.045, 0.275]) {
    group.add(box(0.055, 0.18, 0.02, woodLight, x, 0.33, 0.292));
  }
  // A small round window on the gable side.
  const porthole = new THREE.Mesh(new THREE.CircleGeometry(0.055, 16), windowMaterial);
  porthole.position.set(0.392, 0.35, 0.02);
  porthole.rotation.y = Math.PI / 2;
  group.add(porthole);
  const portholeRim = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 16), woodLight);
  portholeRim.position.copy(porthole.position);
  portholeRim.rotation.y = Math.PI / 2;
  group.add(portholeRim);
  // Woodpile and a lantern beside the porch.
  for (let i = 0; i < 6; i++) {
    group.add(logCapsule(0.019, 0.24, i % 2 ? woodLight : wood, -0.54, 0.07 + Math.floor(i / 3) * 0.04, 0.08 + (i % 3) * 0.04, "x"));
  }
  const lanternPost = cylinder(0.009, 0.012, 0.22, woodLight, 0.34, 0.18, 0.4, 5);
  group.add(lanternPost);
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc46a }));
  lantern.position.set(0.34, 0.31, 0.4);
  group.add(lantern);
  // Icicles and snow chunks along the eaves.
  for (let i = 0; i < 5; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.07 + (i % 3) * 0.025, 5).rotateX(Math.PI), ice);
    spike.position.set(-0.28 + i * 0.15, 0.48, 0.37);
    group.add(spike);
  }
  for (const [x, y, z, s] of [[-0.38, 0.55, 0.34, 0.06], [0.16, 0.54, 0.37, 0.045], [0.38, 0.56, -0.32, 0.055]]) {
    const chunk = new THREE.Mesh(new THREE.SphereGeometry(s, 7, 5), snow);
    chunk.position.set(x, y, z);
    chunk.scale.y = 0.5;
    group.add(chunk);
  }
  // Irregular footing stones.
  for (let i = 0; i < 6; i++) {
    const foot = new THREE.Mesh(new THREE.DodecahedronGeometry(0.05 + (i % 2) * 0.012, 0), stone);
    foot.position.set(-0.38 + i * 0.15, 0.035, 0.35 + (i % 2) * 0.02);
    foot.rotation.set(i, i * 1.4, i * 0.3);
    foot.scale.y = 0.55;
    group.add(foot);
  }
  const smoke = makeSmoke(sceneUniforms.uTime, 0.78);
  smoke.position.set(0.23, 0.92, -0.12);
  group.add(smoke);
  const light = new THREE.PointLight(0xffb45e, 0.95, 2.8, 2);
  light.position.set(0.08, 0.34, 0.4);
  group.add(light);
  const pool = makeWarmPool(1.9, 1.4, 0xffa452, 0.28);
  group.add(pool);
  const halo = makeWindowHalo(0.26, 0.2, 0.322);
  halo.position.y = 0.33;
  group.add(halo);
  return { group, windowMaterial, light, smoke, pool, halo };
}

const CAMPFIRE_FLAME = `uniform float uTime;
uniform float uIntensity;
varying vec2 vUv;
void main() {
  float y = vUv.y;
  float sway = sin(uTime * 3.4 + y * 7.0) * 0.035;
  float halfWidth = 0.10 + (1.0 - y) * 0.27;
  float body = 1.0 - smoothstep(0.0, halfWidth, abs(vUv.x - 0.5 - sway));
  float finger = 1.0 - smoothstep(0.0, 0.055, abs(vUv.x - 0.34 + sin(uTime * 4.2) * 0.02));
  finger *= smoothstep(0.35, 1.0, y) * 0.45;
  float flicker = 0.72 + 0.28 * sin(uTime * 11.0 + y * 14.0);
  float alpha = max(body, finger) * (1.0 - smoothstep(0.55, 1.0, y)) * flicker * uIntensity;
  vec3 color = mix(vec3(1.0, 0.34, 0.08), vec3(1.0, 0.88, 0.42), smoothstep(0.1, 0.8, y));
  gl_FragColor = vec4(color, alpha * 0.9);
}`;

// Low-poly campfire with rounded logs, a stone ring, animated flame cards and
// a flickering warm light.
export function createCampfire() {
  const group = new THREE.Group();
  group.name = "campfire";
  const stone = new THREE.MeshStandardMaterial({ color: 0x68655b, roughness: 0.96, flatShading: true });
  const wood = new THREE.MeshStandardMaterial({ color: 0x4c3527, roughness: 0.95 });
  const ash = new THREE.Mesh(new THREE.CircleGeometry(0.31, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a2723, roughness: 1 }));
  ash.position.y = 0.012;
  group.add(ash);
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * TAU;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.055 + (i % 3) * 0.012, 0), stone);
    rock.position.set(Math.cos(angle) * 0.36, 0.035, Math.sin(angle) * 0.36);
    rock.rotation.set(i, i * 1.7, i * 0.4);
    rock.scale.y = 0.7;
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }
  // A split log seat makes the fire feel used rather than staged.
  const seat = logCapsule(0.06, 0.48, wood, -0.63, 0.075, 0.12, "z");
  seat.rotation.y = 0.18;
  group.add(seat);
  for (let i = 0; i < 3; i++) {
    const log = logCapsule(0.035, 0.42, wood, 0, 0.075, 0, i % 2 ? "x" : "z");
    log.rotation.y = i * 0.95;
    log.position.y = 0.075 + i * 0.012;
    group.add(log);
  }
  const uniforms = { uTime: sceneUniforms.uTime, uIntensity: { value: 1 } };
  const flameMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: CAMPFIRE_FLAME,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  for (let i = 0; i < 3; i++) {
    const flame = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.62), flameMaterial);
    flame.position.y = 0.3;
    flame.rotation.y = (i / 3) * Math.PI;
    group.add(flame);
  }
  const light = new THREE.PointLight(0xff7b2f, 2.1, 3.6, 2);
  light.position.set(0, 0.3, 0);
  group.add(light);
  const smoke = makeSmoke(sceneUniforms.uTime, 0.8);
  smoke.position.y = 0.18;
  group.add(smoke);
  let boostUntil = 0;
  function pulse() {
    boostUntil = performance.now() + 900;
  }
  function update(time) {
    const boost = Math.max(0, (boostUntil - performance.now()) / 900);
    const flicker = 1 + Math.sin(time * 8.3) * 0.12 + Math.sin(time * 19.7 + 1.3) * 0.05;
    light.intensity = (2.0 + boost * 2.4) * flicker;
    uniforms.uIntensity.value = 1 + boost * 0.8;
  }
  return { group, light, smoke, pulse, update };
}

// A small elevated polar research hut with an antenna, fuel drums and a large
// warm window aimed at the aurora.
export function createPolarHut() {
  const group = new THREE.Group();
  group.name = "polar hut";
  const panel = new THREE.MeshStandardMaterial({ color: 0x5b6d73, roughness: 0.72 });
  const panelLight = new THREE.MeshStandardMaterial({ color: 0x7d9095, roughness: 0.68 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x3f4d53, roughness: 0.42, metalness: 0.4 });
  const snow = new THREE.MeshStandardMaterial({ color: 0xe6eef0, roughness: 0.75 });
  const windowMaterial = new THREE.MeshBasicMaterial({ color: 0xffc477 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a4739, roughness: 0.9 });
  const ice = new THREE.MeshPhysicalMaterial({ color: 0xcfeaf2, roughness: 0.2, transparent: true, opacity: 0.8 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xc46b3d, roughness: 0.65 });

  for (const x of [-0.28, 0.28]) {
    for (const z of [-0.2, 0.2]) {
      group.add(cylinder(0.025, 0.03, 0.24, metal, x, 0.12, z, 6));
    }
  }
  group.add(box(0.86, 0.06, 0.64, metal, 0, 0.25, 0));
  group.add(box(0.72, 0.4, 0.52, panel, 0, 0.48, 0));
  group.add(box(0.74, 0.05, 0.54, panelLight, 0, 0.69, 0));
  group.add(box(0.78, 0.12, 0.58, snow, 0, 0.77, 0));
  group.add(box(0.64, 0.06, 0.7, snow, 0, 0.86, 0.02));
  // Large aurora-facing window.
  group.add(box(0.3, 0.18, 0.02, windowMaterial, 0.12, 0.48, 0.265));
  group.add(box(0.34, 0.22, 0.03, panelLight, 0.12, 0.48, 0.258));
  group.add(box(0.24, 0.14, 0.03, windowMaterial, 0.12, 0.48, 0.272));
  // Porthole on the side.
  const porthole = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), windowMaterial);
  porthole.position.set(-0.37, 0.48, 0.06);
  porthole.rotation.y = -Math.PI / 2;
  group.add(porthole);
  // Antenna and dish.
  group.add(cylinder(0.006, 0.008, 0.7, metal, -0.24, 1.12, -0.2, 5));
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 6, 0, TAU, 0, Math.PI / 2), panelLight);
  dish.rotation.x = -0.5;
  dish.position.set(-0.24, 1.45, -0.2);
  group.add(dish);
  // Flag.
  group.add(cylinder(0.008, 0.008, 0.55, metal, 0.32, 1.05, 0.18, 5));
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.1), orange);
  flag.position.set(0.4, 1.26, 0.18);
  group.add(flag);
  // Fuel drums and a ladder.
  for (const [x, z] of [[0.5, -0.26], [0.62, -0.12], [-0.55, 0.28]]) {
    group.add(cylinder(0.055, 0.055, 0.16, orange, x, 0.1, z, 10));
    group.add(cylinder(0.052, 0.052, 0.02, metal, x, 0.19, z, 10));
  }
  group.add(box(0.22, 0.04, 0.24, wood, 0.45, 0.35, 0.28));
  for (let i = 0; i < 4; i++) {
    const rung = box(0.2, 0.02, 0.02, wood, 0.45, 0.1 + i * 0.06, 0.28);
    group.add(rung);
  }
  for (let i = 0; i < 3; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.09 + i * 0.02, 5).rotateX(Math.PI), ice);
    spike.position.set(-0.38 + i * 0.35, 0.68, 0.34);
    group.add(spike);
  }
  const light = new THREE.PointLight(0xffb45e, 1.6, 3.2, 2);
  light.position.set(0.1, 0.5, 0.4);
  group.add(light);
  const groundLight = new THREE.PointLight(0xff9b4a, 0.8, 2.4, 2);
  groundLight.position.set(0.1, 0.1, 0.55);
  group.add(groundLight);
  const smoke = makeSmoke(sceneUniforms.uTime, 0.9);
  smoke.position.set(-0.2, 0.98, -0.24);
  group.add(smoke);
  const pool = makeWarmPool(2.0, 1.5, 0xffa452, 0.28);
  group.add(pool);
  const halo = makeWindowHalo(0.36, 0.25, 0.277);
  halo.position.y = 0.48;
  group.add(halo);
  for (let i = 0; i < 6; i++) {
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.009, 6, 4),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffd98b : 0xffa64d }),
    );
    bulb.position.set(-0.28 + i * 0.11, 0.73 + Math.sin(i) * 0.01, 0.3);
    group.add(bulb);
  }
  return { group, windowMaterial, light, groundLight, smoke, pool, halo };
}
