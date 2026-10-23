import * as THREE from "three";

const { smoothstep } = THREE.MathUtils;

// Leaf outlines as half-width (0..0.5) along the blade, t = 0 at the stalk, 1 at the tip.
const OUTLINES = {
  // Ovate broadleaf: widest just below the middle, drawn to a fine point.
  ovate: (t) => 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.9) * (1 - smoothstep(t, 0.7, 1) * 0.55),
  // Ivy-like heart: lobed shoulders near the stalk, tapering tip.
  heart: (t) => 0.5 * (Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.06)), 0.7) * 0.85 + Math.max(0, 0.25 - t) * 1.2),
  // Narrow lanceolate leaf for loose, falling leaves.
  lance: (t) => 0.32 * Math.pow(Math.sin(Math.PI * t), 0.8),
};

// A single leaf lying along +Z (stalk at the origin) with its face toward +Y.
// It folds along the midrib, curls toward the tip, and carries vein shading in
// vertex colour so it reads as a real leaf rather than a flat card.
export function makeLeafGeometry({ shape = "ovate", fold = 0.22, curl = 0.18, twist = 0.08, stalk = 0.12, segments = 7, across = 4 } = {}) {
  const outline = OUTLINES[shape];
  const positions = [];
  const colors = [];
  const indices = [];
  const columns = across * 2 + 1;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const half = outline(t);
    for (let j = -across; j <= across; j++) {
      const a = j / across;
      const x = a * half;
      // Fold the blade upward from the midrib, curl the tip down, twist slightly.
      const y = Math.abs(a) * half * fold - t * t * curl + a * t * twist * 0.3;
      positions.push(x, y, stalk + t * (1 - stalk));
      const midrib = 1 - (1 - smoothstep(Math.abs(a), 0, 0.14)) * 0.22;
      const vein = 1 - Math.max(0, Math.cos((Math.abs(a) * 2.2 - t * 3) * Math.PI * 2)) * 0.07 * smoothstep(Math.abs(a), 0.15, 0.4);
      const edge = 1 - smoothstep(Math.abs(a), 0.7, 1) * 0.1;
      const tone = (0.86 + 0.14 * t) * midrib * vein * edge;
      colors.push(tone, tone * 1.02, tone * 0.9);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < columns - 1; j++) {
      const a = i * columns + j;
      indices.push(a, a + columns, a + 1, a + 1, a + columns, a + columns + 1);
    }
  }
  // Petiole: a thin strip from the twig to the blade.
  const base = positions.length / 3;
  positions.push(-0.012, 0, 0, 0.012, 0, 0, -0.012, 0, stalk + 0.02, 0.012, 0, stalk + 0.02);
  colors.push(0.62, 0.58, 0.42, 0.62, 0.58, 0.42, 0.7, 0.68, 0.5, 0.7, 0.68, 0.5);
  indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// Conifer spray: a central twig with paired needle tufts swept toward the tip.
export function makeNeedleSprayGeometry() {
  const positions = [];
  const colors = [];
  const indices = [];
  const pushTri = (a, b, c, ta, tb, tc) => {
    const start = positions.length / 3;
    positions.push(...a, ...b, ...c);
    colors.push(ta, ta, ta * 0.92, tb, tb, tb * 0.92, tc, tc, tc * 0.92);
    indices.push(start, start + 1, start + 2);
  };
  // Twig
  pushTri([-0.01, 0, 0], [0.01, 0, 0], [0, 0.005, 1], 0.55, 0.55, 0.75);
  const pairs = 9;
  for (let i = 0; i < pairs; i++) {
    const t = 0.1 + (i / pairs) * 0.85;
    const len = 0.32 * (1 - t * 0.55);
    const root = [0, 0.004, t];
    for (const side of [-1, 1]) {
      // Each tuft is a slim needle-bundle blade, angled forward and slightly up.
      const tip = [side * len * 0.85, 0.05 + len * 0.15, t + len * 0.55];
      const mid = [side * len * 0.4, 0.03, t + len * 0.18];
      pushTri(root, [mid[0], mid[1] + 0.025, mid[2] - 0.03], tip, 0.62, 0.85, 1.05);
      pushTri(root, tip, [mid[0], mid[1] - 0.02, mid[2] + 0.04], 0.62, 1.05, 0.8);
    }
  }
  pushTri([-0.04, 0.02, 0.92], [0.04, 0.02, 0.92], [0, 0.04, 1.12], 0.9, 0.9, 1.1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// Orients a leaf (+Z along the blade, +Y face) so it grows along `direction`
// with its face turned toward `up` as far as the direction allows.
const basisX = new THREE.Vector3();
const basisY = new THREE.Vector3();
const basisZ = new THREE.Vector3();
const basis = new THREE.Matrix4();
export function leafQuaternion(direction, up, target = new THREE.Quaternion()) {
  basisZ.copy(direction).normalize();
  basisY.copy(up).addScaledVector(basisZ, -up.dot(basisZ));
  if (basisY.lengthSq() < 1e-6) basisY.set(0, 0, 1).addScaledVector(basisZ, -basisZ.z);
  basisY.normalize();
  basisX.crossVectors(basisY, basisZ);
  basis.makeBasis(basisX, basisY, basisZ);
  return target.setFromRotationMatrix(basis);
}
