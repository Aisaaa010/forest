import * as THREE from "three";

// Shared water uniforms: mood tweens these colours once for both stream and falls.
export const waterUniforms = {
  uTime: null, // bound to sceneUniforms.uTime by createWaterMaterial
  uDeep: { value: new THREE.Color(0x1f5a55) },
  uShallow: { value: new THREE.Color(0x5fa59a) },
  uSky: { value: new THREE.Color(0xcfe3da) },
  uFoam: { value: new THREE.Color(0xeef7f2) },
  uSunDir: { value: new THREE.Vector3(-0.5, 0.8, 0.6).normalize() },
  uSunColor: { value: new THREE.Color(0xfff0d0) },
  uGlow: { value: 0 },
  uRain: { value: 0 },
};

const waterVertex = `attribute vec3 aFlow;
attribute vec3 aSide;
uniform float uTime;
uniform float uFall;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec3 vFlow;
varying vec3 vSide;
void main() {
  vUv = uv;
  vec3 p = position;
  if (uFall > 0.5) {
    float across = uv.y * 2.0 - 1.0;
    float phase = uv.x * 2.3 - uTime * 0.85;
    float sway = sin(phase + across * 1.7) * 0.035
      + sin(phase * 0.47 - across * 2.2 + uTime * 0.28) * 0.022;
    p += aSide * sway;
  }
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vFlow = normalize(mat3(modelMatrix) * aFlow);
  vSide = normalize(mat3(modelMatrix) * aSide);
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const waterFragment = `uniform float uTime;
uniform float uSpeed;
uniform float uFall;
uniform float uLength;
uniform float uGlow;
uniform float uRain;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSky;
uniform vec3 uFoam;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec3 vFlow;
varying vec3 vSide;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { s += noise(p) * a; p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return s;
}
// Two noise layers drifting at different rates read as moving, folding water.
float surface(vec2 q) {
  return fbm(q) + 0.5 * fbm(q * 1.9 + vec2(-uTime * 0.35, uTime * 0.12));
}

