'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerformanceMonitor, Stats } from '@react-three/drei';
import { Member, RoomConn } from '../lib/types';
import {
  getPathToSeat,
  isInsideSeatBlock,
  oxygenState3D,
  resolveOutOfAABB,
  seatPos3D,
  Vector3D,
} from '../lib/layout';
import { useCinemaStore } from '../lib/store';
import { cameraYawRef, localPosRef, localRotRef } from '../lib/playerRefs';
import { Screen3D } from './Screen3D';
import { Seats3D } from './Seats3D';
import { OxygenTanks3D } from './OxygenTanks3D';
import { LocalCharacter3D, RemoteCharacter3D } from './Character3D';
import { CameraController } from './CameraController';

interface Cinema3DProps {
  videoId: string;
  members: Member[];
  selfId: string;
  selfName: string;
  selfColor: string;
  mySeat: string | null;
  myOxygen: { tank: number; start: number } | null;
  onSelectSeat: (seat: string | null) => void;
  onOxygenComplete: () => void;
  conn: RoomConn | null;
  chats: Record<string, { text: string; time: number }>;
  actions: Record<string, { type: any; time: number }>;
  debugMode?: boolean;
}

// Module-scope static lights controller with 0.6s smooth lerp (Max 4 real lights)
function CinemaLighting() {
  const cinemaLights = useCinemaStore((state) => state.cinemaLights);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const dirRef = useRef<THREE.DirectionalLight>(null);
  const screenLightRef = useRef<THREE.PointLight>(null);

  useFrame((_, delta) => {
    const isBright = cinemaLights === 'on';
    // Đèn rạp BẬT: hemi ~1.8, ambient ~0.35, dir ~1.0. Đèn TẮT: ~40%
    const targetHemi = isBright ? 1.8 : 0.72;
    const targetAmbient = isBright ? 0.35 : 0.14;
    const targetDir = isBright ? 1.0 : 0.40;
    const targetScreen = isBright ? 2.5 : 4.5;

    if (hemiRef.current) {
      hemiRef.current.intensity = THREE.MathUtils.damp(
        hemiRef.current.intensity,
        targetHemi,
        5,
        delta
      );
    }
    if (ambientRef.current) {
      ambientRef.current.intensity = THREE.MathUtils.damp(
        ambientRef.current.intensity,
        targetAmbient,
        5,
        delta
      );
    }
    if (dirRef.current) {
      dirRef.current.intensity = THREE.MathUtils.damp(
        dirRef.current.intensity,
        targetDir,
        5,
        delta
      );
    }
    if (screenLightRef.current) {
      screenLightRef.current.intensity = THREE.MathUtils.damp(
        screenLightRef.current.intensity,
        targetScreen,
        5,
        delta
      );
    }
  });

  return (
    <>
      {/* 1. Hemisphere Light (Soft ambient ceiling & ground) */}
      <hemisphereLight
        ref={hemiRef}
        color="#fff4e0"
        groundColor="#3a332d"
        intensity={1.8}
      />

      {/* 2. Ambient Light */}
      <ambientLight
        ref={ambientRef}
        color="#fff4e0"
        intensity={0.35}
      />

      {/* 3. Directional Light from above-behind */}
      <directionalLight
        ref={dirRef}
        position={[4, 16, 12]}
        color="#fff4e0"
        intensity={1.0}
      />

      {/* 4. Screen Front Reflection Light */}
      <pointLight
        ref={screenLightRef}
        position={[0, 8.7, -11.0]}
        intensity={2.5}
        distance={24}
        color="#fef08a"
      />
    </>
  );
}

