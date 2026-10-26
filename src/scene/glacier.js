import * as THREE from "three";

function hash1(x) {
  const value = Math.sin(x * 219.7 + 117.3) * 43758.5453;
  return value - Math.floor(value);
}

function smoothNoise(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash1(i) * (1 - u) + hash1(i + 1) * u;
}

function wallHeight(t) {
  const peaks = [
    [0.14, 0.4, 0.07],
    [0.3, 0.72, 0.09],
    [0.47, 0.96, 0.1],
    [0.63, 0.58, 0.07],
    [0.78, 0.82, 0.08],
  ];
  let height = 0.85;
  for (const [center, amount, width] of peaks) {
    height += amount * Math.exp(-Math.pow((t - center) / width, 2));
  }
  height += (smoothNoise(t * 17.0 + 3.7) - 0.5) * 0.3;
  height += Math.max(0, smoothNoise(t * 41.0 + 8.2) - 0.58) * 0.55;
  height += Math.max(0, smoothNoise(t * 69.0 + 1.6) - 0.7) * 0.36;
  height -= Math.max(0, 0.3 - smoothNoise(t * 29.0 + 5.5)) * 0.24;
  return Math.max(0.58, height);
}

/**
 * Continuous glacier wall with a vertical faceted face, baked crevasse
 * columns, a bright snow cornice and a handful of broken ice masses.
 */
