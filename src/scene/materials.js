import * as THREE from "three";

// Uniforms shared by every enhanced material, so one update per frame drives
// wind, rim light, translucency and snow cover across the whole island.
export const sceneUniforms = {
  uTime: { value: 0 },
  uWind: { value: 1 },
  uRimColor: { value: new THREE.Color(0xffe2b0) },
  uRimStrength: { value: 0.45 },
  uSnow: { value: 0 },
  // Sun direction in view space, refreshed per frame for leaf translucency.
  uSunView: { value: new THREE.Vector3(0, 1, 0) },
  uTranslucent: { value: new THREE.Color(0xd9e88a) },
};

const glslNumber = (value) => (Number.isInteger(value) ? `${value}.0` : `${value}`);

// The same canopy wave drives inner crowns and the leaves on them, so they move as one.
const CANOPY_WAVE = `float canopyWave(vec3 p) {
  return (sin(uTime * 2.3 + p.x * 6.0 + p.y * 4.0) * cos(uTime * 1.7 + p.z * 5.0 - p.y * 3.0)) * 0.7
    + sin(uTime * 7.0 + dot(p, vec3(23.0, 17.0, 31.0))) * 0.3;
}`;

// Extends a built-in material with optional effects:
// - rim: soft Fresnel edge light.
// - wind: bends vertices by local height squared (grass, flowers).
// - rustle: canopy wave along normals (inner crowns, matching `canopy` leaves).
// - flutter: each instanced leaf tips about its stalk.
// - canopy: instanced leaves shade with a shared crown normal (aCrownNormal) and
//   ride the canopy wave, so a crown lights and moves as one volume.
// - translucency: sunlight glows through thin leaves seen against the light.
// - hang: world-space pendulum swing driven by aSway (0 at anchor, 1 at tip).
// - frost: whole-surface pale tint as uSnow rises (grass blades).
// - snow: snow settles on upward-facing surfaces with a broken, drifted edge.
export function enhanceMaterial(material, options = {}) {
  const { rim = 0, wind = 0, rustle = 0, frost = 0, flutter = 0, translucency = 0, hang = 0, canopy = 0, snow = 0 } = options;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, sceneUniforms);
    const vertexHead = ["uniform float uTime;", "uniform float uWind;", CANOPY_WAVE];
    const fragmentHead = ["uniform float uSnow;"];
    let beginVertex = "";
    let projectExtra = "";
    let normalExtra = "";
    let colorExtra = "";
    let lightExtra = "";

    if (rustle) {
      beginVertex += `
  vec3 rustleWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
  transformed += objectNormal * canopyWave(rustleWorld) * ${glslNumber(rustle)} * uWind;`;
    }
    if (wind) {
      beginVertex += `
#ifdef USE_INSTANCING
  vec3 windOrigin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#else
  vec3 windOrigin = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#endif
  float windBend = max(transformed.y, 0.0) * max(transformed.y, 0.0) * ${glslNumber(wind)} * uWind;
  float gust = 0.65 + 0.35 * sin(uTime * 0.6 + windOrigin.x * 0.35);
  transformed.x += sin(uTime * 1.7 + windOrigin.x * 1.3 + windOrigin.z * 0.7) * windBend * gust;
  transformed.z += cos(uTime * 1.3 + windOrigin.z * 1.1) * windBend * 0.6 * gust;`;
    }
    if (flutter) {
      beginVertex += `
#ifdef USE_INSTANCING
  vec3 leafOrigin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float leafPhase = dot(leafOrigin, vec3(12.9, 7.3, 9.7));
  float leafAmount = (sin(uTime * 4.2 + leafPhase) * 0.6 + sin(uTime * 9.5 + leafPhase * 1.7) * 0.4)
    * ${glslNumber(flutter)} * uWind * (0.55 + 0.45 * sin(uTime * 0.5 + leafOrigin.x));
  transformed.y += leafAmount * transformed.z;
  transformed.x += leafAmount * 0.5 * transformed.x * transformed.z;
#endif`;
    }
    if (canopy) {
      vertexHead.push("attribute vec3 aCrownNormal;", "varying vec3 vCrownNormal;");
      fragmentHead.push("varying vec3 vCrownNormal;");
      projectExtra += `
  // Ride the same canopy wave as the inner crown, along the crown normal.
  vec3 canopyWorld = (modelMatrix * mvPosition).xyz;
  mvPosition.xyz += aCrownNormal * canopyWave(canopyWorld) * ${glslNumber(canopy)} * uWind;
  vCrownNormal = normalize(normalMatrix * aCrownNormal);`;
      // Mostly crown normal, a little of the leaf's own facing for texture.
      normalExtra += `
  normal = normalize(mix(normal * sign(dot(normal, vCrownNormal) + 1e-4), vCrownNormal, 0.72));`;
    }
    if (hang) {
      vertexHead.push("attribute float aSway;");
      projectExtra += `
  float swayAmount = aSway * aSway * ${glslNumber(hang)} * uWind;
  float swayPhase = mvPosition.x * 1.7 + mvPosition.z * 1.3 + mvPosition.y * 2.2;
  float swayGust = 0.6 + 0.4 * sin(uTime * 0.37 + mvPosition.x * 0.4);
  mvPosition.x += (sin(uTime * 1.3 + swayPhase) + sin(uTime * 2.9 + swayPhase * 1.6) * 0.3) * swayAmount * swayGust;
  mvPosition.z += cos(uTime * 1.1 + swayPhase * 0.8) * swayAmount * 0.7 * swayGust;`;
    }
    if (snow) {
      vertexHead.push("varying vec3 vSnowWorld;");
      fragmentHead.push("varying vec3 vSnowWorld;");
      projectExtra += `
  vSnowWorld = (modelMatrix * mvPosition).xyz;`;
      // Snow is judged from the (crown) normal in world space, so it settles on top of
      // the whole canopy with a soft, broken edge rather than on each leaf separately.
      normalExtra += `
  vec3 snowUp = inverseTransformDirection(normal, viewMatrix);
  float snowBreak = sin(vSnowWorld.x * 21.0 + sin(vSnowWorld.z * 17.0)) * sin(vSnowWorld.z * 19.0 + vSnowWorld.y * 13.0);
  float snowCover = uSnow * ${glslNumber(snow)} * smoothstep(0.12, 0.62, snowUp.y + snowBreak * 0.16);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.93, 0.95), snowCover);
  roughnessFactor = mix(roughnessFactor, 0.85, snowCover);`;
    }
    if (frost) {
      colorExtra += `
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.82, 0.8) * (0.7 + 0.3 * dot(diffuseColor.rgb, vec3(1.2))), uSnow * ${glslNumber(frost)});`;
    }
    if (translucency) {
      fragmentHead.push("uniform vec3 uSunView;", "uniform vec3 uTranslucent;");
      lightExtra += `
  float backlit = pow(saturate(-dot(normalize(vViewPosition), uSunView) * 0.5 + 0.5), 4.0) * (0.4 + 0.6 * abs(dot(normal, uSunView)));
  outgoingLight += uTranslucent * diffuseColor.rgb * backlit * ${glslNumber(translucency)} * (1.0 - uSnow * 0.7);`;
    }
    if (rim) {
      fragmentHead.push("uniform vec3 uRimColor;", "uniform float uRimStrength;");
      lightExtra += `
  float rimFacing = 1.0 - saturate(dot(normal, normalize(vViewPosition)));
  outgoingLight += uRimColor * pow(rimFacing, 3.0) * uRimStrength * ${glslNumber(rim)} * (0.35 + 0.65 * diffuseColor.rgb);`;
    }

    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>\n${vertexHead.join("\n")}`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${fragmentHead.join("\n")}`);
    if (beginVertex) shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>${beginVertex}`);
    if (projectExtra) {
      shader.vertexShader = shader.vertexShader.replace("#include <project_vertex>", `vec4 mvPosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif${projectExtra}
  mvPosition = modelViewMatrix * mvPosition;
  gl_Position = projectionMatrix * mvPosition;`);
    }
    if (colorExtra) shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>${colorExtra}`);
    if (normalExtra) shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>${normalExtra}`);
    if (lightExtra) shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>", `${lightExtra}\n#include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `enhanced-${JSON.stringify(options)}`;
  return material;
}

