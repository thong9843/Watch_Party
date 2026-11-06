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
import {
  getStandingTorsoGeometry,
  getStandingHeadLimbsGeometry,
  getSeatedTorsoGeometry,
  getSeatedHeadLimbsGeometry,
  sharedTorsoMaterial,
  sharedHeadLimbsMaterial,
} from '../lib/characterGeometries';
import { triggerConfettiBurst } from './ConfettiPool3D';
import { filterBadWords } from '../lib/badwords';

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

// Module-level scratch objects for useFrame
const _dummyMatrix = new THREE.Matrix4();
const _dummyColor = new THREE.Color();
const _hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const _camPos = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _toMemberVec = new THREE.Vector3();

// ============================================================================
// 1. LOCAL CHARACTER (Zero React state overhead in useFrame)
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
  const torsoRef = useRef<THREE.Mesh>(null);
  const headLimbsRef = useRef<THREE.Mesh>(null);
  const lastActionTriggered = useRef<number>(0);

  const isMoving = useCinemaStore((state) => state.isMoving);
  const isSeated = useCinemaStore((state) => state.isSeated);
  const isFirstPerson = useCinemaStore((state) => state.isFirstPerson);
  const graphicsQuality = useCinemaStore((state) => state.graphicsQuality);

  const now = Date.now();
  const isActionActive = Boolean(activeAction && now - activeAction.time < 2600);
  const currentAction = isActionActive ? activeAction?.type || null : null;
  const isChatting = Boolean(activeChat && now - activeChat.time < 5000);

  // Custom shirt material for local player
  const localTorsoMaterial = useMemo(() => {
    return new THREE.MeshToonMaterial({ color: member.color });
  }, [member.color]);

  // Breathing tube geometry if oxygen active
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

    // First-person view: hide local character model
    root.visible = !isFirstPerson;

    // Direct mutation from localPosRef (zero React state overhead)
    root.position.copy(localPosRef);
    root.rotation.y = localRotRef.y;
    root.rotation.x = 0;

    const t = state.clock.getElapsedTime();
    const torso = torsoRef.current;
    const headLimbs = headLimbsRef.current;

    if (torso) torso.scale.set(1, 1, 1);
    if (headLimbs) headLimbs.scale.set(1, 1, 1);

    if (currentAction === 'siuu') {
      const elapsed = (Date.now() - (activeAction?.time || 0)) / 1000;
      if (activeAction && activeAction.time !== lastActionTriggered.current) {
        lastActionTriggered.current = activeAction.time;
        triggerConfettiBurst(localPosRef.x, localPosRef.y, localPosRef.z);
      }
      if (elapsed < 1.3) {
        const jumpProgress = Math.sin((elapsed / 1.3) * Math.PI);
        root.position.y += jumpProgress * 1.6;
        root.rotation.y += elapsed * Math.PI * 3.5;
      }
    } else if (currentAction === 'crow') {
      if (torso) torso.scale.set(1.22, 1.15, 1.22);
      if (headLimbs) {
        headLimbs.rotation.x = -0.35 + Math.sin(t * 14) * 0.08;
      }
    } else if (currentAction === 'shout') {
      root.position.x += Math.sin(t * 45) * 0.04;
      root.position.z += Math.cos(t * 45) * 0.04;
    } else if (member.oxygen) {
      root.rotation.x = Math.PI * 0.42;
    } else if (isMoving) {
      // Walk bob
      const walkFreq = 9;
      root.position.y += Math.abs(Math.sin(t * walkFreq)) * 0.05;
      root.rotation.z = Math.sin(t * walkFreq) * 0.04;
    } else {
      root.rotation.z = 0;
      if (headLimbs) headLimbs.rotation.x = 0;
    }
  });

  const enableOutlines = graphicsQuality !== 'low';

  return (
    <group ref={rootRef as any}>
      {/* Blob Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <planeGeometry args={[0.85, 0.85]} />
        <meshBasicMaterial
          map={getBlobShadowTexture()}
          transparent
          opacity={isSeated ? 0.35 : 0.65}
          depthWrite={false}
        />
      </mesh>

      {/* 3D Overlays */}
      <Billboard position={[0, 1.35, 0]}>
        {/* Action announcement */}
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
              {filterBadWords(activeChat.text)}
            </AppText>
          </group>
        )}

        {/* Local Player Name Tag */}
        <AppText
          fontSize={0.11}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          fontWeight="bold"
          outlineWidth={0.012}
          outlineColor="#000000"
        >
          {`★ ${member.name}`}
        </AppText>
      </Billboard>

      {/* 3D Oxygen Breathing Tube */}
      {breathingTubeGeometry && (
        <mesh geometry={breathingTubeGeometry}>
          <meshToonMaterial color="#2dd4bf" emissive="#14b8a6" emissiveIntensity={0.6} />
        </mesh>
      )}

      {/* Mesh 1: Torso */}
      <mesh
        ref={torsoRef as any}
        geometry={isSeated ? getSeatedTorsoGeometry() : getStandingTorsoGeometry()}
        material={localTorsoMaterial}
      >
        {enableOutlines && <Outlines thickness={0.02} color="#18181b" />}
      </mesh>

      {/* Mesh 2: Head & Limbs (Merged with Vertex Colors) */}
      <mesh
        ref={headLimbsRef as any}
        geometry={isSeated ? getSeatedHeadLimbsGeometry() : getStandingHeadLimbsGeometry()}
        material={sharedHeadLimbsMaterial}
      >
        {enableOutlines && <Outlines thickness={0.02} color="#18181b" />}
      </mesh>
    </group>
  );
});

