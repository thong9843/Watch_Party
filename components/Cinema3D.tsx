'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerformanceMonitor, Stats } from '@react-three/drei';
import { Member, RoomConn } from '../lib/types';
import { oxygenState3D, seatPos3D } from '../lib/layout';
import { useCinemaStore } from '../lib/store';
import { Screen3D } from './Screen3D';
import { Seats3D } from './Seats3D';
import { OxygenTanks3D } from './OxygenTanks3D';
import { Character3D } from './Character3D';
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

/** Local Player Controller & Synchronizer running at 60fps in useFrame */
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
}) {
  const localPos = useCinemaStore((state) => state.localPos);
  const setLocalPos = useCinemaStore((state) => state.setLocalPos);
  const localRotY = useCinemaStore((state) => state.localRotY);
  const setLocalRotY = useCinemaStore((state) => state.setLocalRotY);
  const isMoving = useCinemaStore((state) => state.isMoving);
  const setIsMoving = useCinemaStore((state) => state.setIsMoving);
  const isSeated = useCinemaStore((state) => state.isSeated);
  const setIsSeated = useCinemaStore((state) => state.setIsSeated);
  const targetMovePos = useCinemaStore((state) => state.targetMovePos);
  const setTargetMovePos = useCinemaStore((state) => state.setTargetMovePos);
  const targetSeatCode = useCinemaStore((state) => state.targetSeatCode);
  const setTargetSeatCode = useCinemaStore((state) => state.setTargetSeatCode);
  const activeNearbySeat = useCinemaStore((state) => state.activeNearbySeat);
  const joystickVector = useCinemaStore((state) => state.joystickVector);

  const keysPressed = useRef<{ [k: string]: boolean }>({});
  const lastBroadcastTime = useRef<number>(0);
  const currentPos = useRef(new THREE.Vector3(...localPos));
  const currentRotY = useRef(localRotY);

  // Key listeners for WASD & E
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      const k = e.key.toLowerCase();
      keysPressed.current[k] = true;

      // 'E' to Sit or Stand up
      if (k === 'e') {
        if (mySeat) {
          onSelectSeat(null);
        } else if (activeNearbySeat) {
          onSelectSeat(activeNearbySeat);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [mySeat, activeNearbySeat, onSelectSeat]);

  // When mySeat changes, synchronize isSeated state
  useEffect(() => {
    if (mySeat) {
      setIsSeated(true);
      const s = seatPos3D(mySeat);
      currentPos.current.set(s.x, s.y, s.z);
      currentRotY.current = Math.PI; // Face cinema screen
      setLocalPos([s.x, s.y, s.z]);
      setLocalRotY(Math.PI);
      setTargetMovePos(null);
      setTargetSeatCode(null);
    } else {
      setIsSeated(false);
    }
  }, [mySeat, setIsSeated, setLocalPos, setLocalRotY, setTargetMovePos, setTargetSeatCode]);

  // 60fps Movement & Oxygen Loop (zero React state updates unless necessary)
  useFrame((_, delta) => {
    const now = Date.now();
    let moved = false;
    let pose: 'walk' | 'sit' | 'crawl' | 'idle' | 'breathe' = 'idle';

    // 1. Oxygen Mode takes full precedence
    if (myOxygen && mySeat) {
      const elapsed = now - myOxygen.start;
      const oState = oxygenState3D(mySeat, myOxygen.tank, elapsed);
      currentPos.current.set(oState.x, oState.y, oState.z);
      currentRotY.current = oState.rotY;
      pose = oState.pose;
      moved = true;

      if (oState.done) {
        onOxygenComplete();
      }
    } else if (mySeat) {
      // 2. Seated on chair
      const s = seatPos3D(mySeat);
      currentPos.current.set(s.x, s.y, s.z);
      currentRotY.current = Math.PI;
      pose = 'sit';
    } else {
      // 3. Free Movement: Keyboard + Joystick + Click-to-move
      let moveX = 0;
      let moveZ = 0;

      // Keyboard WASD / Arrows
      if (keysPressed.current['w'] || keysPressed.current['arrowup']) moveZ -= 1;
      if (keysPressed.current['s'] || keysPressed.current['arrowdown']) moveZ += 1;
      if (keysPressed.current['a'] || keysPressed.current['arrowleft']) moveX -= 1;
      if (keysPressed.current['d'] || keysPressed.current['arrowright']) moveX += 1;

      // Mobile Virtual Joystick
      if (Math.hypot(joystickVector.x, joystickVector.y) > 0.1) {
        moveX += joystickVector.x;
        moveZ += joystickVector.y;
      }

      const speed = 4.6; // units / sec

      if (Math.hypot(moveX, moveZ) > 0.05) {
        // Direct manual input overrides click-to-move
        setTargetMovePos(null);
        setTargetSeatCode(null);

        const len = Math.hypot(moveX, moveZ);
        const normX = (moveX / len) * speed * delta;
        const normZ = (moveZ / len) * speed * delta;

        currentPos.current.x += normX;
        currentPos.current.z += normZ;
        currentRotY.current = Math.atan2(normX, normZ);
        moved = true;
        pose = 'walk';
      } else if (targetMovePos) {
        // Click-to-move waypoint tracking
        const dx = targetMovePos[0] - currentPos.current.x;
        const dz = targetMovePos[2] - currentPos.current.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.15) {
          const step = Math.min(dist, speed * delta);
          currentPos.current.x += (dx / dist) * step;
          currentPos.current.z += (dz / dist) * step;
          currentRotY.current = Math.atan2(dx, dz);
          moved = true;
          pose = 'walk';
        } else {
          // Reached target
          if (targetSeatCode) {
            onSelectSeat(targetSeatCode);
            setTargetSeatCode(null);
          }
          setTargetMovePos(null);
        }
      }

      // Height clamping based on stadium tiers
      // Walkway ramp tiers
      const z = currentPos.current.z;
      if (z > 10.5) currentPos.current.y = 2.8;
      else if (z > 8.0) currentPos.current.y = 2.4;
      else if (z > 5.5) currentPos.current.y = 2.0;
      else if (z > 3.0) currentPos.current.y = 1.6;
      else if (z > 0.5) currentPos.current.y = 1.2;
      else if (z > -2.0) currentPos.current.y = 0.8;
      else currentPos.current.y = 0.4;

      // Cinema room boundaries
      currentPos.current.x = THREE.MathUtils.clamp(currentPos.current.x, -8.6, 8.6);
      currentPos.current.z = THREE.MathUtils.clamp(currentPos.current.z, -5.2, 14.0);
    }

    setLocalPos([currentPos.current.x, currentPos.current.y, currentPos.current.z]);
    setLocalRotY(currentRotY.current);
    if (moved !== isMoving) setIsMoving(moved);

    // 4. Broadcast position 12-14 times/sec (~75ms)
    if (conn && now - lastBroadcastTime.current > 75) {
      lastBroadcastTime.current = now;
      conn.send({
        type: 'pos',
        id: selfId,
        x: currentPos.current.x,
        y: currentPos.current.y,
        z: currentPos.current.z,
        rotY: currentRotY.current,
        isMoving: moved,
        pose,
      });
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
    <Character3D
      member={selfMember}
      isSelf={true}
      x={localPos[0]}
      y={localPos[1]}
      z={localPos[2]}
      rotY={localRotY}
      isMoving={isMoving}
      pose={myOxygen ? 'crawl' : mySeat ? 'sit' : isMoving ? 'walk' : 'idle'}
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
  const setTargetMovePos = useCinemaStore((state) => state.setTargetMovePos);
  const remotePlayers = useCinemaStore((state) => state.remotePlayers);
  const setRemotePlayer = useCinemaStore((state) => state.setRemotePlayer);
  const myAction = actions[selfId];

  // Remote player positions dictionary for CameraController
  const remotePositions = React.useMemo(() => {
    const dict: Record<string, { x: number; y: number; z: number }> = {};
    for (const key of Object.keys(remotePlayers)) {
      dict[key] = {
        x: remotePlayers[key].x,
        y: remotePlayers[key].y,
        z: remotePlayers[key].z,
      };
    }
    return dict;
  }, [remotePlayers]);

  // Click on floor to walk (Click-to-move Sansa Temple style)
  const handleFloorClick = (e: any) => {
    if (mySeat) return; // Seated player doesn't move on floor click
    const point = e.point;
    if (point) {
      setTargetMovePos([point.x, point.y, point.z]);
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

        <CameraController
          selfActionTime={myAction?.time}
          remotePlayersPos={remotePositions}
        />

        {/* Ambient Cinema Light (Warm Red / Golden velvet hue) */}
        <ambientLight intensity={1.4} color="#fef08a" />

        {/* Single Directional Light with 1024 Shadow Map (High Performance) */}
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

        {/* 2. Ghế khán phòng đối xứng (InstancedMesh 60 ghế) */}
        <Seats3D
          members={members}
          selfId={selfId}
          mySeat={mySeat}
          onSelectSeat={onSelectSeat}
        />

        {/* 3. Dãy 7 bình oxi tường trái */}
        <OxygenTanks3D members={members} />

        {/* 4. Kiến trúc phòng rạp (Sàn, bậc thang, tường, trần) */}
        <group>
          {/* Main Floor (Clickable for click-to-move) */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 0]}
            receiveShadow
            onPointerDown={(e) => {
              e.stopPropagation();
              handleFloorClick(e);
            }}
          >
            <planeGeometry args={[20, 32]} />
            <meshStandardMaterial color="#0c0a09" roughness={0.9} />
          </mesh>

          {/* Center Aisle Red Carpet Runner */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 1]} receiveShadow>
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

          {/* Left Wall */}
          <mesh position={[-9.9, 4.8, 0]}>
            <boxGeometry args={[0.3, 10, 32]} />
            <meshStandardMaterial color="#1c1917" roughness={0.85} />
          </mesh>
          {/* Right Wall */}
          <mesh position={[9.9, 4.8, 0]}>
            <boxGeometry args={[0.3, 10, 32]} />
            <meshStandardMaterial color="#1c1917" roughness={0.85} />
          </mesh>
          {/* Back Wall with Entrance Door */}
          <mesh position={[0, 5.0, 15.0]}>
            <boxGeometry args={[20, 10, 0.3]} />
            <meshStandardMaterial color="#18181b" roughness={0.85} />
          </mesh>
          {/* Entrance Doorway Frame */}
          <mesh position={[0, 4.3, 14.8]}>
            <boxGeometry args={[3.2, 3.6, 0.2]} />
            <meshStandardMaterial color="#b45309" roughness={0.4} />
          </mesh>
        </group>

        {/* 5. Local Player */}
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
        />

        {/* 6. Remote Players */}
        {members
          .filter((m) => m.id !== selfId)
          .map((m) => {
            const rp = remotePlayers[m.id];
            // If seated and no broadcast pos, use seat pos
            let px = rp?.x ?? 0;
            let py = rp?.y ?? 2.8;
            let pz = rp?.z ?? 13.5;
            let rot = rp?.rotY ?? Math.PI;
            let pose = rp?.pose ?? 'idle';

            if (m.oxygen && m.seat) {
              const elapsed = Date.now() - m.oxygen.start;
              const oState = oxygenState3D(m.seat, m.oxygen.tank, elapsed);
              px = oState.x;
              py = oState.y;
              pz = oState.z;
              rot = oState.rotY;
              pose = oState.pose;
            } else if (m.seat) {
              const s = seatPos3D(m.seat);
              px = s.x;
              py = s.y;
              pz = s.z;
              rot = Math.PI;
              pose = 'sit';
            }

            return (
              <Character3D
                key={m.id}
                member={m}
                isSelf={false}
                x={px}
                y={py}
                z={pz}
                rotY={rot}
                isMoving={rp?.isMoving ?? false}
                pose={pose}
                activeChat={chats[m.id]}
                activeAction={actions[m.id]}
              />
            );
          })}
      </Canvas>
    </div>
  );
};
