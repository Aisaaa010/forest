import * as THREE from "three";
import { createFoliageMaterials, buildTrees } from "./vegetation.js";
import { buildGrass } from "./flora.js";
import { buildVines } from "./vines.js";
import { createIslandTerrain, makeBoulderGeometry, rimPoint } from "./terrain.js";
import { enhanceMaterial, sceneUniforms } from "./materials.js";
import { makeWaterRibbon } from "./water.js";
import { createAlpineCabin, createPolarHut } from "./cabin.js";
import { createAurora } from "./aurora.js";
import { createGlacierWall } from "./glacier.js";

const TAU = Math.PI * 2;
const ALPINE_PALETTE = [0x2f4d43, 0x3d5c4d, 0x4b6a57, 0x5c7864];

// The second, colder island used by both new scenes. It is built once and kept
// hidden until the alpine or aurora scene is selected.
export function buildColdIsland() {
  const group = new THREE.Group();
  group.name = "cold island";
  group.scale.set(1.06, 1.0, 0.96);

  const streamCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.5, 0.2, -3.0),
    new THREE.Vector3(-1.7, 0.2, -2.0),
    new THREE.Vector3(-0.7, 0.2, -0.9),
    new THREE.Vector3(0.25, 0.2, 0.05),
    new THREE.Vector3(1.35, 0.2, 0.95),
    new THREE.Vector3(2.6, 0.2, 1.5),
    new THREE.Vector3(3.85, 0.19, 1.95),
  ]);
  const fallAngle = Math.atan2(1.95 / 0.75, 3.85);
  const terrain = createIslandTerrain({ streamCurve, fallAngle });
  const { heightAt, normalAt, streamDistance } = terrain;

  const meadowMaterial = enhanceMaterial(
    new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }),
    { detail: { scale: 5, normalStrength: 0.07, stretch: [1, 2.0, 1] }, ice: 0.92 },
  );
  const cliffMaterial = enhanceMaterial(
    new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.95, flatShading: true }),
    { detail: { scale: 7, normalStrength: 0.08 }, ice: 0.95 },
  );
  const rockMaterial = enhanceMaterial(
    new THREE.MeshStandardMaterial({ color: 0x8a918d, vertexColors: true, roughness: 0.9, flatShading: true }),
    { detail: { scale: 14, normalStrength: 0.08 }, ice: 0.85 },
  );
  const snowMaterial = new THREE.MeshStandardMaterial({ color: 0xdfeaf7, roughness: 0.8 });
  const pondMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x4f91a8,
    roughness: 0.1,
    metalness: 0.06,
    transparent: true,
    opacity: 0.94,
    clearcoat: 0.75,
    clearcoatRoughness: 0.12,
    side: THREE.DoubleSide,
  });
  const iceFallMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xb7deea,
    roughness: 0.2,
    metalness: 0.04,
    clearcoat: 0.55,
    side: THREE.DoubleSide,
  });
  const iceShardMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xa9ddec,
    roughness: 0.16,
    metalness: 0.08,
    clearcoat: 0.5,
    emissive: 0x123a4a,
    emissiveIntensity: 0.4,
  });
  const darkRockMaterial = enhanceMaterial(
    new THREE.MeshStandardMaterial({ color: 0x656a65, vertexColors: true, roughness: 0.92, flatShading: true }),
    { detail: { scale: 16, normalStrength: 0.08 }, ice: 0.35 },
  );

  const meadow = new THREE.Mesh(terrain.makeMeadowGeometry(), meadowMaterial);
  meadow.name = "cold meadow";
  meadow.receiveShadow = true;
  group.add(meadow);
  const cliff = new THREE.Mesh(terrain.makeCliffGeometry(), cliffMaterial);
  cliff.name = "cold cliff";
  cliff.castShadow = true;
  cliff.receiveShadow = true;
  group.add(cliff);

  // Frozen creek and a frozen fall at the rim; both stay visible in either scene.
  const stream = new THREE.Mesh(
    makeWaterRibbon(streamCurve, 120, (t) => 0.13 + Math.sin(t * 21) * 0.018, (t) => 0.196 + Math.sin(t * 13) * 0.002).geometry,
    pondMaterial,
  );
  stream.name = "frozen creek";
  stream.renderOrder = 1;
  group.add(stream);
  const lip = rimPoint(fallAngle, 1.02);
  const lipY = heightAt(lip.x, lip.z);
  for (let i = 0; i < 9; i++) {
    const across = (i / 8 - 0.5) * 0.28;
    const icicle = new THREE.Mesh(
      new THREE.ConeGeometry(0.022 + (i % 3) * 0.008, 0.22 + (i % 4) * 0.11, 5).rotateX(Math.PI),
      iceFallMaterial,
    );
    icicle.position.set(
      lip.x - Math.sin(fallAngle) * across,
      lipY - 0.12 - (i % 3) * 0.03,
      lip.z + Math.cos(fallAngle) * across * 0.75,
    );
    icicle.rotation.z = (i % 2 ? 1 : -1) * 0.05;
    icicle.castShadow = true;
    group.add(icicle);
  }

  // A shallow ice pond in front of the cabin.
  const pondX = 0.2;
  const pondZ = 2.05;
  const pondY = heightAt(pondX, pondZ) + 0.012;
  const pond = new THREE.Mesh(new THREE.CircleGeometry(0.78, 32).rotateX(-Math.PI / 2), pondMaterial);
  pond.position.set(pondX, pondY, pondZ);
  pond.renderOrder = 1;
  group.add(pond);
  const pondBank = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.88, 32).rotateX(-Math.PI / 2), snowMaterial);
  pondBank.position.set(pondX, pondY + 0.002, pondZ);
  group.add(pondBank);
  // Fine dark cracks keep the pond from reading as a white plate.
  const crackPositions = [];
  for (let i = 0; i < 11; i++) {
    const angle = i * 1.37;
    const inner = 0.03 + (i % 3) * 0.06;
    const outer = 0.34 + (i % 4) * 0.1;
    crackPositions.push(
      pondX + Math.cos(angle) * inner, pondY + 0.004, pondZ + Math.sin(angle) * inner,
      pondX + Math.cos(angle) * outer, pondY + 0.004, pondZ + Math.sin(angle) * outer,
    );
  }
  const crackGeometry = new THREE.BufferGeometry();
  crackGeometry.setAttribute("position", new THREE.Float32BufferAttribute(crackPositions, 3));
  const cracks = new THREE.LineSegments(crackGeometry, new THREE.LineBasicMaterial({ color: 0x416f7c, transparent: true, opacity: 0.55 }));
  group.add(cracks);

  // Rocks and a modest ridge give the cold island a different silhouette.
  const ridgeGroup = new THREE.Group();
  for (const [x, z, s, sy] of [[-2.4, -3.0, 1.15, 1.4], [-1.15, -3.25, 1.4, 1.8], [0.3, -3.05, 1.0, 1.2], [1.6, -2.9, 0.8, 1.1]]) {
    const rock = new THREE.Mesh(makeBoulderGeometry(500 + Math.round(x * 10), 1), rockMaterial);
    rock.position.set(x, heightAt(x, z) + sy * 0.1, z);
    rock.scale.set(s, sy, s * 0.8);
    rock.rotation.set(0.2, x, 0.1);
    rock.castShadow = true;
    rock.receiveShadow = true;
    ridgeGroup.add(rock);
  }
  // The distant mountain range is a camera-facing backdrop in
  // useForestScene3D; only the low rock foothills live on the island itself.
  group.add(ridgeGroup);

  const treeSpots = [
    [-3.7, -1.3, 0.9], [-2.9, -2.2, 1.0], [-1.6, -2.55, 0.82], [-0.1, -2.65, 0.95],
    [1.5, -2.45, 0.78], [2.9, -1.9, 0.92], [1.3, -0.9, 0.7],
    [3.15, 0.75, 0.92], [2.35, 2.2, 0.78], [0.8, 0.35, 0.62],
    [-3.55, 0.75, 0.88], [-3.35, 2.05, 0.75],
  ];
  const rockSpots = [];
  const forestLife = new THREE.Group();
  forestLife.name = "cold forest life";
  const foliage = createFoliageMaterials(ALPINE_PALETTE);
  const trunkMaterial = enhanceMaterial(
    new THREE.MeshStandardMaterial({ color: 0x604a36, vertexColors: true, roughness: 0.95 }),
    { detail: { scale: 13, normalStrength: 0.08, stretch: [1, 0.45, 1] } },
  );
  const branchMaterial = enhanceMaterial(
    new THREE.MeshStandardMaterial({ color: 0x554334, roughness: 0.96 }),
    { snow: 0.6, detail: { scale: 16, normalStrength: 0.07 } },
  );
  const { trees, roots, mossPatches } = buildTrees(treeSpots, {
    trunkMaterial,
    foliage,
    branchMaterial,
    heightAt,
    normalAt,
    streamDistance,
    sunDirection: new THREE.Vector3(-4, 7, 6),
    leafDensity: window.innerWidth < 700 ? 0.55 : 0.8,
    variantCount: 4,
  });
  trees.forEach((tree) => forestLife.add(tree));
  forestLife.add(roots, mossPatches);
  const avoid = [
    ...treeSpots.map(([x, z, s]) => [x, z, 0.09 * s]),
    [-2.3, 1.3, 0.65],
    [pondX, pondZ, 0.95],
  ];
  const grass = buildGrass({
    count: 900,
    heightAt,
    normalAt,
    streamDistance,
    rimPoint,
    avoid,
  });
  forestLife.add(grass);
  const vines = buildVines(terrain, { fallAngle, clumps: 10 });
  forestLife.add(vines.group);
  group.add(forestLife);

  // Additional snow-covered stones around the shore and clearing.
  for (const [x, z, s] of [[-3.9, -0.2, 0.55], [3.9, 0.9, 0.48], [-3.2, 2.6, 0.4], [2.9, 2.8, 0.34]]) {
    const stone = new THREE.Mesh(makeBoulderGeometry(610 + x * 10, 1), rockMaterial);
    stone.position.set(x, heightAt(x, z) + 0.01, z);
    stone.scale.set(s, s * 0.65, s * 0.8);
    stone.castShadow = true;
    stone.receiveShadow = true;
    group.add(stone);
    rockSpots.push([x, z, s]);
  }
  // Exposed dark rock through the snow adds scale and contrast.
  for (const [x, z, s] of [[-1.7, 0.3, 0.42], [1.0, 1.5, 0.3], [2.0, -1.7, 0.36], [-2.0, -1.9, 0.3]]) {
    const outcrop = new THREE.Mesh(makeBoulderGeometry(680 + x * 9, 1), darkRockMaterial);
    outcrop.position.set(x, heightAt(x, z) + 0.005, z);
    outcrop.scale.set(s, s * 0.7, s * 0.9);
    outcrop.rotation.y = x + z;
    outcrop.castShadow = true;
    outcrop.receiveShadow = true;
    group.add(outcrop);
  }
  for (let i = 0; i < 9; i++) {
    const angle = i * 2.1 + 0.4;
    const radius = 1.4 + (i % 4) * 0.55;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius * 0.8;
    if (streamDistance(x, z) < 0.28) continue;
    const drift = new THREE.Mesh(new THREE.SphereGeometry(0.3 + (i % 3) * 0.12, 9, 6), snowMaterial);
    drift.position.set(x, heightAt(x, z) + 0.01, z);
    drift.scale.set(1.4, 0.13, 0.7);
    drift.rotation.y = angle;
    drift.receiveShadow = true;
    group.add(drift);
  }
  // Larger snowbanks frame the lake and give the foreground a soft edge.
  for (const [x, z, sx, sz] of [[-1.55, 2.85, 1.5, 0.8], [2.35, 2.55, 1.1, 0.65], [-3.1, 2.5, 1.2, 0.6]]) {
    const bank = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 7), snowMaterial);
    bank.position.set(x, heightAt(x, z) + 0.01, z);
    bank.scale.set(sx, 0.16, sz);
    bank.rotation.y = x;
    bank.receiveShadow = true;
    group.add(bank);
  }

  const alpineGroup = new THREE.Group();
  alpineGroup.name = "alpine camp";
  const cabin = createAlpineCabin();
  const cabinX = -2.3;
  const cabinZ = 1.25;
  cabin.group.position.set(cabinX, heightAt(cabinX, cabinZ), cabinZ);
  cabin.group.rotation.y = 0.22;
  cabin.group.scale.setScalar(1.28);
  alpineGroup.add(cabin.group);
  // Fence around the clearing.
  const fenceWood = new THREE.MeshStandardMaterial({ color: 0x5f4836, roughness: 0.95 });
  for (let i = 0; i < 7; i++) {
    const angle = -0.4 + i * 0.32;
    const x = cabinX + Math.cos(angle) * 0.85;
    const z = cabinZ + Math.sin(angle) * 0.72;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.28, 5), fenceWood);
    post.position.set(x, heightAt(x, z) + 0.14, z);
    post.castShadow = true;
    alpineGroup.add(post);
    if (i < 6) {
      const nx = cabinX + Math.cos(angle + 0.32) * 0.85;
      const nz = cabinZ + Math.sin(angle + 0.32) * 0.72;
      for (const y of [0.1, 0.2]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(nx - x, nz - z), 0.022, 0.022), fenceWood);
        rail.position.set((x + nx) / 2, heightAt((x + nx) / 2, (z + nz) / 2) + y, (z + nz) / 2);
        rail.rotation.y = -Math.atan2(nz - z, nx - x);
        alpineGroup.add(rail);
      }
    }
  }
  // Path stones from the cabin toward the pond.
  const pathStone = enhanceMaterial(new THREE.MeshStandardMaterial({ color: 0x8a8a80, roughness: 0.9, flatShading: true }), { detail: { scale: 20 } });
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const targetX = pondX - 0.78;
    const targetZ = pondZ - 0.08;
    const x = cabinX + t * (targetX - cabinX);
    const z = cabinZ + t * (targetZ - cabinZ);
    const stone = new THREE.Mesh(makeBoulderGeometry(730 + i, 1), pathStone);
    stone.position.set(x + Math.sin(t * 9) * 0.06, heightAt(x, z) + 0.01, z);
    stone.scale.set(0.16, 0.035, 0.12);
    stone.receiveShadow = true;
    alpineGroup.add(stone);
  }
  // Compressed footprints in the snow beside the path.
  const footprintMaterial = new THREE.MeshStandardMaterial({ color: 0x6f8597, roughness: 0.95 });
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const targetX = pondX - 0.78;
    const targetZ = pondZ - 0.08;
    const x = cabinX + t * (targetX - cabinX) + (i % 2 ? 0.09 : -0.09);
    const z = cabinZ + t * (targetZ - cabinZ);
    const print = new THREE.Mesh(new THREE.SphereGeometry(0.045, 7, 5), footprintMaterial);
    print.position.set(x, heightAt(x, z) + 0.012, z);
    print.scale.set(0.75, 0.1, 1.15);
    print.rotation.y = t * 1.4;
    alpineGroup.add(print);
  }
  // A short picket fence frames the left foreground like the reference photos.
  for (let i = 0; i < 5; i++) {
    const x = -3.55;
    const z = 1.15 + i * 0.42;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.42, 5), fenceWood);
    post.position.set(x, heightAt(x, z) + 0.21, z);
    post.castShadow = true;
    alpineGroup.add(post);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.034, 6, 5), snowMaterial);
    cap.position.set(x, heightAt(x, z) + 0.44, z);
    alpineGroup.add(cap);
    if (i < 4) {
      const nz = 1.15 + (i + 1) * 0.42;
      for (const y of [0.13, 0.28]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.48), fenceWood);
        rail.position.set(x, heightAt(x, (z + nz) / 2) + y, (z + nz) / 2);
        alpineGroup.add(rail);
      }
    }
  }
  // Two small lanterns.
  for (const [x, z] of [[cabinX + 0.55, cabinZ + 0.35], [cabinX + 0.2, cabinZ + 0.65]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.22, 5), fenceWood);
    post.position.set(x, heightAt(x, z) + 0.11, z);
    alpineGroup.add(post);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc06a }));
    lamp.position.set(x, heightAt(x, z) + 0.24, z);
    alpineGroup.add(lamp);
  }
  for (let i = 0; i < 5; i++) {
    const angle = i * 1.7;
    const drift = new THREE.Mesh(new THREE.SphereGeometry(0.24, 9, 6), snowMaterial);
    drift.position.set(cabinX + Math.cos(angle) * 0.55, heightAt(cabinX, cabinZ) + 0.01, cabinZ + Math.sin(angle) * 0.45);
    drift.scale.set(1, 0.16, 0.7);
    alpineGroup.add(drift);
  }
  group.add(alpineGroup);

  const polarGroup = new THREE.Group();
  polarGroup.name = "polar camp";
  const hut = createPolarHut();
  const hutX = 0.7;
  const hutZ = 1.15;
  hut.group.position.set(hutX, heightAt(hutX, hutZ), hutZ);
  hut.group.rotation.y = -0.22;
  hut.group.scale.setScalar(1.24);
  polarGroup.add(hut.group);
  // A single continuous glacier wall behind the hut, with fissures and blocky
  // seracs. No cone primitives are used for the ice.
  const glacier = createGlacierWall({ heightAt });
  polarGroup.add(glacier.group);
  const iceCrackPositions = [];
  for (let i = 0; i < 14; i++) {
    const angle = i * 1.37;
    const inner = 0.25 + (i % 3) * 0.2;
    const outer = inner + 0.45 + (i % 4) * 0.25;
    const x1 = Math.cos(angle) * inner;
    const z1 = Math.sin(angle) * inner * 0.8;
    const x2 = Math.cos(angle) * outer;
    const z2 = Math.sin(angle) * outer * 0.8;
    iceCrackPositions.push(x1, heightAt(x1, z1) + 0.012, z1, x2, heightAt(x2, z2) + 0.012, z2);
  }
  const iceCracks = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(iceCrackPositions, 3)),
    new THREE.LineBasicMaterial({ color: 0x5f9aaa, transparent: true, opacity: 0.55 }),
  );
  polarGroup.add(iceCracks);
  // Ice arch near the hut.
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 6, 14, Math.PI), iceShardMaterial);
  arch.position.set(-1.5, heightAt(-1.5, 2.3) + 0.1, 2.35);
  arch.rotation.z = Math.PI;
  polarGroup.add(arch);
  // Icicles on the rim.
  for (let i = 0; i < 10; i++) {
    const angle = 0.15 + i * 0.58;
    const point = rimPoint(angle, 0.99);
    const icicle = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.16 + (i % 3) * 0.06, 5).rotateX(Math.PI), iceFallMaterial);
    icicle.position.set(point.x, heightAt(point.x, point.z) - 0.13, point.z);
    polarGroup.add(icicle);
  }
  const reflectionMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: sceneUniforms.uTime,
      uColorA: { value: new THREE.Color(0x37f0ae) },
      uColorB: { value: new THREE.Color(0x9a7cff) },
    },
    vertexShader: `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5;
  float radial = 1.0 - smoothstep(0.12, 0.52, length(p * vec2(1.0, 1.35)));
  float bands = 0.45 + 0.55 * sin(vUv.x * 23.0 + sin(vUv.y * 7.0 + uTime * 0.12) * 1.6);
  float flicker = 0.72 + 0.28 * sin(uTime * 0.29 + vUv.y * 3.0);
  vec3 color = mix(uColorA, uColorB, smoothstep(0.15, 0.9, vUv.x) * 0.55);
  gl_FragColor = vec4(color, radial * bands * flicker * 0.52);
}`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const auroraReflection = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.25).rotateX(-Math.PI / 2), reflectionMaterial);
  auroraReflection.position.set(pondX, pondY + 0.006, pondZ);
  auroraReflection.renderOrder = 2;
  polarGroup.add(auroraReflection);
  group.add(polarGroup);
  const aurora = createAurora();
  group.add(aurora.group);

  cabin.group.userData.coldAction = "cabin";
  hut.group.userData.coldAction = "hut";
  glacier.group.userData.coldAction = "glacier";
  aurora.group.userData.coldAction = "aurora";
  let cabinPulseUntil = 0;
  let hutPulseUntil = 0;
  let glacierPulseUntil = 0;
  let cabinBase = { light: 0, ground: 0, pool: 0, halo: 0 };
  let hutBase = { light: 0, ground: 0, pool: 0, halo: 0 };
  let glacierBaseEmissive = 0.38;

  function setMode(mode, phase, mood) {
    const alpine = mode === "alpine";
    const polar = mode === "aurora";
    forestLife.visible = alpine;
    alpineGroup.visible = alpine;
    polarGroup.visible = polar;
    aurora.group.visible = polar;
    ridgeGroup.visible = alpine;
    glacier.group.visible = polar;
    if (alpine && mood) {
      cabin.windowMaterial.color.setHex(mood.window.color).multiplyScalar(mood.window.factor ?? 1);
      cabin.light.intensity = mood.window.intensity;
      cabin.light.color.setHex(mood.window.color);
      cabin.groundLight.intensity = mood.groundLight;
      cabin.pool.material.uniforms.uOpacity.value = mood.pool;
      cabin.halo.material.opacity = mood.halo;
      cabinBase = {
        light: mood.window.intensity,
        ground: mood.groundLight,
        pool: mood.pool,
        halo: mood.halo,
      };
    }
    if (polar && mood) {
      hut.windowMaterial.color.setHex(mood.window.color).multiplyScalar(mood.window.factor ?? 1);
      hut.light.intensity = mood.window.intensity;
      hut.light.color.setHex(mood.window.color);
      hut.groundLight.intensity = mood.groundLight;
      hut.pool.material.uniforms.uOpacity.value = mood.pool;
      hut.halo.material.opacity = mood.halo;
      hutBase = {
        light: mood.window.intensity,
        ground: mood.groundLight,
        pool: mood.pool,
        halo: mood.halo,
      };
    }
    glacierBaseEmissive = glacier.material.emissiveIntensity;
  }

  function actionFor(object) {
    let node = object;
    while (node && node !== group) {
      if (node.userData?.coldAction) return node.userData.coldAction;
      node = node.parent;
    }
    return null;
  }

  function interact(hit) {
    const action = actionFor(hit?.object);
    if (!action) return null;
    const now = sceneUniforms.uTime.value;
    if (action === "cabin") cabinPulseUntil = now + 1.3;
    else if (action === "hut") hutPulseUntil = now + 1.3;
    else if (action === "glacier") glacierPulseUntil = now + 1.0;
    else if (action === "aurora") aurora.pulse();
    return action;
  }

  function update(time) {
    if (aurora.group.visible) aurora.update(time);
    if (forestLife.visible) {
      const p = Math.max(0, (cabinPulseUntil - time) / 1.3);
      const e = p * p;
      const flicker = 1 + Math.sin(time * 1.7) * 0.012 + Math.sin(time * 4.3 + 1.2) * 0.006;
      cabin.light.intensity = cabinBase.light * flicker + e * 1.5;
      cabin.groundLight.intensity = cabinBase.ground + e * 1.0;
      cabin.pool.material.uniforms.uOpacity.value = cabinBase.pool + e * 0.18;
      cabin.halo.material.opacity = cabinBase.halo + e * 0.1;
    }
    if (polarGroup.visible) {
      const hp = Math.max(0, (hutPulseUntil - time) / 1.3);
      const he = hp * hp;
      const flicker = 1 + Math.sin(time * 1.9 + 0.6) * 0.01;
      hut.light.intensity = hutBase.light * flicker + he * 1.2;
      hut.halo.material.opacity = hutBase.halo + he * 0.1;
      const gp = Math.max(0, (glacierPulseUntil - time) / 1.0);
      glacier.material.emissiveIntensity = glacierBaseEmissive + gp * 0.5;
      glacier.group.scale.setScalar(1 + gp * 0.004);
    }
  }

  return { group, setMode, update, interact, actionFor, cabin, hut, aurora, glacier, treeSpots, terrain };
}
