import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Helper to ensure a BufferGeometry has a Float32Array 'color' attribute.
 */
function applyVertexColor(geom: THREE.BufferGeometry, hexColor: string): THREE.BufferGeometry {
  const c = new THREE.Color(hexColor);
  const count = geom.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geom;
}

// ============================================================================
// 1. TORSO GEOMETRIES (Standing & Seated)
// Single cylinder, tinted by player's color via instanceColor or material color.
// ============================================================================
let _standingTorsoGeometry: THREE.BufferGeometry | null = null;
export function getStandingTorsoGeometry(): THREE.BufferGeometry {
  if (!_standingTorsoGeometry) {
    const geom = new THREE.CylinderGeometry(0.23, 0.27, 0.4, 16);
    geom.translate(0, 0.26, 0);
    _standingTorsoGeometry = geom;
  }
  return _standingTorsoGeometry;
}

let _seatedTorsoGeometry: THREE.BufferGeometry | null = null;
export function getSeatedTorsoGeometry(): THREE.BufferGeometry {
  if (!_seatedTorsoGeometry) {
    const geom = new THREE.CylinderGeometry(0.23, 0.27, 0.4, 16);
    geom.translate(0, 0.24, -0.04);
    _seatedTorsoGeometry = geom;
  }
  return _seatedTorsoGeometry;
}

// ============================================================================
// 2. HEAD & LIMBS GEOMETRIES (Standing & Seated)
// Merged head, hair, eyes, bangs, arms, legs, shoes with Vertex Colors.
// Only 1 single material (vertexColors: true) needed for the entire head & limbs!
// ============================================================================
let _standingHeadLimbsGeometry: THREE.BufferGeometry | null = null;
export function getStandingHeadLimbsGeometry(): THREE.BufferGeometry {
  if (!_standingHeadLimbsGeometry) {
    const geoms: THREE.BufferGeometry[] = [];

    // 1. Head skin: sphere [0.35, 16, 14] at (0, 0.62, 0)
    const head = new THREE.SphereGeometry(0.35, 16, 14);
    head.translate(0, 0.62, 0);
    applyVertexColor(head, '#ffdcb8');
    geoms.push(head);

    // 2. Hair dome: sphere [0.37, 16, 14] at (0, 0.72, -0.02)
    const hair = new THREE.SphereGeometry(0.37, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.6);
    hair.translate(0, 0.72, -0.02);
    applyVertexColor(hair, '#18181b');
    geoms.push(hair);

    // 3. Bangs: box [0.34, 0.08, 0.12] at (0, 0.86, 0.27), rotX 0.3
    const bangs = new THREE.BoxGeometry(0.34, 0.08, 0.12);
    bangs.rotateX(0.3);
    bangs.translate(0, 0.86, 0.27);
    applyVertexColor(bangs, '#18181b');
    geoms.push(bangs);

    // 4. Eyes: spheres [0.045, 8, 8] at (-0.11, 0.64, 0.32) and (0.11, 0.64, 0.32)
    const eyeL = new THREE.SphereGeometry(0.045, 8, 8);
    eyeL.translate(-0.11, 0.64, 0.32);
    applyVertexColor(eyeL, '#09090b');
    geoms.push(eyeL);

    const eyeR = new THREE.SphereGeometry(0.045, 8, 8);
    eyeR.translate(0.11, 0.64, 0.32);
    applyVertexColor(eyeR, '#09090b');
    geoms.push(eyeR);

    // 5. Left Arm: cylinder [0.07, 0.07, 0.22, 8] + hand sphere [0.07, 8, 8] at (-0.3, 0.22, 0)
    const armL = new THREE.CylinderGeometry(0.07, 0.07, 0.22, 8);
    armL.translate(-0.3, 0.22, 0);
    applyVertexColor(armL, '#e4e4e7');
    geoms.push(armL);

    const handL = new THREE.SphereGeometry(0.07, 8, 8);
    handL.translate(-0.3, 0.08, 0);
    applyVertexColor(handL, '#ffdcb8');
    geoms.push(handL);

    // 6. Right Arm: cylinder + hand sphere at (0.3, 0.22, 0)
    const armR = new THREE.CylinderGeometry(0.07, 0.07, 0.22, 8);
    armR.translate(0.3, 0.22, 0);
    applyVertexColor(armR, '#e4e4e7');
    geoms.push(armR);

    const handR = new THREE.SphereGeometry(0.07, 8, 8);
    handR.translate(0.3, 0.08, 0);
    applyVertexColor(handR, '#ffdcb8');
    geoms.push(handR);

    // 7. Left Leg: cylinder [0.075, 0.075, 0.2, 8] at (-0.13, -0.06, 0) + shoe box [0.14, 0.08, 0.19]
    const legL = new THREE.CylinderGeometry(0.075, 0.075, 0.2, 8);
    legL.translate(-0.13, -0.06, 0);
    applyVertexColor(legL, '#27272a');
    geoms.push(legL);

    const shoeL = new THREE.BoxGeometry(0.14, 0.08, 0.19);
    shoeL.translate(-0.13, -0.17, 0.04);
    applyVertexColor(shoeL, '#09090b');
    geoms.push(shoeL);

    // 8. Right Leg: cylinder + shoe box
    const legR = new THREE.CylinderGeometry(0.075, 0.075, 0.2, 8);
    legR.translate(0.13, -0.06, 0);
    applyVertexColor(legR, '#27272a');
    geoms.push(legR);

    const shoeR = new THREE.BoxGeometry(0.14, 0.08, 0.19);
    shoeR.translate(0.13, -0.17, 0.04);
    applyVertexColor(shoeR, '#09090b');
    geoms.push(shoeR);

    _standingHeadLimbsGeometry = mergeGeometries(geoms, false);
    // Cleanup temporary sub-geometries
    geoms.forEach((g) => g.dispose());
  }
  return _standingHeadLimbsGeometry;
}

