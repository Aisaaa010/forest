import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { enhanceMaterial } from "./materials.js";
import { fbm } from "./terrain.js";
import { leafQuaternion, makeLeafGeometry, makeNeedleSprayGeometry } from "./leaves.js";

const { smoothstep } = THREE.MathUtils;
const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;

// A tiny deterministic RNG keeps a tree recognisable between reloads and lets a
// single seed drive every branch, twig and leaf on it.
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const flat = (geometry) => (geometry.index ? geometry.toNonIndexed() : geometry);

// Palette materials are mutated in place by applySceneMood(), so callers keep
// a reference to the returned array instead of recreating materials per scene.
// Each palette entry yields an inner-crown material and a matching leaf material;
// both tween together because they share the same palette slot.
export function createFoliageMaterials(palette) {
  const crowns = palette.map((color) =>
    enhanceMaterial(
      new THREE.MeshStandardMaterial({ color, vertexColors: true, roughness: 0.86, emissive: 0x000000, side: THREE.DoubleSide }),
      {
        rim: 0.15,
        rustle: 0.022,
        snow: 1,
        detail: { scale: 14, normalStrength: 0.05, stretch: [1, 1.45, 1] },
      },
    ),
  );
  const leaves = palette.map((color) =>
    enhanceMaterial(
      new THREE.MeshStandardMaterial({ color, vertexColors: true, roughness: 0.58, emissive: 0x000000, side: THREE.DoubleSide }),
      {
        rim: 0.15,
        flutter: 0.18,
        translucency: 0.12,
        canopy: 0.018,
        snow: 1,
        // Individual leaves keep their own facing instead of being flattened
        // into one spherical crown normal, which restores leaf-scale highlights.
        crownMix: 0.6,
        jitter: 0.5,
      },
    ),
  );
  return { crowns, leaves, all: [...crowns, ...leaves] };
}

// Bark shading is baked into vertex colours: long vertical grooves, a little
// noise, and darker roots where the trunk meets the soil.
function barkTone(y, angle, seed, species) {
  const grain = Math.pow(Math.max(0, Math.cos(angle * 13 + y * 6.5 + seed)), species === "pine" ? 15 : 11);
  const knot = Math.exp(-(Math.pow(angle * 1.8, 2) + Math.pow((y - 0.42) * 9, 2)) * 2.5) * 0.12;
  const tone = 0.86 + fbm(angle * (species === "pine" ? 4.2 : 2.8) + seed, y * 11, 3) * 0.2
    - grain * (species === "pine" ? 0.18 : 0.13) + knot;
  const root = 0.76 + 0.24 * smoothstep(y, 0, 0.2);
  return tone * root;
}

// Tapered tube along a curve, with bark colours per ring. Radial segments stay
// low (5–9) so branches remain cheap and read as part of the low-poly language.
function makeTaperedTube(points, radiusAt, { radial = 7, seed = 0, species = "pine" } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
  const length = Math.max(0.02, curve.getLength());
  const steps = Math.max(3, Math.min(20, Math.round(length / 0.055)));
  const frames = curve.computeFrenetFrames(steps, false);
  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const point = curve.getPoint(t);
    const normal = frames.normals[i];
    const binormal = frames.binormals[i];
    const radius = Math.max(0.0025, radiusAt(t));
    for (let j = 0; j < radial; j++) {
      const angle = (j / radial) * TAU;
      const nx = normal.x * Math.cos(angle) + binormal.x * Math.sin(angle);
      const ny = normal.y * Math.cos(angle) + binormal.y * Math.sin(angle);
      const nz = normal.z * Math.cos(angle) + binormal.z * Math.sin(angle);
      positions.push(point.x + nx * radius, point.y + ny * radius, point.z + nz * radius);
      normals.push(nx, ny, nz);
      const tone = barkTone(point.y, angle + seed * 1.3, seed, species);
      colors.push(tone * (species === "pine" ? 1.02 : 1.1), tone, tone * (species === "pine" ? 0.84 : 0.76));
    }
  }
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = (i + 1) * radial + j;
      const c = (i + 1) * radial + ((j + 1) % radial);
      const d = i * radial + ((j + 1) % radial);
      indices.push(a, b, d, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return geometry;
}

