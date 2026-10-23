import * as THREE from "three";
import { makeLeafGeometry } from "./leaves.js";

// GPU snowfall: each flake follows its own looping path with layered sway and
// gusts, tumbles in brightness as it turns, and fades in and out of view.
export function createSnowfall(count, timeUniform, { radiusX = 5.2, radiusZ = 3.9, top = 6.5 } = {}) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random());
    positions[i * 3] = Math.cos(angle) * radius * radiusX;
    positions[i * 3 + 1] = Math.random();
    positions[i * 3 + 2] = Math.sin(angle) * radius * radiusZ;
    seeds[i * 2] = Math.random();
    // Second seed sets flake size; small flakes are much more common than large ones.
    seeds[i * 2 + 1] = Math.pow(Math.random(), 2.2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 2));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: timeUniform,
      uScale: { value: 60 },
      uOpacity: { value: 0 },
      uTop: { value: top },
      uGust: { value: 1 },
      uColor: { value: new THREE.Color(0xf7fbff) },
    },
    vertexShader: `uniform float uTime;
uniform float uScale;
uniform float uTop;
uniform float uGust;
attribute vec2 aSeed;
varying float vAlpha;
varying float vSoft;
varying float vCrystal;
varying float vTwinkle;
void main() {
  float size = aSeed.y;
  // Bigger flakes fall slower and drift more, like real aggregated snow.
  float fall = 0.16 + (1.0 - size) * 0.22 + fract(aSeed.x * 17.3) * 0.08;
  float cycle = fract(position.y - uTime * fall / uTop);
  vec3 p = vec3(position.x, cycle * uTop - 0.2, position.z);
  float t = uTime + aSeed.x * 40.0;
  float gust = sin(uTime * 0.21) * 0.5 + 0.5;
  p.x += sin(t * (0.5 + size * 0.4)) * (0.16 + size * 0.3) + sin(t * 1.9) * 0.05;
  p.z += cos(t * (0.4 + size * 0.3)) * (0.12 + size * 0.24);
  p.x += (gust * 0.55 + sin(p.y * 0.8 + uTime * 0.3) * 0.25) * uGust;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uScale * (0.45 + size * 1.9) / -mv.z;
  gl_Position = projectionMatrix * mv;
  float flicker = 0.75 + 0.25 * sin(t * (2.0 + aSeed.x * 3.0));
  vAlpha = smoothstep(0.0, 0.08, cycle) * (1.0 - smoothstep(0.85, 1.0, cycle)) * flicker;
  vSoft = 0.35 + size * 0.5;
  vCrystal = smoothstep(0.86, 0.995, aSeed.x);
  vTwinkle = 0.72 + 0.28 * sin(t * (2.4 + aSeed.x * 5.0));
}`,
    fragmentShader: `uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
varying float vSoft;
varying float vCrystal;
varying float vTwinkle;
void main() {
  vec2 q = (gl_PointCoord - 0.5) * 2.0;
  vec2 p = abs(q);
  float d = length(p);
  float core = 1.0 - smoothstep(1.0 - vSoft, 1.0, d);
  float halo = exp(-d * 4.6) * 0.34;
  float rayX = (1.0 - smoothstep(0.015, 0.15, p.x)) * exp(-p.y * 5.2);
  float rayY = (1.0 - smoothstep(0.015, 0.15, p.y)) * exp(-p.x * 5.2);
  float rayA = (1.0 - smoothstep(0.015, 0.12, abs(q.x - q.y) * 0.707)) * exp(-(p.x + p.y) * 3.0);
  float rayB = (1.0 - smoothstep(0.015, 0.12, abs(q.x + q.y) * 0.707)) * exp(-(p.x + p.y) * 3.0);
  float rays = max(max(rayX, rayY), max(rayA, rayB));
  float softFlake = max(core, halo);
  float crystal = max(softFlake, rays * (0.55 + vTwinkle * 0.45));
  float alpha = mix(softFlake, crystal, vCrystal) * vAlpha * uOpacity * vTwinkle;
  vec3 tint = mix(uColor, vec3(0.83, 0.91, 1.0), vCrystal * 0.38);
  gl_FragColor = vec4(tint, alpha);
}`,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.name = "snowfall";
  return points;
}