let _seatedHeadLimbsGeometry: THREE.BufferGeometry | null = null;
export function getSeatedHeadLimbsGeometry(): THREE.BufferGeometry {
  if (!_seatedHeadLimbsGeometry) {
    const geoms: THREE.BufferGeometry[] = [];

    // 1. Head skin: sphere [0.35, 16, 14] at (0, 0.60, -0.04)
    const head = new THREE.SphereGeometry(0.35, 16, 14);
    head.translate(0, 0.60, -0.04);
    applyVertexColor(head, '#ffdcb8');
    geoms.push(head);

    // 2. Hair dome
    const hair = new THREE.SphereGeometry(0.37, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.6);
    hair.translate(0, 0.70, -0.06);
    applyVertexColor(hair, '#18181b');
    geoms.push(hair);

    // 3. Bangs
    const bangs = new THREE.BoxGeometry(0.34, 0.08, 0.12);
    bangs.rotateX(0.3);
    bangs.translate(0, 0.84, 0.23);
    applyVertexColor(bangs, '#18181b');
    geoms.push(bangs);

    // 4. Eyes
    const eyeL = new THREE.SphereGeometry(0.045, 8, 8);
    eyeL.translate(-0.11, 0.62, 0.28);
    applyVertexColor(eyeL, '#09090b');
    geoms.push(eyeL);

    const eyeR = new THREE.SphereGeometry(0.045, 8, 8);
    eyeR.translate(0.11, 0.62, 0.28);
    applyVertexColor(eyeR, '#09090b');
    geoms.push(eyeR);

    // 5. Left Arm (resting forward)
    const armL = new THREE.CylinderGeometry(0.07, 0.07, 0.22, 8);
    armL.rotateX(-0.35);
    armL.translate(-0.3, 0.22, 0.06);
    applyVertexColor(armL, '#e4e4e7');
    geoms.push(armL);

    const handL = new THREE.SphereGeometry(0.07, 8, 8);
    handL.translate(-0.3, 0.12, 0.14);
    applyVertexColor(handL, '#ffdcb8');
    geoms.push(handL);

    // 6. Right Arm (resting forward)
    const armR = new THREE.CylinderGeometry(0.07, 0.07, 0.22, 8);
    armR.rotateX(-0.35);
    armR.translate(0.3, 0.22, 0.06);
    applyVertexColor(armR, '#e4e4e7');
    geoms.push(armR);

    const handR = new THREE.SphereGeometry(0.07, 8, 8);
    handR.translate(0.3, 0.12, 0.14);
    applyVertexColor(handR, '#ffdcb8');
    geoms.push(handR);

    // 7. Left Leg (seated: forward horizontal rotation)
    const legL = new THREE.CylinderGeometry(0.075, 0.075, 0.22, 8);
    legL.rotateX(-Math.PI / 2);
    legL.translate(-0.13, 0.12, 0.11);
    applyVertexColor(legL, '#27272a');
    geoms.push(legL);

    const shoeL = new THREE.BoxGeometry(0.14, 0.08, 0.19);
    shoeL.translate(-0.13, 0.08, 0.26);
    applyVertexColor(shoeL, '#09090b');
    geoms.push(shoeL);

    // 8. Right Leg (seated)
    const legR = new THREE.CylinderGeometry(0.075, 0.075, 0.22, 8);
    legR.rotateX(-Math.PI / 2);
    legR.translate(0.13, 0.12, 0.11);
    applyVertexColor(legR, '#27272a');
    geoms.push(legR);

    const shoeR = new THREE.BoxGeometry(0.14, 0.08, 0.19);
    shoeR.translate(0.13, 0.08, 0.26);
    applyVertexColor(shoeR, '#09090b');
    geoms.push(shoeR);

    _seatedHeadLimbsGeometry = mergeGeometries(geoms, false);
    geoms.forEach((g) => g.dispose());
  }
  return _seatedHeadLimbsGeometry;
}

// Single shared materials for ALL characters
export const sharedTorsoMaterial = new THREE.MeshToonMaterial();

export const sharedHeadLimbsMaterial = new THREE.MeshToonMaterial({
  vertexColors: true,
});
