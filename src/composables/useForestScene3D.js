import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { onMounted, onUnmounted, watch } from "vue";
import { createFoliageMaterials, buildTrees } from "../scene/vegetation.js";
import { buildFlowers, buildGrass } from "../scene/flora.js";
import { createPollen, enhanceMaterial, sceneUniforms } from "../scene/materials.js";
import { createSpray, createWaterMaterial, makeWaterRibbon, waterUniforms } from "../scene/water.js";
import { createFallingLeaves, createSnowfall } from "../scene/weather.js";
import { buildVines } from "../scene/vines.js";
import { createButterflies } from "../scene/butterflies.js";
import { createIslandTerrain, ISLAND_Z_SCALE, makeBoulderGeometry, makeIsletGeometry, rimPoint } from "../scene/terrain.js";

// Direction (in the island's unscaled polar space) where the stream spills off the rim.
const FALL_ANGLE = Math.atan2(1.8 / 0.75, 3.7);

const TREE_SPOTS = [
  [-3.45, -1.65, 1.05], [-2.35, -2.05, 0.73], [-1.05, -1.8, 1.15],
  [0.35, -2.1, 0.78], [1.55, -1.72, 1.02], [2.75, -1.32, 0.78],
  [-3.35, -0.1, 0.74], [-2.2, 0.25, 1.15], [-0.85, 0.05, 0.78],
  [0.75, -0.1, 1.13], [2.15, 0.15, 0.78], [3.25, 0.68, 0.92],
  [-2.55, 1.25, 0.87], [-1.1, 1.55, 0.72], [0.35, 1.42, 0.92],
  [1.85, 1.52, 0.72], [2.9, 1.62, 0.82],
];

const TREE_PALETTES = {
  morning: [0x426e54, 0x527d5d, 0x61876a, 0x739270],
  rain: [0x405651, 0x4c625c, 0x596d64, 0x68776b],
  night: [0x203c3a, 0x294a43, 0x315548, 0x3b5c4c],
  snow: [0x557461, 0x688777, 0x7b9682, 0x8da28b],
};

const { smoothstep } = THREE.MathUtils;

