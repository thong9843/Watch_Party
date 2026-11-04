'use client';

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { ActionType, Member } from '../lib/types';
import { oxygenState3D, seatPos3D, tankPos3D } from '../lib/layout';
import { localPosRef, localRotRef, remotePlayersMap } from '../lib/playerRefs';
import { useCinemaStore } from '../lib/store';

// ============================================================================
// CHIBI MESH HIERARCHY (Reusable for Local & Remote)
// ============================================================================
interface ChibiVisualProps {
  member: Member;
  isSelf: boolean;
  rootRef: React.RefObject<THREE.Group | null>;
  headRef: React.RefObject<THREE.Group | null>;
  torsoRef: React.RefObject<THREE.Mesh | null>;
  leftArmRef: React.RefObject<THREE.Group | null>;
  rightArmRef: React.RefObject<THREE.Group | null>;
  leftLegRef: React.RefObject<THREE.Group | null>;
  rightLegRef: React.RefObject<THREE.Group | null>;
  confettiMeshRef: React.RefObject<THREE.InstancedMesh | null>;
  confettiParticles: Array<{ angle: number; speed: number; vy: number; color: string }>;
  breathingTubeGeometry: THREE.BufferGeometry | null;
  activeChat?: { text: string; time: number } | null;
  activeAction?: { type: ActionType; time: number } | null;
  isActionActive: boolean;
  currentAction: ActionType | null;
  isChatting: boolean;
  pose: 'walk' | 'sit' | 'crawl' | 'idle' | 'breathe';
}

