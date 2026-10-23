import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const { smoothstep, lerp } = THREE.MathUtils;

// Wing outlines in a 256x256 canvas: x grows away from the body, y grows toward the head.
// Forewing reaches forward to a rounded apex; hindwing rounds off behind.
function wingPath(c, tails) {
  c.beginPath();
  c.moveTo(4, 132);
  c.bezierCurveTo(30, 175, 110, 236, 196, 250);
  c.bezierCurveTo(240, 254, 254, 236, 244, 210);
  c.bezierCurveTo(232, 178, 196, 150, 150, 132);
  c.bezierCurveTo(200, 118, 222, 92, 214, 62);
  if (tails) {
    c.bezierCurveTo(206, 40, 182, 30, 168, 26);
    c.lineTo(158, 2);
    c.lineTo(146, 22);
  }
  c.bezierCurveTo(120, 14, 60, 36, 4, 120);
  c.closePath();
}

function veins(c, color, width) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = "round";
  const root = [6, 128];
  for (const [x, y, cx, cy] of [
    [236, 226, 120, 190], [200, 246, 100, 200], [150, 234, 70, 190], [244, 196, 140, 170],
    [210, 70, 120, 104], [190, 40, 110, 80], [140, 26, 80, 70], [100, 34, 50, 80], [214, 104, 130, 112],
  ]) {
    c.beginPath();
    c.moveTo(root[0], root[1]);
    c.quadraticCurveTo(cx, cy, x, y);
    c.stroke();
  }
}

function dots(c, color, radius, points) {
  c.fillStyle = color;
  for (const [x, y, r = 1] of points) {
    c.beginPath();
    c.arc(x, y, radius * r, 0, Math.PI * 2);
    c.fill();
  }
}

// Each painter fills the clipped wing; the outline is stroked afterwards.
export const SPECIES = [
  {
    name: "monarch",
    paint(c) {
      const g = c.createLinearGradient(0, 128, 250, 128);
      g.addColorStop(0, "#c24a0c");
      g.addColorStop(0.5, "#f08a1c");
      g.addColorStop(1, "#f5a53a");
      c.fillStyle = g;
      c.fillRect(0, 0, 256, 256);
      veins(c, "#1d120c", 5);
      c.lineWidth = 22;
      c.strokeStyle = "#1d120c";
      wingPath(c, false);
      c.stroke();
      dots(c, "#fbf2df", 4, [[236, 214], [222, 238], [200, 248, 0.8], [244, 190, 0.9], [208, 60, 0.9], [196, 40], [176, 30, 0.8], [214, 84, 0.7], [226, 206, 0.6]]);
      dots(c, "#f6b25a", 4, [[180, 46, 0.8], [196, 74, 0.7]]);
    },
  },
  {
    name: "morpho",
    paint(c) {
      const g = c.createRadialGradient(40, 128, 10, 60, 128, 230);
      g.addColorStop(0, "#9fe4ff");
      g.addColorStop(0.45, "#2e8fe0");
      g.addColorStop(0.85, "#14327a");
      g.addColorStop(1, "#0b1530");
      c.fillStyle = g;
      c.fillRect(0, 0, 256, 256);
      veins(c, "rgba(10,25,60,0.55)", 2.5);
      c.lineWidth = 18;
      c.strokeStyle = "#0b1226";
      wingPath(c, false);
      c.stroke();
      dots(c, "#e8f6ff", 3, [[226, 222], [208, 240], [234, 200, 0.8], [200, 56], [186, 38, 0.8]]);
    },
    iridescence: 0.6,
  },
  {
    name: "cabbage white",
    paint(c) {
      c.fillStyle = "#f6f3e6";
      c.fillRect(0, 0, 256, 256);
      const g = c.createLinearGradient(0, 128, 90, 128);
      g.addColorStop(0, "rgba(120,130,110,0.6)");
      g.addColorStop(1, "rgba(120,130,110,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, 90, 256);
      veins(c, "rgba(150,150,130,0.35)", 1.5);
      c.fillStyle = "#3a3a36";
      c.beginPath();
      c.ellipse(212, 50, 40, 26, -0.5, 0, Math.PI * 2);
      c.fill();
      dots(c, "#3a3a36", 9, [[168, 196], [150, 170, 0.8]]);
    },
  },
  {
    name: "swallowtail",
    tails: true,
    paint(c) {
      c.fillStyle = "#f5d75a";
      c.fillRect(0, 0, 256, 256);
      c.fillStyle = "#1e1a14";
      for (const [x, w] of [[60, 14], [110, 18], [158, 16]]) {
        c.save();
        c.translate(x, 0);
        c.rotate(-0.25);
        c.fillRect(-w / 2, -20, w, 140);
        c.restore();
      }
      veins(c, "#1e1a14", 3);
      c.lineWidth = 26;
      c.strokeStyle = "#1e1a14";
      wingPath(c, true);
      c.stroke();
      dots(c, "#f7e07a", 5, [[226, 220], [208, 238], [186, 246, 0.8], [238, 198]]);
      dots(c, "#3d7bd6", 6, [[176, 214, 0.9], [196, 226, 0.8]]);
      dots(c, "#e86a2a", 7, [[38, 168]]);
    },
  },
  {
    name: "sulphur",
    paint(c) {
      const g = c.createLinearGradient(0, 128, 250, 128);
      g.addColorStop(0, "#d6c048");
      g.addColorStop(1, "#fbe880");
      c.fillStyle = g;
      c.fillRect(0, 0, 256, 256);
      veins(c, "rgba(150,120,30,0.35)", 1.5);
      c.lineWidth = 6;
      c.strokeStyle = "#d48a2a";
      wingPath(c, false);
      c.stroke();
      dots(c, "#b8691e", 6, [[150, 80, 0.7], [140, 184, 0.9]]);
    },
  },
];

function paintWing(species) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d");
  c.save();
  wingPath(c, species.tails);
  c.clip();
  species.paint(c);
  // Scale texture: a faint sheen band and fine speckle so wings are not flat colour.
  const sheen = c.createLinearGradient(0, 0, 256, 256);
  sheen.addColorStop(0.3, "rgba(255,255,255,0)");
  sheen.addColorStop(0.5, "rgba(255,255,255,0.12)");
  sheen.addColorStop(0.7, "rgba(255,255,255,0)");
  c.fillStyle = sheen;
  c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    c.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
    c.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
  }
  c.restore();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Thin wing plane, hinged at the body (x = 0), lying flat in XZ before flapping.
