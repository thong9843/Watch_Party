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

  // References to keep event listeners stable with zero re-registration
  const mySeatRef = useRef<string | null>(mySeat);
  mySeatRef.current = mySeat;

  const onSelectSeatRef = useRef(onSelectSeat);
  onSelectSeatRef.current = onSelectSeat;

  const lastSitStandToggleTime = useRef<number>(0);

  // Clear keys helper
  const clearKeys = () => {
    keysPressed.current = {};
  };

  // Safe Stand-up logic placing player in front of seat aisle and resolving AABB
  const handleStandUp = () => {
    const now = Date.now();
    if (now - lastSitStandToggleTime.current < 400) return;
    lastSitStandToggleTime.current = now;

    clearKeys();
    const curSeat = mySeatRef.current;
    if (curSeat) {
      const s = seatPos3D(curSeat);
      // Place character into aisle lane in front of row (seat.z + 1.2)
      const targetX = s.x;
      const targetZ = s.z + 1.2;
      const safe = resolveOutOfAABB(targetX, targetZ);
      localPosRef.set(safe.x, getContinuousHeight(safe.z), safe.z);
      localRotRef.y = 0; // Turn facing front/aisle
    }
    onSelectSeatRef.current(null);
  };

  // Safe Sit-down logic
  const handleSitDown = (seat: string) => {
    const now = Date.now();
    if (now - lastSitStandToggleTime.current < 400) return;
    lastSitStandToggleTime.current = now;

    clearKeys();
    onSelectSeatRef.current(seat);
  };

  // Register Key Listeners ONCE
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      const k = e.key.toLowerCase();

      // If seated and pressing movement keys (WASD or arrows), auto stand up!
      if (mySeatRef.current) {
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
          handleStandUp();
          return;
        }
      }

      // Ignore repeat for toggle actions
      if (e.repeat) return;

      keysPressed.current[k] = true;

      // 'E' to Sit or Stand up with 400ms debounce
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

  // Synchronize seat position when mySeat changes
  const prevSeatRef = useRef<string | null>(null);
  useEffect(() => {
    if (mySeat) {
      setIsSeated(true);
      const s = seatPos3D(mySeat);
      localPosRef.set(s.x, s.y, s.z);
      localRotRef.y = Math.PI; // Face cinema screen
      if (waypointQueueRef.current) {
        waypointQueueRef.current.length = 0;
      }
      clearKeys();
    } else {
      setIsSeated(false);
      clearKeys();
      // If we just stood up from a seat, ensure outside AABB
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
    const now = Date.now();
    let movingThisFrame = false;

    // 1. OXYGEN MODE (Deterministic path calculation, DO NOT broadcast pos)
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
      // 2. SEATED ON CHAIR (DO NOT broadcast pos)
      const s = seatPos3D(mySeat);
      localPosRef.set(s.x, s.y, s.z);
      localRotRef.y = Math.PI;
      movingThisFrame = false;
    } else {
      // 3. FREE WALKING & WAYPOINT NAVIGATION
      // Calculate movement inputs
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
      const rightX = -forwardZ; // Math.cos(yaw)
      const rightZ = forwardX;  // -Math.sin(yaw)

      const moveX = inputForward * forwardX + inputRight * rightX;
      const moveZ = inputForward * forwardZ + inputRight * rightZ;

      const speed = 4.8;

      if (Math.hypot(moveX, moveZ) > 0.05) {
        // Direct manual input clears waypoint queue
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
          // Slide along X
          localPosRef.x = nextX;
        } else if (!isInsideSeatBlock(localPosRef.x, nextZ)) {
          // Slide along Z
          localPosRef.z = nextZ;
        }

        // Smoothly rotate character towards movement direction without jump
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
          // Reached waypoint, pop and continue
          waypointQueueRef.current.shift();
          if (waypointQueueRef.current.length === 0) {
            movingThisFrame = false;
          }
        }
      }

      // Continuous Smooth Height Calculation matching stadium tiers
      const targetY = getContinuousHeight(localPosRef.z);
      localPosRef.y = THREE.MathUtils.damp(localPosRef.y, targetY, 12, delta);

      // Clamp within cinema walls
      localPosRef.x = THREE.MathUtils.clamp(localPosRef.x, -8.6, 8.6);
      localPosRef.z = THREE.MathUtils.clamp(localPosRef.z, -5.0, 14.2);
    }

    // Only update discrete React state when moving status actually changes
    if (movingThisFrame !== wasMovingRef.current) {
      wasMovingRef.current = movingThisFrame;
      setIsMoving(movingThisFrame);
    }

    // 4. POSITION BROADCAST REDUCTION
    // - Only send when moving or pos changed > 0.05 / angle > 0.05 rad
    // - Max 10 times/sec (interval >= 100ms)
    // - Send 1 final stop packet when stopping
    // - Round to 2 decimal places to minimize payload
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
  const [dpr, setDpr] = useState(1.5);
  const waypointQueueRef = useRef<Vector3D[]>([]);
  const myAction = actions[selfId];

  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  // Click on seat triggers aisle-based navigation
  const handleNavigateToSeat = (seat: string) => {
    if (mySeat) {
      onSelectSeat(seat);
      return;
    }
    const current = { x: localPosRef.x, z: localPosRef.z };
    const path = getPathToSeat(current, seat);
    waypointQueueRef.current = path;
  };

  // Pointer down on floor records start position
  const handleFloorPointerDown = (e: any) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  };

  // Pointer up on floor checks click vs drag and respect controlMode
  const handleFloorPointerUp = (e: any) => {
    if (mySeat) return;
    if (!pointerDownPos.current) return;
    const dist = Math.hypot(
      e.clientX - pointerDownPos.current.x,
      e.clientY - pointerDownPos.current.y
    );
    pointerDownPos.current = null;
    if (dist > 5) return; // Drag detected, do not move

    // In 'keyboard' mode, floor click-to-move is disabled (only seat click works)
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
        shadows
        dpr={dpr}
        camera={{ position: [0, 4.8, 17.5], fov: 52 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          stencil: false,
        }}
      >
        <PerformanceMonitor
          onIncline={() => setDpr(1.75)}
          onDecline={() => setDpr(1.0)}
        />

        {debugMode && <Stats />}

        <CameraController selfActionTime={myAction?.time} />

        {/* Ambient Cinema Lighting */}
        <ambientLight intensity={1.4} color="#fef08a" />

        {/* Single Directional Light with 1024 Shadow Map */}
        <directionalLight
          position={[5, 12, 6]}
          intensity={2.2}
          color="#fffbeb"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={0.5}
          shadow-camera-far={32}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
          shadow-bias={-0.0005}
        />

        {/* Cinema Wall Sconce Accent Lights */}
        <pointLight position={[-9.2, 4.0, -3.0]} intensity={2.5} distance={8} color="#f59e0b" />
        <pointLight position={[-9.2, 4.0, 5.0]} intensity={2.5} distance={8} color="#f59e0b" />
        <pointLight position={[9.2, 4.0, -3.0]} intensity={2.5} distance={8} color="#f59e0b" />
        <pointLight position={[9.2, 4.0, 5.0]} intensity={2.5} distance={8} color="#f59e0b" />

        {/* 1. Màn chiếu lớn 16:9 3D */}
        <Screen3D videoId={videoId} />

        {/* 2. Ghế khán phòng đối xứng (InstancedMesh) */}
        <Seats3D
          members={members}
          selfId={selfId}
          mySeat={mySeat}
          onSelectSeat={onSelectSeat}
          onNavigateToSeat={handleNavigateToSeat}
        />

        {/* 3. Dãy 7 bình oxi tường trái */}
        <OxygenTanks3D members={members} />

        {/* 4. Khán phòng kiến trúc */}
        <group>
          {/* Main Floor (Clickable for click-to-move in mouse mode) */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 0]}
            receiveShadow
            onPointerDown={handleFloorPointerDown}
            onPointerUp={handleFloorPointerUp}
          >
            <planeGeometry args={[20, 32]} />
            <meshStandardMaterial color="#0c0a09" roughness={0.9} />
          </mesh>

          {/* Center Aisle Red Carpet Runner */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.01, 1]}
            receiveShadow
            onPointerDown={handleFloorPointerDown}
            onPointerUp={handleFloorPointerUp}
          >
            <planeGeometry args={[1.5, 28]} />
            <meshStandardMaterial color="#450a0a" roughness={0.8} />
          </mesh>

          {/* Stadium Tiered Platforms (Rows A-F) */}
          {[
            { y: 0.2, z: -3.0, h: 0.4 },
            { y: 0.4, z: -0.5, h: 0.8 },
            { y: 0.6, z: 2.0, h: 1.2 },
            { y: 0.8, z: 4.5, h: 1.6 },
            { y: 1.0, z: 7.0, h: 2.0 },
            { y: 1.2, z: 9.5, h: 2.4 },
          ].map((tier, idx) => (
            <mesh
              key={`tier-mesh-${idx}`}
              position={[0, tier.h / 2, tier.z]}
              receiveShadow
            >
              <boxGeometry args={[14.2, tier.h, 2.3]} />
              <meshStandardMaterial color="#18181b" roughness={0.7} />
            </mesh>
          ))}

          {/* Back Walkway Platform */}
          <mesh position={[0, 1.4, 13.0]} receiveShadow>
            <boxGeometry args={[18.5, 2.8, 3.8]} />
            <meshStandardMaterial color="#141212" roughness={0.7} />
          </mesh>

          {/* Walls */}
          <mesh position={[-9.9, 4.8, 0]}>
            <boxGeometry args={[0.3, 10, 32]} />
            <meshStandardMaterial color="#1c1917" roughness={0.85} />
          </mesh>
          <mesh position={[9.9, 4.8, 0]}>
            <boxGeometry args={[0.3, 10, 32]} />
            <meshStandardMaterial color="#1c1917" roughness={0.85} />
          </mesh>
          <mesh position={[0, 5.0, 15.0]}>
            <boxGeometry args={[20, 10, 0.3]} />
            <meshStandardMaterial color="#18181b" roughness={0.85} />
          </mesh>
          <mesh position={[0, 4.3, 14.8]}>
            <boxGeometry args={[3.2, 3.6, 0.2]} />
            <meshStandardMaterial color="#b45309" roughness={0.4} />
          </mesh>
        </group>

        {/* 5. Local Player (Zero props re-render per frame) */}
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

        {/* 6. Remote Players (Position read from remotePlayersMap inside useFrame) */}
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