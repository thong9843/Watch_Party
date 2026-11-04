'use client';

import React, { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ALL_SEATS, parseSeat, seatPos3D } from '../lib/layout';
import { Member } from '../lib/types';
import { useCinemaStore } from '../lib/store';
import { localPosRef } from '../lib/playerRefs';
import { Billboard } from '@react-three/drei';
import { AppText } from './AppText';

interface Seats3DProps {
  members: Member[];
  selfId: string;
  mySeat: string | null;
  onSelectSeat: (seat: string | null) => void;
  onNavigateToSeat?: (seat: string) => void;
}

const dummyMatrix = new THREE.Matrix4();
const dummyColor = new THREE.Color();

export const Seats3D: React.FC<Seats3DProps> = ({
  members,
  selfId,
  mySeat,
  onSelectSeat,
  onNavigateToSeat,
}) => {
  const cushionMeshRef = useRef<THREE.InstancedMesh>(null);
  const backrestMeshRef = useRef<THREE.InstancedMesh>(null);
  const [hoveredSeat, setHoveredSeat] = useState<string | null>(null);

  const isSeated = useCinemaStore((state) => state.isSeated);
  const setActiveNearbySeat = useCinemaStore((state) => state.setActiveNearbySeat);
  const activeNearbySeat = useCinemaStore((state) => state.activeNearbySeat);
  const activeNearbySeatRef = useRef<string | null>(null);

  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  // Map occupied seats
  const occupiedMap = useMemo(() => {
    const map = new Map<string, Member>();
    for (const m of members) {
      if (m.seat) {
        map.set(m.seat, m);
      }
    }
    return map;
  }, [members]);

  // Seat matrices and initial setup (adapted for 30% wider spacing)
  const seatData = useMemo(() => {
    return ALL_SEATS.map((seat, index) => {
      const pos = seatPos3D(seat);
      const parsed = parseSeat(seat);
      const rotY = parsed ? (4.5 - parsed.col) * 0.025 : 0;

      dummyMatrix.makeRotationY(rotY);
      dummyMatrix.setPosition(pos.x, pos.y, pos.z);
      const cushionMatrix = dummyMatrix.clone();

      dummyMatrix.makeRotationY(rotY);
      dummyMatrix.setPosition(pos.x, pos.y + 0.38, pos.z - 0.28);
      const backrestMatrix = dummyMatrix.clone();

      return {
        seat,
        index,
        pos,
        cushionMatrix,
        backrestMatrix,
      };
    });
  }, []);

  useMemo(() => {
    if (!cushionMeshRef.current || !backrestMeshRef.current) return;
    seatData.forEach(({ index, cushionMatrix, backrestMatrix }) => {
      cushionMeshRef.current?.setMatrixAt(index, cushionMatrix);
      backrestMeshRef.current?.setMatrixAt(index, backrestMatrix);
    });
    cushionMeshRef.current.instanceMatrix.needsUpdate = true;
    backrestMeshRef.current.instanceMatrix.needsUpdate = true;
  }, [seatData]);

  // Per-frame distance check reading localPosRef directly (zero React re-renders)
  useFrame(() => {
    const cushionMesh = cushionMeshRef.current;
    const backrestMesh = backrestMeshRef.current;
    if (!cushionMesh || !backrestMesh) return;

    let closestVacant: string | null = null;
    let minDistance = 1.8;

    seatData.forEach(({ seat, index, pos }) => {
      const occupant = occupiedMap.get(seat);
      const isMine = seat === mySeat;
      const isOccupied = Boolean(occupant && occupant.id !== selfId);
      const isAway = Boolean(occupant?.oxygen);
      const isHovered = seat === hoveredSeat;

      // Distance check reading localPosRef directly
      if (!isOccupied && !isSeated) {
        const dist = Math.hypot(pos.x - localPosRef.x, pos.z - localPosRef.z);
        if (dist < minDistance) {
          minDistance = dist;
          closestVacant = seat;
        }
      }

      if (isMine) {
        dummyColor.set('#f59e0b'); // Gold for my seat
      } else if (isOccupied) {
        if (isAway) {
          dummyColor.set('#0d9488'); // Cyan when occupant is away breathing oxygen
        } else {
          dummyColor.set('#3f0c0c'); // Dim red for occupied
        }
      } else if (isHovered) {
        dummyColor.set('#ef4444'); // Highlight when hovered
      } else {
        dummyColor.set('#881337'); // Classic cinema velvet red
      }

      cushionMesh.setColorAt(index, dummyColor);
      backrestMesh.setColorAt(index, dummyColor);
    });

    cushionMesh.instanceColor && (cushionMesh.instanceColor.needsUpdate = true);
    backrestMesh.instanceColor && (backrestMesh.instanceColor.needsUpdate = true);

    // Only update discrete React state when closest seat changes
    if (closestVacant !== activeNearbySeatRef.current) {
      activeNearbySeatRef.current = closestVacant;
      setActiveNearbySeat(closestVacant);
    }
  });

  const handlePointerDown = (e: any) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: any) => {
    e.stopPropagation();
    if (!pointerDownPos.current) return;
    const dist = Math.hypot(
      e.clientX - pointerDownPos.current.x,
      e.clientY - pointerDownPos.current.y
    );
    pointerDownPos.current = null;
    if (dist > 5) return; // Treated as drag, ignore click

    const instanceId = e.instanceId;
    if (instanceId !== undefined && instanceId >= 0 && instanceId < ALL_SEATS.length) {
      const seat = ALL_SEATS[instanceId];
      const occupant = occupiedMap.get(seat);

      if (seat === mySeat) {
        onSelectSeat(null); // Stand up
      } else if (!occupant || occupant.id === selfId) {
        if (onNavigateToSeat) {
          onNavigateToSeat(seat); // Walk along waypoints to seat
        } else {
          onSelectSeat(seat);
        }
      }
    }
  };

  const handlePointerMove = (e: any) => {
    e.stopPropagation();
    const instanceId = e.instanceId;
    if (instanceId !== undefined && instanceId >= 0 && instanceId < ALL_SEATS.length) {
      const seat = ALL_SEATS[instanceId];
      if (hoveredSeat !== seat) setHoveredSeat(seat);
    }
  };

  const handlePointerOut = () => {
    if (hoveredSeat) setHoveredSeat(null);
  };

  return (
    <group>
      <instancedMesh
        ref={cushionMeshRef}
        args={[undefined, undefined, ALL_SEATS.length]}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
      >
        <boxGeometry args={[0.88, 0.18, 0.72]} />
        <meshToonMaterial />
      </instancedMesh>

      <instancedMesh
        ref={backrestMeshRef}
        args={[undefined, undefined, ALL_SEATS.length]}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
      >
        <boxGeometry args={[0.88, 0.76, 0.15]} />
        <meshToonMaterial />
      </instancedMesh>

      {/* Floating Prompt on Closest Nearby Seat (GPU 3D Text, No DOM Html) */}
      {activeNearbySeat && !isSeated && (
        <Billboard
          position={[
            seatPos3D(activeNearbySeat).x,
            seatPos3D(activeNearbySeat).y + 0.95,
            seatPos3D(activeNearbySeat).z,
          ]}
        >
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[2.2, 0.32]} />
            <meshBasicMaterial color="#b45309" transparent opacity={0.92} />
          </mesh>
          <AppText
            fontSize={0.14}
            color="#fef08a"
            anchorX="center"
            anchorY="middle"
            fontWeight="bold"
            outlineWidth={0.015}
            outlineColor="#451a03"
          >
            {`[E] Ngồi ghế ${activeNearbySeat}`}
          </AppText>
        </Billboard>
      )}

      {/* Hovered Seat Tooltip */}
      {hoveredSeat && (
        <Billboard
          position={[
            seatPos3D(hoveredSeat).x,
            seatPos3D(hoveredSeat).y + 1.25,
            seatPos3D(hoveredSeat).z,
          ]}
        >
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[1.4, 0.28]} />
            <meshBasicMaterial color="#09090b" transparent opacity={0.85} />
          </mesh>
          <AppText
            fontSize={0.12}
            color="#fbbf24"
            anchorX="center"
            anchorY="middle"
            fontWeight="bold"
          >
            {hoveredSeat === mySeat
              ? `Ghế ${hoveredSeat} (Của bạn)`
              : occupiedMap.has(hoveredSeat)
              ? `Ghế ${hoveredSeat} (${occupiedMap.get(hoveredSeat)!.name})`
              : `Ghế trống ${hoveredSeat}`}
          </AppText>
        </Billboard>
      )}
    </group>
  );
};
