import * as THREE from "three";

// A few small, low-poly birds crossing above the canopy. They are deliberately
// sparse: the scene already has butterflies and fireflies, so the birds read as
// occasional life rather than another particle system.
export function createBirds(count = 3) {
  const group = new THREE.Group();
  group.name = "birds";
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x4c4f43, roughness: 0.78 });
  const headMaterial = new THREE.MeshStandardMaterial({ color: 0x55594b, roughness: 0.72 });
  const wingMaterial = new THREE.MeshStandardMaterial({ color: 0x65705d, roughness: 0.68, side: THREE.DoubleSide });
  const beakMaterial = new THREE.MeshStandardMaterial({ color: 0xc49a5a, roughness: 0.5 });
  const birds = [];

  const bodyGeometry = new THREE.SphereGeometry(0.034, 8, 6).scale(1, 0.7, 1.9);
  const headGeometry = new THREE.SphereGeometry(0.021, 8, 6);
  const beakGeometry = new THREE.ConeGeometry(0.009, 0.034, 5).rotateX(Math.PI / 2);
  const tailGeometry = new THREE.ConeGeometry(0.026, 0.065, 5).rotateX(-Math.PI / 2).scale(1, 1, 0.55);
  // A swept, tapered wing reads as a bird far better than a rectangular card.
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0.018);
  wingShape.lineTo(0.22, 0.05);
  wingShape.lineTo(0.19, -0.012);
  wingShape.lineTo(0.03, -0.032);
  wingShape.closePath();
  const wingGeometry = new THREE.ShapeGeometry(wingShape, 2).rotateX(-Math.PI / 2);

  for (let i = 0; i < count; i++) {
    const bird = new THREE.Group();
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bird.add(body);
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 0.008, 0.057);
    bird.add(head);
    const beak = new THREE.Mesh(beakGeometry, beakMaterial);
    beak.position.set(0, 0.006, 0.087);
    bird.add(beak);
    const tail = new THREE.Mesh(tailGeometry, bodyMaterial);
    tail.position.set(0, 0.005, -0.068);
    bird.add(tail);

    const wings = [];
    for (const side of [-1, 1]) {
      const hinge = new THREE.Group();
      hinge.position.set(side * 0.012, 0.01, 0);
      const wing = new THREE.Mesh(wingGeometry, wingMaterial);
      wing.scale.x = side;
      hinge.add(wing);
      bird.add(hinge);
      wings.push({ hinge, side });
    }

    bird.userData = {
      phase: i * 2.15 + 0.4,
      radius: 3.55 + i * 0.4,
      height: 3.15 + i * 0.22,
      speed: 0.11 + i * 0.016,
      wings,
    };
    bird.scale.setScalar(1.0 + i * 0.05);
    bird.rotation.y = -bird.userData.phase;
    group.add(bird);
    birds.push(bird);
  }

  function update(delta, time) {
    for (const bird of birds) {
      const data = bird.userData;
      const angle = data.phase + time * data.speed;
      const x = Math.cos(angle) * data.radius;
      const z = Math.sin(angle) * data.radius * 0.72;
      const y = data.height + Math.sin(time * 0.72 + data.phase) * 0.18;
      bird.position.set(x, y, z);
      bird.rotation.set(
        Math.sin(time * 0.55 + data.phase) * 0.05,
        Math.atan2(-Math.sin(angle), Math.cos(angle) * 0.72),
        Math.sin(time * 0.9 + data.phase) * 0.08,
      );
      const flap = Math.sin(time * 9.5 + data.phase) * 0.72;
      for (const { hinge, side } of data.wings) {
        hinge.rotation.z = side * (0.12 + flap * 0.65);
        hinge.rotation.x = Math.sin(time * 7.5 + data.phase) * 0.08;
      }
    }
  }

  update(0, 0);
  return { group, update };
}
