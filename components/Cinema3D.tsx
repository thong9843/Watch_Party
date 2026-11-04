'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerformanceMonitor, Stats } from '@react-three/drei';
import { Member, RoomConn } from '../lib/types';
import {
  getContinuousHeight,
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

// Module-scope static lights controller with 0.6s smooth lerp
function CinemaLighting() {
  const cinemaLights = useCinemaStore((state) => state.cinemaLights);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const dirRef = useRef<THREE.DirectionalLight>(null);
  const screenLightRef = useRef<THREE.PointLight>(null);

  useFrame((_, delta) => {
    const isBright = cinemaLights === 'on';
    // Đèn rạp BẬT: hemi ~1.1, dir ~0.9. Đèn TẮT: ~35%
    const targetHemi = isBright ? 1.1 : 0.385;
    const targetDir = isBright ? 0.9 : 0.315;
    const targetScreen = isBright ? 2.5 : 4.5;

    if (hemiRef.current) {
      hemiRef.current.intensity = THREE.MathUtils.damp(
        hemiRef.current.intensity,
        targetHemi,
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
        groundColor="#2a2420"
        intensity={1.1}
      />

      {/* 2. Fixed Directional Light (Warm theater key light - Zero realtime shadow overhead) */}
      <directionalLight
        ref={dirRef}
        position={[6, 14, 8]}
        color="#fff4e0"
        intensity={0.9}
      />

      {/* 3. Screen Front Reflection Light */}
      <pointLight
        ref={screenLightRef}
        position={[0, 5.0, -11.0]}
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
  waypointQueueRef: React.RefObject<Vector3D[]>;
}) {
  const setIsMoving = useCinemaStore((state) => state.setIsMoving);
  const setIsSeated = useCinemaStore((state) => state.setIsSeated);
  const isLobby = useCinemaStore((state) => state.isLobby);
  const joystickVector = useCinemaStore((state) => state.joystickVector);

  const keysPressed = useRef<{ [k: string]: boolean }>({});
  const lastBroadcastTime = useRef<number>(0);
  const lastBroadcastPos = useRef<{ x: number; y: number; z: number; rotY: number }>({
    x: localPosRef.x,
    y: localPosRef.y,
    z: localPosRef.z,
    rotY: localRotRef.y,
  });
  const wasMovingRef = useRef(false);

  const mySeatRef = useRef<string | null>(mySeat);
  mySeatRef.current = mySeat;

  const onSelectSeatRef = useRef(onSelectSeat);
  onSelectSeatRef.current = onSelectSeat;

  const lastSitStandToggleTime = useRef<number>(0);

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
      localPosRef.set(safe.x, getContinuousHeight(safe.z), safe.z);
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

      keysPressed.current[k] = true;

      if (k === 'e') {
        if (mySeatRef.current) {
          handleStandUp();
        } else {
          const activeNearbySeat = useCinemaStore.getState().activeNearbySeat;
          if (activeNearbySeat) {
            handleSitDown(activeNearbySeat);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    const handleBlur = () => {
      clearKeys();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearKeys();
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') {
        clearKeys();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focusin', handleFocusIn);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focusin', handleFocusIn);
    };
  }, []);

  const prevSeatRef = useRef<string | null>(null);
  useEffect(() => {
    if (mySeat) {
      setIsSeated(true);
      const s = seatPos3D(mySeat);
      localPosRef.set(s.x, s.y, s.z);
      localRotRef.y = Math.PI;
      if (waypointQueueRef.current) {
        waypointQueueRef.current.length = 0;
      }
      clearKeys();
    } else {
      setIsSeated(false);
      clearKeys();
      if (prevSeatRef.current) {
        const s = seatPos3D(prevSeatRef.current);
        const targetX = s.x;
        const targetZ = s.z + 1.2;
        const safe = resolveOutOfAABB(targetX, targetZ);
        localPosRef.set(safe.x, getContinuousHeight(safe.z), safe.z);
      }
    }
    prevSeatRef.current = mySeat;
  }, [mySeat, setIsSeated, waypointQueueRef]);

  // 60fps Movement & Collision Loop (Mutates localPosRef, zero React state calls)
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

      // Camera-relative direction calculation
      const yaw = cameraYawRef.value;
      const forwardX = -Math.sin(yaw);
      const forwardZ = -Math.cos(yaw);
      const rightX = -forwardZ;
      const rightZ = forwardX;

      const moveX = inputForward * forwardX + inputRight * rightX;
      const moveZ = inputForward * forwardZ + inputRight * rightZ;

      const speed = 4.8;

      if (Math.hypot(moveX, moveZ) > 0.05) {
        if (waypointQueueRef.current) waypointQueueRef.current.length = 0;

        const len = Math.hypot(moveX, moveZ);
        const normX = (moveX / len) * speed * delta;
        const normZ = (moveZ / len) * speed * delta;

        const nextX = localPosRef.x + normX;
        const nextZ = localPosRef.z + normZ;

        // Seat AABB Collision Check with sliding
        if (!isInsideSeatBlock(nextX, nextZ)) {
          localPosRef.x = nextX;
          localPosRef.z = nextZ;
        } else if (!isInsideSeatBlock(nextX, localPosRef.z)) {
          localPosRef.x = nextX;
        } else if (!isInsideSeatBlock(localPosRef.x, nextZ)) {
          localPosRef.z = nextZ;
        }

        const targetRotY = Math.atan2(normX, normZ);
        const angleDiff = Math.atan2(
          Math.sin(targetRotY - localRotRef.y),
          Math.cos(targetRotY - localRotRef.y)
        );
        localRotRef.y += angleDiff * Math.min(1, 14 * delta);

        movingThisFrame = true;
      } else if (waypointQueueRef.current && waypointQueueRef.current.length > 0) {
        // Waypoint Navigation (Click-to-move through aisles)
        const targetWP = waypointQueueRef.current[0];
        const dx = targetWP.x - localPosRef.x;
        const dz = targetWP.z - localPosRef.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.15) {
          const step = Math.min(dist, speed * delta);
          localPosRef.x += (dx / dist) * step;
          localPosRef.z += (dz / dist) * step;

          const targetRotY = Math.atan2(dx, dz);
          const angleDiff = Math.atan2(
            Math.sin(targetRotY - localRotRef.y),
            Math.cos(targetRotY - localRotRef.y)
          );
          localRotRef.y += angleDiff * Math.min(1, 14 * delta);

          movingThisFrame = true;
        } else {
          waypointQueueRef.current.shift();
          if (waypointQueueRef.current.length === 0) {
            movingThisFrame = false;
          }
        }
      }

      // Continuous Smooth Height Calculation matching stadium tiers
      const targetY = getContinuousHeight(localPosRef.z);
      localPosRef.y = THREE.MathUtils.damp(localPosRef.y, targetY, 12, delta);

      // Clamp within 30% wider cinema boundaries (x: [-11.2, 11.2], z: [-5.2, 15.6])
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
          y: Math.round(localPosRef.y * 100) / 100,
          z: Math.round(localPosRef.z * 100) / 100,
          rotY: Math.round(localRotRef.y * 100) / 100,
          isMoving: movingThisFrame,
          pose: movingThisFrame ? 'walk' : 'idle',
        });
      }
    }
  });

  if (isLobby) return null;

  const selfMember: Member = {
    id: selfId,
    name: selfName,
    color: selfColor,
    seat: mySeat,
    seatAt: 0,
    oxygen: myOxygen,
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
  // Desktop [1.25, 2.0], Mobile [1.0, 1.5]
  const isMobile = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const [dpr, setDpr] = useState(isMobile ? 1.25 : 1.75);
  const waypointQueueRef = useRef<Vector3D[]>([]);
  const myAction = actions[selfId];

  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  const handleNavigateToSeat = (seat: string) => {
    if (mySeat) {
      onSelectSeat(seat);
      return;
    }
    const current = { x: localPosRef.x, z: localPosRef.z };
    const path = getPathToSeat(current, seat);
    waypointQueueRef.current = path;
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
          y: getContinuousHeight(pt.z),
          z: pt.z,
        },
      ];
    }
  };

  return (
    <div className="cinema-3d-canvas-wrap">
      <Canvas
        shadows={false} // Realtime shadows removed in favor of blob shadows
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
        {/* Dark scene background #07070a & subtle atmosphere fog */}
        <color attach="background" args={['#07070a']} />
        <fog attach="fog" args={['#07070a', 15, 42]} />

        {/* Adaptive DPR: desktop [1.25, 2.0], mobile [1.0, 1.5] */}
        <PerformanceMonitor
          onIncline={() => setDpr((prev) => Math.min(isMobile ? 1.5 : 2.0, prev + 0.25))}
          onDecline={() => setDpr((prev) => Math.max(isMobile ? 1.0 : 1.25, prev - 0.25))}
        />

        {debugMode && <Stats />}

        <CameraController selfActionTime={myAction?.time} />

        {/* Fixed Lighting system with Lerping cinemaLights switch */}
        <CinemaLighting />

        {/* 1. Màn chiếu lớn 16:9 3D */}
        <Screen3D videoId={videoId} />

        {/* 2. Ghế khán phòng đối xứng (InstancedMesh với Toon material) */}
        <Seats3D
          members={members}
          selfId={selfId}
          mySeat={mySeat}
          onSelectSeat={onSelectSeat}
          onNavigateToSeat={handleNavigateToSeat}
        />

        {/* 3. Dãy 7 bình oxi tường trái (Toon material, text 3D, zero runtime pointLights) */}
        <OxygenTanks3D members={members} />

        {/* 4. Khán phòng kiến trúc (Rộng hơn 30%, có LED bậc thang) */}
        <group>
          {/* Main Floor (Clickable for click-to-move in mouse mode) */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 0]}
            onPointerDown={handleFloorPointerDown}
            onPointerUp={handleFloorPointerUp}
          >
            <planeGeometry args={[26, 42]} />
            <meshStandardMaterial color="#2b2622" roughness={0.9} />
          </mesh>

          {/* Center Aisle Red Velvet Carpet (Width 1.8) */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.01, 2]}
            onPointerDown={handleFloorPointerDown}
            onPointerUp={handleFloorPointerUp}
          >
            <planeGeometry args={[1.8, 36]} />
            <meshStandardMaterial color="#3f0708" roughness={0.85} />
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

          {/* Stadium Tiered Platforms (Rows A-F with LED Step Strips) */}
          {[
            { y: 0.2, z: -3.2, h: 0.4 },
            { y: 0.425, z: -0.4, h: 0.85 },
            { y: 0.65, z: 2.4, h: 1.3 },
            { y: 0.875, z: 5.2, h: 1.75 },
            { y: 1.1, z: 8.0, h: 2.2 },
            { y: 1.325, z: 10.8, h: 2.65 },
          ].map((tier, idx) => (
            <group key={`tier-group-${idx}`}>
              <mesh position={[0, tier.h / 2, tier.z]}>
                <boxGeometry args={[18.4, tier.h, 2.6]} />
                <meshStandardMaterial color="#161517" roughness={0.7} />
              </mesh>
              {/* LED Step Glow Strip (Zero real lights) */}
              <mesh position={[0, tier.h + 0.01, tier.z + 1.28]}>
                <boxGeometry args={[18.4, 0.02, 0.06]} />
                <meshBasicMaterial color="#f59e0b" transparent opacity={0.65} />
              </mesh>
            </group>
          ))}

          {/* Back Walkway Platform */}
          <mesh position={[0, 1.55, 15.5]}>
            <boxGeometry args={[23.5, 3.1, 7.5]} />
            <meshStandardMaterial color="#121113" roughness={0.7} />
          </mesh>

          {/* Side & Back Walls (Height 13.0, wider X at +/- 11.8) */}
          <mesh position={[-11.8, 6.5, 0]}>
            <boxGeometry args={[0.3, 13, 42]} />
            <meshStandardMaterial color="#1c1917" roughness={0.85} />
          </mesh>
          <mesh position={[11.8, 6.5, 0]}>
            <boxGeometry args={[0.3, 13, 42]} />
            <meshStandardMaterial color="#1c1917" roughness={0.85} />
          </mesh>
          <mesh position={[0, 6.5, 19.5]}>
            <boxGeometry args={[24, 13, 0.3]} />
            <meshStandardMaterial color="#18181b" roughness={0.85} />
          </mesh>

          {/* Entrance Doorway at Back Center */}
          <mesh position={[0, 5.0, 19.3]}>
            <boxGeometry args={[3.6, 4.0, 0.2]} />
            <meshStandardMaterial color="#92400e" roughness={0.4} />
          </mesh>

          {/* Wall Sconce Emissive Decorative Lights (Zero runtime lights overhead) */}
          {[-11.6, 11.6].map((xSide) =>
            [-6, 0, 6, 12].map((zPos, sIdx) => (
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

        {/* 6. Remote Players (Always rendered so lobby viewer sees real players) */}
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
