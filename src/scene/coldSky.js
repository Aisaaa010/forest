import * as THREE from "three";

// Shared sky language for the alpine and polar islands. The same GLSL is used
// by the sky dome and by the ice reflection pass so the lake reflects the same
// stars, horizon and aurora that are visible above it.
export const COLD_SKY_GLSL = /* glsl */ `
uniform float uTime;
uniform float uPolar;
uniform float uStars;
uniform float uMilky;
uniform float uAurora;
uniform float uWarm;
uniform float uOvercast;
uniform float uSunGlow;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uZenith;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uAuroraLow;
uniform vec3 uAuroraMid;
uniform vec3 uAuroraHigh;

float skyHash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
float skyHash2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float skyNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(skyHash2(i), skyHash2(i + vec2(1.0, 0.0)), f.x),
             mix(skyHash2(i + vec2(0.0, 1.0)), skyHash2(i + vec2(1.0, 1.0)), f.x), f.y);
}
float skyFbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += skyNoise(p) * a;
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return v;
}
float skyStars(vec3 dir, float scale, float threshold) {
  vec3 p = dir * scale;
  vec3 cell = floor(p);
  float h = skyHash(cell);
  if (h < threshold) return 0.0;
  vec3 offset = vec3(skyHash(cell + vec3(1.3, 0.0, 0.0)),
                     skyHash(cell + vec3(0.0, 2.7, 0.0)),
                     skyHash(cell + vec3(0.0, 0.0, 4.1)));
  float d = length(fract(p) - offset);
  float core = smoothstep(0.28, 0.0, d);
  float twinkle = 0.74 + 0.26 * sin(uTime * (0.6 + h * 2.4) + h * 70.0);
  return core * twinkle * (0.25 + 2.2 * pow((h - threshold) / (1.0 - threshold), 2.0));
}
vec3 coldAurora(vec3 dir) {
  float el = asin(clamp(dir.y, -1.0, 1.0));
  float az = atan(dir.x, -dir.z);
  vec3 sum = vec3(0.0);
  for (int k = 0; k < 3; k++) {
    float kf = float(k);
    float shift = 0.28 * sin(uTime * 0.021 + kf * 2.1);
    float base = 0.105 + 0.055 * kf + 0.06 * sin(az * 1.9 + kf * 1.7 + uTime * 0.035)
               + 0.035 * sin(az * 4.7 - uTime * 0.06 + kf * 2.3)
               + 0.02 * sin(az * 9.1 + uTime * 0.05);
    float u = el - base;
    float a2 = az - shift;
    float env = smoothstep(-1.7, -0.35, a2) * (1.0 - smoothstep(0.25, 1.55, a2));
    float w = az + 0.012 * sin(el * 5.0 + uTime * 0.12 + kf * 3.0);
    float r = skyNoise(vec2(w * 31.0 + uTime * 0.22 + kf * 9.0, 2.1)) * 0.55
            + skyNoise(vec2(w * 83.0 - uTime * 0.37 + kf * 3.0, 5.3)) * 0.45;
    float rays = pow(clamp(r * 1.3, 0.0, 1.0), 2.0) * 2.1;
    float sheet = 0.25 + 0.75 * smoothstep(0.25, 0.8, skyNoise(vec2(az * 2.6 + uTime * 0.07 + kf * 5.0, 8.0)));
    float bottom = smoothstep(-0.01, 0.018, u);
    float fall = exp(-max(u, 0.0) * 11.0);
    float intensity = bottom * fall * mix(1.0, rays, 0.8) * sheet * env;
    intensity += exp(-pow((u - 0.012) * 55.0, 2.0)) * 0.85 * env * (0.5 + 0.5 * sheet);
    intensity += exp(-max(u, 0.0) * 2.6) * 0.018 * env * bottom;
    float surge = 0.62 + 0.5 * skyNoise(vec2(uTime * 0.06 + kf * 7.3, 1.0)) + 0.18 * sin(uTime * 0.31 + kf);
    vec3 color = mix(uAuroraLow, uAuroraMid, smoothstep(0.0, 0.06, u));
    color = mix(color, uAuroraHigh, smoothstep(0.24, 0.5, u));
    sum += color * intensity * (1.0 - 0.2 * kf) * surge;
  }
  return sum * 0.8 * uAurora * smoothstep(-0.02, 0.05, el);
}
vec3 coldSkyColor(vec3 dir) {
  dir = normalize(dir);
  float el = asin(clamp(dir.y, -1.0, 1.0));
  float az = atan(dir.x, -dir.z);
  float e = max(el, 0.0);
  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.32, e));
  col = mix(col, uZenith, smoothstep(0.28, 1.1, e));

  // Cloud deck: thin dawn wisps, a heavy rain ceiling, pale snow cloud, or a
  // dark polar sky depending on the theme uniforms.
  float cloudField = skyFbm(vec2(az * 1.7 + uTime * 0.004, el * 5.0));
  float cloudDetail = skyFbm(vec2(az * 4.2, el * 7.0 + cloudField * 2.0) + uTime * 0.006);
  float cloudMask = smoothstep(0.34, 0.68, cloudField * 0.7 + cloudDetail * 0.3)
                  * smoothstep(-0.03, 0.14, el) * (1.0 - smoothstep(0.55, 0.95, el));
  vec3 cloudColor = mix(uMid, uHorizon, 0.62) + uWarm * vec3(0.06, 0.035, 0.02);
  col = mix(col, cloudColor, cloudMask * uOvercast * 0.72);

  float sun = max(dot(dir, normalize(uSunDir)), 0.0);
  col += uSunColor * (pow(sun, 320.0) * 2.6 + pow(sun, 24.0) * 0.12) * uSunGlow;

  // A low, soft aurora airglow. The sculpted curtains are separate meshes so
  // they keep parallax, but the sky still carries their colour.
  float glowBand = exp(-pow((el - 0.28) / 0.25, 2.0));
  float glowFold = 0.55 + 0.45 * skyNoise(vec2(az * 2.2 + uTime * 0.008, 3.0));
  vec3 airglow = mix(uAuroraLow, uAuroraMid, 0.45);
  airglow = mix(airglow, uAuroraHigh, smoothstep(0.3, 0.9, e));
  col += airglow * glowBand * glowFold * 0.042 * uAurora;

  // Milky Way only in the polar scene.
  vec3 mw = normalize(vec3(0.4, 0.75, -0.35));
  float band = exp(-pow(dot(dir, mw), 2.0) * 18.0);
  float dust = skyFbm(dir.xz * 5.0 + dir.y * 3.0 + 4.0);
  col += band * (0.15 + dust * 0.85) * vec3(0.22, 0.3, 0.56) * 0.18 * uStars * uMilky;

  float star = skyStars(dir, 150.0, 0.985) * 1.45
             + skyStars(dir, 340.0, 0.965) * 0.66
             + skyStars(dir, 680.0, 0.93) * 0.26;
  vec3 starColor = mix(vec3(0.74, 0.86, 1.0), vec3(1.0, 0.92, 0.78),
                       skyHash(floor(dir * 150.0) + 9.0));
  col += star * starColor * smoothstep(0.0, 0.18, el) * 1.9 * uStars;

  col += coldAurora(dir);

  // A warm, low horizon for the alpine dusk; no pink aurora fringe.
  col += vec3(0.13, 0.075, 0.045) * uWarm * smoothstep(0.1, -0.1, el) * 0.3;

  // Distant ridge and a cloud sea at the bottom of the sky.
  float ridge = 1.0 - abs(skyFbm(vec2(az * 2.4, 1.7)) * 2.0 - 1.0);
  float horizon = 0.006 + 0.058 * ridge * ridge * ridge
                + 0.016 * skyFbm(vec2(az * 10.0, 4.0))
                + 0.012 * skyFbm(vec2(az * 0.9, 8.0));
  float cloudTop = 0.004 + 0.008 * skyFbm(vec2(az * 7.0, 2.0));
  if (el < horizon && el > cloudTop) {
    float rim = smoothstep(horizon - 0.022, horizon, el);
    vec3 mountain = mix(uHorizon * 0.74, vec3(0.008, 0.014, 0.032), uPolar);
    mountain += vec3(0.02, 0.08, 0.065) * uAurora * (0.3 + rim) * 0.3;
    mountain += vec3(0.05, 0.07, 0.11) * rim * rim
              * smoothstep(0.2, 0.9, skyFbm(vec2(az * 14.0, el * 60.0))) * 0.55;
    mountain = mix(mountain, uHorizon * 0.94, smoothstep(0.0, 0.05, horizon - el) * 0.3);
    col = mountain;
  }
  if (el < cloudTop) {
    vec2 p = dir.xz / max(-dir.y + 0.03, 0.03);
    float cloud = skyFbm(p * 0.55 + vec2(uTime * 0.004, 0.0));
    cloud = smoothstep(0.35, 0.7, cloud);
    vec3 cloudColor = mix(vec3(0.006, 0.014, 0.04), vec3(0.08, 0.13, 0.24), cloud);
    cloudColor += vec3(0.015, 0.09, 0.065) * uAurora * cloud * 0.7 * exp(-max(-dir.y, 0.0) * 3.0);
    float haze = exp(-max(-dir.y, 0.0) * 14.0);
    col = mix(cloudColor, uHorizon * 1.25 + airglow * 0.1, haze * 0.55);
  }
  return col;
}
`;