function makeWingGeometry(span) {
  const geometry = new THREE.PlaneGeometry(span, span, 6, 6);
  geometry.translate(span / 2, 0, 0);
  // A slight camber keeps the wing from looking like paper.
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) / span;
    const y = positions.getY(i) / span;
    positions.setZ(i, Math.sin(x * Math.PI) * 0.06 * span * (0.5 + y * 0.5));
  }
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function makeBodyGeometry(length) {
  const furry = new THREE.Color(0x2a221c);
  const paint = (geometry, color) => {
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) colors.set([color.r, color.g, color.b], i * 3);
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.deleteAttribute("uv");
    return geometry.index ? geometry.toNonIndexed() : geometry;
  };
  const abdomen = new THREE.CapsuleGeometry(length * 0.08, length * 0.5, 4, 8).rotateX(Math.PI / 2).translate(0, 0, -length * 0.32);
  const thorax = new THREE.SphereGeometry(length * 0.12, 10, 8).scale(1, 0.95, 1.3);
  const head = new THREE.SphereGeometry(length * 0.085, 10, 8).translate(0, length * 0.01, length * 0.2);
  const parts = [paint(abdomen, furry), paint(thorax, furry.clone().multiplyScalar(1.2)), paint(head, furry)];
  for (const side of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * length * 0.03, length * 0.05, length * 0.26),
      new THREE.Vector3(side * length * 0.14, length * 0.22, length * 0.52),
      new THREE.Vector3(side * length * 0.22, length * 0.3, length * 0.7),
    ]);
    parts.push(paint(new THREE.TubeGeometry(curve, 8, length * 0.009, 3), furry));
    parts.push(paint(new THREE.SphereGeometry(length * 0.025, 6, 4).translate(side * length * 0.22, length * 0.3, length * 0.7), furry));
  }
  return mergeGeometries(parts);
}