// ============================================================================
// 2. ACTIVE REMOTE CHARACTER (Only rendered when doing Action or Oxygen)
// ============================================================================
interface ActiveRemoteCharacterProps {
  member: Member;
  activeChat?: { text: string; time: number } | null;
  activeAction?: { type: ActionType; time: number } | null;
  onSelectMember?: (m: Member) => void;
}

export const ActiveRemoteCharacter3D: React.FC<ActiveRemoteCharacterProps> = React.memo(
  function ActiveRemoteCharacter3D({ member, activeChat, activeAction, onSelectMember }) {
    const rootRef = useRef<THREE.Group>(null);
    const torsoRef = useRef<THREE.Mesh>(null);
    const headLimbsRef = useRef<THREE.Mesh>(null);
    const lastActionTriggered = useRef<number>(0);

    const graphicsQuality = useCinemaStore((state) => state.graphicsQuality);
    const mutedUsers = useCinemaStore((state) => state.mutedUsers);
    const isMuted = mutedUsers.includes(member.id);

    const now = Date.now();
    const isActionActive = !isMuted && Boolean(activeAction && now - activeAction.time < 2600);
    const currentAction = isActionActive ? activeAction?.type || null : null;
    const isChatting = !isMuted && Boolean(activeChat && now - activeChat.time < 5000);

    const torsoMaterial = useMemo(() => {
      return new THREE.MeshToonMaterial({ color: member.color });
    }, [member.color]);

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
      const torso = torsoRef.current;
      const headLimbs = headLimbsRef.current;

      if (torso) torso.scale.set(1, 1, 1);
      if (headLimbs) headLimbs.scale.set(1, 1, 1);
      root.rotation.x = 0;

      if (member.oxygen) {
        const elapsed = Date.now() - member.oxygen.start;
        const oState = oxygenState3D(member.seat || 'A1', member.oxygen.tank, elapsed);
        root.position.set(oState.x, oState.y, oState.z);
        root.rotation.y = oState.rotY;
        if (!oState.isBreathing) {
          root.rotation.x = Math.PI * 0.42;
        }
      } else if (member.seat) {
        const s = seatPos3D(member.seat);
        root.position.set(s.x, s.y, s.z);
        root.rotation.y = Math.PI;
      } else {
        const target = remotePlayersMap.get(member.id);
        if (target) {
          root.position.x = THREE.MathUtils.damp(root.position.x, target.x, 12, delta);
          root.position.y = THREE.MathUtils.damp(root.position.y, target.y, 12, delta);
          root.position.z = THREE.MathUtils.damp(root.position.z, target.z, 12, delta);
          root.rotation.y = THREE.MathUtils.damp(root.rotation.y, target.rotY, 14, delta);
        }
      }

      if (currentAction === 'siuu') {
        const elapsed = (Date.now() - (activeAction?.time || 0)) / 1000;
        if (activeAction && activeAction.time !== lastActionTriggered.current) {
          lastActionTriggered.current = activeAction.time;
          triggerConfettiBurst(root.position.x, root.position.y, root.position.z);
        }
        if (elapsed < 1.3) {
          const jumpProgress = Math.sin((elapsed / 1.3) * Math.PI);
          root.position.y += jumpProgress * 1.6;
          root.rotation.y += elapsed * Math.PI * 3.5;
        }
      } else if (currentAction === 'crow') {
        if (torso) torso.scale.set(1.22, 1.15, 1.22);
        if (headLimbs) headLimbs.rotation.x = -0.35 + Math.sin(t * 14) * 0.08;
      } else if (currentAction === 'shout') {
        root.position.x += Math.sin(t * 45) * 0.04;
        root.position.z += Math.cos(t * 45) * 0.04;
      }
    });

    const isSeated = Boolean(member.seat && !member.oxygen);
    const enableOutlines = graphicsQuality !== 'low';

    return (
      <group ref={rootRef as any}>
        {/* Blob Shadow */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <planeGeometry args={[0.85, 0.85]} />
          <meshBasicMaterial
            map={getBlobShadowTexture()}
            transparent
            opacity={isSeated ? 0.35 : 0.65}
            depthWrite={false}
          />
        </mesh>

        {/* 3D Overlays */}
        <Billboard position={[0, 1.35, 0]}>
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
                {filterBadWords(activeChat.text)}
              </AppText>
            </group>
          )}

          <group onClick={(e: any) => { e.stopPropagation(); onSelectMember?.(member); }}>
            <AppText
              fontSize={0.11}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
              outlineWidth={0.012}
              outlineColor="#000000"
            >
              {member.name}
            </AppText>
          </group>
        </Billboard>

        {/* 3D Oxygen Breathing Tube */}
        {breathingTubeGeometry && (
          <mesh geometry={breathingTubeGeometry}>
            <meshToonMaterial color="#2dd4bf" emissive="#14b8a6" emissiveIntensity={0.6} />
          </mesh>
        )}

        <mesh
          ref={torsoRef as any}
          geometry={isSeated ? getSeatedTorsoGeometry() : getStandingTorsoGeometry()}
          material={torsoMaterial}
        >
          {enableOutlines && <Outlines thickness={0.02} color="#18181b" />}
        </mesh>
        <mesh
          ref={headLimbsRef as any}
          geometry={isSeated ? getSeatedHeadLimbsGeometry() : getStandingHeadLimbsGeometry()}
          material={sharedHeadLimbsMaterial}
        >
          {enableOutlines && <Outlines thickness={0.02} color="#18181b" />}
        </mesh>
      </group>
    );
  }
);

