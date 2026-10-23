import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { enhanceMaterial } from "./materials.js";
import { leafQuaternion, makeLeafGeometry } from "./leaves.js";
import { angleGap, rimPoint } from "./terrain.js";

const { smoothstep } = THREE.MathUtils;

// Tapered tube along a curve that records how far each vertex is from the anchor (aSway).
function strandGeometry(curve, radius, segments, color) {
  const geometry = new THREE.TubeGeometry(curve, segments, 1, 4, false);
  const positions = geometry.getAttribute("position");
  const sway = new Float32Array(positions.count);
  const colors = new Float32Array(positions.count * 3);
  const shade = new THREE.Color(color);
  const ringSize = 5;
  for (let i = 0; i < positions.count; i++) {
    const t = Math.floor(i / ringSize) / segments;
    const point = curve.getPointAt(Math.min(1, t));
    // Re-scale each ring around its centre so the strand thins toward the tip.
    const r = radius * (1 - t * 0.75);
    positions.setXYZ(
      i,
      point.x + (positions.getX(i) - point.x) * r,
      point.y + (positions.getY(i) - point.y) * r,
      point.z + (positions.getZ(i) - point.z) * r,
    );
    sway[i] = t;
    const tone = 0.75 + 0.25 * t;
    colors[i * 3] = shade.r * tone;
    colors[i * 3 + 1] = shade.g * tone;
    colors[i * 3 + 2] = shade.b * tone;
  }
  geometry.deleteAttribute("uv");
  geometry.setAttribute("aSway", new THREE.BufferAttribute(sway, 1));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// Path for one strand: emerges from under the turf overhang (hidden from above),
// then falls under gravity with a gentle sideways meander and a curled tip.
function strandCurve(terrain, angle, length, seed) {
  const profile = terrain.lipProfile(angle);
  const out = (factor) => rimPoint(angle, factor);
  const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle) * 0.75).normalize();
  const points = [];
  const lipReach = profile.lipFactor - 1;
  const start = out(1 + lipReach * 0.3);
  points.push(new THREE.Vector3(start.x, profile.underY + 0.02, start.z));
  const over = out(1 + lipReach * 0.75 + 0.01);
  points.push(new THREE.Vector3(over.x, profile.underY - 0.01, over.z));
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // Hangs clear of the rock face, drifting a little further out as it drops.
    const hangOut = out(profile.lipFactor + 0.035 + t * 0.04);
    const wiggle = Math.sin(t * 5 + seed * 7) * 0.035 * t;
    const curl = smoothstep(t, 0.75, 1) * 0.05;
    points.push(new THREE.Vector3(
      hangOut.x + tangent.x * wiggle + Math.cos(angle) * curl,
      profile.underY - t * length + curl * 0.5,
      hangOut.z + tangent.z * wiggle + Math.sin(angle) * curl * 0.75,
    ));
  }
  return new THREE.CatmullRomCurve3(points, false, "centripetal");
}

// Ivy curtains and bare roots draping over the island rim. Strands and their
// leaves share one sway shader so the curtain moves as a single piece.
export function buildVines(terrain, { fallAngle, clumps = 22, leafy = true } = {}) {
  const group = new THREE.Group();
  group.name = "hanging vines";
  const strands = [];
  const leafMatrices = [];
  const leafSway = [];
  const leafTones = [];
  const dummy = new THREE.Object3D();
  const outward = new THREE.Vector3();
  let seed = 1;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  for (let clump = 0; clump < clumps; clump++) {
    const center = (clump / clumps) * Math.PI * 2 + random() * 0.2;
    if (angleGap(center, fallAngle) < 0.28) continue;
    const strandCount = 2 + Math.floor(random() * 4);
    for (let s = 0; s < strandCount; s++) {
      const angle = center + (random() - 0.5) * 0.14;
      const isVine = random() < 0.72;
      const length = isVine ? 0.35 + Math.pow(random(), 1.5) * 1.1 : 0.15 + random() * 0.35;
      const curve = strandCurve(terrain, angle, length, random());
      const segments = isVine ? 18 : 10;
      strands.push(strandGeometry(curve, isVine ? 0.011 : 0.007, segments, isVine ? 0x4f5c2e : 0x4a3626));
      if (!isVine || !leafy) continue;
      // Leaves alternate along the hanging part of the strand, larger near the top.
      const leafCount = Math.round(length * 26);
      for (let l = 0; l < leafCount; l++) {
        const t = 0.12 + (l / leafCount) * 0.86;
        const point = curve.getPointAt(t);
        const along = curve.getTangentAt(t);
        outward.set(Math.cos(angle), 0, Math.sin(angle) * 0.75).normalize();
        const side = new THREE.Vector3().crossVectors(along, outward).normalize().multiplyScalar(l % 2 ? 1 : -1);
        const grow = side.clone().multiplyScalar(0.8).add(outward).addScaledVector(along, 0.4 + random() * 0.4);
        dummy.position.copy(point);
        leafQuaternion(grow, outward.clone().add(new THREE.Vector3(0, 0.6, 0)), dummy.quaternion);
        dummy.rotateZ((random() - 0.5) * 0.8);
        dummy.scale.setScalar((0.075 + random() * 0.035) * (1.1 - t * 0.45));
        dummy.updateMatrix();
        leafMatrices.push(dummy.matrix.clone());
        leafSway.push(t);
        const v = 0.75 + random() * 0.4;
        leafTones.push(new THREE.Color(v * (0.9 + random() * 0.15), v, v * (0.75 + random() * 0.2)));
      }
    }
  }

  const strandMaterial = enhanceMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
    { hang: 0.06, rim: 0.5, snow: 0.6 },
  );
  const strandMesh = new THREE.Mesh(mergeGeometries(strands), strandMaterial);
  strandMesh.name = "vine strands";
  group.add(strandMesh);

  const leafGeometry = makeLeafGeometry({ shape: "heart", fold: 0.18, curl: 0.12, segments: 5, across: 3 });
  leafGeometry.setAttribute("aSway", new THREE.InstancedBufferAttribute(new Float32Array(leafSway), 1));
  const leafMaterial = enhanceMaterial(
    new THREE.MeshStandardMaterial({ color: 0x5c8a3e, vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }),
    { hang: 0.06, flutter: 0.35, translucency: 0.5, rim: 0.8, snow: 0.6 },
  );
  const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, Math.max(1, leafMatrices.length));
  leafMatrices.forEach((matrix, i) => {
    leaves.setMatrixAt(i, matrix);
    leaves.setColorAt(i, leafTones[i]);
  });
  leaves.count = leafMatrices.length;
  leaves.name = "ivy leaves";
  // No shadow casting: the depth pass would not follow the sway shader.
  group.add(leaves);

  return { group, strandMaterial, leafMaterial };
}