// A lumpy leaf mass with occlusion baked darker underneath. Detail 1 is used for
// small conifer tufts, detail 2 for broadleaf clusters.
export function makeLeafMassGeometry(seed, detail = 2) {
  const geometry = new THREE.IcosahedronGeometry(0.34, detail);
  const positions = geometry.getAttribute("position");
  const colors = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    v.fromBufferAttribute(positions, i);
    const n = fbm(v.x * 5 + seed, v.y * 5 + v.z * 3 - seed, 3);
    const leaves = fbm(v.x * 16 + seed, v.z * 16 + v.y * 11, 2);
    v.multiplyScalar(1 + n * 0.24 + leaves * 0.07);
    if (v.y < -0.12) v.y = -0.12 + (v.y + 0.12) * 0.55;
    positions.setXYZ(i, v.x, v.y, v.z);
    const up = smoothstep(v.y, -0.2, 0.3);
    const tone = 0.3 + up * 0.3 + leaves * 0.08;
    colors.push(tone, tone, tone * 0.94);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

const limbAxis = new THREE.Vector3(0, 1, 0);

function tintGeometry(geometry, r, g, b) {
  const colors = geometry.getAttribute("color");
  for (let i = 0; i < colors.count; i++) {
    colors.setXYZ(i, colors.getX(i) * r, colors.getY(i) * g, colors.getZ(i) * b);
  }
  return geometry;
}

// Builds a conifer from a trunk and several branch whorls. Each branch carries
// needle sprays and small foliage tufts, so the silhouette has gaps and layered
// branch plates instead of a stack of complete cones.
function buildConifer(seed, leafDensity) {
  const rng = mulberry32(seed);
  const height = 1.58 + rng() * 0.34;
  const width = 0.92 + rng() * 0.18;
  const leanX = (rng() - 0.5) * 0.13;
  const leanZ = (rng() - 0.5) * 0.13;
  const baseRadius = 0.058 + rng() * 0.018;
  const species = "pine";
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.04, 0),
    new THREE.Vector3(leanX * 0.25, height * 0.3, leanZ * 0.25),
    new THREE.Vector3(leanX * 0.65, height * 0.63, leanZ * 0.65),
    new THREE.Vector3(leanX, height * 0.94, leanZ),
  ], false, "centripetal");
  const trunkRadius = (t) => baseRadius * (1 - t * 0.82) * (1 + Math.pow(1 - t, 6) * 0.9);
  const barkParts = [makeTaperedTube(trunkCurve.getPoints(7), trunkRadius, { radial: 9, seed, species })];
  const clumpParts = [];
  const sprayMatrices = [];
  const sprayNormals = [];
  const sprayColors = [];
  const sprayJitters = [];
  const clumpDummy = new THREE.Object3D();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const color = new THREE.Color();
  let clumpSeed = seed * 3 + 11;
  let sprayCount = 0;

  const addClump = (center, radius, flatten = 0.5, tint = 1, detail = 1) => {
    const geometry = makeLeafMassGeometry(clumpSeed++, detail);
    euler.set(rng() * TAU, rng() * TAU, rng() * TAU);
    quaternion.setFromEuler(euler);
    const matrix = new THREE.Matrix4().compose(
      center,
      quaternion,
      new THREE.Vector3(radius * (0.9 + rng() * 0.25), radius * flatten, radius * (0.9 + rng() * 0.25)),
    );
    geometry.applyMatrix4(matrix);
    tintGeometry(geometry, tint * (0.92 + rng() * 0.12), tint, tint * (0.82 + rng() * 0.1));
    clumpParts.push(flat(geometry));
  };

  const addSpray = (position, direction, facing, size, normal, brightness) => {
    clumpDummy.position.copy(position);
    leafQuaternion(direction, facing, clumpDummy.quaternion);
    euler.set(0, 0, (rng() - 0.5) * 0.5);
    clumpDummy.quaternion.multiply(new THREE.Quaternion().setFromEuler(euler));
    clumpDummy.scale.setScalar(size);
    clumpDummy.updateMatrix();
    sprayMatrices.push(clumpDummy.matrix.clone());
    sprayNormals.push(normal.clone());
    sprayJitters.push(new THREE.Vector3((rng() - 0.5) * 0.9, (rng() - 0.5) * 0.7, (rng() - 0.5) * 0.9));
    color.setRGB(brightness * 0.86, brightness, brightness * 0.84);
    sprayColors.push(color.clone());
    sprayCount++;
  };

  const whorls = 7 + Math.floor(rng() * 3);
  for (let w = 0; w < whorls; w++) {
    const t = 0.2 + (w / Math.max(1, whorls - 1)) * 0.72 + (rng() - 0.5) * 0.018;
    const center = trunkCurve.getPoint(t);
    const count = w === whorls - 1 ? 4 : 5 + Math.floor(rng() * 3);
    const envelope = 0.55 * Math.pow(Math.sin(Math.PI * (0.07 + t * 0.9)), 0.82) * (1 - t * 0.12) * width;
    const baseAngle = w * 2.399 + rng() * 0.7;
    // A couple of clumps around the trunk fill the whorl core, so the tree does
    // not read as a bare pole with pom-poms stuck on the ends of its branches.
    addClump(center.clone().add(new THREE.Vector3(0.04, 0.02, 0.02)), 0.2 * (1 - t * 0.25), 0.5, 0.68 + rng() * 0.12, 1);
    addClump(center.clone().add(new THREE.Vector3(-0.04, -0.03, -0.03)), 0.18 * (1 - t * 0.25), 0.5, 0.66 + rng() * 0.12, 1);
    for (let b = 0; b < count; b++) {
      const angle = baseAngle + (b / count) * TAU + (rng() - 0.5) * 0.22;
      const dirX = Math.cos(angle);
      const dirZ = Math.sin(angle);
      const length = envelope * (0.82 + rng() * 0.35) * (1 - (b / count) * 0.08);
      const droop = 0.035 + t * 0.12 + rng() * 0.06;
      const start = center.clone();
      const mid = new THREE.Vector3(
        start.x + dirX * length * 0.55,
        start.y + 0.018 - droop * 0.2,
        start.z + dirZ * length * 0.55,
      );
      const end = new THREE.Vector3(
        start.x + dirX * length,
        start.y - droop,
        start.z + dirZ * length,
      );
      const branchCurve = new THREE.CatmullRomCurve3([start, mid, end], false, "centripetal");
      const radius = 0.014 + (1 - t) * 0.012;
      barkParts.push(makeTaperedTube([start, mid, end], (u) => radius * (1 - u * 0.9), {
        radial: 5, seed: seed + w * 13 + b, species,
      }));
      const outward = new THREE.Vector3(dirX, 0, dirZ);
      // Three overlapping tufts per branch give the whorl a dense, ragged plate.
      for (const u of [0.42, 0.72, 0.96]) {
        addClump(
          branchCurve.getPoint(u),
          (0.26 - u * 0.03) * (1 - t * 0.18),
          0.55,
          0.7 + rng() * 0.13,
          1,
        );
      }
      const sprays = Math.max(2, Math.round(4 * leafDensity));
      for (let s = 0; s < sprays; s++) {
        const u = 0.34 + (s / Math.max(1, sprays - 1)) * 0.64;
        const point = branchCurve.getPoint(u);
        const tangent = branchCurve.getTangent(u);
        const grow = tangent.clone().multiplyScalar(0.8).addScaledVector(UP, 0.12).addScaledVector(outward, 0.16);
        const facing = UP.clone().addScaledVector(outward, 0.38);
        addSpray(
          point,
          grow,
          facing,
          (0.23 + rng() * 0.08) * (1 - u * 0.22),
          outward.clone().multiplyScalar(0.35).add(UP).normalize(),
          0.72 + u * 0.22,
        );
      }
      // A short secondary twig near the tip breaks the perfect radial branch.
      if (rng() < 0.55) {
        const u = 0.55 + rng() * 0.25;
        const start2 = branchCurve.getPoint(u);
        const side = new THREE.Vector3(-dirZ, 0, dirX).multiplyScalar(rng() < 0.5 ? -1 : 1);
        const end2 = start2.clone().addScaledVector(side, 0.08 + rng() * 0.08).addScaledVector(UP, 0.03);
        barkParts.push(makeTaperedTube([start2, end2], (v) => 0.0045 * (1 - v * 0.8), {
          radial: 4, seed: seed + 7 + b, species,
        }));
      }
    }
  }

  // A ragged crown top instead of a perfect cone tip.
  const top = trunkCurve.getPoint(0.97);
  addClump(top.clone().add(new THREE.Vector3(0, 0.03, 0)), 0.22, 0.6, 0.82, 1);
  addClump(top.clone().add(new THREE.Vector3(0.07, -0.06, 0.02)), 0.19, 0.6, 0.78, 1);
  addClump(top.clone().add(new THREE.Vector3(-0.06, -0.1, -0.03)), 0.17, 0.55, 0.74, 1);

  // A few snapped, needleless branches near the base add age and asymmetry.
  const deadCount = 1 + Math.floor(rng() * 2);
  for (let d = 0; d < deadCount; d++) {
    const t = 0.16 + rng() * 0.18;
    const start = trunkCurve.getPoint(t);
    const angle = rng() * TAU;
    const length = 0.18 + rng() * 0.16;
    const end = start.clone().add(new THREE.Vector3(Math.cos(angle) * length, -0.04 - rng() * 0.05, Math.sin(angle) * length));
    barkParts.push(makeTaperedTube([start, end], (v) => 0.008 * (1 - v * 0.9), {
      radial: 4, seed: seed + d * 5, species,
    }));
  }

  const crownGeometry = mergeGeometries(clumpParts, false);
  const needleGeometry = makeNeedleSprayGeometry().clone();
  const crownNormals = new Float32Array(sprayNormals.length * 3);
  const leafJitters = new Float32Array(sprayJitters.length * 3);
  sprayNormals.forEach((normal, i) => crownNormals.set([normal.x, normal.y, normal.z], i * 3));
  sprayJitters.forEach((jitter, i) => leafJitters.set([jitter.x, jitter.y, jitter.z], i * 3));
  needleGeometry.setAttribute("aCrownNormal", new THREE.InstancedBufferAttribute(crownNormals, 3));
  needleGeometry.setAttribute("aLeafJitter", new THREE.InstancedBufferAttribute(leafJitters, 3));
  const needles = new THREE.InstancedMesh(needleGeometry, null, Math.max(1, sprayCount));
  sprayMatrices.forEach((matrix, i) => {
    needles.setMatrixAt(i, matrix);
    needles.setColorAt(i, sprayColors[i]);
  });
  needles.count = sprayCount;
  needles.name = "needles";
  return {
    height,
    barkParts,
    crownGeometry,
    crownParts: sprayCount,
    leafMesh: needles,
    leafKind: "spray",
  };
}