const ChibiVisual: React.FC<ChibiVisualProps> = React.memo(function ChibiVisual({
  member,
  isSelf,
  rootRef,
  headRef,
  torsoRef,
  leftArmRef,
  rightArmRef,
  leftLegRef,
  rightLegRef,
  confettiMeshRef,
  confettiParticles,
  breathingTubeGeometry,
  activeChat,
  isActionActive,
  currentAction,
  isChatting,
  pose,
}) {
  return (
    <group ref={rootRef as any}>
      {/* 3D UI Overlays */}
      <Html position={[0, 1.15, 0]} center distanceFactor={9} style={{ pointerEvents: 'none' }}>
        <div className="char-3d-ui-box">
          {isActionActive && (
            <div className={`action-3d-pill fx-${currentAction}`}>
              {currentAction === 'crow' && 'Ò Ó O! Dễ!! 🐓'}
              {currentAction === 'shout' && 'AAAAAA! 📣'}
              {currentAction === 'siuu' && 'SIUUUU! 🙌'}
            </div>
          )}

          {isChatting && activeChat && (
            <div className="chat-3d-bubble">
              <span>{activeChat.text}</span>
              <div className="chat-bubble-arrow" />
            </div>
          )}

          <div className={`char-3d-name ${isSelf ? 'is-self' : ''}`}>
            {isSelf ? `★ ${member.name}` : member.name}
          </div>
        </div>
      </Html>

      {/* Confetti Particles for SIUU */}
      {currentAction === 'siuu' && (
        <instancedMesh
          ref={confettiMeshRef as any}
          args={[undefined, undefined, confettiParticles.length]}
        >
          <planeGeometry args={[0.08, 0.08]} />
          <meshBasicMaterial side={THREE.DoubleSide} />
        </instancedMesh>
      )}

      {/* 3D Oxygen Breathing Tube */}
      {breathingTubeGeometry && (
        <mesh geometry={breathingTubeGeometry}>
          <meshStandardMaterial
            color="#2dd4bf"
            emissive="#14b8a6"
            emissiveIntensity={0.6}
            roughness={0.3}
          />
        </mesh>
      )}

      {/* 1. Head */}
      <group ref={headRef as any} position={[0, 0.58, 0]}>
        <mesh castShadow position={[0, 0, 0]}>
          <sphereGeometry args={[0.34, 20, 18]} />
          <meshStandardMaterial color="#ffdcb8" roughness={0.6} />
        </mesh>

        <mesh position={[0, 0.1, -0.02]}>
          <sphereGeometry args={[0.36, 18, 16, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
          <meshStandardMaterial color="#18181b" roughness={0.9} />
        </mesh>

        <mesh position={[0, 0.22, 0.26]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.32, 0.08, 0.12]} />
          <meshStandardMaterial color="#18181b" roughness={0.9} />
        </mesh>

        <mesh position={[-0.11, 0.02, 0.31]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshBasicMaterial color="#09090b" />
        </mesh>
        <mesh position={[0.11, 0.02, 0.31]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshBasicMaterial color="#09090b" />
        </mesh>

        {pose === 'breathe' ? (
          <group position={[0, -0.09, 0.28]}>
            <mesh>
              <sphereGeometry args={[0.13, 14, 14, 0, Math.PI, 0, Math.PI]} />
              <meshStandardMaterial color="#2dd4bf" roughness={0.3} metalness={0.1} />
            </mesh>
            <mesh position={[0, 0, 0.08]}>
              <cylinderGeometry args={[0.03, 0.03, 0.06, 10]} />
              <meshStandardMaterial color="#0f766e" />
            </mesh>
          </group>
        ) : (
          <mesh position={[0, -0.1, 0.31]} rotation={[0, 0, currentAction === 'crow' ? 0.3 : 0]}>
            <sphereGeometry args={[currentAction === 'shout' ? 0.06 : 0.03, 10, 10]} />
            <meshBasicMaterial color={currentAction === 'shout' ? '#dc2626' : '#991b1b'} />
          </mesh>
        )}
      </group>

      {/* 2. Torso with User Color */}
      <mesh ref={torsoRef as any} position={[0, 0.24, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.26, 0.38, 18]} />
        <meshStandardMaterial color={member.color} roughness={0.5} />
      </mesh>

      {/* 3. Left Arm */}
      <group ref={leftArmRef as any} position={[-0.28, 0.32, 0]}>
        <mesh position={[0, -0.12, 0]}>
          <capsuleGeometry args={[0.065, 0.18, 8, 8]} />
          <meshStandardMaterial color={member.color} roughness={0.5} />
        </mesh>
        <mesh position={[0, -0.25, 0]}>
          <sphereGeometry args={[0.065, 10, 10]} />
          <meshStandardMaterial color="#ffdcb8" roughness={0.6} />
        </mesh>
      </group>

      {/* 4. Right Arm */}
      <group ref={rightArmRef as any} position={[0.28, 0.32, 0]}>
        <mesh position={[0, -0.12, 0]}>
          <capsuleGeometry args={[0.065, 0.18, 8, 8]} />
          <meshStandardMaterial color={member.color} roughness={0.5} />
        </mesh>
        <mesh position={[0, -0.25, 0]}>
          <sphereGeometry args={[0.065, 10, 10]} />
          <meshStandardMaterial color="#ffdcb8" roughness={0.6} />
        </mesh>
      </group>

      {/* 5. Left Leg */}
      <group ref={leftLegRef as any} position={[-0.12, 0.05, 0]}>
        <mesh position={[0, -0.12, 0]} castShadow>
          <capsuleGeometry args={[0.07, 0.14, 8, 8]} />
          <meshStandardMaterial color="#27272a" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.22, 0.04]}>
          <boxGeometry args={[0.13, 0.07, 0.18]} />
          <meshStandardMaterial color="#09090b" roughness={0.9} />
        </mesh>
      </group>

      {/* 6. Right Leg */}
      <group ref={rightLegRef as any} position={[0.12, 0.05, 0]}>
        <mesh position={[0, -0.12, 0]} castShadow>
          <capsuleGeometry args={[0.07, 0.14, 8, 8]} />
          <meshStandardMaterial color="#27272a" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.22, 0.04]}>
          <boxGeometry args={[0.13, 0.07, 0.18]} />
          <meshStandardMaterial color="#09090b" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
});

// ============================================================================
// 1. LOCAL CHARACTER: Directly drives mesh via localPosRef (Zero Props per frame)
// ============================================================================
interface LocalCharacterProps {
  member: Member;
  activeChat?: { text: string; time: number } | null;
  activeAction?: { type: ActionType; time: number } | null;
}