void main() {
  float across = vUv.y * 2.0 - 1.0;
  float edge = abs(across);
  float along = vUv.x / uLength;
  // Water runs fastest mid-channel and accelerates as it nears the lip.
  float speed = uSpeed * (1.0 - edge * edge * 0.65) * (1.0 + smoothstep(0.8, 1.0, along) * 1.4 * (1.0 - uFall));
  vec2 q = uFall > 0.5
    ? vec2(across * 4.5, vUv.x * 1.1 - uTime * speed)
    : vec2(vUv.x * 4.0 - uTime * speed, across * 1.3);
  float e = 0.06;
  float h0 = surface(q);
  vec2 g = vec2(surface(q + vec2(e, 0.0)) - h0, surface(q + vec2(0.0, e)) - h0) / e;
  vec2 slope = uFall > 0.5 ? vec2(g.y, g.x) : g;

  vec3 n = normalize(vNormalW - (slope.x * vFlow + slope.y * vSide) * 0.22);
  vec3 V = normalize(cameraPosition - vWorld);
  if (dot(n, V) < 0.0) n = -n;

  // Rain rings expand on the surface in a jittered grid.
  if (uRain > 0.0 && uFall < 0.5) {
    vec2 rp = vec2(vUv.x, across * 0.16) * 9.0;
    vec2 cell = floor(rp);
    vec2 f = fract(rp) - 0.5 - (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.5;
    float phase = fract(uTime * 0.85 + hash(cell));
    float ring = smoothstep(0.05, 0.0, abs(length(f) - phase * 0.42)) * (1.0 - phase);
    n = normalize(n + vec3(f.x, 0.0, f.y) * ring * 1.5 * uRain);
  }

  float facing = max(dot(n, V), 0.0);
  float fresnel = 0.03 + 0.55 * pow(1.0 - facing, 5.0);
  vec3 col = mix(uDeep, uShallow, smoothstep(0.3, 1.0, edge) * 0.7 + (h0 - 0.5) * 0.25);
  col *= 0.72 + 0.38 * max(dot(n, uSunDir), 0.0);
  col = mix(col, uSky, fresnel);
  vec3 H = normalize(uSunDir + V);
  float nh = max(dot(n, H), 0.0);
  col += uSunColor * (pow(nh, 220.0) * 2.4 + pow(nh, 28.0) * 0.12);
  col += vec3(0.05, 0.22, 0.2) * uGlow * (0.6 + h0);

  float foam;
  float alpha;
  if (uFall > 0.5) {
    float flowBend = sin(vUv.x * 1.65 - uTime * 0.8 + across * 3.0) * 0.55;
    float streakField = fbm(vec2(across * 8.5 + flowBend, vUv.x * 2.1 - uTime * speed * 1.35));
    float streak = smoothstep(0.38, 0.73, streakField);
    float lip = 1.0 - smoothstep(0.0, 0.18, along);
    float spray = smoothstep(0.55, 1.0, along);
    float raggedEdge = fbm(vec2(across * 5.0, along * 8.0 - uTime * 0.22));
    float edgeFade = 1.0 - smoothstep(0.8, 1.04, edge + (raggedEdge - 0.5) * 0.16);
    foam = clamp(streak * 0.72 + lip * 0.58 + spray * 0.55 + smoothstep(0.7, 1.0, edge) * 0.36, 0.0, 1.0);
    alpha = (0.78 + foam * 0.2) * (1.0 - smoothstep(0.76, 1.0, along)) * edgeFade;
  } else {
    float bank = smoothstep(0.62, 0.95, edge) * smoothstep(0.42, 0.68, fbm(q * 2.2 + 4.0));
    float lines = smoothstep(0.6, 0.82, noise(vec2(q.x * 0.55, across * 7.0))) * 0.22;
    float drop = smoothstep(0.9, 1.0, along) * smoothstep(0.4, 0.7, fbm(q * 3.0));
    foam = clamp(bank * 0.45 + lines * 0.45 + drop * 0.8, 0.0, 1.0);
    alpha = 0.9 - smoothstep(0.78, 1.0, edge) * 0.55;
  }
  col = mix(col, uFoam, foam * (uFall > 0.5 ? 0.8 : 0.6));
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createWaterMaterial(timeUniform, { fall = false, speed = 0.35, length = 1 } = {}) {
  waterUniforms.uTime = timeUniform;
  return new THREE.ShaderMaterial({
    uniforms: {
      ...waterUniforms,
      uSpeed: { value: speed },
      uFall: { value: fall ? 1 : 0 },
      uLength: { value: length },
    },
    vertexShader: waterVertex,
    fragmentShader: waterFragment,
    transparent: true,
    side: THREE.DoubleSide,
  });
}

// Ribbon along a curve with UVs in world units (u = distance travelled, v = across),
// plus per-vertex flow and side vectors so the shader can tilt normals along the current.
export function makeWaterRibbon(curve, segments, halfWidthAt, yAt, fall = null) {
  const positions = [];
  const normals = [];
  const flows = [];
  const sides = [];
  const uvs = [];
  const indices = [];
  const lengths = curve.getLengths(segments);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = curve.getPoint(t);
    const tangent = curve.getTangent(t);
    const halfWidth = halfWidthAt(t);
    let side;
    let normal;
    let y = point.y;
    if (fall) {
      side = fall.side;
      normal = fall.outward;
    } else {
      tangent.y = 0;
      tangent.normalize();
      side = new THREE.Vector3(tangent.z, 0, -tangent.x);
      normal = new THREE.Vector3(0, 1, 0);
      y = yAt(t, point);
    }
    for (const sign of [-1, 1]) {
      positions.push(point.x + side.x * halfWidth * sign, y + side.y * halfWidth * sign, point.z + side.z * halfWidth * sign);
      normals.push(normal.x, normal.y, normal.z);
      flows.push(tangent.x, tangent.y, tangent.z);
      sides.push(side.x, side.y, side.z);
      uvs.push(lengths[i], sign < 0 ? 0 : 1);
    }
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("aFlow", new THREE.Float32BufferAttribute(flows, 3));
  geometry.setAttribute("aSide", new THREE.Float32BufferAttribute(sides, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return { geometry, length: lengths[segments] };
}

// Spray and mist where the falls break apart in the air below the island.
export function createSpray(curve, { side, outward }, timeUniform, count = 80) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const start = curve.getPoint(0.55 + Math.random() * 0.4);
    const across = (Math.random() - 0.5) * 0.24;
    positions[i * 3] = start.x + side.x * across;
    positions[i * 3 + 1] = start.y;
    positions[i * 3 + 2] = start.z + side.z * across;
    seeds[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: timeUniform,
      uScale: { value: 60 },
      uOpacity: { value: 0.7 },
      uOutward: { value: outward.clone() },
      uSide: { value: side.clone() },
      uColor: { value: new THREE.Color(0xe8f4ef) },
    },
    vertexShader: `uniform float uTime;
uniform float uScale;
uniform vec3 uOutward;
uniform vec3 uSide;
attribute float aSeed;
varying float vAlpha;
void main() {
  float cycle = fract(uTime * (0.45 + 0.4 * fract(aSeed * 7.3)) + aSeed * 5.1);
  vec3 p = position;
  p += uOutward * cycle * (0.08 + 0.2 * fract(aSeed * 3.3));
  p += uSide * (fract(aSeed * 11.7) - 0.5) * 0.35 * cycle;
  p.y -= cycle * (0.35 + 0.5 * fract(aSeed * 5.9)) + cycle * cycle * 0.25;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uScale * (0.35 + cycle * 1.6) * (0.6 + fract(aSeed * 13.1)) / -mv.z;
  gl_Position = projectionMatrix * mv;
  vAlpha = smoothstep(0.0, 0.12, cycle) * (1.0 - cycle);
}`,
    fragmentShader: `uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = 1.0 - smoothstep(0.0, 1.0, d);
  gl_FragColor = vec4(uColor, a * a * vAlpha * uOpacity);
}`,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.name = "waterfall spray";
  return points;
}