// Broadleaf tree: a short trunk splits into limbs, then secondary branches, and
// every leaf cluster hangs on a real branch tip. The crown is made of several
// overlapping clumps rather than a fixed ring of nine balls.
function buildBroadleaf(seed, leafDensity) {
  const rng = mulberry32(seed);
  const height = 0.9 + rng() * 0.22;
  const leanX = (rng() - 0.5) * 0.12;
  const leanZ = (rng() - 0.5) * 0.12;
  const baseRadius = 0.068 + rng() * 0.018;
  const species = "broadleaf";
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.04, 0),
    new THREE.Vector3(leanX * 0.2, height * 0.3, leanZ * 0.2),
    new THREE.Vector3(leanX * 0.5, height * 0.62, leanZ * 0.5),
    new THREE.Vector3(leanX * 0.8, height * 0.92, leanZ * 0.8),
  ], false, "centripetal");
  const trunkRadius = (t) => baseRadius * (1 - t * 0.72) * (1 + Math.pow(1 - t, 6) * 0.95);
  const barkParts = [makeTaperedTube(trunkCurve.getPoints(7), trunkRadius, { radial: 9, seed, species })];
  const clumpParts = [];
  const leafMatrices = [];
  const leafNormals = [];
  const leafColors = [];
  const leafJitters = [];
  const clumpDummy = new THREE.Object3D();
  const euler = new THREE.Euler();
  const quaternion = new THREE.Quaternion();
  const color = new THREE.Color();
  let clumpSeed = seed * 5 + 31;
  const crownCenter = new THREE.Vector3(0, height + 0.42, 0);

  const addClump = (center, radius, normal, tint, detail = 2) => {
    const geometry = makeLeafMassGeometry(clumpSeed++, detail);
    euler.set(rng() * TAU, rng() * TAU, rng() * TAU);
    quaternion.setFromEuler(euler);
    const matrix = new THREE.Matrix4().compose(
      center,
      quaternion,
      new THREE.Vector3(radius * (0.92 + rng() * 0.2), radius * (0.66 + rng() * 0.14), radius * (0.92 + rng() * 0.2)),
    );
    geometry.applyMatrix4(matrix);
    tintGeometry(geometry, tint * (0.96 + rng() * 0.1), tint, tint * (0.86 + rng() * 0.1));
    clumpParts.push(flat(geometry));
    return { center, radius, normal };
  };

  const addLeavesAround = (cluster, count) => {
    const { center, radius, normal } = cluster;
    for (let i = 0; i < count; i++) {
      const direction = new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1);
      if (direction.lengthSq() > 1 || direction.lengthSq() < 0.04) {
        i--;
        continue;
      }
      direction.normalize();
      if (direction.y < -0.45 && rng() < 0.65) {
        i--;
        continue;
      }
      const position = center.clone().addScaledVector(direction, radius * (0.82 + rng() * 0.26));
      const grow = direction.clone().multiplyScalar(0.8).add(new THREE.Vector3((rng() - 0.5) * 0.7, -0.32 - rng() * 0.28, (rng() - 0.5) * 0.7));
      const facing = direction.clone().multiplyScalar(0.55).add(UP);
      clumpDummy.position.copy(position);
      leafQuaternion(grow, facing, clumpDummy.quaternion);
      clumpDummy.rotateZ((rng() - 0.5) * 0.6);
      clumpDummy.scale.setScalar(0.095 + rng() * 0.04);
      clumpDummy.updateMatrix();
      leafMatrices.push(clumpDummy.matrix.clone());
      leafNormals.push(normal.clone().multiplyScalar(0.55).addScaledVector(direction, 0.45).normalize());
      leafJitters.push(new THREE.Vector3((rng() - 0.5) * 1.1, (rng() - 0.5) * 0.8, (rng() - 0.5) * 1.1));
      const brightness = 0.5 + Math.max(0, direction.y) * 0.12 + rng() * 0.04;
      if (rng() < 0.025) color.setRGB(brightness * 1.25, brightness * 1.12, brightness * 0.55);
      else color.setRGB(brightness * (0.9 + rng() * 0.06), brightness * (1 + rng() * 0.06), brightness * (0.75 + rng() * 0.08));
      leafColors.push(color.clone());
    }
  };

  const limbs = 3 + (rng() < 0.3 ? 1 : 0);
  for (let l = 0; l < limbs; l++) {
    const startT = 0.5 + rng() * 0.22;
    const start = trunkCurve.getPoint(startT);
    const angle = (l / limbs) * TAU + rng() * 0.55;
    const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const length = 0.34 + rng() * 0.15;
    const end = start.clone().addScaledVector(dir, length).addScaledVector(UP, 0.36 + rng() * 0.16);
    const mid = start.clone().addScaledVector(dir, length * 0.5).addScaledVector(UP, 0.14);
    const limbCurve = new THREE.CatmullRomCurve3([start, mid, end], false, "centripetal");
    const limbRadius = 0.02 + (1 - startT) * 0.012;
    barkParts.push(makeTaperedTube([start, mid, end], (v) => limbRadius * (1 - v * 0.8), {
      radial: 6, seed: seed + l * 17, species,
    }));
    const secondaries = 2;
    for (let s = 0; s < secondaries; s++) {
      const u = 0.52 + s * 0.28;
      const branchStart = limbCurve.getPoint(u);
      const sideAngle = angle + (s === 0 ? -1 : 1) * (0.55 + rng() * 0.45) + (rng() - 0.5) * 0.3;
      const sideDir = new THREE.Vector3(Math.cos(sideAngle), 0, Math.sin(sideAngle));
      const branchLength = 0.18 + rng() * 0.13;
      const branchEnd = branchStart.clone().addScaledVector(sideDir, branchLength).addScaledVector(UP, 0.18 + rng() * 0.12);
      const branchMid = branchStart.clone().addScaledVector(sideDir, branchLength * 0.5).addScaledVector(UP, 0.06);
      barkParts.push(makeTaperedTube([branchStart, branchMid, branchEnd], (v) => 0.009 * (1 - v * 0.8), {
        radial: 5, seed: seed + l * 31 + s * 7, species,
      }));
      const clusterNormal = branchEnd.clone().sub(crownCenter).normalize().multiplyScalar(0.6).addScaledVector(UP, 0.55).normalize();
      const cluster = addClump(
        branchEnd.clone().add(new THREE.Vector3(0, 0.03, 0)),
        0.22 + rng() * 0.07,
        clusterNormal,
        0.46 + rng() * 0.1,
        2,
      );
      addLeavesAround(cluster, Math.round(88 * leafDensity));
      // A twig out of the secondary tip keeps the outer crown from looking trimmed.
      if (rng() < 0.7) {
        const twigAngle = sideAngle + (rng() - 0.5) * 1.2;
        const twigStart = branchEnd.clone();
        const twigEnd = twigStart.clone().add(new THREE.Vector3(
          Math.cos(twigAngle) * (0.1 + rng() * 0.1),
          0.1 + rng() * 0.1,
          Math.sin(twigAngle) * (0.1 + rng() * 0.1),
        ));
        barkParts.push(makeTaperedTube([twigStart, twigEnd], (v) => 0.005 * (1 - v * 0.8), {
          radial: 4, seed: seed + l + s * 3, species,
        }));
        const twigCluster = addClump(twigEnd, 0.15 + rng() * 0.05, clusterNormal, 0.42 + rng() * 0.08, 2);
        addLeavesAround(twigCluster, Math.round(42 * leafDensity));
      }
      // One extra filled cluster midway along the secondary branch.
      if (rng() < 0.8) {
        const midCluster = addClump(
          branchCurvePoint(branchStart, branchMid, branchEnd, 0.45),
          0.16 + rng() * 0.05,
          clusterNormal,
          0.4 + rng() * 0.08,
          2,
        );
        addLeavesAround(midCluster, Math.round(46 * leafDensity));
      }
    }
  }

  // A central crown mass fills the gap above the trunk without hiding branch tips.
  const central = addClump(
    new THREE.Vector3(leanX * 0.8, height + 0.44, leanZ * 0.8),
    0.27 + rng() * 0.07,
    UP.clone(),
    0.4 + rng() * 0.08,
    2,
  );
  addLeavesAround(central, Math.round(104 * leafDensity));

  // One broken limb adds an imperfect silhouette.
  if (rng() < 0.7) {
    const start = trunkCurve.getPoint(0.62 + rng() * 0.12);
    const angle = rng() * TAU;
    const end = start.clone().add(new THREE.Vector3(Math.cos(angle) * 0.18, 0.12, Math.sin(angle) * 0.18));
    barkParts.push(makeTaperedTube([start, end], (v) => 0.009 * (1 - v * 0.9), {
      radial: 4, seed: seed + 99, species,
    }));
  }

  const crownGeometry = mergeGeometries(clumpParts, false);
  const leafGeometry = makeLeafGeometry({ shape: "ovate", fold: 0.28, curl: 0.18, segments: 3, across: 2 }).clone();
  // Broadleaf blades are darker than the conifer sprays; this keeps the crown from
  // reading as a pale cloud when many cards face the sun at once.
  const leafColorAttribute = leafGeometry.getAttribute("color");
  for (let i = 0; i < leafColorAttribute.count; i++) {
    leafColorAttribute.setXYZ(i, leafColorAttribute.getX(i) * 0.72, leafColorAttribute.getY(i) * 0.72, leafColorAttribute.getZ(i) * 0.72);
  }
  const crownNormals = new Float32Array(leafNormals.length * 3);
  const jitterArray = new Float32Array(leafJitters.length * 3);
  leafNormals.forEach((normal, i) => crownNormals.set([normal.x, normal.y, normal.z], i * 3));
  leafJitters.forEach((jitter, i) => jitterArray.set([jitter.x, jitter.y, jitter.z], i * 3));
  leafGeometry.setAttribute("aCrownNormal", new THREE.InstancedBufferAttribute(crownNormals, 3));
  leafGeometry.setAttribute("aLeafJitter", new THREE.InstancedBufferAttribute(jitterArray, 3));
  const leaves = new THREE.InstancedMesh(leafGeometry, null, Math.max(1, leafMatrices.length));
  leafMatrices.forEach((matrix, i) => {
    leaves.setMatrixAt(i, matrix);
    leaves.setColorAt(i, leafColors[i]);
  });
  leaves.count = leafMatrices.length;
  leaves.name = "leaves";
  return {
    height,
    barkParts,
    crownGeometry,
    crownParts: clumpParts.length,
    leafMesh: leaves,
    leafKind: "leaf",
  };
}