export const LocalCharacter3D: React.FC<LocalCharacterProps> = React.memo(function LocalCharacter3D({
  member,
  activeChat,
  activeAction,
}) {
  const rootRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const confettiMeshRef = useRef<THREE.InstancedMesh>(null);

  const isMoving = useCinemaStore((state) => state.isMoving);
  const isSeated = useCinemaStore((state) => state.isSeated);

  const now = Date.now();
  const isActionActive = Boolean(activeAction && now - activeAction.time < 2600);
  const currentAction = isActionActive ? activeAction?.type || null : null;
  const isChatting = Boolean(activeChat && now - activeChat.time < 5000);

  const confettiParticles = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 18; i++) {
      arr.push({
        angle: (i / 18) * Math.PI * 2,
        speed: 1.8 + (i % 3) * 0.8,
        vy: 2.5 + (i % 2) * 1.2,
        color: ['#facc15', '#ef4444', '#38bdf8', '#4ade80'][i % 4],
      });
    }
    return arr;
  }, []);

  const dummyMatrix = useMemo(() => new THREE.Matrix4(), []);
  const dummyColor = useMemo(() => new THREE.Color(), []);

  const breathingTubeGeometry = useMemo(() => {
    if (!member.oxygen) return null;
    const tPos = tankPos3D(member.oxygen.tank);
    const start = new THREE.Vector3(tPos.x - localPosRef.x, 1.8 - localPosRef.y, tPos.z - localPosRef.z);
    const end = new THREE.Vector3(0, 0.55, 0.2);
    const mid = new THREE.Vector3(
      (start.x + end.x) * 0.5,
      Math.max(start.y, end.y) + 0.35,
      (start.z + end.z) * 0.5
    );
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    return new THREE.TubeGeometry(curve, 16, 0.035, 8, false);
  }, [member.oxygen]);

  useFrame((state) => {
    const root = rootRef.current;
    if (!root) return;

    // Direct mutation of root group from localPosRef (zero React state overhead)
    root.position.copy(localPosRef);
    root.rotation.y = localRotRef.y;

    const t = state.clock.getElapsedTime();
    const lArm = leftArmRef.current;
    const rArm = rightArmRef.current;
    const lLeg = leftLegRef.current;
    const rLeg = rightLegRef.current;
    const head = headRef.current;
    const torso = torsoRef.current;

    if (torso) torso.scale.set(1, 1, 1);
    root.rotation.x = 0;

    const pose = member.oxygen ? 'crawl' : isSeated ? 'sit' : isMoving ? 'walk' : 'idle';

    if (currentAction === 'siuu') {
      const elapsed = (Date.now() - (activeAction?.time || 0)) / 1000;
      if (elapsed < 1.3) {
        const jumpProgress = Math.sin((elapsed / 1.3) * Math.PI);
        root.position.y += jumpProgress * 1.6;
        root.rotation.y += elapsed * Math.PI * 3.5;
        if (lArm) lArm.rotation.x = -Math.PI * 0.9;
        if (rArm) rArm.rotation.x = -Math.PI * 0.9;
      }
      if (confettiMeshRef.current) {
        confettiParticles.forEach((p, idx) => {
          const tP = Math.min(1.5, elapsed);
          dummyMatrix.makeRotationY(t * 8 + idx);
          dummyMatrix.setPosition(
            Math.cos(p.angle) * p.speed * tP,
            Math.max(0, p.vy * tP - 0.5 * 9.8 * tP * tP) + 0.8,
            Math.sin(p.angle) * p.speed * tP
          );
          confettiMeshRef.current?.setMatrixAt(idx, dummyMatrix);
          dummyColor.set(p.color);
          confettiMeshRef.current?.setColorAt(idx, dummyColor);
        });
        confettiMeshRef.current.instanceMatrix.needsUpdate = true;
      }
    } else if (currentAction === 'crow') {
      if (torso) torso.scale.set(1.22, 1.15, 1.22);
      if (head) head.rotation.x = -0.38 + Math.sin(t * 14) * 0.08;
      if (lArm) lArm.rotation.z = 0.45;
      if (rArm) rArm.rotation.z = -0.45;
    } else if (currentAction === 'shout') {
      root.position.x += Math.sin(t * 45) * 0.04;
      root.position.z += Math.cos(t * 45) * 0.04;
      if (head) head.rotation.x = -0.25;
    } else if (pose === 'crawl') {
      root.rotation.x = Math.PI * 0.42;
      const freq = 12;
      if (lArm) lArm.rotation.x = Math.sin(t * freq) * 0.65;
      if (rArm) rArm.rotation.x = -Math.sin(t * freq) * 0.65;
      if (lLeg) lLeg.rotation.x = -Math.sin(t * freq) * 0.65;
      if (rLeg) rLeg.rotation.x = Math.sin(t * freq) * 0.65;
    } else if (pose === 'sit') {
      if (lLeg) lLeg.rotation.x = -Math.PI / 2;
      if (rLeg) rLeg.rotation.x = -Math.PI / 2;
      if (lArm) lArm.rotation.x = -0.3;
      if (rArm) rArm.rotation.x = -0.3;
      if (head) head.rotation.y = Math.sin(t * 0.8) * 0.06;
    } else if (pose === 'walk') {
      const walkFreq = 9;
      if (lArm) lArm.rotation.x = Math.sin(t * walkFreq) * 0.6;
      if (rArm) rArm.rotation.x = -Math.sin(t * walkFreq) * 0.6;
      if (lLeg) lLeg.rotation.x = -Math.sin(t * walkFreq) * 0.65;
      if (rLeg) rLeg.rotation.x = Math.sin(t * walkFreq) * 0.65;
      if (head) head.position.y = 0.58 + Math.abs(Math.sin(t * walkFreq)) * 0.04;
    } else {
      if (lArm) lArm.rotation.x = 0;
      if (rArm) rArm.rotation.x = 0;
      if (lLeg) lLeg.rotation.x = 0;
      if (rLeg) rLeg.rotation.x = 0;
      if (head) head.position.y = 0.58 + Math.sin(t * 2) * 0.02;
    }
  });

  return (
    <ChibiVisual
      member={member}
      isSelf={true}
      rootRef={rootRef}
      headRef={headRef}
      torsoRef={torsoRef}
      leftArmRef={leftArmRef}
      rightArmRef={rightArmRef}
      leftLegRef={leftLegRef}
      rightLegRef={rightLegRef}
      confettiMeshRef={confettiMeshRef}
      confettiParticles={confettiParticles}
      breathingTubeGeometry={breathingTubeGeometry}
      activeChat={activeChat}
      activeAction={activeAction}
      isActionActive={isActionActive}
      currentAction={currentAction}
      isChatting={isChatting}
      pose={member.oxygen ? 'crawl' : isSeated ? 'sit' : isMoving ? 'walk' : 'idle'}
    />
  );
});

