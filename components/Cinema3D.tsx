'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor, Stats } from '@react-three/drei';
import { Member, RoomConn } from '../lib/types';
import {
  getPathToSeat,
  isInsideSeatBlock,
  oxygenState3D,
  resolveOutOfAABB,
  seatPos3D,
  ROOM_HALF_W,
  ROOM_FRONT_Z,
  ROOM_BACK_Z,
  CEILING_Y,
  SCREEN_CENTER_Y,
  SCREEN_Z,
} from '../lib/layout';
import { useCinemaStore } from '../lib/store';
import { cameraYawRef, localPosRef, localRotRef } from '../lib/playerRefs';
import { Screen3D } from './Screen3D';
import { Seats3D } from './Seats3D';
import { OxygenTanks3D } from './OxygenTanks3D';
import { LocalCharacter3D, RemoteInstancedCharacters3D } from './Character3D';
import { ConfettiPool3D } from './ConfettiPool3D';
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
    // V2.3: 2x Cinema lighting balance
    const targetHemi = isBright ? 2.4 : 0.85;
    const targetAmbient = isBright ? 0.5 : 0.18;
    const targetDir = isBright ? 1.5 : 0.5;
    const targetScreen = isBright ? 3.0 : 5.0;

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
        color="#fff2df"
        groundColor="#26201b"
        intensity={2.4}
      />

      {/* 2. Ambient Light */}
      <ambientLight
        ref={ambientRef}
        color="#fff2df"
        intensity={0.5}
      />

      {/* 3. Directional Light from above-behind */}
      <directionalLight
        ref={dirRef}
        position={[0, 24, 10]}
        color="#fff2df"
        intensity={1.5}
      />

      {/* 4. Screen Front Reflection Light */}
      <pointLight
        ref={screenLightRef}
        position={[0, SCREEN_CENTER_Y, SCREEN_Z + 2.0]}
        intensity={3.0}
        distance={50}
        color="#fef08a"
      />
    </>
  );
}