export function createColdSkyUniforms() {
  return {
    uTime: { value: 0 },
    uPolar: { value: 1 },
    uStars: { value: 1 },
    uMilky: { value: 1 },
    uAurora: { value: 1 },
    uWarm: { value: 0 },
    uOvercast: { value: 0.18 },
    uSunGlow: { value: 0 },
    uSunDir: { value: new THREE.Vector3(-0.45, 0.35, -0.82).normalize() },
    uSunColor: { value: new THREE.Color(0xffe2b0) },
    uZenith: { value: new THREE.Color(0x01040d) },
    uMid: { value: new THREE.Color(0x041424) },
    uHorizon: { value: new THREE.Color(0x0c2630) },
    uAuroraLow: { value: new THREE.Color(0x4bffd6) },
    uAuroraMid: { value: new THREE.Color(0x2fe7a4) },
    uAuroraHigh: { value: new THREE.Color(0x7c8dff) },
  };
}

export function createColdSky() {
  const uniforms = createColdSkyUniforms();
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `${COLD_SKY_GLSL}
varying vec3 vDir;
void main() {
  gl_FragColor = vec4(coldSkyColor(normalize(vDir)), 1.0);
  #include <colorspace_fragment>
}`,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(52, 48, 24), material);
  mesh.name = "cold sky";
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return {
    mesh,
    uniforms,
    setTheme(scene, phase, weather) {
      const polar = scene === "aurora";
      const morning = phase === "morning";
      const afternoon = phase === "afternoon";
      const night = phase === "night";
      const rainy = weather === "rain" || scene === "rain";
      const snowy = weather === "snow" || scene === "snow";
      const alpine = scene === "alpine";
      uniforms.uPolar.value = polar ? 1 : 0;
      uniforms.uAurora.value = polar ? 1 : 0;
      uniforms.uMilky.value = polar ? 1 : night && scene === "night" ? 0.55 : 0;
      uniforms.uStars.value = polar ? 1 : scene === "night" ? 0.9 : alpine && night ? 0.55 : morning ? 0.05 : 0;
      uniforms.uWarm.value = polar ? 0 : alpine && afternoon ? 0.9 : morning ? 0.25 : 0;
      uniforms.uOvercast.value = rainy ? 0.95 : snowy ? 0.88 : night ? 0.24 : morning ? 0.3 : 0.18;
      uniforms.uSunGlow.value = rainy || snowy || polar ? 0 : night ? 0.2 : morning ? 0.8 : alpine && afternoon ? 0.85 : 0.12;
      uniforms.uSunColor.value.setHex(night ? 0xbdd8ff : 0xffe0b2);
      uniforms.uSunDir.value.set(night ? -0.5 : -0.35, night ? 0.42 : 0.28, night ? -0.7 : -0.88).normalize();
      uniforms.uAuroraLow.value.setHex(0x4bffd6);
      uniforms.uAuroraMid.value.setHex(0x2fe7a4);
      uniforms.uAuroraHigh.value.setHex(0x7c8dff);
      if (polar) {
        uniforms.uZenith.value.setHex(0x01040d);
        uniforms.uMid.value.setHex(0x031226);
        uniforms.uHorizon.value.setHex(0x071d27);
      } else if (alpine) {
        if (morning) {
          uniforms.uZenith.value.setHex(0x020b1a);
          uniforms.uMid.value.setHex(0x09213a);
          uniforms.uHorizon.value.setHex(0x284b5b);
        } else if (night) {
          uniforms.uZenith.value.setHex(0x020814);
          uniforms.uMid.value.setHex(0x061727);
          uniforms.uHorizon.value.setHex(0x142d38);
        } else {
          uniforms.uZenith.value.setHex(0x061a32);
          uniforms.uMid.value.setHex(0x123552);
          uniforms.uHorizon.value.setHex(0x3d5662);
        }
      } else if (rainy) {
        uniforms.uZenith.value.setHex(0x425966);
        uniforms.uMid.value.setHex(0x6e8590);
        uniforms.uHorizon.value.setHex(0xa1b0b5);
        uniforms.uSunGlow.value = 0;
      } else if (snowy) {
        uniforms.uZenith.value.setHex(0x687d88);
        uniforms.uMid.value.setHex(0x97aab4);
        uniforms.uHorizon.value.setHex(0xc6d3da);
        uniforms.uSunGlow.value = 0;
      } else if (night || scene === "night") {
        uniforms.uZenith.value.setHex(0x010712);
        uniforms.uMid.value.setHex(0x051a24);
        uniforms.uHorizon.value.setHex(0x0a2a33);
      } else {
        uniforms.uZenith.value.setHex(0x6b94ab);
        uniforms.uMid.value.setHex(0xaec4c8);
        uniforms.uHorizon.value.setHex(0xf1ddc0);
      }
    },
    setMode(mode, phase) {
      this.setTheme(mode, phase, "snow");
    },
  };
}