// Soft additive motes that drift upward and loop; animation runs entirely on the GPU.
export function createPollen(count, { spreadX = 4.4, spreadZ = 3.1, color = 0xfff1c4 } = {}) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random());
    positions[i * 3] = Math.cos(angle) * radius * spreadX;
    positions[i * 3 + 1] = 0.25 + Math.random() * 0.5;
    positions[i * 3 + 2] = Math.sin(angle) * radius * spreadZ;
    seeds[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: sceneUniforms.uTime,
      uScale: { value: 60 },
      uOpacity: { value: 0.8 },
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: `uniform float uTime;
uniform float uScale;
attribute float aSeed;
varying float vAlpha;
void main() {
  vec3 p = position;
  float cycle = fract(uTime * (0.025 + 0.03 * fract(aSeed * 7.13)) + aSeed * 3.7);
  p.y += cycle * 2.4;
  p.x += sin(uTime * 0.31 + aSeed * 12.0) * 0.28;
  p.z += cos(uTime * 0.27 + aSeed * 9.0) * 0.24;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uScale * (0.55 + fract(aSeed * 13.7)) / -mv.z;
  gl_Position = projectionMatrix * mv;
  vAlpha = smoothstep(0.0, 0.18, cycle) * (1.0 - smoothstep(0.75, 1.0, cycle)) * (0.55 + 0.45 * sin(uTime * 1.4 + aSeed * 20.0));
}`,
    fragmentShader: `uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = 1.0 - smoothstep(0.0, 1.0, d);
  // Real alpha keeps the transparent canvas from compositing the quad as black.
  gl_FragColor = vec4(uColor, a * a * vAlpha * uOpacity);
}`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.name = "pollen";
  return points;
}
