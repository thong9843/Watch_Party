'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { ActionType, Member } from '../lib/types';
import { tankPos3D } from '../lib/layout';

interface Character3DProps {
  member: Member;
  isSelf: boolean;
  x: number;
  y: number;
  z: number;
  rotY: number;
  isMoving: boolean;
  pose: 'walk' | 'sit' | 'crawl' | 'idle' | 'breathe';
  activeChat?: { text: string; time: number } | null;
  activeAction?: { type: ActionType; time: number } | null;
}

export const Character3D: React.FC<Character3DProps> = ({
  member,
  isSelf,
  x,
  y,
  z,
  rotY,
  isMoving,
  pose,
  activeChat,
  activeAction,
}) => {
  const rootRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const confettiMeshRef = useRef<THREE.InstancedMesh>(null);

  // Targets for smooth interpolation (remote users)
  const targetPos = useRef(new THREE.Vector3(x, y, z));
  const targetRotY = useRef(rotY);

  useEffect(() => {
    targetPos.current.set(x, y, z);
    targetRotY.current = rotY;
  }, [x, y, z, rotY]);

  // Check action active status (< 2.6s)
  const now = Date.now();
  const isActionActive = Boolean(activeAction && now - activeAction.time < 2600);
  const currentAction = isActionActive ? activeAction?.type : null;
  const isChatting = Boolean(activeChat && now - activeChat.time < 5000);

  // Confetti particles for SIUU action
  const confettiParticles = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const speed = 1.8 + (i % 3) * 0.8;
      const vy = 2.5 + (i % 2) * 1.2;
      arr.push({
        angle,
        speed,
        vy,
        color: ['#facc15', '#ef4444', '#38bdf8', '#4ade80'][i % 4],
      });
    }
    return arr;
  }, []);

  const dummyMatrix = useMemo(() => new THREE.Matrix4(), []);
  const dummyColor = useMemo(() => new THREE.Color(), []);

  // Frame animation loop (zero React setState)
  useFrame((state, delta) => {
    const root = rootRef.current;
    if (!root) return;

    // 1. Smooth interpolation
    if (isSelf) {
      root.position.set(x, y, z);
      root.rotation.y = rotY;
    } else {
      root.position.x = THREE.MathUtils.damp(root.position.x, targetPos.current.x, 14, delta);
      root.position.y = THREE.MathUtils.damp(root.position.y, targetPos.current.y, 14, delta);
      root.position.z = THREE.MathUtils.damp(root.position.z, targetPos.current.z, 14, delta);
      // Angular slerp/damp
      let diff = targetRotY.current - root.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      root.rotation.y += diff * Math.min(1, delta * 12);
    }

    const t = state.clock.getElapsedTime();
    const lArm = leftArmRef.current;
    const rArm = rightArmRef.current;
    const lLeg = leftLegRef.current;
    const rLeg = rightLegRef.current;
    const head = headRef.current;
    const torso = torsoRef.current;

    // Reset base transforms
    if (torso) torso.scale.set(1, 1, 1);
    root.rotation.x = 0;
    root.rotation.z = 0;

    // 2. State & Action Animations
    if (currentAction === 'siuu') {
      // SIUU Jump + Spin 360
      const elapsedAction = (Date.now() - (activeAction?.time || 0)) / 1000;
      if (elapsedAction < 1.3) {
        const jumpProgress = Math.sin((elapsedAction / 1.3) * Math.PI);
        root.position.y += jumpProgress * 1.6;
        root.rotation.y += elapsedAction * Math.PI * 3.5;
        // Arms raised high
        if (lArm) lArm.rotation.x = -Math.PI * 0.9;
        if (rArm) rArm.rotation.x = -Math.PI * 0.9;
      }
      // Confetti update
      if (confettiMeshRef.current) {
        confettiParticles.forEach((p, idx) => {
          const tP = Math.min(1.5, elapsedAction);
          const px = Math.cos(p.angle) * p.speed * tP;
          const pz = Math.sin(p.angle) * p.speed * tP;
          const py = Math.max(0, p.vy * tP - 0.5 * 9.8 * tP * tP);
          dummyMatrix.makeRotationY(t * 8 + idx);
          dummyMatrix.setPosition(px, py + 0.8, pz);
          confettiMeshRef.current?.setMatrixAt(idx, dummyMatrix);
          dummyColor.set(p.color);
          confettiMeshRef.current?.setColorAt(idx, dummyColor);
        });
        confettiMeshRef.current.instanceMatrix.needsUpdate = true;
        confettiMeshRef.current.instanceColor && (confettiMeshRef.current.instanceColor.needsUpdate = true);
      }
    } else if (currentAction === 'crow') {
      // Rooster crow: puff chest + head tilted back
      if (torso) torso.scale.set(1.22, 1.15, 1.22);
      if (head) {
        head.rotation.x = -0.38 + Math.sin(t * 14) * 0.08;
      }
      if (lArm) lArm.rotation.z = 0.45;
      if (rArm) rArm.rotation.z = -0.45;
    } else if (currentAction === 'shout') {
      // Loud shouting: rapid body vibration
      root.position.x += Math.sin(t * 45) * 0.04;
      root.position.z += Math.cos(t * 45) * 0.04;
      if (head) head.rotation.x = -0.25;
    } else if (pose === 'crawl') {
      // Crawling: tilt forward 75 degrees, alternate flailing
      root.rotation.x = Math.PI * 0.42;
      const crawlFreq = 12;
      if (lArm) lArm.rotation.x = Math.sin(t * crawlFreq) * 0.65;
      if (rArm) rArm.rotation.x = -Math.sin(t * crawlFreq) * 0.65;
      if (lLeg) lLeg.rotation.x = -Math.sin(t * crawlFreq) * 0.65;
      if (rLeg) rLeg.rotation.x = Math.sin(t * crawlFreq) * 0.65;
    } else if (pose === 'sit') {
      // Sitting comfortably on chair cushion
      if (lLeg) lLeg.rotation.x = -Math.PI / 2;
      if (rLeg) rLeg.rotation.x = -Math.PI / 2;
      if (lArm) lArm.rotation.x = -0.3;
      if (rArm) rArm.rotation.x = -0.3;
      if (head) head.rotation.y = Math.sin(t * 0.8) * 0.06;
    } else if (pose === 'breathe') {
      // Breathing at oxygen tank: gentle chest heave
      if (torso) {
        const heave = 1 + Math.sin(t * 3.5) * 0.08;
        torso.scale.set(heave, heave, heave);
      }
      if (lLeg) lLeg.rotation.x = 0;
      if (rLeg) rLeg.rotation.x = 0;
    } else if (isMoving || pose === 'walk') {
      // Natural walking gait
      const walkFreq = 9;
      if (lArm) lArm.rotation.x = Math.sin(t * walkFreq) * 0.6;
      if (rArm) rArm.rotation.x = -Math.sin(t * walkFreq) * 0.6;
      if (lLeg) lLeg.rotation.x = -Math.sin(t * walkFreq) * 0.65;
      if (rLeg) rLeg.rotation.x = Math.sin(t * walkFreq) * 0.65;
      if (head) head.position.y = 0.58 + Math.abs(Math.sin(t * walkFreq)) * 0.04;
    } else {
      // Idle breathing
      if (lArm) lArm.rotation.x = 0;
      if (rArm) rArm.rotation.x = 0;
      if (lLeg) lLeg.rotation.x = 0;
      if (rLeg) rLeg.rotation.x = 0;
      if (head) head.position.y = 0.58 + Math.sin(t * 2) * 0.02;
    }
  });

  // 3D Quadratic Breathing Tube curve to Oxygen Tank
  const breathingTubeGeometry = useMemo(() => {
    if (pose !== 'breathe' || !member.oxygen) return null;
    const tPos = tankPos3D(member.oxygen.tank);
    const start = new THREE.Vector3(tPos.x - x, 1.8 - y, tPos.z - z);
    const end = new THREE.Vector3(0, 0.55, 0.2);
    const mid = new THREE.Vector3(
      (start.x + end.x) * 0.5,
      Math.max(start.y, end.y) + 0.35,
      (start.z + end.z) * 0.5
    );
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    return new THREE.TubeGeometry(curve, 16, 0.035, 8, false);
  }, [pose, member.oxygen, x, y, z]);

  return (
    <group ref={rootRef} position={[x, y, z]} rotation={[0, rotY, 0]}>
      {/* Name tag & chat/action bubbles in 3D */}
      <Html position={[0, 1.15, 0]} center distanceFactor={9} style={{ pointerEvents: 'none' }}>
        <div className="char-3d-ui-box">
          {/* Action text */}
          {isActionActive && (
            <div className={`action-3d-pill fx-${currentAction}`}>
              {currentAction === 'crow' && 'Ò Ó O! Dễ!! 🐓'}
              {currentAction === 'shout' && 'AAAAAA! 📣'}
              {currentAction === 'siuu' && 'SIUUUU! 🙌'}
            </div>
          )}

          {/* Chat bubble */}
          {isChatting && activeChat && (
            <div className="chat-3d-bubble">
              <span>{activeChat.text}</span>
              <div className="chat-bubble-arrow" />
            </div>
          )}

          {/* Name label */}
          <div className={`char-3d-name ${isSelf ? 'is-self' : ''}`}>
            {isSelf ? `★ ${member.name}` : member.name}
          </div>
        </div>
      </Html>

      {/* Confetti Particles (SIUU) */}
      {currentAction === 'siuu' && (
        <instancedMesh
          ref={confettiMeshRef}
          args={[undefined, undefined, confettiParticles.length]}
        >
          <planeGeometry args={[0.08, 0.08]} />
          <meshBasicMaterial side={THREE.DoubleSide} />
        </instancedMesh>
      )}

      {/* 3D Breathing Tube */}
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

      {/* CHIBI 3D MODEL HIERARCHY */}
      {/* 1. Head */}
      <group ref={headRef} position={[0, 0.58, 0]}>
        {/* Head Sphere */}
        <mesh castShadow position={[0, 0, 0]}>
          <sphereGeometry args={[0.34, 20, 18]} />
          <meshStandardMaterial color="#ffdcb8" roughness={0.6} />
        </mesh>

        {/* Dark Hair Cap */}
        <mesh position={[0, 0.1, -0.02]}>
          <sphereGeometry args={[0.36, 18, 16, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
          <meshStandardMaterial color="#18181b" roughness={0.9} />
        </mesh>

        {/* Bangs */}
        <mesh position={[0, 0.22, 0.26]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.32, 0.08, 0.12]} />
          <meshStandardMaterial color="#18181b" roughness={0.9} />
        </mesh>

        {/* Eyes */}
        <mesh position={[-0.11, 0.02, 0.31]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshBasicMaterial color="#09090b" />
        </mesh>
        <mesh position={[0.11, 0.02, 0.31]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshBasicMaterial color="#09090b" />
        </mesh>

        {/* Oxygen Mask if breathing */}
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
          /* Mouth */
          <mesh position={[0, -0.1, 0.31]} rotation={[0, 0, currentAction === 'crow' ? 0.3 : 0]}>
            <sphereGeometry args={[currentAction === 'shout' ? 0.06 : 0.03, 10, 10]} />
            <meshBasicMaterial color={currentAction === 'shout' ? '#dc2626' : '#991b1b'} />
          </mesh>
        )}
      </group>

      {/* 2. Torso with User's Color */}
      <mesh ref={torsoRef} position={[0, 0.24, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.26, 0.38, 18]} />
        <meshStandardMaterial color={member.color} roughness={0.5} />
      </mesh>

      {/* 3. Left Arm */}
      <group ref={leftArmRef} position={[-0.28, 0.32, 0]}>
        <mesh position={[0, -0.12, 0]}>
          <capsuleGeometry args={[0.065, 0.18, 8, 8]} />
          <meshStandardMaterial color={member.color} roughness={0.5} />
        </mesh>
        {/* Hand */}
        <mesh position={[0, -0.25, 0]}>
          <sphereGeometry args={[0.065, 10, 10]} />
          <meshStandardMaterial color="#ffdcb8" roughness={0.6} />
        </mesh>
      </group>

      {/* 4. Right Arm */}
      <group ref={rightArmRef} position={[0.28, 0.32, 0]}>
        <mesh position={[0, -0.12, 0]}>
          <capsuleGeometry args={[0.065, 0.18, 8, 8]} />
          <meshStandardMaterial color={member.color} roughness={0.5} />
        </mesh>
        {/* Hand */}
        <mesh position={[0, -0.25, 0]}>
          <sphereGeometry args={[0.065, 10, 10]} />
          <meshStandardMaterial color="#ffdcb8" roughness={0.6} />
        </mesh>
      </group>

      {/* 5. Left Leg */}
      <group ref={leftLegRef} position={[-0.12, 0.05, 0]}>
        <mesh position={[0, -0.12, 0]} castShadow>
          <capsuleGeometry args={[0.07, 0.14, 8, 8]} />
          <meshStandardMaterial color="#27272a" roughness={0.8} />
        </mesh>
        {/* Shoe */}
        <mesh position={[0, -0.22, 0.04]}>
          <boxGeometry args={[0.13, 0.07, 0.18]} />
          <meshStandardMaterial color="#09090b" roughness={0.9} />
        </mesh>
      </group>

      {/* 6. Right Leg */}
      <group ref={rightLegRef} position={[0.12, 0.05, 0]}>
        <mesh position={[0, -0.12, 0]} castShadow>
          <capsuleGeometry args={[0.07, 0.14, 8, 8]} />
          <meshStandardMaterial color="#27272a" roughness={0.8} />
        </mesh>
        {/* Shoe */}
        <mesh position={[0, -0.22, 0.04]}>
          <boxGeometry args={[0.13, 0.07, 0.18]} />
          <meshStandardMaterial color="#09090b" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
};
