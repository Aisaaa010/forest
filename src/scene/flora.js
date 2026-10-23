import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { enhanceMaterial } from "./materials.js";
import { fbm } from "./terrain.js";

const { smoothstep } = THREE.MathUtils;

// Curved, tapered blade with a root-to-tip colour ramp. Both faces are built
// explicitly with upward-leaning normals so blades never render dark from behind.
function makeBladeGeometry(segments = 4) {
  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];
  const root = new THREE.Color(0.32, 0.42, 0.24);
  const tip = new THREE.Color(1.15, 1.12, 0.82);
  const shade = new THREE.Color();
  for (let side = 0; side < 2; side++) {
    const base = positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const halfWidth = 0.5 * Math.pow(1 - t, 0.85);
      const bend = t * t * 0.42;
      const y = t;
      shade.copy(root).lerp(tip, Math.pow(t, 0.8));
      for (const x of [-halfWidth, halfWidth]) {
        positions.push(x * (i === segments ? 0 : 1), y, bend);
        normals.push(0, 0.62, side ? 0.78 : -0.78);
        colors.push(shade.r, shade.g, shade.b);
      }
    }
    for (let i = 0; i < segments; i++) {
      const a = base + i * 2;
      if (side) indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      else indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return geometry;
}

// Dense meadow grass: clumped by noise, taller toward the rim, thinned in the stream.
export function buildGrass({ count, heightAt, streamDistance, rimPoint, avoid = [] }) {
  const geometry = makeBladeGeometry();
  const material = enhanceMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }),
    { rim: 0.8, wind: 0.32, frost: 0.75 },
  );
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let placed = 0;
  for (let attempt = 0; attempt < count * 4 && placed < count; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const radial = Math.sqrt(Math.random()) * 0.965;
    const { x, z } = rimPoint(angle, radial);
    const water = streamDistance(x, z);
    if (water < 0.2) continue;
    if (avoid.some(([ax, az]) => Math.hypot(x - ax, z - az) < 0.11)) continue;
    const clump = smoothstep(fbm(x * 1.6 + 3, z * 1.6 - 2, 3), -0.35, 0.3);
    if (Math.random() > 0.25 + clump * 0.75) continue;
    const lush = 0.6 + clump * 0.5 + smoothstep(radial, 0.7, 0.96) * 0.35 + (1 - smoothstep(water, 0.2, 0.6)) * 0.3;
    const height = (0.07 + Math.random() * 0.13) * lush;
    dummy.position.set(x, heightAt(x, z) - 0.01, z);
    dummy.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.3);
    dummy.scale.set(0.022 + Math.random() * 0.018, height, height);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    color.setHSL(0.21 + Math.random() * 0.08 - clump * 0.02, 0.38 + Math.random() * 0.22, 0.3 + Math.random() * 0.14 + clump * 0.04);
    mesh.setColorAt(placed, color);
    placed++;
  }
  mesh.count = placed;
  mesh.receiveShadow = true;
  mesh.name = "meadow grass";
  return mesh;
}

