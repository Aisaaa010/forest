import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { enhanceMaterial } from "./materials.js";
import { makeLeafMassGeometry } from "./vegetation.js";
import { leafQuaternion, makeLeafGeometry } from "./leaves.js";

const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const flat = (geometry) => (geometry.index ? geometry.toNonIndexed() : geometry);

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

function paint(geometry, color) {
  const count = geometry.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  const tint = new THREE.Color(color);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function makeTube(points, radius, color, tubular = 7) {
  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
  const geometry = new THREE.TubeGeometry(curve, tubular, radius, 4, false);
  paint(geometry, color);
  geometry.deleteAttribute("uv");
  return geometry;
}

// A tiny diamond leaflet: cheap enough that a whole fern plant stays under a
// thousand triangles while still reading as a pinnate frond.
function makeFernLeafletGeometry(tone = 1) {
  const half = 0.028;
  const length = 0.11;
  const positions = [
    0, 0, 0,
    -half, 0, length * 0.42,
    0, 0.009, length * 0.58,
    half, 0, length * 0.42,
  ];
  const colors = new Float32Array(12);
  for (let i = 0; i < 4; i++) {
    const shade = tone * (i === 2 ? 1.12 : 0.9 + i * 0.03);
    colors[i * 3] = 0.2 * shade;
    colors[i * 3 + 1] = 0.4 * shade;
    colors[i * 3 + 2] = 0.16 * shade;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

function makeFernGeometry(seed) {
  const rng = mulberry32(seed);
  const parts = [];
  const fronds = 5 + Math.floor(rng() * 3);
  for (let f = 0; f < fronds; f++) {
    const angle = (f / fronds) * TAU + rng() * 0.5;
    const reach = 0.26 + rng() * 0.12;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(Math.cos(angle) * reach * 0.22, 0.16 + rng() * 0.06, Math.sin(angle) * reach * 0.22),
      new THREE.Vector3(Math.cos(angle) * reach * 0.68, 0.22 + rng() * 0.05, Math.sin(angle) * reach * 0.68),
    ], false, "centripetal");
    parts.push(flat(makeTube([...curve.points], 0.004, 0x3d6532, 8)));
    const pairs = 7;
    for (let i = 0; i < pairs; i++) {
      const t = 0.12 + (i / pairs) * 0.8;
      const point = curve.getPoint(t).addScaledVector(UP, 0.012);
      const tangent = curve.getTangent(t);
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      for (const s of [-1, 1]) {
        const direction = tangent.clone().multiplyScalar(0.42)
          .addScaledVector(side, s * (0.9 - t * 0.25))
          .addScaledVector(UP, 0.18)
          .normalize();
        const leaflet = makeFernLeafletGeometry(0.82 + t * 0.35);
        leaflet.scale(1 - t * 0.18, 1, 1 - t * 0.2);
        const quaternion = new THREE.Quaternion();
        leafQuaternion(direction, UP, quaternion);
        leaflet.applyMatrix4(new THREE.Matrix4().compose(point, quaternion, new THREE.Vector3(1, 1, 1)));
        parts.push(flat(leaflet));
      }
    }
  }
  return mergeGeometries(parts, false);
}

function makeMushroomGeometry(rng, seed, heightAt, x, z) {
  const capColor = new THREE.Color().setHSL(0.055 + rng() * 0.03, 0.46, 0.44 + rng() * 0.08);
  const stemColor = new THREE.Color().setHSL(0.11, 0.16, 0.7);
  const scale = 0.35 + rng() * 0.6;
  const stem = paint(new THREE.CylinderGeometry(0.008, 0.013, 0.075, 6), stemColor);
  stem.translate(0, 0.0375, 0);
  const cap = paint(new THREE.SphereGeometry(0.055, 10, 5, 0, TAU, 0, Math.PI * 0.5), capColor);
  cap.scale(1, 0.62, 1);
  cap.translate(0, 0.062, 0);
  const gills = paint(new THREE.CylinderGeometry(0.052, 0.018, 0.015, 10, 1, true), 0xd8c9a0);
  gills.translate(0, 0.058, 0);
  const geometry = mergeGeometries([flat(stem), flat(cap), flat(gills)], false);
  const y = heightAt(x, z) - 0.004;
  geometry.applyMatrix4(new THREE.Matrix4().makeScale(scale, scale, scale));
  geometry.applyMatrix4(new THREE.Matrix4().makeRotationY(rng() * TAU));
  geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(x, y, z));
  return geometry;
}

