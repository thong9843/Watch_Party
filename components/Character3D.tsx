'use client';

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Outlines } from '@react-three/drei';
import { AppText } from './AppText';
import { ActionType, Member } from '../lib/types';
import { oxygenState3D, seatPos3D, tankPos3D } from '../lib/layout';
import { localPosRef, localRotRef, remotePlayersMap } from '../lib/playerRefs';
import { useCinemaStore } from '../lib/store';

// ============================================================================
// BLOB SHADOW TEXTURE (Cached singleton)
// ============================================================================
let _blobShadowTexture: THREE.CanvasTexture | null = null;
function getBlobShadowTexture(): THREE.CanvasTexture {
  if (!_blobShadowTexture && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.35)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    _blobShadowTexture = new THREE.CanvasTexture(canvas);
  }
  return _blobShadowTexture!;
}

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
      {/* 1. Blob Shadow under player (No realtime shadows) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <planeGeometry args={[0.85, 0.85]} />
        <meshBasicMaterial
          map={getBlobShadowTexture()}
          transparent
          opacity={pose === 'sit' ? 0.35 : 0.65}
          depthWrite={false}
        />
      </mesh>

      {/* 2. 3D Overlays via Billboard + Troika Text (Zero DOM <Html>) */}
      <Billboard position={[0, 1.28, 0]}>
        {/* Action announcement pill */}
        {isActionActive && (
          <group position={[0, isChatting ? 0.65 : 0.35, 0]}>
            <mesh position={[0, 0, -0.01]}>
              <planeGeometry args={[1.7, 0.36]} />
              <meshBasicMaterial color="#b45309" transparent opacity={0.94} />
            </mesh>
            <AppText
              fontSize={0.16}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
              outlineWidth={0.02}
              outlineColor="#451a03"
            >
              {currentAction === 'crow' && 'Ò Ó O! Dễ!! 🐓'}
              {currentAction === 'shout' && 'AAAAAA! 📣'}
              {currentAction === 'siuu' && 'SIUUUU! 🙌'}
            </AppText>
          </group>
        )}

        {/* Chat Bubble */}
        {isChatting && activeChat && (
          <group position={[0, 0.35, 0]}>
            <mesh position={[0, 0, -0.01]}>
              <planeGeometry
                args={[
                  Math.min(3.2, Math.max(1.2, activeChat.text.length * 0.095 + 0.3)),
                  0.36,
                ]}
              />
              <meshBasicMaterial color="#18181b" transparent opacity={0.95} />
            </mesh>
            <AppText
              fontSize={0.14}
              maxWidth={3.0}
              color="#fef08a"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.015}
              outlineColor="#000000"
            >
              {activeChat.text}
            </AppText>
          </group>
        )}

        {/* Player Name Tag */}
        <group position={[0, 0, 0]}>
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[Math.max(0.9, member.name.length * 0.12 + 0.3), 0.24]} />
            <meshBasicMaterial
              color={isSelf ? '#78350f' : '#09090b'}
              transparent
              opacity={0.8}
            />
          </mesh>
          <AppText
            fontSize={0.13}
            color={isSelf ? '#fef08a' : '#f4f4f5'}
            anchorX="center"
            anchorY="middle"
            fontWeight="bold"
            outlineWidth={0.015}
            outlineColor="#09090b"
          >
            {isSelf ? `★ ${member.name}` : member.name}
          </AppText>
        </group>
      </Billboard>

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
          <meshToonMaterial
            color="#2dd4bf"
            emissive="#14b8a6"
            emissiveIntensity={0.6}
          />
        </mesh>
      )}

      {/* 1. Head (Chibi low-poly styled with Outlines) */}
      <group ref={headRef as any} position={[0, 0.62, 0]}>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.35, 22, 20]} />
          <meshToonMaterial color="#ffdcb8" />
          <Outlines thickness={0.025} color="#18181b" />
        </mesh>

        {/* Hair */}
        <mesh position={[0, 0.1, -0.02]}>
          <sphereGeometry args={[0.37, 20, 18, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
          <meshToonMaterial color="#18181b" />
        </mesh>

        {/* Bangs */}
        <mesh position={[0, 0.24, 0.27]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.34, 0.08, 0.12]} />
          <meshToonMaterial color="#18181b" />
        </mesh>

        {/* Eyes */}
        <mesh position={[-0.11, 0.02, 0.32]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshBasicMaterial color="#09090b" />
        </mesh>
        <mesh position={[0.11, 0.02, 0.32]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshBasicMaterial color="#09090b" />
        </mesh>

        {/* Mouth or Oxygen Mask */}
        {pose === 'breathe' ? (
          <group position={[0, -0.09, 0.29]}>
            <mesh>
              <sphereGeometry args={[0.14, 14, 14, 0, Math.PI, 0, Math.PI]} />
              <meshToonMaterial color="#2dd4bf" />
            </mesh>
            <mesh position={[0, 0, 0.08]}>
              <cylinderGeometry args={[0.035, 0.035, 0.06, 10]} />
              <meshToonMaterial color="#0f766e" />
            </mesh>
          </group>
        ) : (
          <mesh position={[0, -0.1, 0.32]} rotation={[0, 0, currentAction === 'crow' ? 0.3 : 0]}>
            <sphereGeometry args={[currentAction === 'shout' ? 0.065 : 0.032, 10, 10]} />
            <meshBasicMaterial color={currentAction === 'shout' ? '#dc2626' : '#991b1b'} />
          </mesh>
        )}
      </group>

      {/* 2. Torso with User Color & Toon Material */}
      <mesh ref={torsoRef as any} position={[0, 0.26, 0]}>
        <cylinderGeometry args={[0.23, 0.27, 0.4, 20]} />
        <meshToonMaterial color={member.color} />
        <Outlines thickness={0.025} color="#18181b" />
      </mesh>

      {/* 3. Left Arm */}
      <group ref={leftArmRef as any} position={[-0.3, 0.34, 0]}>
        <mesh position={[0, -0.12, 0]}>
          <capsuleGeometry args={[0.07, 0.18, 8, 10]} />
          <meshToonMaterial color={member.color} />
        </mesh>
        <mesh position={[0, -0.26, 0]}>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshToonMaterial color="#ffdcb8" />
        </mesh>
      </group>

      {/* 4. Right Arm */}
      <group ref={rightArmRef as any} position={[0.3, 0.34, 0]}>
        <mesh position={[0, -0.12, 0]}>
          <capsuleGeometry args={[0.07, 0.18, 8, 10]} />
          <meshToonMaterial color={member.color} />
        </mesh>
        <mesh position={[0, -0.26, 0]}>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshToonMaterial color="#ffdcb8" />
        </mesh>
      </group>

      {/* 5. Left Leg */}
      <group ref={leftLegRef as any} position={[-0.13, 0.06, 0]}>
        <mesh position={[0, -0.12, 0]}>
          <capsuleGeometry args={[0.075, 0.15, 8, 10]} />
          <meshToonMaterial color="#27272a" />
        </mesh>
        <mesh position={[0, -0.23, 0.04]}>
          <boxGeometry args={[0.14, 0.08, 0.19]} />
          <meshToonMaterial color="#09090b" />
        </mesh>
      </group>

      {/* 6. Right Leg */}
      <group ref={rightLegRef as any} position={[0.13, 0.06, 0]}>
        <mesh position={[0, -0.12, 0]}>
          <capsuleGeometry args={[0.075, 0.15, 8, 10]} />
          <meshToonMaterial color="#27272a" />
        </mesh>
        <mesh position={[0, -0.23, 0.04]}>
          <boxGeometry args={[0.14, 0.08, 0.19]} />
          <meshToonMaterial color="#09090b" />
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

const _dummyConfettiMatrix = new THREE.Matrix4();
const _dummyConfettiColor = new THREE.Color();

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
          _dummyConfettiMatrix.makeRotationY(t * 8 + idx);
          _dummyConfettiMatrix.setPosition(
            Math.cos(p.angle) * p.speed * tP,
            Math.max(0, p.vy * tP - 0.5 * 9.8 * tP * tP) + 0.8,
            Math.sin(p.angle) * p.speed * tP
          );
          confettiMeshRef.current?.setMatrixAt(idx, _dummyConfettiMatrix);
          _dummyConfettiColor.set(p.color);
          confettiMeshRef.current?.setColorAt(idx, _dummyConfettiColor);
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
      if (head) head.position.y = 0.62 + Math.abs(Math.sin(t * walkFreq)) * 0.04;
    } else {
      if (lArm) lArm.rotation.x = 0;
      if (rArm) rArm.rotation.x = 0;
      if (lLeg) lLeg.rotation.x = 0;
      if (rLeg) rLeg.rotation.x = 0;
      if (head) head.position.y = 0.62 + Math.sin(t * 2) * 0.02;
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
// 2. REMOTE CHARACTER: Interpolates pos from remotePlayersMap (Zero Props per frame)
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

  const breathingTubeGeometry = useMemo(() => {
    if (!member.oxygen) return null;
    const tPos = tankPos3D(member.oxygen.tank);
    const start = new THREE.Vector3(tPos.x, 1.8, tPos.z);
    const end = new THREE.Vector3(0, 0.55, 0.2);
    const mid = new THREE.Vector3(
      (start.x + end.x) * 0.5,
      Math.max(start.y, end.y) + 0.35,
      (start.z + end.z) * 0.5
    );
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    return new THREE.TubeGeometry(curve, 16, 0.035, 8, false);
  }, [member.oxygen]);

  useFrame((state, delta) => {
    const root = rootRef.current;
    if (!root) return;

    const t = state.clock.getElapsedTime();
    const lArm = leftArmRef.current;
    const rArm = rightArmRef.current;
    const lLeg = leftLegRef.current;
    const rLeg = rightLegRef.current;
    const head = headRef.current;
    const torso = torsoRef.current;

    if (torso) torso.scale.set(1, 1, 1);
    root.rotation.x = 0;

    let isMoving = false;
    let pose: 'walk' | 'sit' | 'crawl' | 'idle' | 'breathe' = 'idle';

    if (member.oxygen) {
      // Deterministic oxygen crawl
      const elapsed = Date.now() - member.oxygen.start;
      const oState = oxygenState3D(member.seat || 'A1', member.oxygen.tank, elapsed);
      root.position.set(oState.x, oState.y, oState.z);
      root.rotation.y = oState.rotY;
      pose = oState.isBreathing ? 'breathe' : 'crawl';
    } else if (member.seat) {
      // Seated on chair
      const s = seatPos3D(member.seat);
      root.position.set(s.x, s.y, s.z);
      root.rotation.y = Math.PI;
      pose = 'sit';
    } else {
      // Read target position from remotePlayersMap and smoothly damp toward it
      const target = remotePlayersMap.get(member.id);
      if (target) {
        root.position.x = THREE.MathUtils.damp(root.position.x, target.x, 12, delta);
        root.position.y = THREE.MathUtils.damp(root.position.y, target.y, 12, delta);
        root.position.z = THREE.MathUtils.damp(root.position.z, target.z, 12, delta);
        root.rotation.y = THREE.MathUtils.damp(root.rotation.y, target.rotY, 14, delta);
        isMoving = target.isMoving;
      }
      pose = isMoving ? 'walk' : 'idle';
    }

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
          _dummyConfettiMatrix.makeRotationY(t * 8 + idx);
          _dummyConfettiMatrix.setPosition(
            Math.cos(p.angle) * p.speed * tP,
            Math.max(0, p.vy * tP - 0.5 * 9.8 * tP * tP) + 0.8,
            Math.sin(p.angle) * p.speed * tP
          );
          confettiMeshRef.current?.setMatrixAt(idx, _dummyConfettiMatrix);
          _dummyConfettiColor.set(p.color);
          confettiMeshRef.current?.setColorAt(idx, _dummyConfettiColor);
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
      if (head) head.position.y = 0.62 + Math.abs(Math.sin(t * walkFreq)) * 0.04;
    } else {
      if (lArm) lArm.rotation.x = 0;
      if (rArm) rArm.rotation.x = 0;
      if (lLeg) lLeg.rotation.x = 0;
      if (rLeg) rLeg.rotation.x = 0;
      if (head) head.position.y = 0.62 + Math.sin(t * 2) * 0.02;
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
      breathingTubeGeometry={breathingTubeGeometry}
      activeChat={activeChat}
      activeAction={activeAction}
      isActionActive={isActionActive}
      currentAction={currentAction}
      isChatting={isChatting}
      pose={member.oxygen ? 'crawl' : member.seat ? 'sit' : 'idle'}
    />
  );
});
