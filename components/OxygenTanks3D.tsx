'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { TOTAL_TANKS, tankPos3D } from '../lib/layout';
import { Member } from '../lib/types';
import { AppText } from './AppText';

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
      {/* Neon Sign on Left Wall (x = -11.6, facing inwards +X) */}
      <group position={[-11.6, 4.4, 2.5]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, 0, -0.05]}>
          <boxGeometry args={[4.4, 1.0, 0.1]} />
          <meshStandardMaterial color="#022c22" roughness={0.7} />
        </mesh>
        {/* Sign border frame */}
        <mesh position={[0, 0, 0.02]}>
          <boxGeometry args={[4.48, 1.08, 0.04]} />
          <meshBasicMaterial color="#059669" />
        </mesh>
        {/* 3D Text Header */}
        <AppText
          position={[0, 0, 0.08]}
          fontSize={0.34}
          color="#34d399"
          anchorX="center"
          anchorY="middle"
          fontWeight="bold"
          outlineWidth={0.03}
          outlineColor="#064e3b"
        >
          🏥 TRẠM OXI CKTG
        </AppText>
      </group>

      {/* 7 Oxygen Tanks against Left Wall (Zero dynamic pointLights) */}
      {Array.from({ length: TOTAL_TANKS }).map((_, i) => {
        const pos = tankPos3D(i);
        const isOccupied = occupiedTanks.has(i);

        return (
          <group key={`tank-${i}`} position={[pos.x, pos.y, pos.z]}>
            {/* Base platform */}
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.42, 0.46, 0.1, 16]} />
              <meshStandardMaterial color="#18181b" roughness={0.8} />
            </mesh>

            {/* Cylinder body with Toon/Emissive shading (No runtime pointLight) */}
            <mesh position={[0, 0.95, 0]}>
              <cylinderGeometry args={[0.28, 0.28, 1.6, 20]} />
              <meshToonMaterial
                color={isOccupied ? '#10b981' : '#047857'}
                emissive={isOccupied ? '#34d399' : '#065f46'}
                emissiveIntensity={isOccupied ? 0.9 : 0.15}
              />
            </mesh>

            {/* Top rounded dome */}
            <mesh position={[0, 1.75, 0]}>
              <sphereGeometry args={[0.28, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshToonMaterial
                color={isOccupied ? '#34d399' : '#10b981'}
                emissive={isOccupied ? '#6ee7b7' : '#059669'}
                emissiveIntensity={isOccupied ? 0.7 : 0.1}
              />
            </mesh>

            {/* Top Valve */}
            <mesh position={[0, 2.05, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 0.22, 12]} />
              <meshStandardMaterial color="#d1d5db" metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh position={[0, 2.18, 0]}>
              <boxGeometry args={[0.22, 0.07, 0.07]} />
              <meshStandardMaterial color="#ef4444" roughness={0.4} />
            </mesh>

            {/* Pressure gauge round disc on front */}
            <mesh position={[0.24, 1.35, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <cylinderGeometry args={[0.1, 0.1, 0.05, 16]} />
              <meshStandardMaterial color="#f3f4f6" />
            </mesh>

            {/* 3D Text Tank Label (Zero DOM <Html> overhead) */}
            <group position={[0.3, 1.05, 0]} rotation={[0, Math.PI / 2, 0]}>
              <mesh position={[0, 0, -0.01]}>
                <planeGeometry args={[0.65, 0.26]} />
                <meshBasicMaterial
                  color={isOccupied ? '#064e3b' : '#18181b'}
                  transparent
                  opacity={0.88}
                />
              </mesh>
              <AppText
                fontSize={0.13}
                color={isOccupied ? '#34d399' : '#e4e4e7'}
                anchorX="center"
                anchorY="middle"
                fontWeight="bold"
                outlineWidth={0.015}
                outlineColor="#09090b"
              >
                {`O₂ #${i + 1}`}
              </AppText>
            </group>
          </group>
        );
      })}
    </group>
  );
};