// ============================================================================
// 3. REMOTE INSTANCED CHARACTERS (High-performance instanced rendering)
// Renders all passive remote players in 2-4 draw calls.
// Controls LOD & limits 3D Text name tags to the 20 closest players.
// ============================================================================
interface RemoteInstancedCharactersProps {
  members: Member[];
  selfId: string;
  chats: Record<string, { text: string; time: number }>;
  actions: Record<string, { type: ActionType; time: number }>;
  onSelectMember?: (m: Member) => void;
}

export const RemoteInstancedCharacters3D: React.FC<RemoteInstancedCharactersProps> = React.memo(
  function RemoteInstancedCharacters3D({ members, selfId, chats, actions, onSelectMember }) {
    // Instanced meshes for standing players
    const standingTorsoRef = useRef<THREE.InstancedMesh>(null);
    const standingHeadLimbsRef = useRef<THREE.InstancedMesh>(null);

    // Instanced meshes for seated players
    const seatedTorsoRef = useRef<THREE.InstancedMesh>(null);
    const seatedHeadLimbsRef = useRef<THREE.InstancedMesh>(null);

    // Track visible name IDs (max 19 closest + self = 20)
    const [visibleNameIds, setVisibleNameIds] = React.useState<Set<string>>(new Set());
    const frameCount = useRef<number>(0);

    const now = Date.now();

    // Separate active players (doing action or oxygen) vs passive players
    const { activeMembers, standingMembers, seatedMembers } = useMemo(() => {
      const active: Member[] = [];
      const standing: Member[] = [];
      const seated: Member[] = [];

      for (const m of members) {
        if (m.id === selfId) continue;
        const act = actions[m.id];
        const isActionActive = act && now - act.time < 2600;
        if (m.oxygen || isActionActive) {
          active.push(m);
        } else if (m.seat) {
          seated.push(m);
        } else {
          standing.push(m);
        }
      }
      return { activeMembers: active, standingMembers: standing, seatedMembers: seated };
    }, [members, selfId, actions, now]);

    // Update InstancedMeshes every frame
    useFrame((state, delta) => {
      const sTorso = standingTorsoRef.current;
      const sHead = standingHeadLimbsRef.current;
      const seTorso = seatedTorsoRef.current;
      const seHead = seatedHeadLimbsRef.current;

      const t = state.clock.getElapsedTime();

      // 1. Update Standing Players
      if (sTorso && sHead) {
        let idx = 0;
        for (const m of standingMembers) {
          const target = remotePlayersMap.get(m.id);
          let posX = 0, posY = 0, posZ = 0, rotY = 0, isMoving = false;
          if (target) {
            target.currentX = THREE.MathUtils.damp(target.currentX ?? target.x, target.x, 12, delta);
            target.currentY = THREE.MathUtils.damp(target.currentY ?? target.y, target.y, 12, delta);
            target.currentZ = THREE.MathUtils.damp(target.currentZ ?? target.z, target.z, 12, delta);
            target.currentRotY = THREE.MathUtils.damp(target.currentRotY ?? target.rotY, target.rotY, 14, delta);
            posX = target.currentX;
            posY = target.currentY;
            posZ = target.currentZ;
            rotY = target.currentRotY;
            isMoving = target.isMoving;
          }

          if (isMoving) {
            posY += Math.abs(Math.sin(t * 9)) * 0.04;
          }

          _dummyMatrix.makeRotationY(rotY);
          _dummyMatrix.setPosition(posX, posY, posZ);

          sTorso.setMatrixAt(idx, _dummyMatrix);
          sHead.setMatrixAt(idx, _dummyMatrix);

          _dummyColor.set(m.color);
          sTorso.setColorAt(idx, _dummyColor);
          idx++;
        }

        // Hide unused instances
        for (let i = idx; i < standingMembers.length + 10; i++) {
          sTorso.setMatrixAt(i, _hiddenMatrix);
          sHead.setMatrixAt(i, _hiddenMatrix);
        }

        sTorso.instanceMatrix.needsUpdate = true;
        sHead.instanceMatrix.needsUpdate = true;
        if (sTorso.instanceColor) sTorso.instanceColor.needsUpdate = true;
      }

      // 2. Update Seated Players
      if (seTorso && seHead) {
        let idx = 0;
        for (const m of seatedMembers) {
          if (!m.seat) continue;
          const s = seatPos3D(m.seat);
          _dummyMatrix.makeRotationY(Math.PI);
          _dummyMatrix.setPosition(s.x, s.y, s.z);

          seTorso.setMatrixAt(idx, _dummyMatrix);
          seHead.setMatrixAt(idx, _dummyMatrix);

          _dummyColor.set(m.color);
          seTorso.setColorAt(idx, _dummyColor);
          idx++;
        }

        for (let i = idx; i < seatedMembers.length + 10; i++) {
          seTorso.setMatrixAt(i, _hiddenMatrix);
          seHead.setMatrixAt(i, _hiddenMatrix);
        }

        seTorso.instanceMatrix.needsUpdate = true;
        seHead.instanceMatrix.needsUpdate = true;
        if (seTorso.instanceColor) seTorso.instanceColor.needsUpdate = true;
      }

      // 3. LOD Calculation for Name Tags (Run once every 8 frames to save CPU)
      frameCount.current++;
      if (frameCount.current % 8 === 0) {
        state.camera.getWorldPosition(_camPos);
        state.camera.getWorldDirection(_camDir);

        const candidates: { id: string; distSq: number }[] = [];

        for (const m of members) {
          if (m.id === selfId) continue;
          let mX = 0, mZ = 0;
          if (m.seat) {
            const s = seatPos3D(m.seat);
            mX = s.x;
            mZ = s.z;
          } else {
            const target = remotePlayersMap.get(m.id);
            if (target) {
              mX = target.currentX ?? target.x;
              mZ = target.currentZ ?? target.z;
            }
          }

          _toMemberVec.set(mX - _camPos.x, 0, mZ - _camPos.z);
          // Check if in front of camera
          const dot = _toMemberVec.dot(_camDir);
          if (dot > 0) {
            const distSq = _toMemberVec.lengthSq();
            // LOD distance < 25m (distSq < 625)
            if (distSq < 625) {
              candidates.push({ id: m.id, distSq });
            }
          }
        }

        // Pick top 19 closest members
        candidates.sort((a, b) => a.distSq - b.distSq);
        const topIds = new Set<string>();
        for (let i = 0; i < Math.min(19, candidates.length); i++) {
          topIds.add(candidates[i].id);
        }
        setVisibleNameIds(topIds);
      }
    });

    return (
      <group>
        {/* Instanced Standing Players */}
        <instancedMesh
          ref={standingTorsoRef}
          args={[getStandingTorsoGeometry(), sharedTorsoMaterial, Math.max(1, standingMembers.length + 10)]}
          frustumCulled={false}
        />
        <instancedMesh
          ref={standingHeadLimbsRef}
          args={[getStandingHeadLimbsGeometry(), sharedHeadLimbsMaterial, Math.max(1, standingMembers.length + 10)]}
          frustumCulled={false}
        />

        {/* Instanced Seated Players */}
        <instancedMesh
          ref={seatedTorsoRef}
          args={[getSeatedTorsoGeometry(), sharedTorsoMaterial, Math.max(1, seatedMembers.length + 10)]}
          frustumCulled={false}
        />
        <instancedMesh
          ref={seatedHeadLimbsRef}
          args={[getSeatedHeadLimbsGeometry(), sharedHeadLimbsMaterial, Math.max(1, seatedMembers.length + 10)]}
          frustumCulled={false}
        />

        {/* Active Remote Characters (SIUUU / Crow / Shout / Oxygen) */}
        {activeMembers.map((m) => (
          <ActiveRemoteCharacter3D
            key={m.id}
            member={m}
            activeChat={chats[m.id]}
            activeAction={actions[m.id]}
            onSelectMember={onSelectMember}
          />
        ))}

        {/* Chat Bubbles & 3D Name Tags for Passive Remote Players */}
        {members
          .filter((m) => m.id !== selfId && !activeMembers.some((am) => am.id === m.id))
          .map((m) => {
            const hasChat = chats[m.id] && now - chats[m.id].time < 5000;
            const showName = visibleNameIds.has(m.id);
            if (!hasChat && !showName) return null;

            return (
              <PassiveBillboardTag
                key={`tag-${m.id}`}
                member={m}
                chat={hasChat ? chats[m.id] : null}
                showName={showName}
                onSelectMember={onSelectMember}
              />
            );
          })}
      </group>
    );
  }
);