export function createGlacierWall({ heightAt }) {
  const group = new THREE.Group();
  group.name = "glacier wall";
  const columns = 32;
  const rows = 9;
  const xMin = -3.2;
  const xMax = 3.2;
  const baseZ = -3.14;

  const positions = [];
  const colors = [];
  const indices = [];
  const iceDeep = new THREE.Color(0x1c4f6c);
  const iceMid = new THREE.Color(0x63bad1);
  const icePale = new THREE.Color(0xd3f1f8);
  const snow = new THREE.Color(0xf2fbff);
  const crevasse = new THREE.Color(0x0a2b40);
  const topPoints = [];

  for (let i = 0; i <= columns; i++) {
    const t = i / columns;
    const x = xMin + (xMax - xMin) * t;
    const baseY = heightAt(x, baseZ) + 0.02;
    const edge = THREE.MathUtils.smoothstep(t, 0, 0.07) * THREE.MathUtils.smoothstep(1 - t, 0, 0.07);
    const h = wallHeight(t) * (0.28 + 0.72 * edge);
    // Buttresses make the wall read as a series of vertical ice ribs.
    const rib = Math.sin(t * Math.PI * 7.0 + 0.6) * 0.22 + (smoothNoise(t * 19.0 + 2.2) - 0.5) * 0.18;
    const channel = Math.pow(0.5 + 0.5 * Math.sin(t * Math.PI * 13.0 + 1.4), 9.0);
    for (let r = 0; r <= rows; r++) {
      const v = r / rows;
      const jitterX = (smoothNoise(t * 47.0 + r * 4.3 + 0.7) - 0.5) * 0.05;
      const jitterZ = (smoothNoise(t * 23.0 + r * 2.9 + 8.2) - 0.5) * 0.12;
      const y = baseY + v * h;
      const z = baseZ + 0.11 + rib + jitterZ - channel * 0.16;
      positions.push(x + jitterX, y, z);

      const grain = smoothNoise(t * 33.0 + r * 1.7 + 4.4);
      const c = new THREE.Color().lerpColors(iceDeep, iceMid, THREE.MathUtils.smoothstep(v, 0.02, 0.6));
      c.lerp(icePale, THREE.MathUtils.smoothstep(v, 0.5, 0.88) * 0.85);
      // Horizontal ice strata and occasional deep blue crevasses.
      if (Math.sin(v * 22.0 + grain * 4.0) > 0.68) c.lerp(icePale, 0.22);
      if (grain > 0.7 || channel > 0.45) c.lerp(crevasse, 0.42 + channel * 0.25);
      if (v > 0.86) c.lerp(snow, 0.78);
      colors.push(c.r, c.g, c.b);
      if (r === rows) topPoints.push(new THREE.Vector3(x + jitterX, y, z));
    }
  }

  for (let i = 0; i < columns; i++) {
    for (let r = 0; r < rows; r++) {
      const a = i * (rows + 1) + r;
      const b = (i + 1) * (rows + 1) + r;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  // Top shelf closes the wall and catches the cold sky.
  const shelfStart = (columns + 1) * (rows + 1);
  for (let i = 0; i <= columns; i++) {
    const p = topPoints[i];
    positions.push(p.x, p.y - 0.01, p.z - 0.48);
    colors.push(snow.r, snow.g, snow.b);
  }
  for (let i = 0; i < columns; i++) {
    const topA = i * (rows + 1) + rows;
    const topB = (i + 1) * (rows + 1) + rows;
    const backA = shelfStart + i;
    const backB = shelfStart + i + 1;
    indices.push(topA, topB, backA, topB, backB, backA);
  }

  // A back face closes the wall into a solid ice mass instead of a paper-thin
  // front sheet. The back stays darker so the front face keeps the light.
  const backBaseStart = positions.length / 3;
  for (let i = 0; i <= columns; i++) {
    const p = topPoints[i];
    const x = xMin + (xMax - xMin) * (i / columns);
    const baseY = heightAt(x, baseZ) + 0.02;
    positions.push(x, baseY, baseZ - 0.5);
    colors.push(0.1, 0.24, 0.33);
  }
  for (let i = 0; i < columns; i++) {
    const a = shelfStart + i;
    const b = shelfStart + i + 1;
    const c = backBaseStart + i;
    const d = backBaseStart + i + 1;
    indices.push(a, c, b, b, c, d);
  }

  // Side cheeks close the two cut ends of the mass.
  for (const i of [0, columns]) {
    const frontBase = i * (rows + 1);
    const frontTop = i * (rows + 1) + rows;
    const backTop = shelfStart + i;
    const backBase = backBaseStart + i;
    indices.push(frontBase, frontTop, backTop, frontBase, backTop, backBase);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.16,
    metalness: 0.04,
    clearcoat: 0.7,
    clearcoatRoughness: 0.16,
    flatShading: true,
    side: THREE.DoubleSide,
    emissive: 0x15506a,
    emissiveIntensity: 0.38,
  });
  const wall = new THREE.Mesh(geometry, material);
  wall.name = "continuous glacier wall";
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);

  // Dark recessed crevasse columns are baked into the vertex colours above;
  // separate floating ribbons read as wires, so they are deliberately omitted.

  // A bright snow cornice along the crest.
  const corniceMaterial = new THREE.MeshStandardMaterial({
    color: 0xeaf8fd,
    roughness: 0.62,
    emissive: 0x294b60,
    emissiveIntensity: 0.08,
  });
  const cornicePositions = [];
  for (let i = 0; i <= columns; i++) {
    const p = topPoints[i];
    cornicePositions.push(p.x - 0.08, p.y + 0.015, p.z + 0.02, p.x + 0.08, p.y + 0.015, p.z + 0.02);
  }
  const corniceIndices = [];
  for (let i = 0; i < columns; i++) {
    const a = i * 2;
    corniceIndices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
  }
  const corniceGeometry = new THREE.BufferGeometry();
  corniceGeometry.setAttribute("position", new THREE.Float32BufferAttribute(cornicePositions, 3));
  corniceGeometry.setIndex(corniceIndices);
  corniceGeometry.computeVertexNormals();
  const cornice = new THREE.Mesh(corniceGeometry, corniceMaterial);
  group.add(cornice);

  // Dark end cheeks cover the pale cut face when the camera rotates around.
  const cheekMaterial = new THREE.MeshStandardMaterial({
    color: 0x1b4b62,
    roughness: 0.42,
    metalness: 0.02,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  for (const i of [0, columns]) {
    const x = i === 0 ? xMin : xMax;
    const baseY = heightAt(x, baseZ) + 0.02;
    const top = topPoints[i];
    const cheekGeometry = new THREE.BufferGeometry();
    cheekGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
      x, baseY, baseZ + 0.04,
      x, top.y, baseZ + 0.04,
      x, top.y * 0.92, baseZ - 0.5,
      x, baseY, baseZ - 0.5,
    ], 3));
    cheekGeometry.setIndex([0, 1, 2, 0, 2, 3]);
    cheekGeometry.computeVertexNormals();
    const cheek = new THREE.Mesh(cheekGeometry, cheekMaterial);
    cheek.name = "glacier end cheek";
    group.add(cheek);
  }

  // Small icicle fringe under the cornice adds a readable ice edge.
  const icicleMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xc7ecf5,
    roughness: 0.18,
    metalness: 0.02,
    clearcoat: 0.5,
    emissive: 0x164c62,
    emissiveIntensity: 0.2,
  });
  for (let i = 0; i < 14; i++) {
    const idx = 4 + i * 2;
    if (idx >= topPoints.length) break;
    const p = topPoints[idx];
    const length = 0.08 + smoothNoise(i * 5.3) * 0.16;
    const icicle = new THREE.Mesh(
      new THREE.ConeGeometry(0.018 + smoothNoise(i) * 0.012, length, 5).rotateX(Math.PI),
      icicleMaterial,
    );
    icicle.position.set(p.x, p.y - length * 0.5 + 0.01, p.z + 0.08);
    icicle.rotation.z = (smoothNoise(i * 2.1) - 0.5) * 0.16;
    group.add(icicle);
  }

  // Truncated five-sided ice towers at the base, with snow caps. They are
  // deliberately not cones and are anchored into the snow.
  const seracMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xaeeaf5,
    roughness: 0.18,
    metalness: 0.03,
    clearcoat: 0.65,
    flatShading: true,
    emissive: 0x1c617c,
    emissiveIntensity: 0.3,
  });

  // A dark ice cave gives the wall a readable negative space and focal point.
  const caveMaterial = new THREE.MeshStandardMaterial({
    color: 0x061c2a,
    roughness: 0.42,
    metalness: 0.02,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const caveX = -0.72;
  const caveBase = heightAt(caveX, baseZ) + 0.05;
  const cave = new THREE.Mesh(new THREE.CircleGeometry(0.43, 18, 0, Math.PI), caveMaterial);
  cave.position.set(caveX, caveBase + 0.4, baseZ + 0.38);
  cave.scale.set(1.35, 0.85, 1);
  group.add(cave);
  const caveRim = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.045, 6, 18, Math.PI), seracMaterial);
  caveRim.position.copy(cave.position);
  caveRim.scale.set(1.35, 0.85, 1);
  group.add(caveRim);

  const meltMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x16485d,
    roughness: 0.12,
    metalness: 0.08,
    clearcoat: 0.8,
    transparent: true,
    opacity: 0.8,
  });
  const melt = new THREE.Mesh(new THREE.CircleGeometry(0.34, 18).rotateX(-Math.PI / 2), meltMaterial);
  melt.position.set(caveX, heightAt(caveX, -2.82) + 0.015, -2.82);
  melt.scale.set(1.4, 1, 0.7);
  group.add(melt);

  // Three broken ice masses at the wall foot, half buried in snow. The large
  // towers were removed because a row of columns read as a fence, not a glacier.
  const blocks = [
    [0.1, 0.85, 0.52, 0.72, -2.78],
    [0.18, 0.62, 0.4, 0.54, -2.9],
    [0.82, 0.78, 0.48, 0.64, -2.8],
  ];
  for (let i = 0; i < blocks.length; i++) {
    const [t, h, w, d, z] = blocks[i];
    const x = xMin + (xMax - xMin) * t + (smoothNoise(i * 4.1) - 0.5) * 0.24;
    const baseY = heightAt(x, z);
    const block = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), seracMaterial);
    block.scale.set(w, h, d);
    block.position.set(x, baseY + h * 0.34, z);
    block.rotation.set(
      (smoothNoise(i * 3.1) - 0.5) * 0.28,
      smoothNoise(i * 4.7) * Math.PI,
      (smoothNoise(i * 9.2) - 0.5) * 0.22,
    );
    block.castShadow = true;
    block.receiveShadow = true;
    group.add(block);
    const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), corniceMaterial);
    cap.scale.set(w * 0.8, 0.07, d * 0.8);
    cap.position.set(x, baseY + h * 0.34 + h * 0.48, z);
    cap.rotation.y = block.rotation.y;
    group.add(cap);
  }

  for (let i = 0; i < 6; i++) {
    const t = 0.12 + i * 0.14;
    const x = xMin + (xMax - xMin) * t + (smoothNoise(i * 6.3) - 0.5) * 0.3;
    const z = -2.58 - smoothNoise(i * 2.7) * 0.18;
    const s = 0.07 + smoothNoise(i * 4.9) * 0.09;
    const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), seracMaterial);
    chunk.position.set(x, heightAt(x, z) + s * 0.5, z);
    chunk.rotation.set(smoothNoise(i) * 2, smoothNoise(i * 3) * 2, smoothNoise(i * 5) * 2);
    chunk.castShadow = true;
    group.add(chunk);
  }

  return { group, material };
}