// A single petal lying along +Z with its base at the origin. The outline can be
// rounded, pointed or notched; colour runs from a tinted throat to a white tip so
// the per-instance petal colour reads as a natural gradient.
function makePetalGeometry({
  length, width, cup = 0.2, curl = 0.15, round = 0.6, point = 0, notch = 0,
  throat = 0xffffff, throatSize = 0.35, ridges = 0,
}) {
  const geometry = new THREE.PlaneGeometry(1, 1, 6, 12);
  const positions = geometry.getAttribute("position");
  const colors = [];
  const base = new THREE.Color(throat);
  const tint = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const u = positions.getX(i) + 0.5;
    const t = positions.getY(i) + 0.5;
    const across = (u - 0.5) * 2;
    let profile = Math.pow(Math.sin(Math.PI * Math.min(1, t * (1 - round * 0.3) + 0.05)), round) * (0.22 + 0.78 * Math.sqrt(t));
    profile *= 1 - point * smoothstep(t, 0.55, 1) * 0.85;
    const tipDip = notch * (1 - Math.abs(across)) * smoothstep(t, 0.85, 1);
    const reach = (t - tipDip * 0.12) * length;
    const ridge = ridges ? Math.cos(across * Math.PI * ridges) * 0.004 * smoothstep(t, 0.2, 0.7) : 0;
    const x = across * width * 0.5 * profile;
    const y = across * across * cup * width * profile + t * t * curl * length + ridge;
    positions.setXYZ(i, x, y, reach);
    const vein = 1 - (1 - smoothstep(Math.abs(across), 0, 0.1)) * 0.1 - Math.max(0, ridge) * 12;
    const edge = 1 - smoothstep(Math.abs(across), 0.75, 1) * 0.06;
    tint.setRGB(1, 1, 1).lerp(base, 1 - smoothstep(t, throatSize * 0.4, throatSize));
    tint.multiplyScalar(vein * edge * (0.82 + 0.18 * smoothstep(t, 0, 0.3)));
    colors.push(tint.r, tint.g, tint.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.deleteAttribute("uv");
  geometry.computeVertexNormals();
  return geometry;
}

// mergeGeometries needs every part indexed the same way; flatten them all.
const flat = (geometry) => (geometry.index ? geometry.toNonIndexed() : geometry);

// Replace vertex colours with a flat colour, optionally keeping existing shading.
function paint(geometry, hex, keepShading = false) {
  const color = new THREE.Color(hex);
  const count = geometry.getAttribute("position").count;
  const existing = geometry.getAttribute("color");
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const k = keepShading && existing ? existing.getX(i) : 1;
    colors[i * 3] = color.r * k;
    colors[i * 3 + 1] = color.g * k;
    colors[i * 3 + 2] = color.b * k;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  if (geometry.getAttribute("uv")) geometry.deleteAttribute("uv");
  return geometry;
}

const FLOWER_TYPES = [
  { name: "daisy", petals: 18, rings: 2, length: 0.09, width: 0.022, cup: 0.12, curl: 0.04, tilt: 0.08, round: 0.4, notch: 1,
    throat: 0xf3e2a0, throatSize: 0.25, center: "disc", centerRadius: 0.03, height: 0.22, nod: 0.35,
    colors: [0xfffbf2, 0xfbf3ea, 0xfff0f3] },
  { name: "cosmos", petals: 8, rings: 1, length: 0.085, width: 0.055, cup: 0.18, curl: 0.1, tilt: 0.28, round: 0.9, notch: 0.8, ridges: 1.5,
    throat: 0xb84f7e, throatSize: 0.32, center: "disc", centerRadius: 0.018, stamens: 10, height: 0.27, nod: 0.25,
    colors: [0xf3a9c2, 0xe9b6e6, 0xf8cdd5, 0xd2aef0] },
  { name: "tulip", petals: 3, rings: 2, length: 0.085, width: 0.06, cup: 0.6, curl: -0.08, tilt: 1.22, round: 1, point: 0.6,
    throat: 0xf0d36a, throatSize: 0.3, center: "pistil", stamens: 6, height: 0.24, nod: 0.05,
    colors: [0xf28a7a, 0xf6cf6b, 0xe86f8f, 0xf7ad6e, 0xfaf0e6] },
  { name: "buttercup", petals: 5, rings: 1, length: 0.052, width: 0.054, cup: 0.42, curl: 0.16, tilt: 0.5, round: 1.3,
    throat: 0xe0a020, throatSize: 0.4, center: "disc", centerRadius: 0.013, stamens: 14, height: 0.15, nod: 0.2,
    colors: [0xf8d64f, 0xf5bd3d, 0xfbe57e] },
  { name: "bud", petals: 4, rings: 1, length: 0.06, width: 0.045, cup: 0.7, curl: -0.12, tilt: 1.42, round: 1, point: 0.8,
    throat: 0xffffff, throatSize: 0.2, center: "none", height: 0.2, nod: 0.6,
    colors: [0xf0a0b5, 0xf7c27f, 0xe2b2ea] },
];

// Disc of spiralled florets (golden angle), darker and denser toward the centre.
function makeFloretDisc(radius) {
  const parts = [];
  const dome = paint(new THREE.SphereGeometry(radius, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.45).scale(1, 0.55, 1), 0x8a6a1e);
  parts.push(dome);
  const count = Math.round(radius * 1400);
  const inner = new THREE.Color(0x6b5a1c);
  const outer = new THREE.Color(0xf0bf3a);
  const tint = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const r = Math.sqrt((i + 0.5) / count);
    const angle = i * 2.39996;
    const floret = new THREE.IcosahedronGeometry(radius * 0.11 * (0.8 + r * 0.5), 0);
    const y = Math.sqrt(Math.max(0, 1 - r * r)) * radius * 0.5;
    floret.translate(Math.cos(angle) * r * radius * 0.96, y + 0.002, Math.sin(angle) * r * radius * 0.96);
    parts.push(paint(floret, tint.copy(inner).lerp(outer, smoothstep(r, 0.3, 0.95)).getHex()));
  }
  return mergeGeometries(parts.map(flat));
}