// Cubic interpolation between three points, used for a cluster on a branch bend.
function branchCurvePoint(a, b, c, t) {
  const curve = new THREE.CatmullRomCurve3([a, b, c], false, "centripetal");
  return curve.getPoint(t);
}

// Builds one tree per [x, z, scale] spot, alternating layered conifers and
// clustered broadleaves. Crowns are returned as raycast targets.
export function buildTrees(spots, {
  trunkMaterial,
  foliage,
  branchMaterial,
  heightAt,
  normalAt,
  sunDirection,
  streamDistance,
  leafDensity = 1,
}) {
  const fallbackNormals = () => UP.clone();
  const surfaceNormal = normalAt || fallbackNormals;
  const sun = (sunDirection ? sunDirection.clone() : new THREE.Vector3(-0.5, 0.9, 0.6)).normalize();
  const shadeAngle = Math.atan2(-sun.z, -sun.x);
  const ground = (x, z) => (heightAt ? heightAt(x, z) : 0.18);
  const roots = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.008, 0.034, 1, 7).translate(0, 0.5, 0),
    branchMaterial,
    Math.max(1, spots.length * 7),
  );
  roots.name = "exposed tree roots";
  roots.castShadow = true;
  roots.receiveShadow = true;
  const rootDummy = new THREE.Object3D();
  let rootInstance = 0;

  const mossGeometry = new THREE.IcosahedronGeometry(0.22, 2);
  const mossPositions = mossGeometry.getAttribute("position");
  const mossColors = [];
  for (let i = 0; i < mossPositions.count; i++) {
    const x = mossPositions.getX(i);
    const y = mossPositions.getY(i);
    const z = mossPositions.getZ(i);
    const lobe = fbm(x * 13 + 2, z * 13 - 4, 3);
    mossPositions.setXYZ(i, x * (1 + lobe * 0.14), y * 0.24 + lobe * 0.025, z * (1 + lobe * 0.14));
    const tint = 0.74 + fbm(x * 18, y * 14 + z * 9, 2) * 0.28;
    mossColors.push(tint * 0.85, tint, tint * 0.64);
  }
  mossGeometry.setAttribute("color", new THREE.Float32BufferAttribute(mossColors, 3));
  mossGeometry.computeVertexNormals();
  const mossMaterial = enhanceMaterial(
    new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, flatShading: true }),
    { frost: 0.4, rim: 0.15, detail: { scale: 20, normalStrength: 0.04 } },
  );
  const mossPatches = new THREE.InstancedMesh(mossGeometry, mossMaterial, Math.max(1, spots.length * 3));
  mossPatches.name = "tree root moss";
  mossPatches.receiveShadow = true;
  const mossDummy = new THREE.Object3D();
  const mossUp = new THREE.Vector3(0, 1, 0);
  let mossInstance = 0;

  const trees = [];
  const treeTargets = [];

  spots.forEach(([x, z, scale], treeIndex) => {
    const seed = 0x9e3779b9 ^ Math.imul(treeIndex + 1, 0x85ebca6b);
    const rng = mulberry32(seed ^ 0x27d4eb2d);
    const isBroadleaf = treeIndex % 4 === 1 || treeIndex % 7 === 0;
    const paletteIndex = treeIndex % foliage.crowns.length;
    const tree = new THREE.Group();
    const baseY = ground(x, z) - 0.025;
    tree.position.set(x, baseY, z);
    tree.rotation.y = rng() * TAU;
    // Height classes: a few emergent trees, many medium ones, some young ones.
    const sizeClass = treeIndex % 5 === 0 ? 1.1 : treeIndex % 3 === 0 ? 0.88 : 1;
    tree.scale.setScalar(scale * sizeClass);
    tree.userData.phase = treeIndex * 0.78;
    tree.userData.baseScale = scale * sizeClass;
    tree.userData.displayScale = scale * sizeClass;
    tree.userData.species = isBroadleaf ? "broadleaf" : "conifer";

    const built = isBroadleaf
      ? buildBroadleaf(seed, leafDensity)
      : buildConifer(seed, leafDensity);
    const barkMaterial = trunkMaterial;
    const barkGeometry = mergeGeometries(built.barkParts, false);
    const bark = new THREE.Mesh(barkGeometry, barkMaterial);
    bark.castShadow = true;
    bark.receiveShadow = true;
    bark.userData.tree = tree;
    tree.add(bark);

    const crown = new THREE.Mesh(built.crownGeometry, foliage.crowns[paletteIndex]);
    crown.castShadow = true;
    crown.receiveShadow = true;
    crown.userData.tree = tree;
    tree.add(crown);

    built.leafMesh.material = foliage.leaves[paletteIndex];
    built.leafMesh.castShadow = false;
    built.leafMesh.receiveShadow = true;
    built.leafMesh.userData.tree = tree;
    built.leafMesh.name = built.leafKind === "spray" ? "needle sprays" : "leaves";
    tree.add(built.leafMesh);

    tree.userData.crowns = [crown, built.leafMesh];
    treeTargets.push(bark, crown, built.leafMesh);

    // Surface roots radiate downhill and meet the terrain at their far end, which
    // keeps trunks visually planted on a slope instead of hovering over it.
    const rootCount = isBroadleaf ? 5 : 4;
    for (let rootIndex = 0; rootIndex < rootCount; rootIndex++) {
      const angle = (rootIndex / rootCount) * TAU + rng() * 0.5;
      const reach = (0.2 + rng() * 0.12) * scale * sizeClass;
      const start = new THREE.Vector3(
        Math.cos(angle) * 0.035 * scale * sizeClass,
        0.045 * scale * sizeClass,
        Math.sin(angle) * 0.035 * scale * sizeClass,
      );
      const endX = x + Math.cos(angle) * reach;
      const endZ = z + Math.sin(angle) * reach;
      const end = new THREE.Vector3(
        endX - x,
        ground(endX, endZ) + 0.006 - baseY,
        endZ - z,
      );
      const direction = end.clone().sub(start);
      const length = Math.max(0.02, direction.length());
      rootDummy.position.copy(start);
      rootDummy.quaternion.setFromUnitVectors(limbAxis, direction.normalize());
      rootDummy.scale.set(scale * sizeClass * 0.68, length, scale * sizeClass * 0.68);
      rootDummy.updateMatrix();
      roots.setMatrixAt(rootInstance++, rootDummy.matrix);
    }

    // Moss grows on the shaded side of the trunk and, when the tree is near the
    // stream, a little more of it.
    const nearWater = streamDistance ? Math.max(0, 1 - streamDistance(x, z) / 0.9) : 0;
    const patchCount = nearWater > 0.25 ? 3 : 2;
    for (let patchIndex = 0; patchIndex < patchCount; patchIndex++) {
      const angle = shadeAngle + (rng() - 0.5) * 1.9;
      const offset = (0.18 + rng() * 0.1) * scale * sizeClass;
      const mossX = x + Math.cos(angle) * offset;
      const mossZ = z + Math.sin(angle) * offset;
      const normal = surfaceNormal(mossX, mossZ);
      mossDummy.position.set(mossX, ground(mossX, mossZ) + 0.004, mossZ);
      mossDummy.quaternion.setFromUnitVectors(mossUp, normal);
      mossDummy.rotateY(rng() * TAU);
      mossDummy.scale.set(
        scale * sizeClass * (0.9 + rng() * 0.3),
        0.7 + rng() * 0.2,
        scale * sizeClass * (0.65 + rng() * 0.25),
      );
      mossDummy.updateMatrix();
      mossPatches.setMatrixAt(mossInstance, mossDummy.matrix);
      const shade = 0.32 + rng() * 0.1 - nearWater * 0.04;
      mossPatches.setColorAt(mossInstance++, new THREE.Color().setHSL(0.24 + rng() * 0.02, 0.36, shade));
    }

    trees.push(tree);
  });

  roots.count = rootInstance;
  mossPatches.count = mossInstance;
  roots.instanceMatrix.needsUpdate = true;
  mossPatches.instanceMatrix.needsUpdate = true;
  if (mossPatches.instanceColor) mossPatches.instanceColor.needsUpdate = true;
  roots.computeBoundingSphere();
  mossPatches.computeBoundingSphere();
  return { trees, treeTargets, roots, mossPatches };
}