/** Local Player Controller: Updates localPosRef at 60fps in useFrame (ZERO React setState per frame) */
function LocalPlayerController({
  selfId,
  selfName,
  selfColor,
  mySeat,
  myOxygen,
  onSelectSeat,
  onOxygenComplete,
  conn,
  chats,
  actions,
  waypointQueueRef,
}: {
  selfId: string;
  selfName: string;
  selfColor: string;
  mySeat: string | null;
  myOxygen: { tank: number; start: number } | null;
  onSelectSeat: (seat: string | null) => void;
  onOxygenComplete: () => void;
  conn: RoomConn | null;
  chats: Record<string, { text: string; time: number }>;
  actions: Record<string, { type: any; time: number }>;
  waypointQueueRef: React.MutableRefObject<Vector3D[]>;
}) {
  const isLobby = useCinemaStore((state) => state.isLobby);
  const setIsMoving = useCinemaStore((state) => state.setIsMoving);
  const setIsSeated = useCinemaStore((state) => state.setIsSeated);
  const activeNearbySeat = useCinemaStore((state) => state.activeNearbySeat);
  const joystickVector = useCinemaStore((state) => state.joystickVector);

  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const lastSitStandToggleTime = useRef(0);
  const wasMovingRef = useRef(false);

  // Position broadcast throttler
  const lastBroadcastTime = useRef(0);
  const lastBroadcastPos = useRef({ x: 0, y: 0, z: 0, rotY: 0 });

  // Refs for callbacks & active seat
  const mySeatRef = useRef(mySeat);
  mySeatRef.current = mySeat;
  const activeNearbySeatRef = useRef(activeNearbySeat);
  activeNearbySeatRef.current = activeNearbySeat;
  const onSelectSeatRef = useRef(onSelectSeat);
  onSelectSeatRef.current = onSelectSeat;

  const clearKeys = () => {
    keysPressed.current = {};
  };

  const handleStandUp = () => {
    const now = Date.now();
    if (now - lastSitStandToggleTime.current < 400) return;
    lastSitStandToggleTime.current = now;

    clearKeys();
    const curSeat = mySeatRef.current;
    if (curSeat) {
      const s = seatPos3D(curSeat);
      const targetX = s.x;
      const targetZ = s.z + 1.2;
      const safe = resolveOutOfAABB(targetX, targetZ);
      localPosRef.set(safe.x, 0, safe.z);
      localRotRef.y = 0;
    }
    onSelectSeatRef.current(null);
  };

  const handleSitDown = (seat: string) => {
    const now = Date.now();
    if (now - lastSitStandToggleTime.current < 400) return;
    lastSitStandToggleTime.current = now;

    clearKeys();
    onSelectSeatRef.current(seat);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      const k = e.key.toLowerCase();

      if (mySeatRef.current) {
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
          handleStandUp();
          return;
        }
      }

      if (e.repeat) return;

      if (k === 'e') {
        e.preventDefault();
        if (mySeatRef.current) {
          handleStandUp();
        } else if (activeNearbySeatRef.current) {
          handleSitDown(activeNearbySeatRef.current);
        }
        return;
      }

      keysPressed.current[k] = true;
      waypointQueueRef.current = [];
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysPressed.current[k] = false;
    };

    const handleBlur = () => {
      clearKeys();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearKeys();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [waypointQueueRef]);

  // Reset keys and sync seated state when seat changes
  const prevSeatRef = useRef(mySeat);
  useEffect(() => {
    setIsSeated(Boolean(mySeat));
    if (mySeat) {
      clearKeys();
      waypointQueueRef.current = [];
    } else if (prevSeatRef.current) {
      clearKeys();
      if (prevSeatRef.current) {
        const s = seatPos3D(prevSeatRef.current);
        const targetX = s.x;
        const targetZ = s.z + 1.2;
        const safe = resolveOutOfAABB(targetX, targetZ);
        localPosRef.set(safe.x, 0, safe.z);
      }
    }
    prevSeatRef.current = mySeat;
  }, [mySeat, setIsSeated, waypointQueueRef]);

  // 60fps Movement & Collision Loop (Flat floor y = 0)
  useFrame((_, delta) => {
    if (isLobby) return; // In lobby mode, local player does not move/broadcast

    const now = Date.now();
    let movingThisFrame = false;

    // 1. OXYGEN MODE
    if (myOxygen && mySeat) {
      const elapsed = now - myOxygen.start;
      const oState = oxygenState3D(mySeat, myOxygen.tank, elapsed);
      localPosRef.set(oState.x, oState.y, oState.z);
      localRotRef.y = oState.rotY;
      movingThisFrame = true;

      if (oState.done) {
        onOxygenComplete();
      }
    } else if (mySeat) {
      // 2. SEATED ON CHAIR
      const s = seatPos3D(mySeat);
      localPosRef.set(s.x, s.y, s.z);
      localRotRef.y = Math.PI;
      movingThisFrame = false;
    } else {
      // 3. FREE WALKING & WAYPOINT NAVIGATION
      let inputForward = 0;
      let inputRight = 0;

      if (keysPressed.current['w'] || keysPressed.current['arrowup']) inputForward += 1;
      if (keysPressed.current['s'] || keysPressed.current['arrowdown']) inputForward -= 1;
      if (keysPressed.current['d'] || keysPressed.current['arrowright']) inputRight += 1;
      if (keysPressed.current['a'] || keysPressed.current['arrowleft']) inputRight -= 1;

      if (Math.hypot(joystickVector.x, joystickVector.y) > 0.1) {
        inputRight += joystickVector.x;
        inputForward -= joystickVector.y;
      }

      if (inputForward !== 0 || inputRight !== 0) {
        waypointQueueRef.current = [];

        const len = Math.hypot(inputForward, inputRight);
        const normF = inputForward / len;
        const normR = inputRight / len;

        // Camera-relative direction
        const camYaw = cameraYawRef.value;
        const camForwardX = -Math.sin(camYaw);
        const camForwardZ = -Math.cos(camYaw);
        const camRightX = Math.cos(camYaw);
        const camRightZ = -Math.sin(camYaw);

        const moveDirX = normF * camForwardX + normR * camRightX;
        const moveDirZ = normF * camForwardZ + normR * camRightZ;

        const moveSpeed = 5.2; // 3D units/sec
        const newX = localPosRef.x + moveDirX * moveSpeed * delta;
        const newZ = localPosRef.z + moveDirZ * moveSpeed * delta;

        // Seat block AABB collision check
        if (!isInsideSeatBlock(newX, localPosRef.z)) {
          localPosRef.x = newX;
        }
        if (!isInsideSeatBlock(localPosRef.x, newZ)) {
          localPosRef.z = newZ;
        }

        // Rotate face smoothly toward movement direction
        const targetRotY = Math.atan2(moveDirX, moveDirZ);
        let diff = targetRotY - localRotRef.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        localRotRef.y = THREE.MathUtils.damp(localRotRef.y, localRotRef.y + diff, 16, delta);

        movingThisFrame = true;
      } else if (waypointQueueRef.current && waypointQueueRef.current.length > 0) {
        // Waypoint Navigation (Click-to-move through aisles on flat floor)
        const targetWP = waypointQueueRef.current[0];
        const dx = targetWP.x - localPosRef.x;
        const dz = targetWP.z - localPosRef.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.15) {
          const moveSpeed = 5.0;
          const step = Math.min(dist, moveSpeed * delta);
          localPosRef.x += (dx / dist) * step;
          localPosRef.z += (dz / dist) * step;

          const targetRotY = Math.atan2(dx, dz);
          let diff = targetRotY - localRotRef.y;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          localRotRef.y = THREE.MathUtils.damp(localRotRef.y, localRotRef.y + diff, 16, delta);

          movingThisFrame = true;
        } else {
          waypointQueueRef.current.shift();
          if (waypointQueueRef.current.length === 0) {
            movingThisFrame = false;
          }
        }
      }

      // Flat floor height
      localPosRef.y = 0;

      // Clamp within cinema boundaries (x: [-11.2, 11.2], z: [-5.2, 15.6])
      localPosRef.x = THREE.MathUtils.clamp(localPosRef.x, -11.2, 11.2);
      localPosRef.z = THREE.MathUtils.clamp(localPosRef.z, -5.2, 15.6);
    }

    if (movingThisFrame !== wasMovingRef.current) {
      wasMovingRef.current = movingThisFrame;
      setIsMoving(movingThisFrame);
    }

    // 4. POSITION BROADCAST REDUCTION
    if (conn && !mySeat && !myOxygen) {
      const posDist = Math.hypot(
        localPosRef.x - lastBroadcastPos.current.x,
        localPosRef.z - lastBroadcastPos.current.z
      );
      const angleDiff = Math.abs(localRotRef.y - lastBroadcastPos.current.rotY);
      const timeSinceLast = now - lastBroadcastTime.current;

      const shouldSendMoving = movingThisFrame && timeSinceLast >= 100 && (posDist > 0.05 || angleDiff > 0.05);
      const shouldSendStop = !movingThisFrame && lastBroadcastPos.current.x !== localPosRef.x && timeSinceLast >= 100;

      if (shouldSendMoving || shouldSendStop) {
        lastBroadcastTime.current = now;
        lastBroadcastPos.current = {
          x: localPosRef.x,
          y: localPosRef.y,
          z: localPosRef.z,
          rotY: localRotRef.y,
        };

        conn.send({
          type: 'pos',
          id: selfId,
          x: Math.round(localPosRef.x * 100) / 100,
          y: 0,
          z: Math.round(localPosRef.z * 100) / 100,
          rotY: Math.round(localRotRef.y * 100) / 100,
          isMoving: movingThisFrame,
          pose: movingThisFrame ? 'walk' : 'idle',
        });
      }
    }
  });

  const selfMember: Member = {
    id: selfId,
    name: selfName,
    color: selfColor,
    seat: mySeat,
    seatAt: 0,
    oxygen: myOxygen,
    joinedAt: 0,
  };

  return (
    <LocalCharacter3D
      member={selfMember}
      activeChat={chats[selfId]}
      activeAction={actions[selfId]}
    />
  );
}

