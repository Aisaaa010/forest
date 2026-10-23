import * as THREE from "three";
import { enhanceMaterial } from "./materials.js";
import { fbm } from "./terrain.js";
import { leafQuaternion, makeLeafGeometry, makeNeedleSprayGeometry } from "./leaves.js";

const { smoothstep } = THREE.MathUtils;

// Palette materials are mutated in place by applySceneMood(), so callers keep
// a reference to the returned array instead of recreating materials per scene.
// Foliage shading detail (occlusion, tip highlights) lives in vertex colours.
// Each palette entry yields an inner-crown material and a matching leaf material;
// both tween together because they share the same palette slot.
export function createFoliageMaterials(palette) {
  const crowns = palette.map((color) =>
    enhanceMaterial(
      new THREE.MeshStandardMaterial({ color, vertexColors: true, roughness: 0.86, emissive: 0x000000, side: THREE.DoubleSide }),
      { rim: 1, rustle: 0.022, snow: 1 },
    ),
  );
  const leaves = palette.map((color) =>
    enhanceMaterial(
      new THREE.MeshStandardMaterial({ color, vertexColors: true, roughness: 0.62, emissive: 0x000000, side: THREE.DoubleSide }),
      { rim: 1, flutter: 0.18, translucency: 0.55, canopy: 0.018, snow: 1 },
    ),
  );
  return { crowns, leaves, all: [...crowns, ...leaves] };
}