// Lightweight Billboard Tag for passive remote players
const PassiveBillboardTag: React.FC<{
  member: Member;
  chat: { text: string; time: number } | null;
  showName: boolean;
  onSelectMember?: (m: Member) => void;
}> = React.memo(function PassiveBillboardTag({ member, chat, showName, onSelectMember }) {
  const groupRef = useRef<THREE.Group>(null);
  const mutedUsers = useCinemaStore((state) => state.mutedUsers);
  const isMuted = mutedUsers.includes(member.id);

  useFrame(() => {
    const grp = groupRef.current;
    if (!grp) return;

    if (member.seat) {
      const s = seatPos3D(member.seat);
      grp.position.set(s.x, s.y + 1.35, s.z);
    } else {
      const target = remotePlayersMap.get(member.id);
      if (target) {
        grp.position.set(target.currentX ?? target.x, (target.currentY ?? target.y) + 1.35, target.currentZ ?? target.z);
      }
    }
  });

  return (
    <group ref={groupRef as any}>
      <Billboard>
        {!isMuted && chat && (
          <group position={[0, 0.35, 0]}>
            <mesh position={[0, 0, -0.01]}>
              <planeGeometry
                args={[
                  Math.min(3.2, Math.max(1.2, chat.text.length * 0.095 + 0.3)),
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
              {filterBadWords(chat.text)}
            </AppText>
          </group>
        )}

        {showName && (
          <group onClick={(e: any) => { e.stopPropagation(); onSelectMember?.(member); }}>
            <AppText
              fontSize={0.11}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
              outlineWidth={0.012}
              outlineColor="#000000"
            >
              {isMuted ? `🔇 ${member.name}` : member.name}
            </AppText>
          </group>
        )}
      </Billboard>
    </group>
  );
});