export function buildUnderstory({
  heightAt,
  normalAt,
  streamDistance,
  treeSpots = [],
  rockSpots = [],
  foliage,
  trunkMaterial,
  branchMaterial,
}) {
  const group = new THREE.Group();
  group.name = "forest understory";
  const rng = mulberry32(0x51ed270b);
  const shadowEntries = [];
  const clear = (x, z, padding = 0.18) => {
    if (streamDistance(x, z) < 0.26 + padding) return false;
    for (const [tx, tz, ts = 1] of treeSpots) {
      if (Math.hypot(x - tx, z - tz) < 0.26 + padding + ts * 0.08) return false;
    }
    for (const [rx, rz, rs = 1] of rockSpots) {
      if (Math.hypot(x - rx, z - rz) < 0.16 + padding + rs * 0.1) return false;
    }
    return true;
  };

  // Low shrubs fill the space between trunks and add a second canopy height.
  const shrubSpots = [
    [-3.62, 1.12, 1.0], [3.18, 1.7, 0.9], [-0.12, -0.86, 0.85],
    [2.52, -2.5, 0.9], [-2.42, 2.52, 0.8],
  ];
  shrubSpots.forEach(([x, z, size], index) => {
    if (!clear(x, z, 0.12)) return;
    const parts = [];
    const count = 4 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * TAU + rng() * 0.6;
      const radius = (0.08 + rng() * 0.12) * size;
      const center = new THREE.Vector3(
        Math.cos(angle) * radius,
        0.16 + rng() * 0.14 * size,
        Math.sin(angle) * radius,
      );
      const clump = makeLeafMassGeometry(400 + index * 13 + i, 2);
      clump.scale(0.16 * size, 0.1 * size, 0.16 * size);
      clump.rotateY(rng() * TAU);
      clump.translate(center.x, center.y, center.z);
      const colors = clump.getAttribute("color");
      const tone = 0.68 + rng() * 0.18;
      for (let v = 0; v < colors.count; v++) {
        colors.setXYZ(v, colors.getX(v) * tone * 1.04, colors.getY(v) * tone, colors.getZ(v) * tone * 0.82);
      }
      parts.push(flat(clump));
    }
    const mesh = new THREE.Mesh(mergeGeometries(parts, false), foliage.crowns[(index + 1) % foliage.crowns.length]);
    mesh.position.set(x, heightAt(x, z) - 0.01, z);
    mesh.rotation.y = rng() * TAU;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    // Two woody stems peek out from the leaf mass.
    for (let s = 0; s < 2; s++) {
      const stemHeight = 0.2 + rng() * 0.12;
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.012, stemHeight, 5).translate(0, stemHeight / 2, 0),
        branchMaterial,
      );
      stem.position.set(x + (rng() - 0.5) * 0.12, heightAt(x, z) - 0.01, z + (rng() - 0.5) * 0.12);
      stem.rotation.z = (rng() - 0.5) * 0.35;
      stem.rotation.x = (rng() - 0.5) * 0.35;
      stem.castShadow = true;
      group.add(stem);
    }
    shadowEntries.push({ x, z, radius: 0.24 * size, opacity: 0.22 });
  });

  // Ferns: a low, arching layer that reads at a glance as damp forest floor.
  const fernMaterial = enhanceMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, side: THREE.DoubleSide }),
    { rim: 0.45, wind: 0.45, translucency: 0.24 },
  );
  const fernSpots = [
    [-3.5, 0.28, 1.0], [2.72, 0.55, 0.9], [0.82, 2.56, 0.85], [-1.15, -2.5, 0.85], [3.1, -0.75, 0.8],
  ];
  const fernGeometry = makeFernGeometry(83);
  fernSpots.forEach(([x, z, size], index) => {
    if (!clear(x, z, 0.08)) return;
    const fern = new THREE.Mesh(fernGeometry, fernMaterial);
    const normal = normalAt(x, z);
    fern.position.set(x, heightAt(x, z) - 0.01, z);
    fern.quaternion.setFromUnitVectors(UP, normal);
    fern.rotateY(rng() * TAU);
    fern.scale.setScalar(size * (0.85 + rng() * 0.25));
    fern.receiveShadow = true;
    fern.castShadow = true;
    group.add(fern);
    shadowEntries.push({ x, z, radius: 0.2 * size, opacity: 0.18 });
  });

  // A fallen log with a sawn end, a broken branch and moss on its upper face.
  const logX = -2.9;
  const logZ = 2.15;
  if (clear(logX, logZ, 0.16)) {
    const log = new THREE.Group();
    const logBarkMaterial = enhanceMaterial(
      new THREE.MeshStandardMaterial({ color: 0x775a3e, roughness: 0.95 }),
      { detail: { scale: 15, normalStrength: 0.055, stretch: [1, 0.5, 1] } },
    );
    const logY = heightAt(logX, logZ) + 0.025;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.085, 0.92, 9), logBarkMaterial);
    trunk.rotation.z = Math.PI / 2;
    trunk.rotation.y = 0.34;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    log.add(trunk);
    const cutMaterial = new THREE.MeshStandardMaterial({ color: 0xb08a5e, roughness: 0.82 });
    for (const side of [-1, 1]) {
      const cut = new THREE.Mesh(new THREE.CircleGeometry(0.078, 9), cutMaterial);
      cut.position.x = side * 0.46;
      cut.rotation.y = Math.PI / 2;
      log.add(cut);
    }
    const moss = new THREE.Mesh(makeLeafMassGeometry(912, 2), foliage.crowns[2]);
    moss.position.set(0.02, 0.055, 0);
    moss.scale.set(0.28, 0.07, 0.12);
    moss.rotation.y = 0.34;
    moss.castShadow = true;
    log.add(moss);
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.032, 0.28, 6), branchMaterial);
    branch.position.set(-0.1, 0.03, 0.12);
    branch.rotation.set(0.9, 0.2, 0.7);
    branch.castShadow = true;
    log.add(branch);
    log.position.set(logX, logY, logZ);
    group.add(log);
    shadowEntries.push({ x: logX, z: logZ, radius: 0.55, opacity: 0.24 });
  }

  // A handful of mushrooms near the log and tree roots.
  const mushroomSpots = [
    [-2.1, 2.55], [-2.35, 2.2], [-2.9, 1.95],
    [-3.15, 0.5], [1.18, 1.95], [2.05, -1.02], [0.35, 2.32],
  ];
  const mushroomParts = [];
  for (const [x, z] of mushroomSpots) {
    if (!clear(x, z, 0.02)) continue;
    mushroomParts.push(makeMushroomGeometry(rng, 0, heightAt, x, z));
  }
  if (mushroomParts.length) {
    const mushroomMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
    const mushrooms = new THREE.Mesh(mergeGeometries(mushroomParts, false), mushroomMaterial);
    mushrooms.name = "mushrooms";
    mushrooms.castShadow = true;
    mushrooms.receiveShadow = true;
    group.add(mushrooms);
  }

  // Fallen leaves gather under the crowns instead of being spread uniformly.
  const litterGeometry = makeLeafGeometry({ shape: "ovate", fold: 0.18, curl: 0.1, segments: 3, across: 2 });
  const litterMaterial = enhanceMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, side: THREE.DoubleSide }),
    { rim: 0.2 },
  );
  const litterCount = 150;
  const litter = new THREE.InstancedMesh(litterGeometry, litterMaterial, litterCount);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let placed = 0;
  for (let attempt = 0; attempt < litterCount * 8 && placed < litterCount; attempt++) {
    const tree = treeSpots[Math.floor(rng() * treeSpots.length)];
    if (!tree) break;
    const angle = rng() * TAU;
    const radius = 0.15 + rng() * 0.55 * (tree[2] || 1);
    const x = tree[0] + Math.cos(angle) * radius;
    const z = tree[1] + Math.sin(angle) * radius;
    if (streamDistance(x, z) < 0.22) continue;
    dummy.position.set(x, heightAt(x, z) + 0.004, z);
    dummy.rotation.set((rng() - 0.5) * 0.18, rng() * TAU, (rng() - 0.5) * 0.18);
    dummy.scale.setScalar(0.055 + rng() * 0.04);
    dummy.updateMatrix();
    litter.setMatrixAt(placed, dummy.matrix);
    color.setHSL(0.1 + rng() * 0.13, 0.24 + rng() * 0.18, 0.22 + rng() * 0.16);
    litter.setColorAt(placed, color);
    placed++;
  }
  litter.count = placed;
  litter.receiveShadow = true;
  litter.name = "leaf litter";
  group.add(litter);

  return {
    group,
    fernMaterial,
    litterMaterial,
    shadowEntries,
  };
}