// Tapered trunk with a root flare, long split bark and small irregular knot scars.
function makeTrunkGeometry(height, radius, species) {
  const profile = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const flare = 1 + Math.pow(1 - t, 6) * 1.1;
    const irregular = 1 + Math.sin(t * 18 + (species === "pine" ? 0.5 : 1.7)) * 0.014;
    profile.push(new THREE.Vector2(radius * (1 - t * 0.55) * flare * irregular, t * height));
  }
  const geometry = new THREE.LatheGeometry(profile, 18);
  const positions = geometry.getAttribute("position");
  const colors = [];
  const knotY = species === "pine" ? height * 0.38 : height * 0.56;
  const knotAngle = species === "pine" ? 1.4 : -0.6;
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const angle = Math.atan2(positions.getZ(i), positions.getX(i));
    const grainPhase = angle * (species === "pine" ? 13 : 9)
      + Math.sin(y * 7 + angle * 2.5) * 0.62
      + fbm(angle * 2.5, y * 12, 2) * 0.6;
    const groove = Math.pow(Math.max(0, Math.cos(grainPhase)), species === "pine" ? 18 : 25);
    const scale = species === "pine"
      ? Math.sin(angle * 21 + y * 34) * Math.sin(y * 49 + angle * 7) * 0.035
      : Math.sin(angle * 5 + y * 19) * 0.035;
    const knotDelta = Math.atan2(Math.sin(angle - knotAngle), Math.cos(angle - knotAngle));
    const knotRadius = Math.sqrt((knotDelta * 13) ** 2 + ((y - knotY) * 22) ** 2);
    const knotRing = Math.exp(-((knotRadius - 0.72) ** 2) * 2.4) * 0.18;
    const knotCore = Math.exp(-(knotRadius ** 2) * 1.3) * 0.22;
    const bark = 0.88 + fbm(angle * (species === "pine" ? 5 : 3), y * 13, 3) * 0.2
      + scale - groove * (species === "pine" ? 0.24 : 0.18) + knotRing - knotCore;
    const root = 0.75 + 0.25 * smoothstep(y, 0, 0.18);
    const tone = bark * root;
    colors.push(tone * (species === "pine" ? 1.04 : 1.12), tone, tone * (species === "pine" ? 0.88 : 0.78));
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// One conifer tier: a cone whose skirt is cut into drooping, jagged needle tips.
function makeTierGeometry(radius, height, seed) {
  const segments = 22;
  const geometry = new THREE.ConeGeometry(radius, height, segments, 4, true);
  const positions = geometry.getAttribute("position");
  const colors = [];
  for (let i = 0; i < positions.count; i++) {
    let x = positions.getX(i);
    let y = positions.getY(i);
    let z = positions.getZ(i);
    const t = (y + height / 2) / height;
    const angle = Math.atan2(z, x);
    // Alternate columns (by vertex index, so the seam matches) hang lower as needle tips.
    const jag = ((i % (segments + 1)) % 2 === 0 ? 1 : 0) * (1 - t);
    const lump = 1 + fbm(Math.cos(angle) * 2 + seed, Math.sin(angle) * 2 + t * 3, 2) * 0.16 * (1 - t);
    x *= lump * (1 + jag * 0.12);
    z *= lump * (1 + jag * 0.12);
    y -= jag * height * 0.13 + Math.pow(1 - t, 3) * height * 0.08;
    positions.setXYZ(i, x, y, z);
    // Inner, lower needles sit in shade; tips catch light.
    const tone = 0.6 + 0.4 * t + jag * 0.18 + fbm(x * 9 + seed, z * 9, 2) * 0.08;
    colors.push(tone, tone, tone * 0.96);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// A lumpy leaf mass with occlusion baked darker underneath.
function makeLeafMassGeometry(seed) {
  const geometry = new THREE.IcosahedronGeometry(0.34, 3);
  const positions = geometry.getAttribute("position");
  const colors = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    v.fromBufferAttribute(positions, i);
    const n = fbm(v.x * 5 + seed, v.y * 5 + v.z * 3 - seed, 3);
    const leaves = fbm(v.x * 16 + seed, v.z * 16 + v.y * 11, 2);
    v.multiplyScalar(1 + n * 0.22 + leaves * 0.06);
    if (v.y < -0.12) v.y = -0.12 + (v.y + 0.12) * 0.55;
    positions.setXYZ(i, v.x, v.y, v.z);
    const up = smoothstep(v.y, -0.2, 0.3);
    // Darker inner mass, hidden under real leaves.
    const tone = 0.32 + up * 0.28 + leaves * 0.08;
    colors.push(tone, tone, tone * 0.94);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

const limbAxis = new THREE.Vector3(0, 1, 0);

// Builds one tree per [x, z, scale] spot, alternating layered conifers and
// clustered broadleaves. Crowns are returned as raycast targets.
export function buildTrees(spots, { trunkMaterial, foliage, branchMaterial, heightAt, leafDensity = 1 }) {
  const foliageMaterials = foliage.crowns;
  const broadLeaf = makeLeafGeometry({ shape: "ovate", fold: 0.25, curl: 0.16, segments: 5, across: 3 });
  const needleSpray = makeNeedleSprayGeometry();
  const leafDummy = new THREE.Object3D();
  const leafColor = new THREE.Color();
  const direction = new THREE.Vector3();
  const facing = new THREE.Vector3();
  const sky = new THREE.Vector3(0, 1, 0);
  const coniferTrunk = makeTrunkGeometry(0.62, 0.075, "pine");
  const broadleafTrunk = makeTrunkGeometry(0.82, 0.085, "broadleaf");
  const limbGeometry = new THREE.CylinderGeometry(0.022, 0.042, 1, 6).translate(0, 0.5, 0);
  const rootGeometry = new THREE.CylinderGeometry(0.008, 0.034, 1, 7).translate(0, 0.5, 0);
  const tierSets = [0, 1, 2].map((variant) =>
    Array.from({ length: 5 }, (_, tier) => makeTierGeometry(0.6 - tier * 0.095, 0.56 - tier * 0.04, variant * 7 + tier)),
  );
  const tipGeometry = new THREE.ConeGeometry(0.07, 0.3, 10);
  tipGeometry.setAttribute("color", new THREE.Float32BufferAttribute(new Array(tipGeometry.getAttribute("position").count * 3).fill(1), 3));
  const leafMasses = [3, 9, 17, 29].map(makeLeafMassGeometry);
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
    { frost: 0.4, rim: 0.15 },
  );
  const totalRootCount = spots.reduce((count, _, index) => count + (index % 4 === 1 || index % 7 === 0 ? 5 : 4), 0);
  const roots = new THREE.InstancedMesh(rootGeometry, branchMaterial, totalRootCount);
  roots.name = "exposed tree roots";
  roots.castShadow = true;
  const rootDummy = new THREE.Object3D();
  const mossPatches = new THREE.InstancedMesh(mossGeometry, mossMaterial, spots.length * 2);
  mossPatches.name = "tree root moss";
  mossPatches.receiveShadow = true;
  const mossDummy = new THREE.Object3D();
  const rootUp = new THREE.Vector3(0, 1, 0);
  let rootInstance = 0;
  let mossInstance = 0;
  const trees = [];
  const treeTargets = [];

  spots.forEach(([x, z, scale], treeIndex) => {
    const tree = new THREE.Group();
    // Sink trunks slightly so they stay planted on sloped ground.
    tree.position.set(x, (heightAt ? heightAt(x, z) : 0.18) - 0.02, z);
    tree.rotation.y = treeIndex * 1.37;
    tree.scale.setScalar(scale);
    tree.userData.phase = treeIndex * 0.78;
    const crowns = [];
    const addCrown = (mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.tree = tree;
      crowns.push(mesh);
      treeTargets.push(mesh);
      tree.add(mesh);
    };
    const isBroadleaf = treeIndex % 4 === 1 || treeIndex % 7 === 0;
    // Buttress roots emerge from the collar and taper as they meet the soil.
    const rootsForTree = isBroadleaf ? 5 : 4;
    const treeOrigin = new THREE.Vector3(x, tree.position.y, z);
    for (let rootIndex = 0; rootIndex < rootsForTree; rootIndex++) {
      const angle = rootIndex / rootsForTree * Math.PI * 2 + treeIndex * 1.71;
      const reach = 0.24 + (rootIndex % 2) * 0.07;
      const localStart = new THREE.Vector3(Math.cos(angle) * 0.035, 0.055, Math.sin(angle) * 0.035)
        .applyAxisAngle(rootUp, tree.rotation.y).multiplyScalar(scale).add(treeOrigin);
      const localEnd = new THREE.Vector3(Math.cos(angle) * reach, 0.006, Math.sin(angle) * reach * 0.82)
        .applyAxisAngle(rootUp, tree.rotation.y).multiplyScalar(scale).add(treeOrigin);
      const direction = localEnd.clone().sub(localStart);
      rootDummy.position.copy(localStart);
      rootDummy.quaternion.setFromUnitVectors(rootUp, direction.clone().normalize());
      rootDummy.scale.set(scale * 0.72, direction.length(), scale * 0.72);
      rootDummy.updateMatrix();
      roots.setMatrixAt(rootInstance++, rootDummy.matrix);
    }
    for (let patchIndex = 0; patchIndex < 2; patchIndex++) {
      const angle = treeIndex * 2.4 + patchIndex * Math.PI * 0.82;
      const offset = new THREE.Vector3(Math.cos(angle) * 0.22, 0, Math.sin(angle) * 0.19)
        .applyAxisAngle(rootUp, tree.rotation.y).multiplyScalar(scale);
      const mossX = x + offset.x;
      const mossZ = z + offset.z;
      mossDummy.position.set(mossX, (heightAt ? heightAt(mossX, mossZ) : tree.position.y) + 0.004, mossZ);
      mossDummy.rotation.set(0, angle, 0);
      mossDummy.scale.set(scale * (0.95 + (treeIndex % 3) * 0.12), 0.82, scale * (0.68 + patchIndex * 0.1));
      mossDummy.updateMatrix();
      mossPatches.setMatrixAt(mossInstance, mossDummy.matrix);
      mossPatches.setColorAt(mossInstance++, new THREE.Color().setHSL(0.24 + (treeIndex % 3) * 0.018, 0.36, 0.42 + patchIndex * 0.04));
    }
    // Exposed roots radiate into the turf and anchor the trunk to uneven ground.
    const rootCount = isBroadleaf ? 5 : 4;
    for (let rootIndex = 0; rootIndex < rootCount; rootIndex++) {
      const angle = rootIndex / rootCount * Math.PI * 2 + treeIndex * 1.71;
      const reach = 0.24 + (rootIndex % 2) * 0.07;
      const start = new THREE.Vector3(Math.cos(angle) * 0.035, 0.055, Math.sin(angle) * 0.035);
      const end = new THREE.Vector3(Math.cos(angle) * reach, 0.006, Math.sin(angle) * reach * 0.82);
      const direction = end.clone().sub(start);
      const root = new THREE.Mesh(rootGeometry, branchMaterial);
      root.position.copy(start);
      root.scale.set(0.72, direction.length(), 0.72);
      root.quaternion.setFromUnitVectors(limbAxis, direction.normalize());
      root.castShadow = true;
      tree.add(root);
    }
    for (let patchIndex = 0; patchIndex < 2; patchIndex++) {
      const angle = treeIndex * 2.4 + patchIndex * Math.PI * 0.82;
      const moss = new THREE.Mesh(mossGeometry, mossMaterial);
      moss.position.set(Math.cos(angle) * 0.22, 0.012, Math.sin(angle) * 0.19);
      moss.scale.set(1.0 + (treeIndex % 3) * 0.18, 0.72, 0.72 + (patchIndex % 2) * 0.18);
      moss.rotation.y = angle;
      moss.receiveShadow = true;
      tree.add(moss);
    }
    // Real leaf blades / needle sprays for this tree, gathered into one instanced mesh.
    const leafMatrices = [];
    const leafTones = [];
    const leafNormals = [];
    const addLeaf = (position, grow, face, size, brightness, crownNormal) => {
      leafDummy.position.copy(position);
      leafQuaternion(grow, face, leafDummy.quaternion);
      leafDummy.scale.setScalar(size);
      leafDummy.updateMatrix();
      leafMatrices.push(leafDummy.matrix.clone());
      leafNormals.push(crownNormal.clone());
      const v = brightness * (0.82 + Math.random() * 0.06);
      // A few older leaves turn yellow-olive, the rest vary subtly in hue.
      if (Math.random() < 0.02) leafColor.setRGB(v * 1.22, v * 1.12, v * 0.58);
      else leafColor.setRGB(v * (0.97 + Math.random() * 0.06), v * (1 + Math.random() * 0.06), v * (0.9 + Math.random() * 0.08));
      leafTones.push(leafColor.clone());
    };

    if (isBroadleaf) {
      const trunk = new THREE.Mesh(broadleafTrunk, trunkMaterial);
      trunk.castShadow = true;
      tree.add(trunk);
      // Limbs fork from the upper trunk toward the main leaf masses.
      const limbEnds = [];
      for (let limb = 0; limb < 3; limb++) {
        const angle = limb * 2.1 + treeIndex;
        const end = new THREE.Vector3(Math.cos(angle) * 0.3, 1.08 + (limb % 2) * 0.12, Math.sin(angle) * 0.27);
        const start = new THREE.Vector3(0, 0.62 + limb * 0.06, 0);
        const direction = end.clone().sub(start);
        const bough = new THREE.Mesh(limbGeometry, branchMaterial);
        bough.position.copy(start);
        bough.scale.set(1 - limb * 0.15, direction.length(), 1 - limb * 0.15);
        bough.quaternion.setFromUnitVectors(limbAxis, direction.normalize());
        bough.castShadow = true;
        tree.add(bough);
        limbEnds.push(end);
      }
      const clusters = 9;
      const crownCenter = new THREE.Vector3(0, 1.15, 0);
      for (let cluster = 0; cluster < clusters; cluster++) {
        const ring = cluster < 6;
        const angle = (cluster / (ring ? 6 : 3)) * Math.PI * 2 + treeIndex * 0.31 + (ring ? 0 : 0.5);
        const reach = ring ? 0.3 : 0.13;
        const crown = new THREE.Mesh(
          leafMasses[(treeIndex + cluster) % leafMasses.length],
          foliageMaterials[(treeIndex + cluster) % foliageMaterials.length],
        );
        crown.position.set(Math.cos(angle) * reach, (ring ? 1.0 : 1.32) + (cluster % 3) * 0.07, Math.sin(angle) * reach * 0.9);
        crown.scale.setScalar((ring ? 0.82 : 0.92) + (cluster % 3) * 0.07);
        crown.rotation.set(angle * 0.3, angle, angle * 0.2);
        addCrown(crown);
        const clusterNormal = crown.position.clone().sub(crownCenter).normalize().multiplyScalar(0.5).add(new THREE.Vector3(0, 1, 0)).normalize();
        const shell = 0.28 * crown.scale.x;
        const leafCount = Math.round(90 * leafDensity);
        for (let leaf = 0, tries = 0; leaf < leafCount && tries < leafCount * 3; tries++) {
          direction.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
          if (direction.lengthSq() > 1 || direction.lengthSq() < 0.05) continue;
          direction.normalize();
          // Few leaves on the shaded underside, none pointing back into the trunk.
          if (direction.y < -0.35 && Math.random() < 0.7) continue;
          leaf++;
          const radius = shell * (0.78 + Math.random() * 0.3);
          const base = crown.position.clone().addScaledVector(direction, radius);
          const grow = direction.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.9, -0.45 - Math.random() * 0.3, (Math.random() - 0.5) * 0.9));
          facing.copy(direction).multiplyScalar(0.6).add(sky);
          const occlusion = 0.85 + Math.max(0, direction.y) * 0.3 + direction.clone().sub(crownCenter.clone().sub(crown.position).normalize()).length() * 0.05;
          addLeaf(base, grow, facing, 0.13 + Math.random() * 0.06, occlusion, clusterNormal);
        }
      }
    } else {
      const trunk = new THREE.Mesh(coniferTrunk, trunkMaterial);
      trunk.castShadow = true;
      tree.add(trunk);
      const tiers = tierSets[treeIndex % tierSets.length];
      const crownCenter = new THREE.Vector3(0, 1.2, 0);
      tiers.forEach((geometry, tier) => {
        const height = 0.56 - tier * 0.04;
        const radius = 0.6 - tier * 0.095;
        const crown = new THREE.Mesh(geometry, foliageMaterials[(treeIndex + tier) % foliageMaterials.length]);
        crown.position.y = 0.48 + tier * 0.27 + height / 2;
        crown.rotation.y = tier * 0.7;
        addCrown(crown);
        const tierNormal = new THREE.Vector3(0, height * 0.7, radius).normalize();
        // Needle sprays hang off the tier skirt, swept outward and down its slope.
        const sprayCount = Math.round((30 - tier * 4) * leafDensity);
        const tierBase = crown.position.y - height / 2;
        for (let spray = 0; spray < sprayCount; spray++) {
          const angle = (spray / sprayCount) * Math.PI * 2 + Math.random() * 0.4;
          const h = 0.04 + Math.random() * 0.6;
          const r = radius * (1 - h) * (0.9 + Math.random() * 0.1);
          const base = new THREE.Vector3(Math.cos(angle) * r, tierBase + h * height - 0.03, Math.sin(angle) * r);
          const grow = new THREE.Vector3(Math.cos(angle), -0.3 - Math.random() * 0.35, Math.sin(angle));
          facing.set(Math.cos(angle) * height, radius, Math.sin(angle) * height);
          const sprayNormal = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(0.4).add(tierNormal).normalize();
          addLeaf(base, grow, facing, 0.17 + Math.random() * 0.08 - tier * 0.012, 0.8 + h * 0.35, sprayNormal);
        }
      });
      const tip = new THREE.Mesh(tipGeometry, foliageMaterials[treeIndex % foliageMaterials.length]);
      tip.position.y = 0.48 + 5 * 0.27 + 0.1;
      addCrown(tip);
    }

    const leafGeometry = (isBroadleaf ? broadLeaf : needleSpray).clone();
    const crownNormals = new Float32Array(leafNormals.length * 3);
    leafNormals.forEach((normal, i) => crownNormals.set([normal.x, normal.y, normal.z], i * 3));
    leafGeometry.setAttribute("aCrownNormal", new THREE.InstancedBufferAttribute(crownNormals, 3));
    const leaves = new THREE.InstancedMesh(leafGeometry, foliage.leaves[treeIndex % foliage.leaves.length], leafMatrices.length);
    leafMatrices.forEach((matrix, i) => {
      leaves.setMatrixAt(i, matrix);
      leaves.setColorAt(i, leafTones[i]);
    });
    leaves.receiveShadow = true;
    leaves.name = "leaves";
    tree.add(leaves);

    tree.userData.crowns = crowns;
    tree.userData.baseScale = scale;
    tree.userData.displayScale = scale;
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