export const Cinema3D: React.FC<Cinema3DProps> = ({
  videoId,
  members,
  selfId,
  selfName,
  selfColor,
  mySeat,
  myOxygen,
  onSelectSeat,
  onOxygenComplete,
  conn,
  chats,
  actions,
  debugMode,
}) => {
  const isLobby = useCinemaStore((state) => state.isLobby);
  const [dpr, setDpr] = useState(1.5);
  const waypointQueueRef = useRef<Vector3D[]>([]);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  const selfActionTime = actions[selfId]?.time;

  const handleNavigateToSeat = (seat: string) => {
    if (mySeat) return;
    const waypoints = getPathToSeat(
      { x: localPosRef.x, z: localPosRef.z },
      seat
    );
    waypointQueueRef.current = waypoints;
  };

  const handleFloorPointerDown = (e: any) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleFloorPointerUp = (e: any) => {
    if (mySeat) return;
    if (!pointerDownPos.current) return;
    const dist = Math.hypot(
      e.clientX - pointerDownPos.current.x,
      e.clientY - pointerDownPos.current.y
    );
    pointerDownPos.current = null;
    if (dist > 5) return;

    const mode = useCinemaStore.getState().controlMode;
    if (mode === 'keyboard') return;

    const pt = e.point;
    if (pt) {
      waypointQueueRef.current = [
        {
          x: pt.x,
          y: 0,
          z: pt.z,
        },
      ];
    }
  };

  return (
    <div className="cinema-3d-canvas-wrap">
      <Canvas
        shadows={false}
        dpr={dpr}
        camera={{ position: [14.0, 11.5, 16.0], fov: 52 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          stencil: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
      >
        <color attach="background" args={['#07070a']} />
        <fog args={['#07070a', 20, 50]} />

        <PerformanceMonitor
          onIncline={() => setDpr((prev) => Math.min(2.0, prev + 0.25))}
          onDecline={() => setDpr((prev) => Math.max(1.0, prev - 0.25))}
        />

        {debugMode && <Stats />}

        <CameraController selfActionTime={selfActionTime} />

        {/* 4 Fixed Real Lights (CinemaLighting) */}
        <CinemaLighting />

        {/* 1. Màn chiếu 3D (Được nâng lên mép dưới cách sàn ~3.5m) kèm 2 dải banner cổ vũ */}
        <Screen3D videoId={videoId} />

        {/* 2. Ghế khán phòng (6 dãy × 10 ghế trên sàn phẳng y = 0) */}
        <Seats3D
          members={members}
          selfId={selfId}
          mySeat={mySeat}
          onSelectSeat={onSelectSeat}
          onNavigateToSeat={handleNavigateToSeat}
        />

        {/* 3. Dãy 7 bình oxi tường trái */}
        <OxygenTanks3D members={members} />

        {/* 4. Khán phòng kiến trúc (Sàn phẳng y = 0, LED dẫn đường dọc lối đi) */}
        <group>
          {/* Main Floor (Clickable for click-to-move in mouse mode) */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 0]}
            onPointerDown={handleFloorPointerDown}
            onPointerUp={handleFloorPointerUp}
          >
            <planeGeometry args={[26, 42]} />
            <meshStandardMaterial color="#3b342e" roughness={0.9} />
          </mesh>

          {/* Center Aisle Red Velvet Carpet (Width 1.8) */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.01, 2]}
            onPointerDown={handleFloorPointerDown}
            onPointerUp={handleFloorPointerUp}
          >
            <planeGeometry args={[1.8, 36]} />
            <meshStandardMaterial color="#4a0e17" roughness={0.85} />
          </mesh>

          {/* LED Guide Strips along Center Aisle */}
          <mesh position={[-0.92, 0.02, 3.5]}>
            <boxGeometry args={[0.04, 0.02, 30]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.8} />
          </mesh>
          <mesh position={[0.92, 0.02, 3.5]}>
            <boxGeometry args={[0.04, 0.02, 30]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.8} />
          </mesh>

          {/* LED Guide Strips along Side Walkways */}
          <mesh position={[-7.6, 0.02, 3.5]}>
            <boxGeometry args={[0.04, 0.02, 30]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.7} />
          </mesh>
          <mesh position={[7.6, 0.02, 3.5]}>
            <boxGeometry args={[0.04, 0.02, 30]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.7} />
          </mesh>

          {/* Side & Back Walls (Warm dark tone #3a332d) */}
          <mesh position={[-11.8, 6.5, 0]}>
            <boxGeometry args={[0.3, 13, 42]} />
            <meshStandardMaterial color="#3a332d" roughness={0.85} />
          </mesh>
          <mesh position={[11.8, 6.5, 0]}>
            <boxGeometry args={[0.3, 13, 42]} />
            <meshStandardMaterial color="#3a332d" roughness={0.85} />
          </mesh>
          <mesh position={[0, 6.5, 19.5]}>
            <boxGeometry args={[24, 13, 0.3]} />
            <meshStandardMaterial color="#3a332d" roughness={0.85} />
          </mesh>

          {/* Entrance Doorway at Back Center (Floor at y = 0 -> center at y = 2.0) */}
          <mesh position={[0, 2.0, 19.3]}>
            <boxGeometry args={[3.6, 4.0, 0.2]} />
            <meshStandardMaterial color="#92400e" roughness={0.4} />
          </mesh>

          {/* Wall Sconce Emissive Decorative Lights */}
          {[-11.6, 11.6].map((xSide) =>
            [-6, 0, 6, 12, 16].map((zPos, sIdx) => (
              <group key={`sconce-${xSide}-${sIdx}`} position={[xSide, 5.5, zPos]}>
                <mesh>
                  <boxGeometry args={[0.1, 0.6, 0.22]} />
                  <meshBasicMaterial color="#fbbf24" />
                </mesh>
              </group>
            ))
          )}
        </group>

        {/* 5. Local Player (Hidden when in lobby) */}
        <LocalPlayerController
          selfId={selfId}
          selfName={selfName}
          selfColor={selfColor}
          mySeat={mySeat}
          myOxygen={myOxygen}
          onSelectSeat={onSelectSeat}
          onOxygenComplete={onOxygenComplete}
          conn={conn}
          chats={chats}
          actions={actions}
          waypointQueueRef={waypointQueueRef}
        />

        {/* 6. Remote Players */}
        {members
          .filter((m) => m.id !== selfId)
          .map((m) => (
            <RemoteCharacter3D
              key={m.id}
              member={m}
              activeChat={chats[m.id]}
              activeAction={actions[m.id]}
            />
          ))}
      </Canvas>
    </div>
  );
};
