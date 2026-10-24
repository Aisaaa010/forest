import * as THREE from "three";

const TAU = Math.PI * 2;

// Soft contact shadows that follow the terrain. A flat decal would sink into a
// slope, so each disc's outer rings are projected onto the height field.
export function buildContactShadows(entries, heightAt) {
  const positions = [];
  const alphas = [];
  const indices = [];
  const rings = [0.55, 1];
  const segments = 20;
  for (const { x, z, radius, opacity = 0.28 } of entries) {
    if (!radius || radius <= 0) continue;
    const base = positions.length / 3;
    positions.push(x, heightAt(x, z) + 0.014, z);
    alphas.push(opacity);
    for (const ring of rings) {
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * TAU;
        const px = x + Math.cos(angle) * radius * ring;
        const pz = z + Math.sin(angle) * radius * ring;
        positions.push(px, heightAt(px, pz) + 0.013, pz);
        alphas.push(opacity * (ring < 1 ? 0.52 : 0.02));
      }
    }
    const inner = base + 1;
    const outer = base + 1 + segments;
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      indices.push(base, inner + i, inner + next);
      indices.push(inner + i, outer + i, outer + next, inner + i, outer + next, inner + next);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aAlpha", new THREE.Float32BufferAttribute(alphas, 1));
  geometry.setIndex(indices);
  const material = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0x17251a) } },
    vertexShader: `attribute float aAlpha;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `uniform vec3 uColor;
varying float vAlpha;
void main() { gl_FragColor = vec4(uColor, vAlpha); }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "contact shadows";
  mesh.renderOrder = 0;
  mesh.frustumCulled = false;
  return mesh;
}
