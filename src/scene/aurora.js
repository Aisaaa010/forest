import * as THREE from "three";

const AURORA_VERTEX = `varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const AURORA_FRAGMENT = `uniform float uTime;
uniform vec3 uLow;
uniform vec3 uHigh;
uniform float uOpacity;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { v += noise(p) * a; p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}
void main() {
  float x = vUv.x * 7.0 + uTime * 0.018;
  float y = vUv.y * 2.1 - uTime * 0.012;
  float body = fbm(vec2(x, y));
  float rays = fbm(vec2(x * 5.0 + body * 1.8, y * 1.4));
  float fine = fbm(vec2(x * 3.2, y * 0.9));
  float vertical = pow(0.5 + 0.5 * sin(x * 34.0 + body * 7.0 + uTime * 0.04), 7.0);
  float curtain = smoothstep(0.36, 0.7, body) * (0.5 + rays * 0.7)
    * (0.5 + smoothstep(0.45, 0.85, fine) * 0.55 + vertical * 0.35);
  float topFade = smoothstep(0.0, 0.2, vUv.y);
  float bottomFade = 1.0 - smoothstep(0.62, 1.0, vUv.y);
  float edgeFade = smoothstep(0.0, 0.08, vUv.x) * (1.0 - smoothstep(0.92, 1.0, vUv.x));
  float alpha = curtain * topFade * bottomFade * edgeFade * uOpacity;
  vec3 color = mix(uLow, uHigh, smoothstep(0.25, 0.9, vUv.y) * 0.75 + rays * 0.25);
  color += uHigh * smoothstep(0.72, 1.0, vUv.y) * 0.12;
  gl_FragColor = vec4(color, alpha);
}`;

function createCurtain({ radius, height, y, low, high, opacity, rotation = 0, thetaStart = -Math.PI * 0.8, thetaLength = Math.PI * 1.6 }) {
  const geometry = new THREE.CylinderGeometry(radius, radius, height, 72, 1, true, thetaStart, thetaLength);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLow: { value: new THREE.Color(low) },
      uHigh: { value: new THREE.Color(high) },
      uOpacity: { value: opacity },
    },
    vertexShader: AURORA_VERTEX,
    fragmentShader: AURORA_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = y;
  mesh.rotation.y = rotation;
  mesh.renderOrder = -1;
  return mesh;
}

function createStars(count = 260) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const elevation = 0.22 + Math.random() * 0.76;
    const radius = 18 + Math.random() * 6;
    const horizontal = Math.cos(elevation) * radius;
    positions[i * 3] = Math.cos(angle) * horizontal;
    positions[i * 3 + 1] = Math.sin(elevation) * radius;
    positions[i * 3 + 2] = Math.sin(angle) * horizontal;
    seeds[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `uniform float uTime;
attribute float aSeed;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = (0.8 + fract(aSeed * 17.3) * 1.8) * (42.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
  vAlpha = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.6 + aSeed * 1.5) + aSeed * 31.0));
}`,
    fragmentShader: `varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = 1.0 - smoothstep(0.0, 1.0, d);
  gl_FragColor = vec4(0.82, 0.92, 1.0, a * vAlpha * 0.9);
}`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.name = "polar stars";
  return points;
}

export function createAurora() {
  const group = new THREE.Group();
  group.name = "aurora sky";
  const layers = [
    createCurtain({ radius: 7.4, height: 5.6, y: 3.6, low: 0x2ff5a8, high: 0x5bdcff, opacity: 0.5, rotation: 0.1 }),
    createCurtain({ radius: 8.6, height: 4.8, y: 4.0, low: 0x28d9b0, high: 0xa98cff, opacity: 0.34, rotation: 1.1 }),
    createCurtain({ radius: 9.6, height: 3.8, y: 4.5, low: 0x2ff5a8, high: 0xb79cff, opacity: 0.24, rotation: -0.7, thetaStart: -Math.PI * 0.45, thetaLength: Math.PI * 0.9 }),
  ];
  group.add(...layers);
  const stars = createStars();
  group.add(stars);
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(0.36, 24),
    new THREE.MeshBasicMaterial({ color: 0xf2f4e4, transparent: true, opacity: 0.9 }),
  );
  moon.position.set(-6.5, 7.5, -9);
  moon.lookAt(0, 2, 0);
  group.add(moon);
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(0.9, 24),
    new THREE.MeshBasicMaterial({ color: 0xdce7e8, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  halo.position.copy(moon.position);
  halo.lookAt(0, 2, 0);
  group.add(halo);
  const auroraLight = new THREE.PointLight(0x5de0c0, 1.4, 18);
  auroraLight.position.set(0, 4.0, 0);
  group.add(auroraLight);

  function update(time) {
    for (const layer of layers) layer.material.uniforms.uTime.value = time;
    stars.material.uniforms.uTime.value = time;
    group.rotation.y = Math.sin(time * 0.01) * 0.06;
  }

  return { group, update };
}