function makeStamens(count, length, filament, anther) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (i % 2) * 0.3;
    const lean = 0.35 + (i % 3) * 0.12;
    const len = length * (0.85 + (i % 4) * 0.06);
    const transform = new THREE.Matrix4()
      .makeRotationY(-angle)
      .multiply(new THREE.Matrix4().makeRotationZ(-lean));
    const stalk = paint(new THREE.CylinderGeometry(0.0012, 0.0018, len, 3).translate(0, len / 2, 0), filament);
    const tip = paint(new THREE.SphereGeometry(0.0042, 5, 4).scale(1, 0.7, 1.6).translate(0, len, 0), anther);
    parts.push(stalk.applyMatrix4(transform), tip.applyMatrix4(transform));
  }
  return mergeGeometries(parts.map(flat));
}

// Gently curved stem; heads are re-aimed along its final tangent.
function stemCurve(type) {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.008, type.height * 0.4, 0.004),
    new THREE.Vector3(0.022, type.height * 0.78, -0.004),
    new THREE.Vector3(0.03 + type.nod * 0.02, type.height, 0.002),
  ]);
}

function headTransform(type) {
  const curve = stemCurve(type);
  const tip = curve.getPoint(1);
  const tangent = curve.getTangent(1);
  // Heads nod slightly past the stem tangent, as if turning toward the light.
  const aim = tangent.clone().add(new THREE.Vector3(type.nod * 0.5, 0, type.nod * 0.25)).normalize();
  const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), aim);
  return new THREE.Matrix4().compose(tip, rotation, new THREE.Vector3(1, 1, 1));
}

function makeFlowerHead(type) {
  const parts = [];
  for (let ring = 0; ring < type.rings; ring++) {
    const count = type.petals;
    for (let i = 0; i < count; i++) {
      const petal = makePetalGeometry({ ...type, length: type.length * (1 - ring * 0.14), width: type.width * (1 - ring * 0.08) });
      const yaw = (i / count) * Math.PI * 2 + ring * (Math.PI / count) + Math.sin(i * 3.7) * 0.06;
      petal.applyMatrix4(new THREE.Matrix4().makeRotationX(-(type.tilt + ring * 0.16 + Math.sin(i * 5.1) * 0.06)));
      petal.applyMatrix4(new THREE.Matrix4().makeRotationY(yaw));
      petal.translate(0, ring * 0.003, 0);
      parts.push(petal);
    }
  }
  return mergeGeometries(parts).applyMatrix4(headTransform(type));
}

function makeFlowerBody(type) {
  const curve = stemCurve(type);
  const stem = paint(new THREE.TubeGeometry(curve, 8, 0.0055, 5), 0x5a8a44);
  const head = [];
  if (type.center === "disc") head.push(makeFloretDisc(type.centerRadius));
  if (type.center === "pistil") head.push(paint(new THREE.CylinderGeometry(0.004, 0.006, 0.05, 6).translate(0, 0.025, 0), 0xc9d56a));
  if (type.stamens) head.push(makeStamens(type.stamens, type.center === "pistil" ? 0.045 : 0.03, 0xf4e6b0, type.name === "cosmos" ? 0xe7b62e : 0x8a5a2a));
  const sepal = paint(new THREE.ConeGeometry(0.016, 0.026, 8, 1, true).rotateX(Math.PI).translate(0, -0.008, 0), 0x4d7a3c);
  head.push(sepal);
  const headParts = head.map((g) => flat(g).applyMatrix4(headTransform(type)));
  // A basal rosette plus one stem leaf, folded along the midrib.
  const leaves = [0, 1, 2, 3].map((i) => {
    const basal = i < 3;
    const leaf = paint(makePetalGeometry({
      length: basal ? 0.1 + (i % 2) * 0.03 : 0.08, width: basal ? 0.03 : 0.024, cup: -0.35, curl: basal ? -0.55 : -0.3, round: 0.7, point: 0.5,
    }), basal ? 0x5d9145 : 0x649a4a, true);
    leaf.applyMatrix4(new THREE.Matrix4().makeRotationX(basal ? -0.55 : -0.85));
    leaf.applyMatrix4(new THREE.Matrix4().makeRotationY(i * 2.2 + 0.4));
    return flat(leaf.translate(0, basal ? 0.004 : type.height * 0.42, 0));
  });
  return mergeGeometries([flat(stem), ...headParts, ...leaves]);
}

