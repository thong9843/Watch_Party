'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { TOTAL_TANKS, tankPos3D } from '../lib/layout';
import { Member } from '../lib/types';
import { Html } from '@react-three/drei';

interface OxygenTanks3DProps {
  members: Member[];
}

export const OxygenTanks3D: React.FC<OxygenTanks3DProps> = ({ members }) => {
  const occupiedTanks = useMemo(() => {
    const set = new Set<number>();
    for (const m of members) {
      if (m.oxygen) {
        set.add(m.oxygen.tank);
      }
    }
    return set;
  }, [members]);

  return (
    <group>
      {/* Neon Sign on Left Wall */}
      <group position={[-8.9, 3.8, 2.5]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, 0, -0.05]}>
          <boxGeometry args={[4.2, 0.9, 0.1]} />
          <meshStandardMaterial color="#064e3b" roughness={0.6} />
        </mesh>
        <Html transform distanceFactor={5.5} position={[0, 0, 0.06]}>
          <div className="oxygen-station-3d-sign">
            <span className="sign-icon">🏥</span>
            <span className="sign-title">TRẠM OXI CKTG</span>
          </div>
        </Html>
        <pointLight position={[0, 0, 0.4]} color="#10b981" intensity={3} distance={6} />
      </group>

      {/* 7 Oxygen Tanks */}
      {Array.from({ length: TOTAL_TANKS }).map((_, i) => {
        const pos = tankPos3D(i);
        const isOccupied = occupiedTanks.has(i);

        return (
          <group key={`tank-${i}`} position={[pos.x, pos.y, pos.z]}>
            {/* Base platform */}
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.38, 0.42, 0.1, 16]} />
              <meshStandardMaterial color="#18181b" roughness={0.8} />
            </mesh>

            {/* Cylinder body */}
            <mesh position={[0, 0.85, 0]} castShadow>
              <cylinderGeometry args={[0.26, 0.26, 1.4, 20]} />
              <meshStandardMaterial
                color={isOccupied ? '#10b981' : '#059669'}
                emissive={isOccupied ? '#10b981' : '#047857'}
                emissiveIntensity={isOccupied ? 0.6 : 0.1}
                roughness={0.4}
                metalness={0.3}
              />
            </mesh>

            {/* Top rounded dome */}
            <mesh position={[0, 1.55, 0]}>
              <sphereGeometry args={[0.26, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial
                color={isOccupied ? '#34d399' : '#10b981'}
                roughness={0.3}
              />
            </mesh>

            {/* Top Valve */}
            <mesh position={[0, 1.82, 0]}>
              <cylinderGeometry args={[0.07, 0.07, 0.2, 12]} />
              <meshStandardMaterial color="#d1d5db" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[0, 1.94, 0]}>
              <boxGeometry args={[0.18, 0.06, 0.06]} />
              <meshStandardMaterial color="#ef4444" roughness={0.4} />
            </mesh>

            {/* Pressure gauge round disc on front */}
            <mesh position={[0.22, 1.25, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <cylinderGeometry args={[0.09, 0.09, 0.05, 16]} />
              <meshStandardMaterial color="#f3f4f6" />
            </mesh>

            {/* Active glow light */}
            {isOccupied && (
              <pointLight position={[0, 1.2, 0]} color="#34d399" intensity={4} distance={4} />
            )}

            {/* Tank Label */}
            <Html position={[0, 0.85, 0.3]} distanceFactor={8} center style={{ pointerEvents: 'none' }}>
              <div className={`tank-3d-badge ${isOccupied ? 'is-active' : ''}`}>
                O₂ #{i + 1}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};
