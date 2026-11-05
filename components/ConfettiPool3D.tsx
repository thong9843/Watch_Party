'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

const MAX_BURSTS = 8;
const PARTICLES_PER_BURST = 36;
const TOTAL_PARTICLES = 300; // Requirement: max 300 particles

interface BurstParticle {
  angle: number;
  speed: number;
  vy: number;
  color: THREE.Color;
}

interface ActiveBurst {
  origin: THREE.Vector3;
  startTime: number;
  particles: BurstParticle[];
}

const activeBursts: ActiveBurst[] = [];

// Pre-allocated objects for useFrame
const _particleMatrix = new THREE.Matrix4();
const _hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const _burstColors = [
  new THREE.Color('#facc15'),
  new THREE.Color('#ef4444'),
  new THREE.Color('#38bdf8'),
  new THREE.Color('#4ade80'),
  new THREE.Color('#ec4899'),
  new THREE.Color('#a855f7'),
];

export function triggerConfettiBurst(x: number, y: number, z: number): void {
  // If pool full, replace oldest burst
  if (activeBursts.length >= MAX_BURSTS) {
    activeBursts.shift();
  }

  const particles: BurstParticle[] = [];
  for (let i = 0; i < PARTICLES_PER_BURST; i++) {
    particles.push({
      angle: (i / PARTICLES_PER_BURST) * Math.PI * 2 + (Math.random() - 0.5) * 0.3,
      speed: 1.8 + (i % 4) * 0.7 + Math.random() * 0.5,
      vy: 2.4 + (i % 3) * 1.0 + Math.random() * 0.6,
      color: _burstColors[i % _burstColors.length],
    });
  }

  activeBursts.push({
    origin: new THREE.Vector3(x, y, z),
    startTime: Date.now(),
    particles,
  });
}

export const ConfettiPool3D: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Initialize hidden particles and colors
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < TOTAL_PARTICLES; i++) {
      mesh.setMatrixAt(i, _hiddenMatrix);
      mesh.setColorAt(i, _burstColors[i % _burstColors.length]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const now = Date.now();
    const t = state.clock.getElapsedTime();
    let particleIdx = 0;

    // Prune expired bursts
    for (let b = activeBursts.length - 1; b >= 0; b--) {
      const burst = activeBursts[b];
      if ((now - burst.startTime) / 1000 > 1.45) {
        activeBursts.splice(b, 1);
      }
    }

    if (activeBursts.length === 0) {
      // If nothing active, hide any lingering particles once
      if ((mesh.userData.hadActive ?? false) === true) {
        for (let i = 0; i < TOTAL_PARTICLES; i++) {
          mesh.setMatrixAt(i, _hiddenMatrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.userData.hadActive = false;
      }
      return;
    }

    mesh.userData.hadActive = true;

    for (const burst of activeBursts) {
      const elapsed = Math.min(1.4, (now - burst.startTime) / 1000);
      const origin = burst.origin;

      for (let pIdx = 0; pIdx < burst.particles.length && particleIdx < TOTAL_PARTICLES; pIdx++) {
        const p = burst.particles[pIdx];
        const rotY = t * 8 + pIdx;
        const posX = origin.x + Math.cos(p.angle) * p.speed * elapsed;
        const posY = origin.y + Math.max(0, p.vy * elapsed - 0.5 * 9.8 * elapsed * elapsed) + 0.8;
        const posZ = origin.z + Math.sin(p.angle) * p.speed * elapsed;

        _particleMatrix.makeRotationY(rotY);
        _particleMatrix.setPosition(posX, posY, posZ);

        mesh.setMatrixAt(particleIdx, _particleMatrix);
        mesh.setColorAt(particleIdx, p.color);
        particleIdx++;
      }
    }

    // Hide remaining unused slots
    while (particleIdx < TOTAL_PARTICLES) {
      mesh.setMatrixAt(particleIdx, _hiddenMatrix);
      particleIdx++;
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, TOTAL_PARTICLES]}
      frustumCulled={false}
    >
      <planeGeometry args={[0.08, 0.08]} />
      <meshBasicMaterial side={THREE.DoubleSide} />
    </instancedMesh>
  );
};