export function useForestScene3D(canvasRef, viewRef, state, notify) {
  let disposeScene;

  onMounted(() => {
    const canvas = canvasRef.value;
    const view = viewRef.value;
    if (!canvas || !view) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
        preserveDrawingBuffer: true,
      });
    } catch {
      state.threeAvailable = false;
      notify("此设备暂不支持 3D 显示，请尝试开启浏览器的硬件加速。");
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 80);
    const cameraTarget = new THREE.Vector3(0, 0.2, 0);
    let cameraYaw = 0.45;
    let targetYaw = cameraYaw;
    let cameraPitch = 0.48;
    let targetPitch = cameraPitch;
    let fitDistance = 16.5;
    let cameraDistance = fitDistance;
    let targetDistance = cameraDistance;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const ambientLight = new THREE.HemisphereLight(0xeaf4da, 0x423b2d, 1.55);
    scene.add(ambientLight);
    const sunlight = new THREE.DirectionalLight(0xffe5ae, 2.35);
    sunlight.position.set(-5, 9, 6);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(1024, 1024);
    sunlight.shadow.camera.left = -8;
    sunlight.shadow.camera.right = 8;
    sunlight.shadow.camera.top = 8;
    sunlight.shadow.camera.bottom = -8;
    sunlight.shadow.normalBias = 0.04;
    scene.add(sunlight);
    const fillLight = new THREE.DirectionalLight(0xa9d5c4, 1.05);
    fillLight.position.set(6, 4, -5);
    scene.add(fillLight);
    // Warm back light silhouettes crowns and grass tips against the sky.
    const backLight = new THREE.DirectionalLight(0xffd7a0, 1.1);
    backLight.position.set(3, 3.5, -8);
    scene.add(backLight);
    const nightGlow = new THREE.PointLight(0x9cdbca, 2.2, 12);
    nightGlow.position.set(0, 3.5, 0);
    scene.add(nightGlow);

    const island = new THREE.Group();
    scene.add(island);
    // The stream runs from a spring near the back rim and spills over the east edge.
    const fallLip = rimPoint(FALL_ANGLE, 0.99);
    const streamCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.9, 0.2, -3.2),
      new THREE.Vector3(-1.3, 0.2, -2.2),
      new THREE.Vector3(-0.35, 0.2, -1.15),
      new THREE.Vector3(0.5, 0.2, -0.15),
      new THREE.Vector3(1.3, 0.2, 0.9),
      new THREE.Vector3(2.45, 0.2, 1.72),
      new THREE.Vector3(fallLip.x - 0.35, 0.2, fallLip.z - 0.12),
      new THREE.Vector3(fallLip.x, 0.19, fallLip.z),
    ]);
    const terrain = createIslandTerrain({ streamCurve, fallAngle: FALL_ANGLE });
    const { heightAt, streamDistance } = terrain;

    // Cliff, islets and boulders carry their own vertex colours; the material only tints for mood.
    const terrainMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.94,
      flatShading: true,
    });
    const cliff = new THREE.Mesh(terrain.makeCliffGeometry(), terrainMaterial);
    cliff.name = "cliff";
    cliff.castShadow = true;
    cliff.receiveShadow = true;
    island.add(cliff);

    const meadow = new THREE.Mesh(
      terrain.makeMeadowGeometry(),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
    );
    meadow.name = "meadow";
    meadow.receiveShadow = true;
    island.add(meadow);

    // Ivy curtains and roots drape over the turf lip and sway as one.
    const vines = buildVines(terrain, { fallAngle: FALL_ANGLE, clumps: window.innerWidth < 700 ? 16 : 26 });
    island.add(vines.group);

    // Snow settles per vertex: meadow everywhere, cliff mostly on the turf lip and rock ledges.
    const snowSurfaces = [meadow, cliff].map((mesh) => {
      const attribute = mesh.geometry.getAttribute("color");
      return { attribute, base: attribute.array.slice(), weights: mesh.geometry.userData.snowWeights };
    });

    const streamHalfWidth = (t) => 0.15 + Math.sin(t * 25) * 0.025 + Math.sin(t * 61 + 0.8) * 0.014;
    const streamRibbon = makeWaterRibbon(
      streamCurve,
      140,
      streamHalfWidth,
      (t) => 0.19 + Math.sin(t * 18) * 0.003 - smoothstep(t, 0.93, 1) * 0.012,
    );
    const streamMaterial = createWaterMaterial(sceneUniforms.uTime, { speed: 0.32, length: streamRibbon.length });
    const stream = new THREE.Mesh(streamRibbon.geometry, streamMaterial);
    stream.name = "stream";
    stream.renderOrder = 1;
    const bankPositions = [];
    const bankIndices = [];
    const bankSegments = 110;
    for (let i = 0; i <= bankSegments; i++) {
      const t = i / bankSegments;
      const point = streamCurve.getPoint(t);
      const tangent = streamCurve.getTangent(t);
      const tangentLength = Math.hypot(tangent.x, tangent.z) || 1;
      const sideX = tangent.z / tangentLength;
      const sideZ = -tangent.x / tangentLength;
      const halfWidth = streamHalfWidth(t);
      const bankWidth = 0.06 + Math.sin(t * 33 + 1.1) * 0.018;
      // Banks slope from just under the waterline up to the carved meadow edge.
      const inner = 0.184;
      const outer = (offset) => heightAt(point.x + sideX * offset, point.z + sideZ * offset) + 0.006;
      const reach = halfWidth + bankWidth;
      bankPositions.push(
        point.x - sideX * reach, outer(-reach), point.z - sideZ * reach,
        point.x - sideX * halfWidth, inner, point.z - sideZ * halfWidth,
        point.x + sideX * halfWidth, inner, point.z + sideZ * halfWidth,
        point.x + sideX * reach, outer(reach), point.z + sideZ * reach,
      );
      if (i < bankSegments) {
        const a = i * 4;
        bankIndices.push(a, a + 4, a + 5, a, a + 5, a + 1, a + 2, a + 6, a + 7, a + 2, a + 7, a + 3);
      }
    }
    const bankGeometry = new THREE.BufferGeometry();
    bankGeometry.setAttribute("position", new THREE.Float32BufferAttribute(bankPositions, 3));
    bankGeometry.setIndex(bankIndices);
    bankGeometry.computeVertexNormals();
    const streamBanks = new THREE.Mesh(
      bankGeometry,
      new THREE.MeshStandardMaterial({ color: 0x687754, roughness: 0.98, flatShading: true, side: THREE.DoubleSide }),
    );
    streamBanks.name = "mossy stream banks";
    island.add(streamBanks);
    island.add(stream);
    const creekStoneMaterial = new THREE.MeshStandardMaterial({ color: 0x817d68, vertexColors: true, roughness: 0.92, flatShading: true });
    const creekStoneGeometries = [11, 23, 37].map((seed) => makeBoulderGeometry(seed, 1).scale(0.3, 0.3, 0.3));
    for (const [point, side, size] of [
      [0.7, -1, 0.9], [1.3, 1, 0.6], [2, 1, 1.0], [2.6, -1, 0.55], [3, -1, 0.72],
      [3.6, 1, 0.66], [4, 1, 0.82], [4.6, -1, 0.6], [5, -1, 0.92], [5.4, 1, 0.7],
    ]) {
      const curvePoint = streamCurve.getPoint(point / 6);
      const tangent = streamCurve.getTangent(point / 6);
      const stone = new THREE.Mesh(creekStoneGeometries[Math.round(point * 3) % 3], creekStoneMaterial);
      const reach = 0.19 + (point % 1) * 0.06;
      stone.position.x = curvePoint.x + tangent.z * side * reach;
      stone.position.z = curvePoint.z - tangent.x * side * reach;
      stone.position.y = Math.max(0.19, heightAt(stone.position.x, stone.position.z)) + 0.01;
      stone.scale.set(size, 0.7, 0.8);
      stone.rotation.set(0.2, point * 0.8, 0.12);
      stone.castShadow = true;
      island.add(stone);
    }

    const sourceEnd = streamCurve.getPoint(0);
    const sourceAngle = Math.atan2(sourceEnd.z / ISLAND_Z_SCALE, sourceEnd.x);
    const waterfallPaths = [
      terrain.makeWaterfallCurve(),
      terrain.makeWaterfallCurve({ angle: sourceAngle, streamEnd: sourceEnd }),
    ];
    const waterfalls = [];
    const waterfallSprays = [];
    waterfallPaths.forEach(({ curve, side, outward }, index) => {
      const fallRibbon = makeWaterRibbon(
        curve, 96,
        (t) => (0.18 + THREE.MathUtils.smoothstep(t, 0.05, 0.9) * 0.23
          + Math.sin(t * 15 + index) * 0.02 + Math.sin(t * 6 + 0.7) * 0.018) * (index ? 0.88 : 1),
        null, { side, outward },
      );
      const waterfall = new THREE.Mesh(
        fallRibbon.geometry,
        createWaterMaterial(sceneUniforms.uTime, { fall: true, speed: index ? 1.45 : 1.6, length: fallRibbon.length }),
      );
      waterfall.name = index ? "source waterfall" : "main waterfall";
      waterfall.userData.curve = curve;
      waterfall.renderOrder = 2;
      island.add(waterfall);
      waterfalls.push(waterfall);

      const spray = createSpray(curve, { side, outward }, sceneUniforms.uTime, window.innerWidth < 700 ? 36 : 62);
      spray.renderOrder = 3;
      island.add(spray);
      waterfallSprays.push(spray);
    });

    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x6f553e, vertexColors: true, roughness: 0.95 });
    const foliage = createFoliageMaterials(TREE_PALETTES.morning);
    const snowMaterial = enhanceMaterial(new THREE.MeshStandardMaterial({ color: 0xe7eee5, roughness: 0.76 }), { rustle: 0.022 });
    const snowBankMaterial = new THREE.MeshStandardMaterial({ color: 0xe7eee5, roughness: 0.8 });
    const branchMaterial = enhanceMaterial(new THREE.MeshStandardMaterial({ color: 0x5e4532, roughness: 0.96 }), { snow: 0.6 });
    const { trees, treeTargets, roots, mossPatches } = buildTrees(TREE_SPOTS, {
      trunkMaterial, foliage, branchMaterial, heightAt, leafDensity: window.innerWidth < 700 ? 0.55 : 1,
    });
    trees.forEach((tree) => island.add(tree));
    island.add(roots, mossPatches);

    const snowBanks = [];
    for (const [x, z, scale] of [
      [-3.8, -0.8, 0.95], [-3.15, 1.65, 0.8], [-1.85, -1.35, 0.78],
      [-0.7, 2.0, 0.88], [0.8, -1.45, 0.82], [2.4, 1.95, 0.9], [3.65, -0.35, 0.82],
    ]) {
      const bank = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 10), snowBankMaterial);
      bank.position.set(x, heightAt(x, z) + 0.02, z);
      bank.scale.set(scale, 0.19, scale * 0.72);
      bank.visible = false;
      snowBanks.push(bank);
      island.add(bank);
    }

    // A small handcrafted snowman gives the snowy island a clear focal point.
    const snowman = new THREE.Group();
    snowman.name = "snowman";
    snowman.position.set(1.2, heightAt(1.2, 2.65), 2.65);
    snowman.userData.baseY = snowman.position.y;
    snowman.userData.idlePhase = Math.random() * Math.PI * 2;
    snowman.rotation.y = -0.18;
    snowman.visible = false;
    const snowmanSnow = new THREE.MeshPhysicalMaterial({
      color: 0xf5f8f7, roughness: 0.72, clearcoat: 0.2, clearcoatRoughness: 0.48,
    });
    const coal = new THREE.MeshPhysicalMaterial({ color: 0x20272d, roughness: 0.28, clearcoat: 0.72 });
    const eyeGlint = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const blush = new THREE.MeshStandardMaterial({ color: 0xf29a9b, roughness: 0.9, transparent: true, opacity: 0.78 });
    const twig = new THREE.MeshStandardMaterial({ color: 0x493629, roughness: 0.92 });
    const scarf = new THREE.MeshStandardMaterial({ color: 0xd95f79, roughness: 0.76 });
    const scarfStripe = new THREE.MeshStandardMaterial({ color: 0xffd5bf, roughness: 0.72 });
    const hat = new THREE.MeshStandardMaterial({ color: 0xb95b87, roughness: 0.84 });
    const carrot = new THREE.MeshStandardMaterial({ color: 0xf18b45, roughness: 0.62 });
    const mitten = new THREE.MeshStandardMaterial({ color: 0xe56f86, roughness: 0.82 });
    const snowball = new THREE.SphereGeometry(1, 28, 20);
    const snowballs = [
      [0.36, 0.34, 0.34, 0.38],
      [0.265, 0.79, 0.28, 0.29],
      [0.2, 1.16, 0.22, 0.22],
    ];
    for (const [radius, y, scaleY, scaleZ] of snowballs) {
      const ball = new THREE.Mesh(snowball, snowmanSnow);
      ball.position.set(0, y, 0);
      ball.scale.set(radius, scaleY, scaleZ);
      ball.castShadow = true;
      ball.receiveShadow = true;
      snowman.add(ball);
    }
    const addSnowmanPiece = (geometry, material, x, y, z, rotation = null) => {
      const piece = new THREE.Mesh(geometry, material);
      piece.position.set(x, y, z);
      if (rotation) piece.rotation.set(...rotation);
      piece.castShadow = true;
      piece.receiveShadow = true;
      snowman.add(piece);
      return piece;
    };
    // A rounded knitted beanie, pom-pom, and soft brim.
    const cap = addSnowmanPiece(new THREE.SphereGeometry(0.19, 24, 16), hat, 0, 1.39, 0);
    cap.scale.set(1, 0.9, 1);
    const capBand = addSnowmanPiece(new THREE.TorusGeometry(0.176, 0.031, 10, 32), scarfStripe, 0, 1.345, 0);
    capBand.rotation.x = Math.PI / 2;
    addSnowmanPiece(new THREE.SphereGeometry(0.052, 14, 10), scarfStripe, 0, 1.55, 0);
    // Wrapped scarf with a striped tail hanging over the front.
    const scarfLoop = addSnowmanPiece(new THREE.TorusGeometry(0.218, 0.045, 10, 36), scarf, 0, 0.96, 0);
    scarfLoop.rotation.x = Math.PI / 2;
    const scarfTail = addSnowmanPiece(new THREE.BoxGeometry(0.086, 0.235, 0.045), scarf, 0.12, 0.79, 0.2, [0, 0, -0.12]);
    addSnowmanPiece(new THREE.BoxGeometry(0.088, 0.025, 0.012), scarfStripe, 0.12, 0.79, 0.226, [0, 0, -0.12]);
    addSnowmanPiece(new THREE.BoxGeometry(0.088, 0.025, 0.012), scarfStripe, 0.12, 0.68, 0.226, [0, 0, -0.12]);
    // Big glossy eyes, tiny catchlights, rosy cheeks, and a happy curved smile.
    for (const x of [-0.072, 0.072]) {
      addSnowmanPiece(new THREE.SphereGeometry(0.036, 16, 12), coal, x, 1.195, 0.222);
      addSnowmanPiece(new THREE.SphereGeometry(0.011, 10, 8), eyeGlint, x - 0.009, 1.208, 0.252);
      addSnowmanPiece(new THREE.SphereGeometry(0.0045, 8, 6), eyeGlint, x + 0.012, 1.183, 0.254);
    }
    for (const x of [-0.128, 0.128]) {
      const rosyCheek = addSnowmanPiece(new THREE.SphereGeometry(0.045, 14, 10), blush, x, 1.11, 0.179);
      rosyCheek.scale.set(1, 0.58, 0.36);
    }
    for (const [x, y] of [[-0.06, 1.075], [-0.032, 1.059], [0, 1.054], [0.032, 1.059], [0.06, 1.075]]) {
      addSnowmanPiece(new THREE.SphereGeometry(0.009, 8, 7), coal, x, y, 0.207);
    }
    // A short, rounded carrot nose points toward the viewer.
    addSnowmanPiece(new THREE.ConeGeometry(0.038, 0.16, 10), carrot, 0, 1.137, 0.266, [Math.PI / 2, 0, 0]);
    for (const y of [0.82, 0.67, 0.52]) addSnowmanPiece(new THREE.SphereGeometry(0.026, 10, 8), coal, 0, y, 0.285);
    // Forked twig arms break the stacked-snow silhouette.
    const snowmanArms = new THREE.Group();
    const addTwig = (points, radius = 0.017) => {
      const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
      const arm = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, radius, 6, false), twig);
      arm.castShadow = true;
      snowmanArms.add(arm);
    };
    addTwig([[0.2, 0.85, 0], [0.34, 0.9, 0], [0.47, 1.0, 0.015], [0.53, 1.09, 0.02]]);
    addTwig([[0.43, 0.97, 0.01], [0.52, 0.98, 0.02], [0.57, 0.95, 0.02]], 0.012);
    addTwig([[-0.2, 0.85, 0], [-0.34, 0.91, 0], [-0.46, 0.99, 0.015], [-0.51, 1.08, 0.02]]);
    addTwig([[-0.42, 0.97, 0.01], [-0.51, 0.98, 0.02], [-0.56, 0.95, 0.02]], 0.012);
    for (const [x, y] of [[0.53, 1.09], [-0.51, 1.08]]) {
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.046, 12, 10), mitten);
      hand.position.set(x, y, 0.02);
      hand.scale.set(1, 0.82, 0.78);
      hand.castShadow = true;
      snowmanArms.add(hand);
    }
    snowman.add(snowmanArms);
    island.add(snowman);

    const rockMaterials = [0x73705c, 0x89836a, 0x5f6957].map(
      (color) => new THREE.MeshStandardMaterial({ color, vertexColors: true, roughness: 1, flatShading: true }),
    );
    const rockGeometries = [3, 7, 13].map((seed) => makeBoulderGeometry(seed));
    const interactiveRocks = [];
    for (const [x, z, scale, index] of [
      [-4.05, -0.95, 0.92, 0], [-3.74, -0.65, 0.65, 1], [3.92, -0.15, 0.74, 2],
      [-3.45, 1.78, 0.62, 1], [2.95, 2.3, 0.9, 0], [3.35, -2.1, 0.58, 2],
      [-1.55, 2.45, 0.42, 2], [1.2, -2.75, 0.5, 1], [-0.2, 2.9, 0.34, 0], [-4.15, 0.45, 0.4, 2],
    ]) {
      const rock = new THREE.Mesh(rockGeometries[Math.abs(Math.round(x * 3 + z)) % rockGeometries.length], rockMaterials[index]);
      rock.position.set(x, heightAt(x, z) + 0.02 * scale, z);
      rock.scale.set(scale, scale * 0.72, scale * 0.88);
      rock.rotation.set(0, x * 0.4 + z, 0);
      rock.userData.baseY = rock.position.y;
      rock.userData.baseScale = rock.scale.clone();
      rock.userData.tapAt = 0;
      rock.receiveShadow = true;
      rock.castShadow = true;
      interactiveRocks.push(rock);
      island.add(rock);
    }
    for (const [x, y, z, scale, index] of [
      [-4.7, -1.55, 1.6, 0.85, 0], [4.85, -2.0, -0.9, 1.0, 1],
      [-2.9, -2.75, -2.45, 0.62, 2], [0.9, -2.45, -3.2, 0.5, 3],
    ]) {
      // Each islet gets its own seed so no two silhouettes match.
      const rock = new THREE.Mesh(makeIsletGeometry(x + z), terrainMaterial);
      rock.position.set(x, y, z);
      rock.scale.setScalar(scale);
      rock.rotation.y = x * 1.7;
      rock.castShadow = true;
      rock.userData.baseY = y;
      rock.userData.baseScale = rock.scale.clone();
      rock.userData.tapAt = 0;
      rock.userData.floatPhase = index;
      interactiveRocks.push(rock);
      const isletColors = rock.geometry.getAttribute("color");
      snowSurfaces.push({ attribute: isletColors, base: isletColors.array.slice(), weights: rock.geometry.userData.snowWeights });
      island.add(rock);
    }

    const mistMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: sceneUniforms.uTime,
        uOpacity: { value: 0 },
        uSeed: { value: 0 },
        uColor: { value: new THREE.Color(0xd9e1e2) },
      },
      vertexShader: `varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
      fragmentShader: `uniform float uTime;
