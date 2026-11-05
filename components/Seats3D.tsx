'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const armrestLeftMeshRef = useRef<THREE.InstancedMesh>(null);
  const armrestRightMeshRef = useRef<THREE.InstancedMesh>(null);
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

  // Seat matrices setup (V2.3: Backrest at +Z towards entrance, cushion & person face -Z towards screen)
  const seatData = useMemo(() => {
    return ALL_SEATS.map((seat, index) => {
      const pos = seatPos3D(seat);
      const parsed = parseSeat(seat);
      const rotY = parsed ? (parsed.col - 4.5) * 0.025 : 0;

      // 1. Cushion (facing screen, centered slightly forward toward -Z)
      dummyMatrix.makeRotationY(rotY);
      dummyMatrix.setPosition(pos.x, pos.y, pos.z - 0.08);
      const cushionMatrix = dummyMatrix.clone();

      // 2. Backrest (at back of chair +Z towards entrance, facing screen)
      dummyMatrix.makeRotationY(rotY);
      dummyMatrix.setPosition(pos.x, pos.y + 0.38, pos.z + 0.30);
      const backrestMatrix = dummyMatrix.clone();

      // 3. Armrests (left & right flanking the seat)
      dummyMatrix.makeRotationY(rotY);
      dummyMatrix.setPosition(pos.x - 0.50, pos.y + 0.16, pos.z + 0.06);
      const armrestLeftMatrix = dummyMatrix.clone();

      dummyMatrix.makeRotationY(rotY);
      dummyMatrix.setPosition(pos.x + 0.50, pos.y + 0.16, pos.z + 0.06);
      const armrestRightMatrix = dummyMatrix.clone();

      return {
        seat,
        index,
        pos,
        cushionMatrix,
        backrestMatrix,
        armrestLeftMatrix,
        armrestRightMatrix,
      };
    });
  }, []);

  const matricesInitialized = useRef(false);

  useEffect(() => {
    if (
      !cushionMeshRef.current ||
      !backrestMeshRef.current ||
      !armrestLeftMeshRef.current ||
      !armrestRightMeshRef.current
    )
      return;

    seatData.forEach(
      ({ index, cushionMatrix, backrestMatrix, armrestLeftMatrix, armrestRightMatrix }) => {
        cushionMeshRef.current?.setMatrixAt(index, cushionMatrix);
        backrestMeshRef.current?.setMatrixAt(index, backrestMatrix);
        armrestLeftMeshRef.current?.setMatrixAt(index, armrestLeftMatrix);
        armrestRightMeshRef.current?.setMatrixAt(index, armrestRightMatrix);
      }
    );
    cushionMeshRef.current.instanceMatrix.needsUpdate = true;
    backrestMeshRef.current.instanceMatrix.needsUpdate = true;
    armrestLeftMeshRef.current.instanceMatrix.needsUpdate = true;
    armrestRightMeshRef.current.instanceMatrix.needsUpdate = true;
    matricesInitialized.current = true;
  }, [seatData]);

  // Per-frame distance check reading localPosRef directly (zero React re-renders)
  useFrame(() => {
    const cushionMesh = cushionMeshRef.current;
    const backrestMesh = backrestMeshRef.current;
    const armLeftMesh = armrestLeftMeshRef.current;
    const armRightMesh = armrestRightMeshRef.current;
    if (!cushionMesh || !backrestMesh || !armLeftMesh || !armRightMesh) return;

    if (!matricesInitialized.current) {
      seatData.forEach(
        ({ index, cushionMatrix, backrestMatrix, armrestLeftMatrix, armrestRightMatrix }) => {
          cushionMesh.setMatrixAt(index, cushionMatrix);
          backrestMesh.setMatrixAt(index, backrestMatrix);
          armLeftMesh.setMatrixAt(index, armrestLeftMatrix);
          armRightMesh.setMatrixAt(index, armrestRightMatrix);
        }
      );
      cushionMesh.instanceMatrix.needsUpdate = true;
      backrestMesh.instanceMatrix.needsUpdate = true;
      armLeftMesh.instanceMatrix.needsUpdate = true;
      armRightMesh.instanceMatrix.needsUpdate = true;
      matricesInitialized.current = true;
    }

    let closestVacant: string | null = null;
    let minDistance = 2.0;

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
        dummyColor.set('#9b2335'); // Classic cinema velvet red
      }

      cushionMesh.setColorAt(index, dummyColor);
      backrestMesh.setColorAt(index, dummyColor);

      // Armrests: slightly darker velvet tone
      dummyColor.multiplyScalar(0.75);
      armLeftMesh.setColorAt(index, dummyColor);
      armRightMesh.setColorAt(index, dummyColor);
    });

    cushionMesh.instanceColor && (cushionMesh.instanceColor.needsUpdate = true);
    backrestMesh.instanceColor && (backrestMesh.instanceColor.needsUpdate = true);
    armLeftMesh.instanceColor && (armLeftMesh.instanceColor.needsUpdate = true);
    armRightMesh.instanceColor && (armRightMesh.instanceColor.needsUpdate = true);

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
    if (!pointerDownPos.current) return;
    const dist = Math.hypot(
      e.clientX - pointerDownPos.current.x,
      e.clientY - pointerDownPos.current.y
    );
    pointerDownPos.current = null;
    if (dist > 8) return; // Ignore drag/swipe

    e.stopPropagation();
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
      {/* 1. Seat Cushions */}
      <instancedMesh
        ref={cushionMeshRef}
        args={[undefined, undefined, ALL_SEATS.length]}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
      >
        <boxGeometry args={[0.95, 0.18, 0.76]} />
        <meshToonMaterial />
      </instancedMesh>

      {/* 2. Seat Backrests (Facing screen, situated at back of chair +Z) */}
      <instancedMesh
        ref={backrestMeshRef}
        args={[undefined, undefined, ALL_SEATS.length]}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
      >
        <boxGeometry args={[0.95, 0.82, 0.16]} />
        <meshToonMaterial />
      </instancedMesh>

      {/* 3. Left Armrests */}
      <instancedMesh
        ref={armrestLeftMeshRef}
        args={[undefined, undefined, ALL_SEATS.length]}
      >
        <boxGeometry args={[0.11, 0.32, 0.70]} />
        <meshToonMaterial />
      </instancedMesh>

      {/* 4. Right Armrests */}
      <instancedMesh
        ref={armrestRightMeshRef}
        args={[undefined, undefined, ALL_SEATS.length]}
      >
        <boxGeometry args={[0.11, 0.32, 0.70]} />
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
          <AppText
            fontSize={0.13}
            color="#fbbf24"
            anchorX="center"
            anchorY="middle"
            fontWeight="bold"
            outlineWidth={0.012}
            outlineColor="#000000"
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
            seatPos3D(hoveredSeat).y + 0.85,
            seatPos3D(hoveredSeat).z,
          ]}
        >
          <AppText
            fontSize={0.11}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            fontWeight="bold"
            outlineWidth={0.01}
            outlineColor="#000000"
          >
            {occupiedMap.has(hoveredSeat)
              ? `${hoveredSeat} · ${occupiedMap.get(hoveredSeat)?.name}`
              : `Ghế ${hoveredSeat}`}
          </AppText>
        </Billboard>
      )}
    </group>
  );
};
