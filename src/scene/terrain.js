import * as THREE from "three";

// Procedural floating-island terrain. Every surface (meadow, cliff, rim growth,
// boulders) samples the same height and rim functions so the pieces meet without seams.

export const ISLAND_RADIUS = 4.82;
export const ISLAND_Z_SCALE = 0.75;
export const RIM_SEGMENTS = 144;

const { smoothstep, lerp } = THREE.MathUtils;
const CLIFF_DEPTH = 2.25;
const ROCK_ROWS = 32;
const STRATA = [0x8a7254, 0x6b5a43, 0x4f4638, 0x7a6d58].map((hex) => new THREE.Color(hex));
const MOSS = new THREE.Color(0x56683c);
const SOIL = new THREE.Color(0x4f3b28);
const TURF_SHADOW = new THREE.Color(0x2f3b1d);

function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function valueNoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}

export function fbm(x, y, octaves = 4) {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * frequency + i * 17.3, y * frequency - i * 9.1) * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return sum / norm;
}

// Sampling noise on a circle keeps rim features periodic around the island.
function ringNoise(angle, frequency, offset = 0, octaves = 3) {
  return fbm(Math.cos(angle) * frequency + offset, Math.sin(angle) * frequency - offset, octaves);
}

export function angleGap(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

export function rimWobble(angle) {
  // Two slow lobes give the island a less machined outline; erosion notches break
  // up the few places where the silhouette would otherwise read as a perfect oval.
  const lobes = Math.sin(angle * 2 + 0.6) * 0.032 + Math.sin(angle * 3.3 - 1.1) * 0.018;
  const notch = Math.pow(Math.max(0, Math.sin(angle * 7 + 1.7)), 7) * 0.026;
  return 1 + lobes + Math.sin(angle * 5) * 0.018 + Math.cos(angle * 9) * 0.012
    + ringNoise(angle, 2.2, 3.1) * 0.05 - notch;
}

export function rimPoint(angle, inset = 1) {
  const radius = ISLAND_RADIUS * rimWobble(angle) * inset;
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius * ISLAND_Z_SCALE };
}

// Radius factor of the cliff below the turf lip: 1 at the top, tapering to a narrow keel.
function cliffTaper(depth) {
  return 0.985 - 0.35 * depth - 0.575 * Math.pow(depth, 2.4);
}