function RendererInfoTracker() {
  const { gl } = useThree();
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__threeRenderer = gl;
    }
  }, [gl]);
  return null;
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
  waypointQueueRef: React.MutableRefObject<Array<{ x: number; y: number; z: number }>>;
}) {
  const keysPressed = useRef<Record<string, boolean>>({});
  const joystickVector = useCinemaStore((state) => state.joystickVector);
  const isSeated = useCinemaStore((state) => state.isSeated);
  const setIsSeated = useCinemaStore((state) => state.setIsSeated);
  const setIsMoving = useCinemaStore((state) => state.setIsMoving);
  const activeNearbySeat = useCinemaStore((state) => state.activeNearbySeat);

  const wasMovingRef = useRef(false);
  const lastSitStandToggleTime = useRef(0);
  const lastBroadcastTime = useRef(0);
  const lastBroadcastPos = useRef({ x: 0, y: 0, z: 0, rotY: 0 });

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
      // Step forward into the row aisle towards screen (-Z)
      const targetZ = s.z - 1.1;
      const safe = resolveOutOfAABB(targetX, targetZ);
      localPosRef.set(safe.x, 0, safe.z);
      localRotRef.y = Math.PI; // Face screen (-Z)
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
  }, []);

  useEffect(() => {
    const seated = Boolean(mySeat);
    if (seated !== isSeated) {
      setIsSeated(seated);
    }
    clearKeys();
  }, [mySeat, isSeated, setIsSeated]);

  // Main 60fps local player physics loop
  useFrame((_, delta) => {
    const now = Date.now();
    let movingThisFrame = false;

    if (myOxygen) {
      // 1. OXYGEN CRAWL PROGRESSION
      const elapsed = now - myOxygen.start;
      const oState = oxygenState3D(mySeat || 'A1', myOxygen.tank, elapsed);
      localPosRef.set(oState.x, oState.y, oState.z);
      localRotRef.y = oState.rotY;
      movingThisFrame = true;

      if (oState.done) {
        onOxygenComplete();
      }
    } else if (mySeat) {
      // 2. SEATED ON CHAIR (Sitting facing screen -Z)
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

      const inputMagnitude = Math.hypot(inputForward, inputRight);

      if (inputMagnitude > 0.05) {
        waypointQueueRef.current = [];
        const normF = inputForward / inputMagnitude;
        const normR = inputRight / inputMagnitude;

        // Camera-relative direction
        const camYaw = cameraYawRef.value;
        const camForwardX = -Math.sin(camYaw);
        const camForwardZ = -Math.cos(camYaw);
        const camRightX = Math.cos(camYaw);
        const camRightZ = -Math.sin(camYaw);

        const moveDirX = normF * camForwardX + normR * camRightX;
        const moveDirZ = normF * camForwardZ + normR * camRightZ;

        const moveSpeed = 6.2; // 3D units/sec
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

        if (dist > 0.18) {
          const moveSpeed = 5.8;
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

      // Clamp within cinema boundaries
      localPosRef.x = THREE.MathUtils.clamp(localPosRef.x, -ROOM_HALF_W + 0.8, ROOM_HALF_W - 0.8);
      localPosRef.z = THREE.MathUtils.clamp(localPosRef.z, ROOM_FRONT_Z + 1.2, ROOM_BACK_Z - 1.2);
    }

    if (movingThisFrame !== wasMovingRef.current) {
      wasMovingRef.current = movingThisFrame;
      setIsMoving(movingThisFrame);
    }

    // 4. POSITION BROADCAST REDUCTION (V3 O2: <= 5 packets/s when walking, 0 packets/s when stationary or seated)
    if (conn && !mySeat && !myOxygen) {
      const posDist = Math.hypot(
        localPosRef.x - lastBroadcastPos.current.x,
        localPosRef.z - lastBroadcastPos.current.z
      );
      const angleDiff = Math.abs(localRotRef.y - lastBroadcastPos.current.rotY);
      const timeSinceLast = now - lastBroadcastTime.current;

      // 5 packets/second maximum when moving: timeSinceLast >= 200ms
      // Distance threshold: > 0.08m, rotation threshold: > 0.1 rad
      const shouldSendMoving = movingThisFrame && timeSinceLast >= 200 && (posDist > 0.08 || angleDiff > 0.1);
      const shouldSendStop = !movingThisFrame && lastBroadcastPos.current.x !== localPosRef.x && timeSinceLast >= 200;

      if (shouldSendMoving || shouldSendStop) {
        lastBroadcastTime.current = now;
        lastBroadcastPos.current = {
          x: localPosRef.x,
          y: localPosRef.y,
          z: localPosRef.z,
          rotY: localRotRef.y,
        };

        // Compact array format: [id, x, z, rotY, pose]
        // pose: 0=idle, 1=walk, 2=sit, 3=crawl, 4=breathe
        conn.send([
          selfId,
          Math.round(localPosRef.x * 100) / 100,
          Math.round(localPosRef.z * 100) / 100,
          Math.round(localRotRef.y * 100) / 100,
          movingThisFrame ? 1 : 0,
        ]);
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
  const [dpr, setDpr] = useState(1.5);
  const graphicsQuality = useCinemaStore((state) => state.graphicsQuality);

  const effectiveDpr = useMemo(() => {
    if (graphicsQuality === 'high') return 1.75;
    if (graphicsQuality === 'med') return 1.25;
    if (graphicsQuality === 'low') return 1.0;
    return dpr; // 'auto'
  }, [graphicsQuality, dpr]);

  const waypointQueueRef = useRef<Array<{ x: number; y: number; z: number }>>([]);
  const selfActionTime = actions[selfId]?.time;
  const floorClickStart = useRef<{ x: number; y: number } | null>(null);

  const handleNavigateToSeat = (seat: string) => {
    if (mySeat) {
      onSelectSeat(null);
    }
    const path = getPathToSeat(
      { x: localPosRef.x, z: localPosRef.z },
      seat
    );
    waypointQueueRef.current = path;
  };

  const handleFloorPointerDown = (e: any) => {
    floorClickStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleFloorPointerUp = (e: any) => {
    if (!floorClickStart.current) return;
    const dist = Math.hypot(
      e.clientX - floorClickStart.current.x,
      e.clientY - floorClickStart.current.y
    );
    floorClickStart.current = null;
    if (dist > 8) return;

    if (useCinemaStore.getState().controlMode !== 'mouse') return;
    if (mySeat) return;

    const point = e.point;
    if (!point) return;

    const safePoint = resolveOutOfAABB(point.x, point.z);
    waypointQueueRef.current = [
      {
        x: safePoint.x,
        y: 0,
        z: safePoint.z,
      },
    ];
  };

  return (
    <div className="cinema-3d-canvas-wrap">
      <Canvas
        shadows={false}
        dpr={effectiveDpr}
        camera={{ position: [0.0, 10.0, 22.0], fov: 52, far: 150 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          stencil: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
      >
        <color attach="background" args={['#07070a']} />
        <fog args={['#07070a', 25, 65]} />

        {graphicsQuality === 'auto' && (
          <PerformanceMonitor
            onIncline={() => setDpr((prev) => Math.min(2.0, prev + 0.25))}
            onDecline={() => setDpr((prev) => Math.max(1.0, prev - 0.25))}
          />
        )}

        {debugMode && <Stats />}

        <RendererInfoTracker />

        <CameraController
          selfActionTime={selfActionTime}
          isBreathingOxygen={Boolean(myOxygen)}
        />

        {/* 4 Fixed Real Lights (CinemaLighting) */}
        <CinemaLighting />

        {/* 1. Màn chiếu 3D 28x15.75m kèm 2 dải banner cổ vũ */}
        <Screen3D videoId={videoId} />

        {/* 2. Ghế khán phòng (8 dãy × 14 ghế = 112 ghế trên sàn phẳng y = 0) */}
        <Seats3D
          members={members}
          selfId={selfId}
          mySeat={mySeat}
          onSelectSeat={onSelectSeat}
          onNavigateToSeat={handleNavigateToSeat}
        />

        {/* 3. Dãy 8 bình oxi tường trái tại x = -17.0 */}
        <OxygenTanks3D members={members} />

        {/* 4. Khán phòng kiến trúc V2.3.1 (Thu gọn: 34m x 39.5m, Trần cao 22m, Ghế chiếm ~70% sàn) */}
        <group>
          {/* Main Floor (Clickable for click-to-move in mouse mode) */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, -0.25]}
            onPointerDown={handleFloorPointerDown}
            onPointerUp={handleFloorPointerUp}
          >
            <planeGeometry args={[36, 42]} />
            <meshStandardMaterial color="#362f29" roughness={0.9} />
          </mesh>

          {/* Ceiling (Single large mesh) */}
          <mesh
            rotation={[Math.PI / 2, 0, 0]}
            position={[0, CEILING_Y, -0.25]}
          >
            <planeGeometry args={[36, 42]} />
            <meshStandardMaterial color="#181513" roughness={0.95} />
          </mesh>

          {/* Center Aisle Red Velvet Carpet (Width 2.0m, X in [-1.0, 1.0]) */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.01, -0.25]}
            onPointerDown={handleFloorPointerDown}
            onPointerUp={handleFloorPointerUp}
          >
            <planeGeometry args={[2.0, 39]} />
            <meshStandardMaterial color="#4a0e17" roughness={0.85} />
          </mesh>

          {/* LED Guide Strips along Center Aisle */}
          <mesh position={[-1.05, 0.02, -0.25]}>
            <boxGeometry args={[0.05, 0.02, 39]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.85} />
          </mesh>
          <mesh position={[1.05, 0.02, -0.25]}>
            <boxGeometry args={[0.05, 0.02, 39]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.85} />
          </mesh>

          {/* LED Guide Strips along Side Walkways */}
          <mesh position={[-13.8, 0.02, -0.25]}>
            <boxGeometry args={[0.05, 0.02, 39]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.7} />
          </mesh>
          <mesh position={[13.8, 0.02, -0.25]}>
            <boxGeometry args={[0.05, 0.02, 39]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.7} />
          </mesh>

          {/* Ambient LED Strips along Base of Left and Right Walls */}
          <mesh position={[-ROOM_HALF_W + 0.2, 0.04, -0.25]}>
            <boxGeometry args={[0.08, 0.04, 39]} />
            <meshBasicMaterial color="#0284c7" transparent opacity={0.6} />
          </mesh>
          <mesh position={[ROOM_HALF_W - 0.2, 0.04, -0.25]}>
            <boxGeometry args={[0.08, 0.04, 39]} />
            <meshBasicMaterial color="#0284c7" transparent opacity={0.6} />
          </mesh>

          {/* Left Wall at X = -17.0 */}
          <mesh position={[-ROOM_HALF_W, CEILING_Y / 2, -0.25]}>
            <boxGeometry args={[0.4, CEILING_Y, 41]} />
            <meshStandardMaterial color="#2d2722" roughness={0.85} />
          </mesh>
          {/* Right Wall at X = 17.0 */}
          <mesh position={[ROOM_HALF_W, CEILING_Y / 2, -0.25]}>
            <boxGeometry args={[0.4, CEILING_Y, 41]} />
            <meshStandardMaterial color="#2d2722" roughness={0.85} />
          </mesh>
          {/* Back Wall at Z = 19.5 */}
          <mesh position={[0, CEILING_Y / 2, ROOM_BACK_Z]}>
            <boxGeometry args={[36, CEILING_Y, 0.4]} />
            <meshStandardMaterial color="#2d2722" roughness={0.85} />
          </mesh>
          {/* Front Wall (Behind Screen) at Z = -20.5 */}
          <mesh position={[0, CEILING_Y / 2, ROOM_FRONT_Z - 0.5]}>
            <boxGeometry args={[36, CEILING_Y, 0.4]} />
            <meshStandardMaterial color="#1a1614" roughness={0.9} />
          </mesh>

          {/* Entrance Doorway at Back Wall Center */}
          <mesh position={[0, 2.8, ROOM_BACK_Z - 0.2]}>
            <boxGeometry args={[4.5, 5.6, 0.2]} />
            <meshStandardMaterial color="#854d0e" roughness={0.4} />
          </mesh>

          {/* Wall Sconce Emissive Decorative Lights */}
          {[-ROOM_HALF_W + 0.2, ROOM_HALF_W - 0.2].map((xSide) =>
            [-16, -10, -4, 2, 8, 14].map((zPos, sIdx) => (
              <group key={`sconce-${xSide}-${sIdx}`} position={[xSide, 8.5, zPos]}>
                <mesh>
                  <boxGeometry args={[0.15, 0.9, 0.3]} />
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

        {/* 6. Instanced Remote Players (Standing + Seated) & Active Players */}
        <RemoteInstancedCharacters3D
          members={members}
          selfId={selfId}
          chats={chats}
          actions={actions}
        />

        {/* 7. Shared Confetti Pool (Max 300 particles, 8 concurrent bursts) */}
        <ConfettiPool3D />
      </Canvas>
    </div>
  );
};