uniform float uOpacity;
uniform float uSeed;
uniform vec3 uColor;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed * 91.7) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float n = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { n += noise(p) * a; p = p * 2.03 + 13.7; a *= 0.5; }
  return n;
}
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float shape = 1.0 - smoothstep(0.28, 1.08, length(p * vec2(0.78, 1.08)));
  float drift = fbm(vUv * vec2(5.0, 2.8) + vec2(uTime * 0.012 + uSeed, -uTime * 0.003));
  float wisps = smoothstep(0.24, 0.78, drift);
  float filaments = 0.88 + 0.12 * sin(vUv.y * 19.0 + drift * 7.0 + uTime * 0.08);
  float alpha = shape * (0.3 + wisps * 0.7) * filaments * uOpacity;
  gl_FragColor = vec4(uColor, alpha);
}`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mistGeometry = new THREE.PlaneGeometry(1, 1);
    const mistClouds = Array.from({ length: 9 }, (_, index) => {
      const material = mistMaterial.clone();
      material.uniforms.uTime = sceneUniforms.uTime;
      material.uniforms.uSeed.value = index * 7.31 + 1.4;
      const cloud = new THREE.Mesh(mistGeometry, material);
      const angle = index * 2.399;
      const radius = 1.05 + (index % 4) * 0.72;
      cloud.position.set(Math.cos(angle) * radius, 0.48 + index % 5 * 0.4, Math.sin(angle) * radius * 0.72);
      cloud.scale.set(3.0 + index % 3 * 0.62, 1.0 + index % 2 * 0.38, 1);
      cloud.userData.baseX = cloud.position.x;
      cloud.userData.baseY = cloud.position.y;
      cloud.userData.baseZ = cloud.position.z;
      cloud.userData.phase = index * 1.73;
      island.add(cloud);
      return cloud;
    });
    mistMaterial.dispose();

    // Flower drifts and grass avoid trunks so nothing sprouts through a tree.
    const trunkSpots = TREE_SPOTS.map(([x, z]) => [x, z]);
    const flowerBeds = buildFlowers({
      perType: window.innerWidth < 700 ? 9 : 16, heightAt, streamDistance, rimPoint, avoid: trunkSpots,
    });
    island.add(flowerBeds);
    const flowers = [flowerBeds];
    const butterflies = createButterflies(6, { blooms: flowerBeds.userData.blooms, heightAt });
    island.add(butterflies.group);

    const grass = buildGrass({
      count: window.innerWidth < 700 ? 2600 : 5200, heightAt, streamDistance, rimPoint, avoid: trunkSpots,
    });
    island.add(grass);
    const grassDummy = new THREE.Object3D();

    const pollen = createPollen(window.innerWidth < 700 ? 50 : 90);
    island.add(pollen);

    // Scattered pebbles break up the meadow and gather along the stream.
    const pebbleCount = window.innerWidth < 700 ? 40 : 70;
    const pebbles = new THREE.InstancedMesh(
      makeBoulderGeometry(41, 0).scale(0.16, 0.16, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x8a8670, vertexColors: true, roughness: 0.95, flatShading: true }),
      pebbleCount,
    );
    for (let i = 0; i < pebbleCount; i++) {
      const nearStream = i % 3 === 0;
      const t = nearStream ? Math.random() * 0.95 : 0;
      let x;
      let z;
      if (nearStream) {
        const point = streamCurve.getPoint(t);
        const tangent = streamCurve.getTangent(t);
        const offset = (Math.random() < 0.5 ? -1 : 1) * (0.2 + Math.random() * 0.12);
        x = point.x + tangent.z * offset;
        z = point.z - tangent.x * offset;
      } else {
        ({ x, z } = rimPoint(Math.random() * Math.PI * 2, 0.3 + Math.random() * 0.62));
      }
      const size = 0.45 + Math.random() * 0.9;
      grassDummy.position.set(x, heightAt(x, z) + 0.008 * size, z);
      grassDummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      grassDummy.scale.set(size, size * (0.5 + Math.random() * 0.3), size * (0.7 + Math.random() * 0.4));
      grassDummy.updateMatrix();
      pebbles.setMatrixAt(i, grassDummy.matrix);
      pebbles.setColorAt(i, new THREE.Color().setHSL(0.12 + Math.random() * 0.06, 0.08 + Math.random() * 0.08, 0.42 + Math.random() * 0.2));
    }
    pebbles.receiveShadow = true;
    island.add(pebbles);

    const fireflyBodyGeometry = new THREE.SphereGeometry(1, 12, 8);
    const fireflyBodyMaterial = new THREE.MeshStandardMaterial({ color: 0x89704a, roughness: 0.62, metalness: 0.08 });
    const fireflyHeadMaterial = new THREE.MeshStandardMaterial({ color: 0x3e3528, roughness: 0.48 });
    const fireflyEyeMaterial = new THREE.MeshBasicMaterial({ color: 0x171914 });
    const fireflyFacetMaterial = new THREE.MeshBasicMaterial({ color: 0x806b43 });
    const fireflyShellMaterial = new THREE.MeshStandardMaterial({ color: 0xb38b50, roughness: 0.38, metalness: 0.22 });
    const fireflyAbdomenMaterial = new THREE.MeshStandardMaterial({
      color: 0xb2cc5b, roughness: 0.48, emissive: 0x7ea82b, emissiveIntensity: 0.62,
    });
    const fireflyWingMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xd7e7cc, roughness: 0.34, metalness: 0.05, transparent: true, opacity: 0.62,
      side: THREE.DoubleSide, depthWrite: false, clearcoat: 0.5,
    });
    const fireflyGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xd9f67b, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const fireflyCoreMaterial = new THREE.MeshBasicMaterial({ color: 0xf2ffb2 });
    const fireflyVeinMaterial = new THREE.LineBasicMaterial({ color: 0xe6efcf, transparent: true, opacity: 0.7 });
    const fireflyWingShape = new THREE.Shape();
    fireflyWingShape.moveTo(0, 0);
    fireflyWingShape.quadraticCurveTo(0.055, 0.035, 0.075, 0.105);
    fireflyWingShape.quadraticCurveTo(0.018, 0.095, 0, 0);
    const fireflyWingGeometry = new THREE.ShapeGeometry(fireflyWingShape, 8);
    const fireflyAbdomenRingGeometry = new THREE.TorusGeometry(0.017, 0.0022, 5, 16);
    const fireflyWingVeinGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.004, 0.002), new THREE.Vector3(0.061, 0.086, 0.002),
      new THREE.Vector3(0.018, 0.03, 0.002), new THREE.Vector3(0.067, 0.033, 0.002),
      new THREE.Vector3(0.033, 0.05, 0.002), new THREE.Vector3(0.069, 0.065, 0.002),
      new THREE.Vector3(0.046, 0.068, 0.002), new THREE.Vector3(0.071, 0.088, 0.002),
    ]);
    const fireflyLegGeometry = new THREE.CylinderGeometry(0.0022, 0.003, 0.043, 5);
    const fireflyAntennaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.006, 0.018, 0), new THREE.Vector3(0.016, 0.027, 0.002),
    ]);
    const fireflyAntennaGeometry = new THREE.TubeGeometry(fireflyAntennaCurve, 5, 0.0018, 4, false);
    const fireflies = Array.from({ length: 23 }, (_, index) => {
      const firefly = new THREE.Group();
      firefly.name = `firefly-${index + 1}`;
      const wingHinges = [];
      const body = new THREE.Mesh(fireflyBodyGeometry, fireflyBodyMaterial);
      body.scale.set(0.027, 0.027, 0.048);
      firefly.add(body);
      const head = new THREE.Mesh(fireflyBodyGeometry, fireflyHeadMaterial);
      head.position.set(0, 0.003, 0.047);
      head.scale.set(0.023, 0.022, 0.024);
      firefly.add(head);
      const thoraxShield = new THREE.Mesh(fireflyBodyGeometry, fireflyShellMaterial);
      thoraxShield.position.set(0, 0.021, 0.002);
      thoraxShield.scale.set(0.021, 0.008, 0.026);
      firefly.add(thoraxShield);
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(fireflyBodyGeometry, fireflyEyeMaterial);
        eye.position.set(side * 0.015, 0.009, 0.061);
        eye.scale.set(0.008, 0.009, 0.006);
        firefly.add(eye);
        for (const [dx, dy, dz] of [[0, 0, 0.005], [0, 0.005, 0.002], [0, -0.005, 0.002], [side * 0.004, 0, 0], [-side * 0.004, 0, 0]]) {
          const facet = new THREE.Mesh(fireflyBodyGeometry, fireflyFacetMaterial);
          facet.position.set(side * 0.015 + dx, 0.009 + dy, 0.061 + dz);
          facet.scale.set(0.0024, 0.0024, 0.002);
          firefly.add(facet);
        }
        const antenna = new THREE.Mesh(fireflyAntennaGeometry, fireflyBodyMaterial);
        antenna.position.set(side * 0.008, 0.018, 0.06);
        antenna.scale.x = side;
        firefly.add(antenna);
        const antennaTip = new THREE.Mesh(fireflyBodyGeometry, fireflyShellMaterial);
        antennaTip.position.set(side * 0.024, 0.045, 0.062);
        antennaTip.scale.setScalar(0.0035);
        firefly.add(antennaTip);
      }
      const wings = [-1, 1].map((side) => {
        const hinge = new THREE.Group();
        hinge.position.set(side * 0.016, 0.021, -0.006);
        const wing = new THREE.Mesh(fireflyWingGeometry, fireflyWingMaterial);
        wing.scale.x = side;
        hinge.add(wing);
        const veins = new THREE.LineSegments(fireflyWingVeinGeometry, fireflyVeinMaterial);
        veins.scale.x = side;
        hinge.add(veins);
        firefly.add(hinge);
        wingHinges.push(hinge);
        return { hinge, side };
      });
      for (const side of [-1, 1]) {
        for (let leg = 0; leg < 3; leg++) {
          const foot = new THREE.Mesh(fireflyLegGeometry, fireflyBodyMaterial);
          foot.position.set(side * 0.018, -0.031, 0.025 - leg * 0.025);
          foot.rotation.z = side * (0.72 + leg * 0.08);
          foot.rotation.x = side * (0.28 + leg * 0.14);
          firefly.add(foot);
          const joint = new THREE.Mesh(fireflyBodyGeometry, fireflyShellMaterial);
          joint.position.set(side * 0.028, -0.035, 0.025 - leg * 0.025);
          joint.scale.setScalar(0.004);
          firefly.add(joint);
        }
      }
      const abdomen = new THREE.Mesh(fireflyBodyGeometry, fireflyAbdomenMaterial);
      abdomen.position.set(0, -0.003, -0.051);
      abdomen.scale.set(0.022, 0.021, 0.035);
      firefly.add(abdomen);
      for (const z of [-0.034, -0.051, -0.068]) {
        const ring = new THREE.Mesh(fireflyAbdomenRingGeometry, fireflyShellMaterial);
        ring.position.set(0, -0.003, z);
        ring.scale.set(1.15, 0.95, 1);
        firefly.add(ring);
      }
      const glow = new THREE.Mesh(fireflyBodyGeometry, fireflyGlowMaterial.clone());
      glow.position.set(0, -0.008, -0.074);
      glow.scale.set(0.084, 0.073, 0.09);
      firefly.add(glow);
      const core = new THREE.Mesh(fireflyBodyGeometry, fireflyCoreMaterial);
      core.position.set(0, -0.006, -0.079);
      core.scale.set(0.015, 0.014, 0.023);
      firefly.add(core);
      firefly.userData.wings = wings;
      firefly.userData.glow = glow;
      // Merge the many tiny static parts into a handful of material batches.
      // This keeps the extra detail affordable when the whole swarm is visible at night.
      firefly.updateMatrixWorld(true);
      const batches = new Map();
      const staticMeshes = [];
      firefly.traverse((object) => {
        if (!object.isMesh || object === glow) return;
        let parent = object.parent;
        while (parent && parent !== firefly) {
          if (wingHinges.includes(parent)) return;
          parent = parent.parent;
        }
        if (parent !== firefly) return;
        const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
        if (!batches.has(object.material)) batches.set(object.material, []);
        batches.get(object.material).push(geometry);
        staticMeshes.push(object);
      });
      staticMeshes.forEach((mesh) => mesh.parent.remove(mesh));
      batches.forEach((geometries, material) => {
        const merged = mergeGeometries(geometries, false);
        geometries.forEach((geometry) => geometry.dispose());
        if (!merged) return;
        merged.computeBoundingSphere();
        firefly.add(new THREE.Mesh(merged, material));
      });
      firefly.userData.baseScale = (1.42 + (index % 4) * 0.08) * 0.25;
      firefly.scale.setScalar(firefly.userData.baseScale);
      firefly.userData.scareTarget = new THREE.Vector3();
      firefly.userData.scareUntil = 0;
      firefly.position.set(
        Math.sin(index * 9.17) * (1.2 + index % 4 * 0.45),
        0.6 + (index % 5) * 0.36,
        Math.cos(index * 5.31) * (0.8 + index % 5 * 0.32),
      );
      firefly.userData.baseX = firefly.position.x;
      firefly.userData.baseY = firefly.position.y;
      firefly.userData.baseZ = firefly.position.z;
      firefly.visible = false;
      island.add(firefly);
      return firefly;
    });
    fireflyGlowMaterial.dispose();
    const fireflyGather = { target: new THREE.Vector3(), until: 0 };

    const rainCount = window.innerWidth < 700 ? 86 : 150;
    const rainMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.008, 0.014, 0.22, 5),
      new THREE.MeshBasicMaterial({ color: 0xd5eafa, transparent: true, opacity: 0.56, depthWrite: false }),
      rainCount,
    );
    rainMesh.frustumCulled = false;
    rainMesh.visible = false;
    rainMesh.renderOrder = 2;
    scene.add(rainMesh);
    const rain = Array.from({ length: rainCount }, () => ({
      x: (Math.random() - 0.5) * 9,
      y: Math.random() * 7,
      z: (Math.random() - 0.5) * 6.8,
      speed: 6 + Math.random() * 5,
      lean: -0.09 - Math.random() * 0.08,
      size: 0.55 + Math.random() * 0.9,
      length: 0.65 + Math.random() * 1.05,
    }));
    let rainImpactTimer = 0;

    // Snow fades in and out with the weather instead of popping on.
    const snowfall = createSnowfall(window.innerWidth < 700 ? 450 : 900, sceneUniforms.uTime);
    snowfall.visible = false;
    scene.add(snowfall);
    const fallingLeaves = createFallingLeaves(window.innerWidth < 700 ? 14 : 26, { trees, heightAt });
    island.add(fallingLeaves.mesh);
    const dummy = new THREE.Object3D();
    updateParticles(rain, rainMesh, 0, 0, false);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const ripples = Array.from({ length: 15 }, () => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.15, 0.012, 5, 36),
        new THREE.MeshBasicMaterial({ color: 0xd8f6e5, transparent: true, opacity: 0, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.visible = false;
      scene.add(ring);
      return { mesh: ring, age: 0, active: false };
    });
    let active = true;
    let frame = 0;
    let lastFrame = 0;
    let dirty = true;
    let pointerDown = null;
    let dragStart = null;
    let dragged = false;
    const activePointers = new Map();
    let pinchDistanceStart = 0;
    let pinchZoomStart = cameraDistance;
    let hoverTree = null;
    let hoverRock = null;
    let hoverFirefly = null;
    let hoverInteractive = false;
    const sparks = [];
    const waterDrops = [];
    const waterDropGeometry = new THREE.SphereGeometry(0.018, 8, 6);
    const flowerPulses = [];
    const sparkGeometry = new THREE.IcosahedronGeometry(0.045, 1);
    let moodTargets = [];
    let snowCoverage = 0;
    let targetSnowCoverage = 0;
    let contextLost = false;

    function updateCamera() {
      const horizontal = Math.cos(cameraPitch) * cameraDistance;
      camera.position.set(
        Math.sin(cameraYaw) * horizontal,
        Math.sin(cameraPitch) * cameraDistance + cameraTarget.y,
        Math.cos(cameraYaw) * horizontal,
      );
      camera.lookAt(cameraTarget);
    }
    function resize() {
      const rect = view.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      camera.aspect = rect.width / rect.height;
      const previousFit = fitDistance;
      fitDistance = Math.max(15.8, 5.55 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
      targetDistance *= fitDistance / previousFit;
      cameraDistance *= fitDistance / previousFit;
      camera.far = Math.max(80, fitDistance * 1.5 + 15);
      camera.setViewOffset(rect.width, rect.height, 0, rect.height * (camera.aspect < 0.8 ? 0.055 : 0.035), rect.width, rect.height);
      camera.updateProjectionMatrix();
      renderer.setSize(rect.width, rect.height, false);
      pollen.material.uniforms.uScale.value = rect.height * renderer.getPixelRatio() * 0.09;
      snowfall.material.uniforms.uScale.value = rect.height * renderer.getPixelRatio() * 0.072;
      waterfallSprays.forEach((spray) => {
        spray.material.uniforms.uScale.value = rect.height * renderer.getPixelRatio() * 0.08;
      });
      updateCamera();
      dirty = true;
      if (!contextLost) renderer.render(scene, camera);
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(view);
    resize();

    function applySceneMood() {
      const night = state.phase === "night";
      const afternoon = state.phase === "afternoon";
      const rainy = state.weather === "rain";
      const snowing = state.weather === "snow";
      const misty = state.weather === "mist";
      const palette = TREE_PALETTES[snowing ? "snow" : rainy ? "rain" : night ? "night" : state.scene] || TREE_PALETTES.morning;
      moodTargets = [];
      const color = (object, property, value) => moodTargets.push({ object, property, value: new THREE.Color(value) });
      const number = (object, property, value) => moodTargets.push({ object, property, value });
      foliage.all.forEach((material, index) => {
        const isLeaf = index >= foliage.crowns.length;
        color(material, "color", palette[index % palette.length]);
        color(material, "emissive", night ? 0x133631 : 0x000000);
        number(material, "emissiveIntensity", night ? 0.24 : 0);
        // Wet leaves turn glossy in the rain.
        number(material, "roughness", rainy ? (isLeaf ? 0.32 : 0.6) : isLeaf ? 0.62 : 0.86);
      });
      color(vines.leafMaterial, "color", night ? 0x2a4a3a : rainy ? 0x53675d : snowing ? 0x6f8a68 : afternoon ? 0x6c9040 : 0x5c8a3e);
      number(vines.leafMaterial, "roughness", rainy ? 0.32 : 0.6);
      color(vines.strandMaterial, "color", night ? 0x2a2420 : rainy ? 0x494744 : snowing ? 0x52524a : 0x3e322a);
      number(vines.strandMaterial, "roughness", rainy ? 0.55 : 0.9);
      color(branchMaterial, "color", night ? 0x2a2420 : rainy ? 0x4c4741 : snowing ? 0x52524a : 0x3e322a);
      number(branchMaterial, "roughness", rainy ? 0.55 : 0.88);
      butterflies.group.visible = !night && !rainy && !snowing;
      targetSnowCoverage = snowing ? 1 : 0;

      snowBanks.forEach((bank) => { bank.visible = snowing; });
      snowman.visible = snowing;
      if (!snowing) {
        snowman.position.y = snowman.userData.baseY;
        snowman.rotation.z = 0;
        snowman.scale.setScalar(1);
        snowmanArms.rotation.z = 0;
        cap.rotation.z = 0;
        scarfTail.rotation.z = -0.12;
        snowman.userData.reactionUntil = 0;
      }
      if (snowing) snowfall.visible = true;
      number(snowfall.material.uniforms.uOpacity, "value", snowing ? (night ? 0.75 : 0.95) : 0);
      color(snowfall.material.uniforms.uColor, "value", snowing ? (night ? 0xcbdcff : 0xeaf5ff) : 0xf7fbff);
      fallingLeaves.mesh.visible = !snowing && !reducedMotion.matches;
      fallingLeaves.setPalette(afternoon);
      rainMesh.visible = rainy;
      fireflies.forEach((fly) => { fly.visible = night; });
      flowers.forEach((flower) => { flower.visible = !snowing && !rainy; });
      pollen.visible = !night && !rainy && !snowing;
      number(pollen.material.uniforms.uOpacity, "value", misty ? 0.45 : afternoon ? 0.95 : 0.75);
      number(sceneUniforms.uWind, "value", reducedMotion.matches ? 0 : rainy ? 2.2 : snowing ? 0.5 : 1);
      number(sceneUniforms.uRimStrength, "value", night ? 0.3 : rainy ? 0.18 : snowing ? 0.25 : afternoon ? 0.6 : 0.45);
      color(sceneUniforms.uRimColor, "value", night ? 0x7fc8c0 : snowing ? 0xdbe8f0 : afternoon ? 0xffd08a : 0xffe2b0);
      number(backLight, "intensity", night ? 0.35 : rainy ? 0.42 : afternoon ? 1.5 : 1.1);
      color(backLight, "color", rainy ? 0xd4b98f : snowing ? 0xd3dcff : 0xffd7a0);
      // Frosted, muted blades poke through the snow instead of staying spring-green.
      color(grass.material, "color", rainy ? 0xb2bcb6 : 0xffffff);
      number(sceneUniforms.uSnow, "value", snowing ? 1 : 0);
      number(ambientLight, "intensity", night ? 0.55 : rainy ? 1.02 : 1.55);
      color(ambientLight, "color", night ? 0x7d9db4 : rainy ? 0xc4d0d5 : snowing ? 0xe7f1f6 : 0xeaf4da);
      number(sunlight, "intensity", night ? 0.75 : rainy ? 1.05 : afternoon ? 2.75 : 2.35);
      color(sunlight, "color", night ? 0x9bb9db : snowing ? 0xe0e4ff : rainy ? 0xc5cdd2 : afternoon ? 0xfff1ce : 0xffd79d);
      number(sunlight.position, "x", afternoon ? -2.5 : -5);
      number(sunlight.position, "y", afternoon ? 11 : 8);
      number(fillLight, "intensity", night ? 0.7 : rainy ? 0.82 : 1.05);
      color(fillLight, "color", night ? 0x5685ba : rainy ? 0x8da4ad : snowing ? 0xb7d3f6 : 0xa9d5c4);
      number(nightGlow, "intensity", night ? 3.4 : 0.4);
      color(meadow.material, "color", rainy ? 0xb1bfba : 0xffffff);
      color(terrainMaterial, "color", rainy ? 0xa5afb0 : snowing ? 0xdfe3e2 : 0xffffff);
      color(waterUniforms.uDeep, "value", night ? 0x0f3438 : rainy ? 0x304851 : snowing ? 0x3f6e72 : 0x1f5a55);
      color(waterUniforms.uShallow, "value", night ? 0x2a6560 : rainy ? 0x6d898d : snowing ? 0x8bb7b5 : 0x5fa59a);
      color(waterUniforms.uSky, "value", night ? 0x4a6680 : rainy ? 0x9dabb0 : snowing ? 0xe6eef2 : afternoon ? 0xf1e2c4 : 0xcfe3da);
      color(waterUniforms.uSunColor, "value", night ? 0x9bb9db : rainy ? 0xb6c0c2 : afternoon ? 0xffe0a8 : 0xfff0d0);
      number(waterUniforms.uGlow, "value", night ? 0.6 : 0);
      number(waterUniforms.uRain, "value", rainy ? 1 : 0);
      number(snowfall.material.uniforms.uGust, "value", misty ? 0.4 : 1);
      const mistOpacity = misty ? 0.58 : rainy ? 0.42 : 0;
      mistClouds.forEach((cloud) => {
        number(cloud.material.uniforms.uOpacity, "value", mistOpacity);
        color(cloud.material.uniforms.uColor, "value", rainy ? (night ? 0x9baab3 : 0xcbd4d8) : 0xe3e9e7);
      });
      number(renderer, "toneMappingExposure", night ? 0.94 : rainy ? 0.96 : snowing ? 0.98 : 1.04);
      dirty = true;
    }
    applySceneMood();

    function pointFromPointer(event) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      camera.updateMatrixWorld();
      island.updateMatrixWorld(true);
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
    }
    function burstAt(point, winter = false, tint = null) {
      if (reducedMotion.matches) return;
      while (sparks.length > 110) {
        const oldest = sparks.shift();
        scene.remove(oldest.mesh);
        oldest.material.dispose();
      }
      for (let i = 0; i < 10; i++) {
        const material = new THREE.MeshBasicMaterial({
          color: tint || (winter ? 0xf3f8ed : 0xf2d98a),
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(sparkGeometry, material);
        mesh.position.copy(point);
        mesh.scale.setScalar(0.45 + Math.random() * 1.15);
        scene.add(mesh);
        sparks.push({
          mesh,
          material,
          life: 0.75 + Math.random() * 0.8,
          velocity: new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.4 + Math.random() * 1.4, (Math.random() - 0.5) * 1.4),
        });
      }
    }
    function addRipple(point, tint = 0xd8f6e5) {
      if (reducedMotion.matches) return;
      for (let wave = 0; wave < 3; wave++) {
        const ripple = ripples.find((item) => !item.active);
        if (!ripple) break;
        ripple.active = true;
        ripple.age = -wave * 0.12;
        ripple.duration = 0.82 + wave * 0.12;
        ripple.maxScale = 2.6 + wave * 0.45;
        ripple.maxOpacity = 0.64;
        ripple.mesh.material.color.setHex(tint);
        ripple.mesh.material.opacity = 0;
        ripple.mesh.position.set(point.x, point.y + 0.035 + wave * 0.002, point.z);
        ripple.mesh.scale.setScalar(0.16);
        ripple.mesh.visible = true;
      }
    }
    function addRainImpact(point, onWater) {
      if (reducedMotion.matches) return;
      const ripple = ripples.find((item) => !item.active);
      if (!ripple) return;
      ripple.active = true;
      ripple.age = 0;
      ripple.duration = onWater ? 0.62 : 0.42;
      ripple.maxScale = onWater ? 0.62 : 0.28;
      ripple.maxOpacity = onWater ? 0.25 : 0.14;
      ripple.mesh.material.color.setHex(onWater ? 0xcaf4f0 : 0xe1ebed);
      ripple.mesh.material.opacity = 0;
      ripple.mesh.position.set(point.x, point.y + (onWater ? 0.024 : 0.012), point.z);
      ripple.mesh.scale.setScalar(0.08);
      ripple.mesh.visible = true;
    }
    function splashAt(point, tint = 0xa9e4df) {
      if (reducedMotion.matches) return;
      while (waterDrops.length > 72) {
        const oldest = waterDrops.shift();
        scene.remove(oldest.mesh);
        oldest.material.dispose();
      }
      for (let i = 0; i < 9; i++) {
        const material = new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.9, depthWrite: false });
        const drop = new THREE.Mesh(waterDropGeometry, material);
        drop.position.copy(point).add(new THREE.Vector3((Math.random() - 0.5) * 0.1, Math.random() * 0.05, (Math.random() - 0.5) * 0.1));
        drop.scale.setScalar(0.65 + Math.random() * 1.4);
        scene.add(drop);
        waterDrops.push({
          mesh: drop, material, age: 0, life: 0.42 + Math.random() * 0.34,
          velocity: new THREE.Vector3((Math.random() - 0.5) * 1.3, 0.65 + Math.random() * 1.15, (Math.random() - 0.5) * 1.3),
        });
      }
    }
    function gatherFireflies(point) {
      if (!fireflies.some((fly) => fly.visible)) return;
      fireflyGather.target.copy(island.worldToLocal(point.clone()));
      fireflyGather.until = performance.now() + 2600;
    }
    function interact(event) {
      pointFromPointer(event);
      const snowmanHit = snowman.visible ? raycaster.intersectObject(snowman, true)[0] : null;
      if (snowmanHit) {
        snowman.userData.reactionUntil = performance.now() + 950;
        gatherFireflies(snowmanHit.point);
        burstAt(snowmanHit.point, true);
        dirty = true;
        return;
      }
      const visibleFireflies = fireflies.filter((fly) => fly.visible);
      const fireflyHit = visibleFireflies.length ? raycaster.intersectObjects(visibleFireflies, true)[0] : null;
      if (fireflyHit) {
        let firefly = fireflyHit.object;
        while (firefly && !fireflies.includes(firefly)) firefly = firefly.parent;
        if (firefly) {
          const localPoint = island.worldToLocal(fireflyHit.point.clone());
          const escape = firefly.position.clone().sub(localPoint);
          if (escape.lengthSq() < 0.0025) escape.set(Math.cos(fireflies.indexOf(firefly) * 2.4), 0, Math.sin(fireflies.indexOf(firefly) * 2.4));
          firefly.userData.scareTarget.copy(firefly.position).add(escape.normalize().multiplyScalar(0.48));
          firefly.userData.scareTarget.y += 0.3;
          firefly.userData.scareUntil = performance.now() + 760;
          fireflyGather.until = 0;
          burstAt(fireflyHit.point, false, 0xdafa8c);
          dirty = true;
          return;
        }
      }
      const treeHit = raycaster.intersectObjects(treeTargets, false)[0];
      if (treeHit) {
        const tree = treeHit.object.userData.tree;
        tree.userData.bloomUntil = performance.now() + 1100;
        tree.userData.tapAt = performance.now();
        gatherFireflies(treeHit.point);
        burstAt(treeHit.point, state.weather === "snow");
        dirty = true;
        return;
      }
      const rockHit = raycaster.intersectObjects(interactiveRocks, false)[0];
      if (rockHit) {
        rockHit.object.userData.tapAt = performance.now();
        gatherFireflies(rockHit.point);
        burstAt(rockHit.point, state.weather === "snow", 0xd6c99a);
        dirty = true;
        return;
      }
      const flowerHit = raycaster.intersectObjects(flowerBeds.children, false)[0];
      if (flowerHit) {
        gatherFireflies(flowerHit.point);
        const localPoint = flowerBeds.worldToLocal(flowerHit.point.clone());
        butterflies.attract(localPoint);
        if (!reducedMotion.matches && flowerHit.instanceId !== undefined) {
          const existingPulse = flowerPulses.find((pulse) => pulse.mesh === flowerHit.object && pulse.id === flowerHit.instanceId);
          if (existingPulse) existingPulse.start = performance.now();
          else {
            const transform = new THREE.Object3D();
            const base = new THREE.Matrix4();
            flowerHit.object.getMatrixAt(flowerHit.instanceId, base);
            base.decompose(transform.position, transform.quaternion, transform.scale);
            const pairedMesh = flowerHit.object.userData.pairedMesh;
            flowerPulses.push({
              mesh: flowerHit.object, pairedMesh, id: flowerHit.instanceId, base, transform,
              pairedBase: pairedMesh ? new THREE.Matrix4().copy(base) : null,
              baseScale: transform.scale.clone(), start: performance.now(),
            });
          }
        }
        burstAt(flowerHit.point, false, 0xf5b5d0);
        dirty = true;
        return;
      }
      const streamHit = raycaster.intersectObject(stream, false)[0];
      if (streamHit) {
        gatherFireflies(streamHit.point);
        addRipple(streamHit.point, 0x9edfd7);
        splashAt(streamHit.point);
        dirty = true;
        return;
      }
      const waterfallHit = raycaster.intersectObjects(waterfalls, false)[0];
      if (waterfallHit) {
        gatherFireflies(waterfallHit.point);
        const impact = waterfallHit.object.localToWorld(waterfallHit.object.userData.curve.getPoint(1).clone());
        addRipple(impact, 0xb8eee7);
        splashAt(waterfallHit.point, 0xb8eee7);
        splashAt(impact, 0xcaf3ed);
        dirty = true;
        return;
      }
      const groundHit = raycaster.intersectObject(meadow, false)[0];
      if (!groundHit) return;
      gatherFireflies(groundHit.point);
      if (state.weather === "rain") {
        addRipple(groundHit.point, 0xb9d6e4);
        splashAt(groundHit.point, 0xb9d6e4);
      }
      burstAt(groundHit.point, state.weather === "snow");
      dirty = true;
    }
    function onPointerDown(event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      canvas.style.cursor = "grabbing";
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activePointers.size >= 2) {
        const [a, b] = [...activePointers.values()];
        pinchDistanceStart = Math.hypot(a.x - b.x, a.y - b.y);
        pinchZoomStart = targetDistance;
        pointerDown = null;
        dragged = true;
        canvas.setPointerCapture?.(event.pointerId);
        return;
      }
      pointerDown = { x: event.clientX, y: event.clientY, id: event.pointerId };
      dragStart = { yaw: targetYaw, pitch: targetPitch };
      dragged = false;
      canvas.setPointerCapture?.(event.pointerId);
    }
    function onPointerMove(event) {
      if (activePointers.has(event.pointerId)) {
        activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }
      if (activePointers.size >= 2) {
        const [a, b] = [...activePointers.values()];
        const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
        targetDistance = THREE.MathUtils.clamp(pinchZoomStart * pinchDistanceStart / distance, fitDistance * 0.76, fitDistance * 1.38);
        dirty = true;
        return;
      }
      if (pointerDown) {
        const dx = event.clientX - pointerDown.x;
        const dy = event.clientY - pointerDown.y;
        if (Math.abs(dx) + Math.abs(dy) > 5) dragged = true;
        if (dragged) {
          targetYaw = dragStart.yaw - dx * 0.004;
          targetPitch = THREE.MathUtils.clamp(dragStart.pitch + dy * 0.0024, 0.17, 0.92);
        }
      } else {
        pointFromPointer(event);
        const hit = raycaster.intersectObjects(treeTargets, false)[0];
        hoverTree = hit?.object.userData.tree || null;
        const rockHoverHit = raycaster.intersectObjects(interactiveRocks, false)[0];
        hoverRock = rockHoverHit?.object || null;
        const visibleFireflies = fireflies.filter((fly) => fly.visible);
        const fireflyHoverHit = visibleFireflies.length ? raycaster.intersectObjects(visibleFireflies, true)[0] : null;
        hoverFirefly = null;
        if (fireflyHoverHit) {
          let parent = fireflyHoverHit.object;
          while (parent && !fireflies.includes(parent)) parent = parent.parent;
          if (parent) hoverFirefly = parent;
        }
        const hoverSnowman = snowman.visible && Boolean(raycaster.intersectObject(snowman, true)[0]);
        const hoverFlower = flowerBeds.visible && Boolean(raycaster.intersectObjects(flowerBeds.children, false)[0]);
        const hoverWater = Boolean(raycaster.intersectObject(stream, false)[0] || raycaster.intersectObjects(waterfalls, false)[0]);
        hoverInteractive = Boolean(hoverTree || hoverRock || hoverFirefly || hoverSnowman || hoverFlower || hoverWater);
        canvas.style.cursor = hoverInteractive ? "pointer" : "grab";
      }
      dirty = true;
    }
    function onPointerUp(event) {
      if (pointerDown?.id === event.pointerId && !dragged) interact(event);
      activePointers.delete(event.pointerId);
      pointerDown = null;
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = hoverInteractive ? "pointer" : "grab";
      dirty = true;
    }
    function onPointerCancel(event) {
      activePointers.delete(event.pointerId);
      pointerDown = null;
      canvas.style.cursor = "grab";
    }
    function onPointerLeave() { hoverTree = null; hoverRock = null; hoverFirefly = null; hoverInteractive = false; dirty = true; }
    function onWheel(event) {
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? view.clientHeight : 1);
      targetDistance = THREE.MathUtils.clamp(targetDistance + delta * 0.0005 * fitDistance, fitDistance * 0.76, fitDistance * 1.38);
      dirty = true;
      event.preventDefault();
    }
    function onKeyDown(event) {
      if (!["Enter", " ", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "Home"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "ArrowLeft") targetYaw -= 0.15;
      else if (event.key === "ArrowRight") targetYaw += 0.15;
      else if (event.key === "ArrowUp") targetPitch = Math.min(0.92, targetPitch + 0.08);
      else if (event.key === "ArrowDown") targetPitch = Math.max(0.17, targetPitch - 0.08);
      else if (["+", "="].includes(event.key)) targetDistance = Math.max(fitDistance * 0.76, targetDistance - fitDistance * 0.06);
      else if (event.key === "-") targetDistance = Math.min(fitDistance * 1.38, targetDistance + fitDistance * 0.06);
      else if (event.key === "Home") { targetYaw = 0.45; targetPitch = 0.48; targetDistance = fitDistance; }
      else {
        const rect = canvas.getBoundingClientRect();
        interact({ clientX: rect.left + rect.width * 0.5, clientY: rect.top + rect.height * 0.5 });
      }
      dirty = true;
    }
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("keydown", onKeyDown);

    function updateParticles(items, mesh, now, delta, snowy) {
      for (let i = 0; i < items.length; i++) {
        const p = items[i];
        p.y -= p.speed * delta;
        if (snowy) {
          p.x += Math.sin(now * 0.0008 + p.phase) * p.drift * delta;
          p.z += Math.cos(now * 0.00065 + p.phase) * 0.13 * delta;
        } else p.x += p.lean * delta;
        if (p.y < -0.12) {
          p.y = 4.8 + Math.random() * 2.4;
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.sqrt(Math.random());
          p.x = Math.cos(angle) * radius * 4.9;
          p.z = Math.sin(angle) * radius * 3.65;
        }
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(snowy ? p.phase + now * 0.0003 : 0, snowy ? p.phase * 0.4 : 0, snowy ? p.phase : p.lean * 0.48);
        if (snowy) dummy.scale.setScalar(p.size);
        else dummy.scale.set(p.size, p.length, p.size);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    function animate(now) {
      frame = requestAnimationFrame(animate);
      if (!active || contextLost || document.hidden || now - lastFrame < 30) return;
      const delta = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0;
      lastFrame = now;
      const timeStep = reducedMotion.matches ? 0 : delta;
      sceneUniforms.uTime.value += timeStep;
      let moving = false;
      const blend = reducedMotion.matches ? 1 : 1 - Math.exp(-delta * 6);
      moodTargets = moodTargets.filter(({ object, property, value }) => {
        if (value.isColor) {
          const current = object[property];
          const distance = Math.abs(current.r - value.r) + Math.abs(current.g - value.g) + Math.abs(current.b - value.b);
          if (distance < 0.002 || reducedMotion.matches) { current.copy(value); dirty = true; return false; }
          current.lerp(value, blend);
        } else {
          if (Math.abs(object[property] - value) < 0.002 || reducedMotion.matches) { object[property] = value; dirty = true; return false; }
          object[property] += (value - object[property]) * blend;
        }
        moving = true;
        return true;
      });
      if (snowCoverage !== targetSnowCoverage) {
        snowCoverage = reducedMotion.matches || Math.abs(snowCoverage - targetSnowCoverage) < 0.002
          ? targetSnowCoverage : snowCoverage + (targetSnowCoverage - snowCoverage) * blend;
        for (const { attribute, base, weights } of snowSurfaces) {
          for (let i = 0; i < attribute.count; i++) {
            const amount = snowCoverage * (weights ? weights[i] : 1);
            attribute.setXYZ(i,
              THREE.MathUtils.lerp(base[i * 3], 0.83, amount),
              THREE.MathUtils.lerp(base[i * 3 + 1], 0.89, amount),
              THREE.MathUtils.lerp(base[i * 3 + 2], 0.88, amount));
          }
          attribute.needsUpdate = true;
        }
        moving = true;
      }
      if (timeStep > 0 && rainMesh.visible) {
        updateParticles(rain, rainMesh, now, timeStep, false);
        rainImpactTimer -= timeStep;
        if (rainImpactTimer <= 0) {
          let point;
          let onWater = false;
          if (Math.random() < 0.3) {
            point = streamCurve.getPoint(Math.random() * 0.98 + 0.01);
            onWater = true;
            point.y = 0.2;
          } else {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.sqrt(Math.random()) * 0.91;
            const x = Math.cos(angle) * radius * 4.65;
            const z = Math.sin(angle) * radius * 3.48;
            onWater = streamDistance(x, z) < 0.2;
            point = new THREE.Vector3(x, onWater ? 0.2 : heightAt(x, z), z);
          }
          addRainImpact(point, onWater);
          rainImpactTimer = 0.055 + Math.random() * 0.12;
        }
        moving = true;
      }
      waterUniforms.uSunDir.value.copy(sunlight.position).normalize();
      sceneUniforms.uSunView.value.copy(waterUniforms.uSunDir.value).transformDirection(camera.matrixWorldInverse);
      if (cameraYaw !== targetYaw || cameraPitch !== targetPitch || cameraDistance !== targetDistance) {
        const cameraBlend = reducedMotion.matches ? 1 : 1 - Math.exp(-delta * 8);
        cameraYaw += (targetYaw - cameraYaw) * cameraBlend;
        cameraPitch += (targetPitch - cameraPitch) * cameraBlend;
        cameraDistance += (targetDistance - cameraDistance) * cameraBlend;
        if (Math.abs(cameraYaw - targetYaw) < 0.001) cameraYaw = targetYaw;
        if (Math.abs(cameraPitch - targetPitch) < 0.001) cameraPitch = targetPitch;
        if (Math.abs(cameraDistance - targetDistance) < 0.01) cameraDistance = targetDistance;
        updateCamera();
        moving = true;
      }

      trees.forEach((tree) => {
          // Layered sway with slow gusts; each tree leans a little differently.
          const phase = tree.userData.phase;
          const gust = 0.6 + 0.4 * Math.sin(now * 0.00023 + phase * 0.3);
          const strength = (state.weather === "rain" ? 0.042 : 0.02) * gust;
          const sway = reducedMotion.matches ? 0 : (Math.sin(now * 0.0009 + phase) + Math.sin(now * 0.0023 + phase * 1.7) * 0.35) * strength;
          const tapAge = tree.userData.tapAt ? now - tree.userData.tapAt : Infinity;
          const tapShake = !reducedMotion.matches && tapAge < 1100
            ? Math.sin(tapAge * 0.032) * Math.exp(-tapAge / 360) * 0.12 : 0;
          tree.rotation.z = sway + tapShake;
          tree.rotation.x = reducedMotion.matches ? 0 : Math.cos(now * 0.0007 + phase * 1.3) * strength * 0.5 + tapShake * 0.45;
          const focusScale = tree === hoverTree ? 1.12 : 1;
          const bloom = tree.userData.bloomUntil > now ? 1.08 : 1;
          const scaleTarget = tree.userData.baseScale * focusScale * bloom;
          const previousScale = tree.userData.displayScale;
          tree.userData.displayScale += (scaleTarget - tree.userData.displayScale) * (reducedMotion.matches ? 1 : Math.min(1, timeStep * 9));
          tree.scale.setScalar(tree.userData.displayScale);
          if (sway || Math.abs(previousScale - tree.userData.displayScale) > 0.0001) moving = true;
      });
      if (snowman.visible && snowman.userData.reactionUntil) {
        if (now < snowman.userData.reactionUntil) {
          const progress = 1 - (snowman.userData.reactionUntil - now) / 950;
          const jump = progress < 0.72 ? Math.sin((progress / 0.72) * Math.PI) : 0;
          const landing = progress > 0.72 ? Math.sin(((progress - 0.72) / 0.28) * Math.PI) : 0;
          snowman.position.y = snowman.userData.baseY + jump * 0.11;
          snowman.rotation.z = Math.sin(progress * Math.PI * 2) * 0.035 * (1 - progress);
          snowman.scale.set(1 + landing * 0.09 - jump * 0.025, 1 - landing * 0.12 + jump * 0.045, 1 + landing * 0.09 - jump * 0.025);
          snowmanArms.rotation.z = Math.sin(progress * 19) * 0.12 * (1 - progress);
          cap.rotation.z = Math.sin(progress * 8) * 0.075 * (1 - progress);
          scarfTail.rotation.z = -0.12 + Math.sin(progress * 17) * 0.07 * (1 - progress);
          moving = true;
        } else {
          snowman.position.y = snowman.userData.baseY;
          snowman.rotation.z = 0;
          snowman.scale.setScalar(1);
          snowmanArms.rotation.z = 0;
          cap.rotation.z = 0;
          scarfTail.rotation.z = -0.12;
          snowman.userData.reactionUntil = 0;
          moving = true;
        }
      } else if (snowman.visible && timeStep > 0) {
        // A quiet breath and a tiny glance keep the snowman feeling present between clicks.
        const idle = now * 0.001 + snowman.userData.idlePhase;
        snowman.position.y = snowman.userData.baseY + Math.sin(idle * 1.25) * 0.012;
        snowman.rotation.z = Math.sin(idle * 0.62) * 0.012;
        snowmanArms.rotation.z = Math.sin(idle * 0.8) * 0.018;
        cap.rotation.z = Math.sin(idle * 0.72 + 1) * 0.018;
        scarfTail.rotation.z = -0.12 + Math.sin(idle * 1.1) * 0.025;
        moving = true;
      }
      for (let i = flowerPulses.length - 1; i >= 0; i--) {
        const pulse = flowerPulses[i];
        const progress = (now - pulse.start) / 760;
        if (progress >= 1) {
          pulse.mesh.setMatrixAt(pulse.id, pulse.base);
          pulse.mesh.instanceMatrix.needsUpdate = true;
          if (pulse.pairedMesh) {
            pulse.pairedMesh.setMatrixAt(pulse.id, pulse.pairedBase);
            pulse.pairedMesh.instanceMatrix.needsUpdate = true;
          }
          flowerPulses.splice(i, 1);
          moving = true;
          continue;
        }
        const scale = 1 + Math.sin(Math.PI * progress) * 0.32;
        pulse.transform.scale.copy(pulse.baseScale).multiplyScalar(scale);
        pulse.transform.updateMatrix();
        pulse.mesh.setMatrixAt(pulse.id, pulse.transform.matrix);
        pulse.mesh.instanceMatrix.needsUpdate = true;
        if (pulse.pairedMesh) {
          pulse.pairedMesh.setMatrixAt(pulse.id, pulse.transform.matrix);
          pulse.pairedMesh.instanceMatrix.needsUpdate = true;
        }
        moving = true;
      }
      if (timeStep > 0) {
        fireflies.forEach((fly, index) => {
          const phase = now * 0.0012 + index;
          const home = new THREE.Vector3(
            fly.userData.baseX + Math.sin(now * 0.0007 + index) * 0.18,
            fly.userData.baseY + Math.sin(phase) * 0.16,
            fly.userData.baseZ + Math.cos(now * 0.00065 + index * 1.4) * 0.16,
          );
          const gathering = now < fireflyGather.until;
          const startled = now < fly.userData.scareUntil;
          const target = startled
            ? fly.userData.scareTarget
            : gathering
            ? fireflyGather.target.clone().add(new THREE.Vector3(
              Math.cos(index * 2.4) * (0.22 + index % 3 * 0.07),
              0.18 + (index % 5) * 0.09 + Math.sin(phase * 2) * 0.04,
              Math.sin(index * 2.4) * (0.22 + index % 3 * 0.07),
            ))
            : home;
          fly.position.lerp(target, 1 - Math.exp(-timeStep * (startled ? 4.2 : gathering ? 2.2 : 1.1)));
          const pulse = (Math.sin(now * (startled ? 0.01 : gathering ? 0.004 : 0.002) + index * 2) + 1) * 0.5;
          fly.userData.glow.material.opacity = startled ? 0.68 + pulse * 0.3 : gathering ? 0.44 + pulse * 0.42 : 0.24 + pulse * 0.2;
          fly.scale.setScalar(fly.userData.baseScale * (gathering ? 1 + pulse * 0.1 : 1));
          if (fly === hoverFirefly) fly.userData.glow.material.opacity = Math.min(1, fly.userData.glow.material.opacity + 0.12);
          fly.rotation.y = Math.sin(phase * 0.55) * 0.22;
          fly.userData.wings.forEach(({ hinge, side }) => {
            hinge.rotation.x = side * (0.18 + Math.sin(now * 0.035 + index * 3) * 0.62);
            hinge.rotation.z = side * (0.12 + pulse * 0.1);
          });
          if (fly.visible) moving = true;
        });
        interactiveRocks.forEach((rock) => {
          const tapAge = rock.userData.tapAt ? now - rock.userData.tapAt : Infinity;
          const tapProgress = tapAge < 620 ? tapAge / 620 : null;
          if (rock.userData.tapAt && tapProgress === null) rock.userData.tapAt = 0;
          const hop = tapProgress === null ? 0 : Math.sin(tapProgress * Math.PI) * 0.17;
          const hover = rock === hoverRock ? 1.08 : 1;
          const tapScale = tapProgress === null ? 1 : 1 + Math.sin(tapProgress * Math.PI) * 0.1;
          const float = rock.userData.floatPhase === undefined ? 0 : Math.sin(now * 0.0007 + rock.userData.floatPhase) * 0.08;
          rock.position.y = rock.userData.baseY + float + hop;
          rock.scale.copy(rock.userData.baseScale).multiplyScalar(hover * tapScale);
          if (rock.userData.floatPhase !== undefined || tapProgress !== null || hoverRock === rock) moving = true;
        });
        mistClouds.forEach((cloud, index) => {
          const phase = now * 0.00012 + cloud.userData.phase;
          cloud.position.x = cloud.userData.baseX + Math.sin(phase) * 0.38;
          cloud.position.y = cloud.userData.baseY + Math.sin(phase * 0.7) * 0.09;
          cloud.position.z = cloud.userData.baseZ + Math.cos(phase * 0.8) * 0.24;
          cloud.quaternion.copy(camera.quaternion);
          if (cloud.material.uniforms.uOpacity.value > 0.005) moving = true;
        });
        if (butterflies.group.visible) butterflies.update(timeStep, sceneUniforms.uTime.value, { wind: sceneUniforms.uWind.value });
        if (fallingLeaves.mesh.visible) {
          fallingLeaves.update(timeStep, state.weather === "rain" ? 2.4 : 1);
          moving = true;
        }
        snowfall.visible = snowfall.material.uniforms.uOpacity.value > 0.01;
      }
      for (const ripple of ripples) {
        if (!ripple.active) continue;
        if (timeStep === 0) { ripple.active = false; ripple.mesh.visible = false; continue; }
        ripple.age += timeStep;
        if (ripple.age < 0) { moving = true; continue; }
        const progress = THREE.MathUtils.clamp(ripple.age / ripple.duration, 0, 1);
        const eased = 1 - Math.pow(1 - progress, 2.2);
        ripple.mesh.scale.setScalar(0.16 + eased * ripple.maxScale);
        ripple.mesh.material.opacity = Math.pow(1 - progress, 1.6) * (ripple.maxOpacity ?? 0.64);
        if (progress >= 1) { ripple.active = false; ripple.mesh.visible = false; }
        else moving = true;
      }
      for (let i = waterDrops.length - 1; i >= 0; i--) {
        const drop = waterDrops[i];
        if (timeStep === 0) {
          scene.remove(drop.mesh);
          drop.material.dispose();
          waterDrops.splice(i, 1);
          continue;
        }
        drop.age += timeStep;
        drop.mesh.position.addScaledVector(drop.velocity, timeStep);
        drop.velocity.y -= 2.6 * timeStep;
        drop.material.opacity = Math.max(0, 1 - drop.age / drop.life);
        drop.mesh.scale.multiplyScalar(1 - timeStep * 0.45);
        if (drop.age >= drop.life) {
          scene.remove(drop.mesh);
          drop.material.dispose();
          waterDrops.splice(i, 1);
        } else moving = true;
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const spark = sparks[i];
        spark.life -= delta;
        spark.mesh.position.addScaledVector(spark.velocity, timeStep);
        spark.velocity.y -= 0.6 * timeStep;
        spark.material.opacity = Math.max(0, spark.life);
        if (spark.life <= 0 || reducedMotion.matches) {
          scene.remove(spark.mesh);
          spark.material.dispose();
          sparks.splice(i, 1);
        } else moving = true;
      }
      // Water, wind, pollen and snow animate in shaders, so keep drawing while time advances.
      if (timeStep > 0) moving = true;
      if (moving || dirty) renderer.render(scene, camera);
      dirty = false;
    }
    frame = requestAnimationFrame(animate);

    const onVisibilityChange = () => { if (!document.hidden) { lastFrame = performance.now(); dirty = true; } };
    const onMotionChange = () => { dirty = true; };
    const onContextLost = (event) => {
      event.preventDefault();
      contextLost = true;
      activePointers.clear();
      pointerDown = null;
      state.threeAvailable = false;
      notify("3D 画面暂时中断，正在等待浏览器恢复。");
    };
    const onContextRestored = () => {
      contextLost = false;
      lastFrame = 0;
      state.threeAvailable = true;
      resize();
      applySceneMood();
      dirty = true;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    reducedMotion.addEventListener?.("change", onMotionChange);
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);
    const stopWatch = watch(
      () => [state.weather, state.phase, state.scene],
      applySceneMood,
    );

    disposeScene = () => {
      active = false;
      cancelAnimationFrame(frame);
      stopWatch();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reducedMotion.removeEventListener?.("change", onMotionChange);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("keydown", onKeyDown);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      const geometries = new Set();
      const materials = new Set();
      geometries.add(waterDropGeometry);
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (Array.isArray(object.material)) object.material.forEach((material) => materials.add(material));
        else if (object.material) materials.add(object.material);
      });
      geometries.add(sparkGeometry);
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      renderer.dispose();
      state.threeAvailable = false;
    };
    state.threeAvailable = true;
  });

  onUnmounted(() => disposeScene?.());
}