// ============================================================================
// 2. REMOTE CHARACTER: Reads target from remotePlayersMap (Zero React Re-renders)
// ============================================================================
interface RemoteCharacterProps {
  member: Member;
  activeChat?: { text: string; time: number } | null;
  activeAction?: { type: ActionType; time: number } | null;
}

export const RemoteCharacter3D: React.FC<RemoteCharacterProps> = React.memo(function RemoteCharacter3D({
  member,
  activeChat,
  activeAction,
}) {
  const rootRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const confettiMeshRef = useRef<THREE.InstancedMesh>(null);

  const now = Date.now();
  const isActionActive = Boolean(activeAction && now - activeAction.time < 2600);
  const currentAction = isActionActive ? activeAction?.type || null : null;
  const isChatting = Boolean(activeChat && now - activeChat.time < 5000);

  const confettiParticles = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 18; i++) {
      arr.push({
        angle: (i / 18) * Math.PI * 2,
        speed: 1.8 + (i % 3) * 0.8,
        vy: 2.5 + (i % 2) * 1.2,
        color: ['#facc15', '#ef4444', '#38bdf8', '#4ade80'][i % 4],
      });
    }
    return arr;
  }, []);

  const dummyMatrix = useMemo(() => new THREE.Matrix4(), []);
  const dummyColor = useMemo(() => new THREE.Color(), []);

  useFrame((state, delta) => {
    const root = rootRef.current;
    if (!root) return;

    let targetX = 0;
    let targetY = 2.8;
    let targetZ = 13.5;
    let targetRotY = Math.PI;
    let pose: 'walk' | 'sit' | 'crawl' | 'idle' | 'breathe' = 'idle';

    // 1. Oxygen state (computed deterministically)
    if (member.oxygen && member.seat) {
      const elapsed = Date.now() - member.oxygen.start;
      const oState = oxygenState3D(member.seat, member.oxygen.tank, elapsed);
      targetX = oState.x;
      targetY = oState.y;
      targetZ = oState.z;
      targetRotY = oState.rotY;
      pose = oState.pose;
    } else if (member.seat) {
      // 2. Sitting on seat
      const s = seatPos3D(member.seat);
      targetX = s.x;
      targetY = s.y;
      targetZ = s.z;
      targetRotY = Math.PI;
      pose = 'sit';
    } else {
      // 3. Free movement: read target from remotePlayersMap (no React state!)
      const rData = remotePlayersMap.get(member.id);
      if (rData) {
        targetX = rData.x;
        targetY = rData.y;
        targetZ = rData.z;
        targetRotY = rData.rotY;
        pose = rData.isMoving ? 'walk' : rData.pose || 'idle';
      }
    }

    // Dampen coordinates to 60fps
    root.position.x = THREE.MathUtils.damp(root.position.x, targetX, 14, delta);
    root.position.y = THREE.MathUtils.damp(root.position.y, targetY, 14, delta);
    root.position.z = THREE.MathUtils.damp(root.position.z, targetZ, 14, delta);

    let diff = targetRotY - root.rotation.y;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    root.rotation.y += diff * Math.min(1, delta * 12);

    const t = state.clock.getElapsedTime();
    const lArm = leftArmRef.current;
    const rArm = rightArmRef.current;
    const lLeg = leftLegRef.current;
    const rLeg = rightLegRef.current;
    const head = headRef.current;
    const torso = torsoRef.current;

    if (torso) torso.scale.set(1, 1, 1);
    root.rotation.x = 0;

    if (currentAction === 'siuu') {
      const elapsed = (Date.now() - (activeAction?.time || 0)) / 1000;
      if (elapsed < 1.3) {
        const jumpProgress = Math.sin((elapsed / 1.3) * Math.PI);
        root.position.y += jumpProgress * 1.6;
        root.rotation.y += elapsed * Math.PI * 3.5;
        if (lArm) lArm.rotation.x = -Math.PI * 0.9;
        if (rArm) rArm.rotation.x = -Math.PI * 0.9;
      }
    } else if (currentAction === 'crow') {
      if (torso) torso.scale.set(1.22, 1.15, 1.22);
      if (head) head.rotation.x = -0.38 + Math.sin(t * 14) * 0.08;
      if (lArm) lArm.rotation.z = 0.45;
      if (rArm) rArm.rotation.z = -0.45;
    } else if (currentAction === 'shout') {
      root.position.x += Math.sin(t * 45) * 0.04;
      root.position.z += Math.cos(t * 45) * 0.04;
      if (head) head.rotation.x = -0.25;
    } else if (pose === 'crawl') {
      root.rotation.x = Math.PI * 0.42;
      const freq = 12;
      if (lArm) lArm.rotation.x = Math.sin(t * freq) * 0.65;
      if (rArm) rArm.rotation.x = -Math.sin(t * freq) * 0.65;
      if (lLeg) lLeg.rotation.x = -Math.sin(t * freq) * 0.65;
      if (rLeg) rLeg.rotation.x = Math.sin(t * freq) * 0.65;
    } else if (pose === 'sit') {
      if (lLeg) lLeg.rotation.x = -Math.PI / 2;
      if (rLeg) rLeg.rotation.x = -Math.PI / 2;
      if (lArm) lArm.rotation.x = -0.3;
      if (rArm) rArm.rotation.x = -0.3;
      if (head) head.rotation.y = Math.sin(t * 0.8) * 0.06;
    } else if (pose === 'walk') {
      const walkFreq = 9;
      if (lArm) lArm.rotation.x = Math.sin(t * walkFreq) * 0.6;
      if (rArm) rArm.rotation.x = -Math.sin(t * walkFreq) * 0.6;
      if (lLeg) lLeg.rotation.x = -Math.sin(t * walkFreq) * 0.65;
      if (rLeg) rLeg.rotation.x = Math.sin(t * walkFreq) * 0.65;
    } else {
      if (lArm) lArm.rotation.x = 0;
      if (rArm) rArm.rotation.x = 0;
      if (lLeg) lLeg.rotation.x = 0;
      if (rLeg) rLeg.rotation.x = 0;
    }
  });

  return (
    <ChibiVisual
      member={member}
      isSelf={false}
      rootRef={rootRef}
      headRef={headRef}
      torsoRef={torsoRef}
      leftArmRef={leftArmRef}
      rightArmRef={rightArmRef}
      leftLegRef={leftLegRef}
      rightLegRef={rightLegRef}
      confettiMeshRef={confettiMeshRef}
      confettiParticles={confettiParticles}
      breathingTubeGeometry={null}
      activeChat={activeChat}
      activeAction={activeAction}
      isActionActive={isActionActive}
      currentAction={currentAction}
      isChatting={isChatting}
      pose={'idle'}
    />
  );
});