// Flower beds: each species is two instanced meshes (tinted petals + green body),
// clustered in drifts so the meadow reads as patches instead of noise.
export function buildFlowers({ perType, heightAt, streamDistance, rimPoint, avoid = [] }) {
  const group = new THREE.Group();
  group.name = "flowers";
  const petalMaterial = enhanceMaterial(
    // Sheen gives petals a soft velvet edge highlight instead of a plastic shine.
    new THREE.MeshPhysicalMaterial({
      vertexColors: true, roughness: 0.5, side: THREE.DoubleSide, sheen: 0.6, sheenRoughness: 0.45,
      sheenColor: 0xfff4f0, emissive: 0xffffff, emissiveIntensity: 0.035,
    }),
    { rim: 1, wind: 0.9 },
  );
  const bodyMaterial = enhanceMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }),
    { rim: 0.6, wind: 0.9 },
  );
  const drifts = Array.from({ length: FLOWER_TYPES.length * 2 }, (_, i) => {
    const angle = i * 2.399 + 0.6;
    return { ...rimPoint(angle, 0.3 + (i % 4) * 0.17), type: i % FLOWER_TYPES.length };
  });
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  // Open blooms (world positions of flower heads) for butterflies to land on.
  const blooms = [];
  FLOWER_TYPES.forEach((type, typeIndex) => {
    const headOffset = stemCurve(type).getPoint(1);
    const petals = new THREE.InstancedMesh(makeFlowerHead(type), petalMaterial, perType);
    const bodies = new THREE.InstancedMesh(makeFlowerBody(type), bodyMaterial, perType);
    const homes = drifts.filter((drift) => drift.type === typeIndex);
    let placed = 0;
    for (let attempt = 0; attempt < perType * 8 && placed < perType; attempt++) {
      const home = homes[attempt % homes.length];
      const spread = 0.55 * Math.sqrt(-2 * Math.log(Math.random() + 1e-6));
      const angle = Math.random() * Math.PI * 2;
      const x = home.x + Math.cos(angle) * spread;
      const z = home.z + Math.sin(angle) * spread * 0.8;
      if (Math.hypot(x / 4.6, z / 3.4) > 0.95 || streamDistance(x, z) < 0.3) continue;
      if (avoid.some(([ax, az]) => Math.hypot(x - ax, z - az) < 0.22)) continue;
      const size = 1.05 + Math.random() * 0.55;
      dummy.position.set(x, heightAt(x, z) - 0.008, z);
      dummy.rotation.set((Math.random() - 0.5) * 0.25, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.25);
      dummy.scale.setScalar(size);
      dummy.updateMatrix();
      petals.setMatrixAt(placed, dummy.matrix);
      if (type.name !== "bud" && type.name !== "tulip") blooms.push(headOffset.clone().applyMatrix4(dummy.matrix));
      bodies.setMatrixAt(placed, dummy.matrix);
      petals.setColorAt(placed, color.setHex(type.colors[Math.floor(Math.random() * type.colors.length)]));
      bodies.setColorAt(placed, color.setRGB(1, 1, 1));
      placed++;
    }
    petals.count = bodies.count = placed;
    petals.castShadow = bodies.castShadow = true;
    petals.name = `${type.name} petals`;
    petals.userData.pairedMesh = bodies;
    bodies.userData.pairedMesh = petals;
    group.add(petals, bodies);
  });
  group.userData.blooms = blooms;
  return group;
}