// Same leaf model as the canopy, centred on its midpoint so it tumbles naturally.
function makeLooseLeafGeometry() {
  return makeLeafGeometry({ shape: "ovate", fold: 0.3, curl: 0.22, twist: 0.2, segments: 5, across: 3 })
    .translate(0, 0, -0.5)
    .scale(0.1, 0.1, 0.1);
}

const LEAF_TONES = {
  green: [0x7fa253, 0x9cb15a, 0x6c9448, 0xb7ba5c],
  autumn: [0xd9a441, 0xc8743a, 0xe2bd5b, 0xa3b04f],
};

// A few leaves detach from crowns, flutter down in a pendulum glide, rest on the
// grass for a while, then shrink away and respawn elsewhere.
export function createFallingLeaves(count, { trees, heightAt }) {
  const mesh = new THREE.InstancedMesh(
    makeLooseLeafGeometry(),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }),
    count,
  );
  mesh.name = "falling leaves";
  mesh.castShadow = true;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const leaves = Array.from({ length: count }, (_, i) => ({ age: -i * 0.9, tone: i % 4 }));
  let palette = LEAF_TONES.green;

  function respawn(leaf) {
    const tree = trees[Math.floor(Math.random() * trees.length)];
    const scale = tree.userData.baseScale;
    const angle = Math.random() * Math.PI * 2;
    const reach = (0.15 + Math.random() * 0.35) * scale;
    leaf.x = tree.position.x + Math.cos(angle) * reach;
    leaf.z = tree.position.z + Math.sin(angle) * reach;
    leaf.y = tree.position.y + (0.9 + Math.random() * 0.6) * scale;
    leaf.ground = heightAt(leaf.x, leaf.z) + 0.01;
    leaf.phase = Math.random() * Math.PI * 2;
    leaf.swing = 0.7 + Math.random() * 0.8;
    leaf.spin = (Math.random() - 0.5) * 3;
    leaf.size = 0.75 + Math.random() * 0.5;
    leaf.rest = 0;
    leaf.age = 0;
    leaf.tone = Math.floor(Math.random() * 4);
  }

  function setPalette(autumn) {
    palette = autumn ? LEAF_TONES.autumn : LEAF_TONES.green;
    leaves.forEach((leaf, i) => mesh.setColorAt(i, color.setHex(palette[leaf.tone])));
    mesh.instanceColor.needsUpdate = true;
  }

  // wind: horizontal drift multiplier (rain makes leaves fall faster and blow further).
  function update(delta, wind = 1) {
    leaves.forEach((leaf, i) => {
      leaf.age += delta;
      if (leaf.age < 0) {
        dummy.scale.setScalar(0);
      } else {
        if (leaf.x === undefined) respawn(leaf);
        const t = leaf.age;
        // Leaves blown past the rim are recycled instead of hovering in the air.
        if (Math.hypot(leaf.x / 4.7, leaf.z / 3.5) > 1) respawn(leaf);
        if (leaf.y > leaf.ground) {
          // Pendulum glide: sideways swing with matching roll, sinking fastest mid-swing.
          const swing = Math.sin(t * 1.8 * leaf.swing + leaf.phase);
          leaf.y -= (0.16 + Math.abs(swing) * 0.22) * delta * (0.8 + wind * 0.2);
          leaf.x += (Math.cos(t * 1.8 * leaf.swing + leaf.phase) * 0.35 + 0.12 * wind) * delta;
          leaf.z += Math.sin(t * 0.9 + leaf.phase) * 0.12 * delta;
          dummy.position.set(leaf.x, Math.max(leaf.y, leaf.ground), leaf.z);
          dummy.rotation.set(swing * 0.9, t * leaf.spin + leaf.phase, Math.cos(t * 1.8 * leaf.swing + leaf.phase) * 0.6);
          dummy.scale.setScalar(leaf.size * Math.min(1, t * 2));
          leaf.ground = heightAt(leaf.x, leaf.z) + 0.01;
        } else {
          leaf.rest += delta;
          dummy.position.set(leaf.x, leaf.ground, leaf.z);
          dummy.rotation.set(0.05, leaf.phase, 0.04);
          dummy.scale.setScalar(leaf.size * (1 - THREE.MathUtils.smoothstep(leaf.rest, 4, 6)));
          if (leaf.rest > 6) respawn(leaf);
        }
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }

  setPalette(false);
  update(0);
  return { mesh, update, setPalette };
}