export function createIslandTerrain({ streamCurve, fallAngle }) {
  const streamSegments = streamCurve.getSpacedPoints(120);

  function streamDistance(x, z) {
    let best = Infinity;
    for (let i = 0; i < streamSegments.length - 1; i++) {
      const a = streamSegments[i];
      const b = streamSegments[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const t = THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      const distance = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
      if (distance < best) best = distance;
    }
    return best;
  }

  function radial(x, z) {
    const angle = Math.atan2(z / ISLAND_Z_SCALE, x);
    return { angle, rn: Math.hypot(x, z / ISLAND_Z_SCALE) / (ISLAND_RADIUS * rimWobble(angle)) };
  }

  function heightAt(x, z) {
    const { angle, rn } = radial(x, z);
    const interior = 1 - smoothstep(rn, 0.68, 1);
    const hills = (fbm(x * 0.32 + 4.2, z * 0.42 - 1.3, 4) * 0.5 + 0.5) * 0.3;
    const bumps = fbm(x * 2.6, z * 2.6, 2) * 0.018;
    const micro = fbm(x * 7.4 + 2.6, z * 7.4 - 4.8, 2) * 0.0075;
    const rim = ringNoise(angle, 3, 7.7, 2) * 0.03;
    let y = 0.17 + rim * (1 - interior) + hills * interior + bumps * (0.4 + interior * 0.6)
      + micro * interior;
    // Carve a shallow bed so the stream sits in the meadow instead of on top of it.
    const distance = streamDistance(x, z);
    const bed = 0.122 + smoothstep(distance, 0.1, 0.3) * 0.04;
    y = lerp(y, bed, 1 - smoothstep(distance, 0.2, 0.72));
    return y;
  }

  // Slope normal, sampled from the same height field so grass, roots and rocks can
  // sit on the surface instead of floating over it.
  function normalAt(x, z) {
    const e = 0.055;
    const left = heightAt(x - e, z);
    const right = heightAt(x + e, z);
    const back = heightAt(x, z - e);
    const front = heightAt(x, z + e);
    return new THREE.Vector3(left - right, e * 2, back - front).normalize();
  }

  function meadowColor(x, z, y, rn, distance, target) {
    const patch = fbm(x * 0.7 + 11, z * 0.9, 3);
    target.setRGB(0.085, 0.19, 0.07);
    if (patch > 0) target.lerp(new THREE.Color(0.14, 0.235, 0.075), Math.min(1, patch * 2.2));
    else target.lerp(new THREE.Color(0.052, 0.14, 0.06), Math.min(1, -patch * 2.2));
    const moist = 1 - smoothstep(distance, 0.2, 0.75);
    target.lerp(new THREE.Color(0.045, 0.145, 0.065), moist * 0.65);
    target.lerp(new THREE.Color(0.13, 0.185, 0.07), smoothstep(rn, 0.9, 1) * 0.55);
    target.multiplyScalar(0.9 + (y - 0.17) * 0.7 + (hash(x * 31, z * 17) - 0.5) * 0.1);
    return target;
  }

  function makeMeadowGeometry() {
    const rings = 36;
    const positions = [0, heightAt(0, 0), 0];
    const color = new THREE.Color();
    meadowColor(0, 0, positions[1], 0, streamDistance(0, 0), color);
    const colors = [color.r, color.g, color.b];
    const indices = [];
    for (let ring = 1; ring <= rings; ring++) {
      // Rings bunch toward the rim, where the silhouette needs the most detail.
      const t = 1 - Math.pow(1 - ring / rings, 1.3);
      for (let i = 0; i < RIM_SEGMENTS; i++) {
        const angle = (i / RIM_SEGMENTS) * Math.PI * 2;
        const { x, z } = rimPoint(angle, t);
        const y = heightAt(x, z);
        positions.push(x, y, z);
        meadowColor(x, z, y, t, streamDistance(x, z), color);
        colors.push(color.r, color.g, color.b);
      }
    }
    for (let i = 0; i < RIM_SEGMENTS; i++) indices.push(0, 1 + ((i + 1) % RIM_SEGMENTS), 1 + i);
    for (let ring = 1; ring < rings; ring++) {
      const inner = 1 + (ring - 1) * RIM_SEGMENTS;
      const outer = inner + RIM_SEGMENTS;
      for (let i = 0; i < RIM_SEGMENTS; i++) {
        const next = (i + 1) % RIM_SEGMENTS;
        indices.push(inner + i, outer + next, outer + i, inner + i, inner + next, outer + next);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }
  // Each cliff vertex row is described per angle; the first row reuses the meadow rim exactly.
  function cliffRows(angle) {
    const rim = rimPoint(angle);
    const top = heightAt(rim.x, rim.z);
    const calm = smoothstep(angleGap(angle, fallAngle), 0.05, 0.18);
    const lip = (0.025 + Math.max(0, ringNoise(angle, 4, 1.9, 2)) * 0.05) * calm;
    const rows = [
      { factor: 1, y: top, kind: "rim", depth: 0 },
      { factor: 1 + lip, y: top - 0.045, kind: "turf", depth: 0 },
      { factor: 1 + lip * 0.6, y: top - 0.115, kind: "turfUnder", depth: 0 },
      { factor: 0.975, y: top - 0.2, kind: "soil", depth: 0 },
    ];
    const strataTilt = ringNoise(angle, 1.4, 5.3, 2) * 0.55;
    const spike = Math.max(0, ringNoise(angle, 4.5, 8.4, 2) + 0.1);
    for (let row = 1; row <= ROCK_ROWS; row++) {
      const depth = row / ROCK_ROWS;
      const crag = fbm(Math.cos(angle) * 3.1 + depth * 3.5, Math.sin(angle) * 3.1 - depth * 2.2, 4)
        * (0.08 + depth * 0.2) * (0.3 + calm * 0.7);
      const grooves = ringNoise(angle, 11, 2.4, 2) * 0.05 * depth * calm;
      const fracture = Math.pow(Math.max(0, ringNoise(angle, 17, 6.2, 2)), 2) * 0.035 * depth * calm;
      const band = depth * 7 + strataTilt;
      const ledge = Math.pow(Math.max(0, Math.sin(band * Math.PI * 2)), 6) * (1 - depth) * calm;
      rows.push({
        factor: Math.max(0.02, cliffTaper(depth) * (1 + crag + grooves - fracture) + ledge * 0.05),
        y: -0.04 - depth * CLIFF_DEPTH - spike * Math.pow(depth, 3) * 0.6,
        kind: "rock",
        depth,
        band,
        ledge,
      });
    }
    return { rows, rim };
  }

  function cliffColor(row, x, z, angle, target) {
    if (row.kind === "rim") return meadowColor(x, z, row.y, 1, streamDistance(x, z), target);
    if (row.kind === "turf") return meadowColor(x, z, row.y, 1, 9, target).lerp(TURF_SHADOW, 0.35);
    if (row.kind === "turfUnder") return target.copy(TURF_SHADOW).lerp(SOIL, 0.45);
    if (row.kind === "soil") return target.copy(SOIL).multiplyScalar(0.9 + hash(angle * 40, 3) * 0.2);
    const index = Math.abs(Math.floor(row.band)) % STRATA.length;
    target.copy(STRATA[index]).lerp(STRATA[(index + 1) % STRATA.length], smoothstep(row.band % 1, 0.8, 1));
    target.multiplyScalar(0.9 + fbm(x * 2.4 + row.y * 3, z * 2.4 - row.y * 2, 2) * 0.18);
    const moss = smoothstep(fbm(Math.cos(angle) * 5 + row.y * 2, Math.sin(angle) * 5, 3), 0.05, 0.35);
    target.lerp(MOSS, moss * (1 - row.depth) * 0.75 + row.ledge * 0.45);
    if (angleGap(angle, fallAngle) < 0.09 && row.depth < 0.7) target.multiplyScalar(0.7);
    return target.multiplyScalar(1 - row.depth * 0.38);
  }

  function makeCliffGeometry() {
    const positions = [];
    const colors = [];
    const snowWeights = [];
    const indices = [];
    const color = new THREE.Color();
    let rowCount = 0;
    for (let i = 0; i < RIM_SEGMENTS; i++) {
      const angle = (i / RIM_SEGMENTS) * Math.PI * 2;
      const { rows } = cliffRows(angle);
      rowCount = rows.length;
      for (const row of rows) {
        const { x, z } = rimPoint(angle, row.factor);
        positions.push(x, row.y, z);
        cliffColor(row, x, z, angle, color);
        colors.push(color.r, color.g, color.b);
        snowWeights.push(row.kind === "rock" ? Math.min(1, row.ledge * 0.9 + (1 - row.depth) * 0.12) : row.kind === "soil" ? 0.4 : 1);
      }
    }
    // Vertices are stored column by column (all rows of one angle, then the next angle).
    for (let i = 0; i < RIM_SEGMENTS; i++) {
      const a = i * rowCount;
      const b = ((i + 1) % RIM_SEGMENTS) * rowCount;
      for (let row = 0; row < rowCount - 1; row++) {
        indices.push(a + row, b + row, a + row + 1, b + row, b + row + 1, a + row + 1);
      }
    }
    const keel = positions.length / 3;
    positions.push(0, -0.04 - CLIFF_DEPTH - 0.75, 0);
    colors.push(0.12, 0.1, 0.08);
    snowWeights.push(0);
    for (let i = 0; i < RIM_SEGMENTS; i++) {
      const a = i * rowCount + rowCount - 1;
      const b = ((i + 1) % RIM_SEGMENTS) * rowCount + rowCount - 1;
      indices.push(a, b, keel);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.userData.snowWeights = snowWeights;
    return geometry;
  }

  // Where hanging growth can anchor: the meadow edge, the overhanging turf lip
  // and how far out the rock below can bulge, so strands clear the cliff face.
  function lipProfile(angle) {
    const { rows } = cliffRows(angle);
    return {
      top: rows[0].y,
      lipY: rows[1].y,
      lipFactor: rows[1].factor,
      underY: rows[2].y,
      calm: smoothstep(angleGap(angle, fallAngle), 0.05, 0.18),
    };
  }

  // The fall leaves the rim where the stream ends and arcs down the cliff face.
  function makeWaterfallCurve({ angle = fallAngle, streamEnd = streamCurve.getPoint(1) } = {}) {
    const side = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle) * ISLAND_Z_SCALE).normalize();
    const start = { x: streamEnd.x, z: streamEnd.z };
    const lip = rimPoint(angle, 1.035);
    const points = [
      // Join the creek exactly at its lip, then peel the sheet away from the turf.
      new THREE.Vector3(start.x, streamEnd.y - 0.012, start.z),
      new THREE.Vector3(lip.x, streamEnd.y - 0.07, lip.z),
    ];
    for (const depth of [0.08, 0.2, 0.36, 0.55, 0.75, 0.94, 1.08]) {
      // Gravity pulls the water down while momentum makes the broad curtain bow toward open air.
      const radius = 1.1 + depth * 0.12 + Math.sin(depth * Math.PI) * 0.035;
      const { x, z } = rimPoint(angle, radius);
      const sideDrift = depth * 0.42 + Math.sin(depth * Math.PI * 0.8) * 0.04;
      points.push(new THREE.Vector3(
        x + side.x * sideDrift,
        -0.04 - depth * CLIFF_DEPTH,
        z + side.z * sideDrift,
      ));
    }
    const outward = new THREE.Vector3(side.z, 0, -side.x);
    if (outward.x * Math.cos(fallAngle) + outward.z * Math.sin(fallAngle) < 0) outward.negate();
    return { curve: new THREE.CatmullRomCurve3(points), side, outward };
  }

  return {
    heightAt,
    normalAt,
    streamDistance,
    makeMeadowGeometry,
    makeCliffGeometry,
    lipProfile,
    makeWaterfallCurve,
  };
}

// Rounded, noise-displaced boulder with a flattened base so it sits on the ground.
export function makeBoulderGeometry(seed, detail = 1) {
  const geometry = new THREE.IcosahedronGeometry(0.3, detail);
  const positions = geometry.getAttribute("position");
  const colors = [];
  const vertex = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i);
    const n = fbm(vertex.x * 4 + seed * 3.7, vertex.z * 4 + vertex.y * 2.5 - seed, 3);
    vertex.multiplyScalar(1 + n * 0.32);
    if (vertex.y < -0.1) vertex.y = -0.1 + (vertex.y + 0.1) * 0.25;
    positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
    // Moss gathers on upward faces, tinted through vertex colour.
    const moss = smoothstep(vertex.y, 0.02, 0.24) * smoothstep(n, -0.15, 0.25);
    colors.push(lerp(1, 0.62, moss), lerp(1, 0.92, moss), lerp(1, 0.55, moss));
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// Small floating islet: grassy plateau over a tapering rock keel.
export function makeIsletGeometry(seed) {
  const geometry = new THREE.IcosahedronGeometry(0.5, 2);
  const positions = geometry.getAttribute("position");
  const colors = [];
  const vertex = new THREE.Vector3();
  const grass = new THREE.Color(0.13, 0.25, 0.09);
  const rock = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i);
    const n = fbm(vertex.x * 3 + seed * 5.1, vertex.z * 3 + vertex.y * 2 + seed, 3);
    if (vertex.y > 0.18) vertex.y = 0.18 + (vertex.y - 0.18) * 0.15 + n * 0.03;
    else {
      const depth = (0.18 - vertex.y) / 0.68;
      const taper = 1 - Math.pow(depth, 1.4) * 0.82;
      vertex.x *= taper * (1 + n * 0.25);
      vertex.z *= taper * (1 + n * 0.25);
      vertex.y -= depth * depth * 0.45 * (1 + n);
    }
    positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
    rock.copy(STRATA[Math.abs(Math.floor(vertex.y * 9 + seed)) % STRATA.length]).multiplyScalar(0.75 + vertex.y * 0.4);
    if (vertex.y > 0.14) colors.push(grass.r, grass.g, grass.b);
    else if (vertex.y > 0.06) colors.push(SOIL.r, SOIL.g, SOIL.b);
    else colors.push(rock.r, rock.g, rock.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  // Snow settles on the grassy plateau and thins out down the rock keel.
  const islet = geometry.getAttribute("position");
  geometry.userData.snowWeights = Array.from({ length: islet.count }, (_, i) => smoothstep(islet.getY(i), 0.0, 0.16));
  return geometry;
}