// A handful of butterflies that wander over the meadow, glide, and stop to
// perch on blooms with slowly opening and closing wings.
export function createButterflies(count, { blooms, heightAt, bounds = [4.3, 3.1] }) {
  const group = new THREE.Group();
  group.name = "butterflies";
  const span = 0.13;
  const wingGeometry = makeWingGeometry(span);
  const bodyGeometry = makeBodyGeometry(span * 1.1);
  const bodyMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const wingMaterials = SPECIES.map((species) => new THREE.MeshPhysicalMaterial({
    map: paintWing(species),
    transparent: true,
    alphaTest: 0.4,
    side: THREE.DoubleSide,
    roughness: 0.55,
    sheen: 0.4,
    sheenColor: 0xffffff,
    iridescence: species.iridescence || 0,
    iridescenceIOR: 1.6,
  }));
  const target = new THREE.Vector3();
  const desired = new THREE.Vector3();

  const flock = Array.from({ length: count }, (_, i) => {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const speciesIndex = i % SPECIES.length;
    const torso = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.add(torso);
    const wings = [-1, 1].map((side) => {
      const hinge = new THREE.Group();
      const wing = new THREE.Mesh(wingGeometry, wingMaterials[speciesIndex]);
      wing.scale.x = side;
      wing.castShadow = true;
      hinge.add(wing);
      body.add(hinge);
      return { hinge, side };
    });
    root.scale.setScalar(0.85 + Math.random() * 0.35);
    group.add(root);
    const bloom = blooms[Math.floor(Math.random() * blooms.length)];
    root.position.copy(bloom || new THREE.Vector3(0, 0.6, 0));
    return {
      root, body, wings,
      velocity: new THREE.Vector3(),
      target: new THREE.Vector3().copy(root.position),
      mode: "perch",
      timer: 1 + Math.random() * 5,
      phase: Math.random() * Math.PI * 2,
      yaw: Math.random() * Math.PI * 2,
      wander: Math.random() * 100,
      openness: 0.5,
    };
  });

  function pickTarget(b) {
    if (blooms.length && Math.random() < 0.7) {
      b.target.copy(blooms[Math.floor(Math.random() * blooms.length)]);
      b.goal = "bloom";
    } else {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.85;
      const x = Math.cos(angle) * bounds[0] * r;
      const z = Math.sin(angle) * bounds[1] * r;
      b.target.set(x, heightAt(x, z) + 0.45 + Math.random() * 0.9, z);
      b.goal = "air";
    }
  }

  function update(delta, time, { wind = 1 } = {}) {
    flock.forEach((b) => {
      b.timer -= delta;
      let flap;
      if (b.mode === "perch") {
        // Resting wings fold up and open slowly, like a butterfly sunning itself.
        b.openness = lerp(b.openness, 0.5 + 0.5 * Math.sin(time * 0.9 + b.phase), 1 - Math.exp(-delta * 3));
        flap = lerp(1.35, 0.25, b.openness);
        b.root.position.copy(b.target).y += 0.005;
        if (b.timer <= 0) {
          b.mode = "fly";
          pickTarget(b);
          b.velocity.set(0, 0.6, 0);
        }
      } else {
        desired.copy(b.target).sub(b.root.position);
        const distance = desired.length();
        const t = time + b.wander;
        // Erratic, fluttering path: the steering target wobbles in all three axes.
        desired.normalize().multiplyScalar(Math.min(0.75, 0.25 + distance * 0.6));
        desired.x += Math.sin(t * 2.3) * 0.35 + Math.sin(t * 5.1) * 0.12 + 0.05 * wind;
        desired.z += Math.cos(t * 1.9) * 0.35;
        desired.y += Math.sin(t * 3.7) * 0.22;
        b.velocity.lerp(desired, 1 - Math.exp(-delta * 2.5));
        b.root.position.addScaledVector(b.velocity, delta);
        const ground = heightAt(b.root.position.x, b.root.position.z) + 0.12;
        if (b.root.position.y < ground) b.root.position.y = ground;
        if (Math.hypot(b.root.position.x / bounds[0], b.root.position.z / bounds[1]) > 1) pickTarget(b);
        // Beat fast, with occasional short glides.
        const glide = smoothstep(Math.sin(t * 0.8), 0.75, 0.95);
        b.phase += delta * lerp(15, 1.5, glide);
        flap = lerp(0.45 + Math.sin(b.phase) * 0.85, 0.2, glide);
        b.body.position.y = Math.sin(b.phase) * -0.008;
        if (b.goal === "bloom" && distance < 0.06) {
          b.mode = "perch";
          b.timer = 3 + Math.random() * 5;
          b.root.position.copy(b.target);
        } else if (b.goal === "air" && distance < 0.15) {
          pickTarget(b);
        }
        b.yaw = Math.atan2(b.velocity.x, b.velocity.z);
      }
      // Turn the short way round so heading never spins through a full circle.
      const turn = Math.atan2(Math.sin(b.yaw - b.root.rotation.y), Math.cos(b.yaw - b.root.rotation.y));
      b.root.rotation.y += turn * (1 - Math.exp(-delta * 6));
      b.body.rotation.x = b.mode === "fly" ? -0.25 : -0.05;
      for (const { hinge, side } of b.wings) hinge.rotation.z = side * flap;
    });
  }

  function attract(position) {
    if (!blooms.length || !flock.length) return;
    const destination = blooms.reduce((nearest, bloom) =>
      bloom.distanceToSquared(position) < nearest.distanceToSquared(position) ? bloom : nearest,
    blooms[0]);
    const visitors = [...flock]
      .sort((a, b) => a.root.position.distanceToSquared(destination) - b.root.position.distanceToSquared(destination))
      .slice(0, Math.min(2, flock.length));
    visitors.forEach((butterfly, index) => {
      butterfly.mode = "fly";
      butterfly.goal = "bloom";
      butterfly.timer = 9;
      butterfly.target.copy(destination).add(new THREE.Vector3(index ? 0.075 : -0.075, 0.025, index ? -0.045 : 0.045));
      butterfly.velocity.y = Math.max(0.25, butterfly.velocity.y);
    });
  }

  update(0, 0);
  return { group, update, attract };
}
