'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useCinemaStore } from '../lib/store';
import { cameraYawRef, localPosRef, localRotRef, remotePlayersMap } from '../lib/playerRefs';
import { ROOM_HALF_W, ROOM_BACK_Z, SCREEN_CENTER_Y, SCREEN_Z } from '../lib/layout';

interface CameraControllerProps {
  selfActionTime?: number;
  isBreathingOxygen?: boolean;
}

// Module-scope static vectors to eliminate GC memory allocations in useFrame
const _camCinemaTarget = new THREE.Vector3(0, 7.5, 6.0);
const _targetScreenLookAt = new THREE.Vector3(0, SCREEN_CENTER_Y, SCREEN_Z);
const _focusCenter = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _lobbyLookAt = new THREE.Vector3(0, 4.0, 0.0);

// Spawn position: (0, 0, 22). Default camera: distance 12, height 4.5, pitch ~22deg
const _enterTargetCamPos = new THREE.Vector3(0, 4.8, 28.5);
const _enterTargetLookAt = new THREE.Vector3(0, 1.8, 12.0);

export const CameraController: React.FC<CameraControllerProps> = ({
  selfActionTime,
  isBreathingOxygen,
}) => {
  const { camera } = useThree();

  const isSeated = useCinemaStore((state) => state.isSeated);
  const cameraMode = useCinemaStore((state) => state.cameraMode);
  const setCameraMode = useCinemaStore((state) => state.setCameraMode);
  const actionFocusTarget = useCinemaStore((state) => state.actionFocusTarget);
  const followOtherActions = useCinemaStore((state) => state.followOtherActions);

  // Pitch clamped: 10 deg to 65 deg
  const MIN_PITCH = (10 * Math.PI) / 180;
  const MAX_PITCH = (65 * Math.PI) / 180;

  // Zoom distance: 3 to 35, default 12 (V2.3: 2x Cinema)
  const targetDist = useRef(12.0);
  const currentDist = useRef(12.0);

  const targetYaw = useRef(0);
  const currentYaw = useRef(0);
  const targetPitch = useRef((22 * Math.PI) / 180);
  const currentPitch = useRef((22 * Math.PI) / 180);
  const pitchDragOffset = useRef(0);

  const isDragging = useRef(false);
  const startMousePos = useRef({ x: 0, y: 0 });
  const lastMousePos = useRef({ x: 0, y: 0 });
  const hasMovedPastThreshold = useRef(false);

  // V2.3 Action Camera Lock State
  // High rear 3rd-person view (height ~6, pitch ~30 deg, dist = max(zoom, 11), looks at charY + 1.2)
  const isActionLocked = useRef(false);
  const actionEndTime = useRef(0);
  const savedYaw = useRef(0);
  const savedPitch = useRef(0);
  const savedDist = useRef(12.0);
  const actionTargetId = useRef<string | null>(null);

  const prevSelfActionTime = useRef<number | undefined>(undefined);
  const prevActionFocusTargetTime = useRef<number | undefined>(undefined);

  // Current camera smoothed lookAt target
  const currentLookAt = useRef(new THREE.Vector3(0, 1.8, 12.0));

  // Lobby slow rotation angle
  const lobbyOrbitAngle = useRef(0.6);

  // Entering animation start timestamp
  const enterStartTime = useRef<number | null>(null);

  // Wall check throttled (max 20 times/sec = 50ms interval)
  const lastWallCheckTime = useRef(0);
  const lastClampedPos = useRef(new THREE.Vector3());

  // Listen for action triggers (Local Action)
  useEffect(() => {
    const now = Date.now();
    if (selfActionTime && selfActionTime !== prevSelfActionTime.current) {
      prevSelfActionTime.current = selfActionTime;

      if (!isActionLocked.current) {
        savedYaw.current = targetYaw.current;
        savedPitch.current = currentPitch.current;
        savedDist.current = currentDist.current;
      }
      isActionLocked.current = true;
      actionEndTime.current = now + 2600;
      actionTargetId.current = null;
    }
  }, [selfActionTime]);

  // Listen for remote action trigger (when followOtherActions is on)
  useEffect(() => {
    if (
      followOtherActions &&
      actionFocusTarget &&
      actionFocusTarget.time !== prevActionFocusTargetTime.current
    ) {
      prevActionFocusTargetTime.current = actionFocusTarget.time;

      if (!isActionLocked.current) {
        savedYaw.current = targetYaw.current;
        savedPitch.current = currentPitch.current;
        savedDist.current = currentDist.current;
      }
      isActionLocked.current = true;
      actionEndTime.current = actionFocusTarget.time + 2600;
      actionTargetId.current = actionFocusTarget.id;
    }
  }, [followOtherActions, actionFocusTarget]);

  // Mouse drag & wheel event handlers (Ignored when isActionLocked or breathing oxygen)
  useEffect(() => {
    const isLocked = () => isActionLocked.current || Boolean(isBreathingOxygen);

    const handleMouseDown = (e: MouseEvent) => {
      if (isLocked()) return; // Lock camera during action/oxygen

      if (
        (e.target as HTMLElement)?.closest(
          'button, input, textarea, footer, header, .chat-form, .modal-backdrop, .lobby-3d-card, .lobby-3d-overlay, .admin-page-wrap, .change-video-modal'
        )
      ) {
        return;
      }

      const mode = useCinemaStore.getState().controlMode;
      const allowedButton = mode === 'keyboard' ? 0 : 2;

      if (e.button === allowedButton) {
        isDragging.current = true;
        startMousePos.current = { x: e.clientX, y: e.clientY };
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        hasMovedPastThreshold.current = false;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || isLocked()) return;

      const dist = Math.hypot(
        e.clientX - startMousePos.current.x,
        e.clientY - startMousePos.current.y
      );
      if (dist > 5) {
        hasMovedPastThreshold.current = true;
      }

      if (hasMovedPastThreshold.current) {
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        lastMousePos.current = { x: e.clientX, y: e.clientY };

        targetYaw.current -= dx * 0.0055;
        pitchDragOffset.current += dy * 0.0045;
        pitchDragOffset.current = THREE.MathUtils.clamp(
          pitchDragOffset.current,
          -Math.PI / 6,
          Math.PI / 4
        );
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      hasMovedPastThreshold.current = false;
    };

    const handleContextMenu = (e: MouseEvent) => {
      const mode = useCinemaStore.getState().controlMode;
      if (mode === 'mouse') {
        e.preventDefault();
      }
    };

    // Wheel zoom: 3 to 35 (V2.3: 2x Cinema)
    const handleWheel = (e: WheelEvent) => {
      if (isLocked()) return; // Lock camera zoom during action/oxygen

      if (
        (e.target as HTMLElement)?.closest(
          'input, textarea, .chat-messages-scroll, .modal-backdrop, .lobby-3d-card, .lobby-3d-overlay, .admin-page-wrap, .change-video-modal'
        )
      ) {
        return;
      }
      e.preventDefault();

      if (e.deltaY > 0) {
        // Scroll down: zoom out
        targetDist.current = Math.min(35.0, targetDist.current * 1.12);
      } else if (e.deltaY < 0) {
        // Scroll up: zoom in
        targetDist.current = Math.max(3.0, targetDist.current / 1.12);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;
      if (e.repeat) return;

      const key = e.key.toLowerCase();
      if (key === 'c') {
        e.preventDefault();
        setCameraMode(cameraMode === 'cinema' ? 'follow' : 'cinema');
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [cameraMode, setCameraMode, isBreathingOxygen]);

  useFrame((_, delta) => {
    const now = Date.now();

    // 1. LOBBY ISOMETRIC ROTATING CAMERA
    if (cameraMode === 'lobby') {
      lobbyOrbitAngle.current += delta * 0.12;
      const sweep = Math.sin(lobbyOrbitAngle.current) * 1.0;
      const camX = Math.sin(sweep) * 16.0;
      const camZ = 16.0 + Math.cos(sweep) * 6.0;
      const camY = 14.0;

      camera.position.x = THREE.MathUtils.damp(camera.position.x, camX, 4, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, camY, 4, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, camZ, 4, delta);

      currentLookAt.current.x = THREE.MathUtils.damp(currentLookAt.current.x, _lobbyLookAt.x, 5, delta);
      currentLookAt.current.y = THREE.MathUtils.damp(currentLookAt.current.y, _lobbyLookAt.y, 5, delta);
      currentLookAt.current.z = THREE.MathUtils.damp(currentLookAt.current.z, _lobbyLookAt.z, 5, delta);

      camera.lookAt(currentLookAt.current);
      return;
    }

    // 2. ENTERING CINEMA CAMERA FLIGHT
    if (cameraMode === 'entering') {
      if (!enterStartTime.current) {
        enterStartTime.current = now;
      }
      const elapsed = (now - enterStartTime.current) / 1300;
      const p = Math.min(1.0, elapsed);
      const ease = 1 - Math.pow(1 - p, 3);

      camera.position.x = THREE.MathUtils.lerp(camera.position.x, _enterTargetCamPos.x, ease * 0.18 + 0.05);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, _enterTargetCamPos.y, ease * 0.18 + 0.05);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, _enterTargetCamPos.z, ease * 0.18 + 0.05);

      currentLookAt.current.x = THREE.MathUtils.lerp(currentLookAt.current.x, _enterTargetLookAt.x, 0.1);
      currentLookAt.current.y = THREE.MathUtils.lerp(currentLookAt.current.y, _enterTargetLookAt.y, 0.1);
      currentLookAt.current.z = THREE.MathUtils.lerp(currentLookAt.current.z, _enterTargetLookAt.z, 0.1);

      camera.lookAt(currentLookAt.current);

      if (p >= 1.0) {
        targetYaw.current = 0;
        currentYaw.current = 0;
        targetDist.current = 12.0;
        currentDist.current = 12.0;
        pitchDragOffset.current = 0;
        setCameraMode('follow');
        enterStartTime.current = null;
      }
      return;
    }

    // Smooth damp zoom distance
    currentDist.current = THREE.MathUtils.damp(currentDist.current, targetDist.current, 10, delta);

    // Zoom-dependent base pitch: increases from 20 deg (dist=3) to 42 deg (dist=35)
    const zoomProgress = THREE.MathUtils.clamp((currentDist.current - 3.0) / 32.0, 0, 1);
    const dynamicBasePitch = ((20 + zoomProgress * 22) * Math.PI) / 180;
    targetPitch.current = THREE.MathUtils.clamp(
      dynamicBasePitch + pitchDragOffset.current,
      MIN_PITCH,
      MAX_PITCH
    );

    // Action camera expiration check (keep locked during oxygen crawl)
    const isDoingAction = now < actionEndTime.current || Boolean(isBreathingOxygen);
    if (isActionLocked.current && !isDoingAction) {
      targetYaw.current = savedYaw.current;
      targetPitch.current = savedPitch.current;
      targetDist.current = savedDist.current;
      isActionLocked.current = false;
      actionTargetId.current = null;
    }

    // Smooth damp yaw & pitch
    currentYaw.current = THREE.MathUtils.damp(currentYaw.current, targetYaw.current, 12, delta);
    currentPitch.current = THREE.MathUtils.damp(currentPitch.current, targetPitch.current, 12, delta);

    // Save camera yaw for WASD camera-relative direction
    cameraYawRef.value = currentYaw.current;

    // 3. CINEMA VIEW (Key 'C')
    if (cameraMode === 'cinema') {
      camera.position.x = THREE.MathUtils.damp(camera.position.x, _camCinemaTarget.x, 6, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, _camCinemaTarget.y, 6, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, _camCinemaTarget.z, 6, delta);

      currentLookAt.current.x = THREE.MathUtils.damp(currentLookAt.current.x, _targetScreenLookAt.x, 6, delta);
      currentLookAt.current.y = THREE.MathUtils.damp(currentLookAt.current.y, _targetScreenLookAt.y, 6, delta);
      currentLookAt.current.z = THREE.MathUtils.damp(currentLookAt.current.z, _targetScreenLookAt.z, 6, delta);

      camera.lookAt(currentLookAt.current);
      return;
    }

    // Determine target player coordinates (Self vs Remote focused)
    let charX = localPosRef.x;
    let charY = localPosRef.y;
    let charZ = localPosRef.z;

    if (actionTargetId.current && isDoingAction) {
      const rp = remotePlayersMap.get(actionTargetId.current);
      if (rp) {
        charX = rp.x;
        charY = rp.y;
        charZ = rp.z;
      }
    }

    // 4. OVER THE SHOULDER VIEW WHEN SITTING (No active action lock)
    if (isSeated && !isDoingAction && !actionTargetId.current) {
      _desiredCamPos.set(charX + 0.65, charY + 1.25, charZ + 1.7);
      _focusCenter.set(charX, charY + 1.8, charZ - 12.0);
    } else if (isDoingAction) {
      // 5. V2.3 ACTION CAMERA LOCK:
      // High rear 3rd-person view, height ~6, pitch ~30 deg, dist = max(currentDist, 11)
      // Behind character (+Z) looking towards screen (-Z), seeing full body, effects, surrounding seats & screen
      const actionDist = Math.max(currentDist.current, 11.0);
      const actionPitch = (30 * Math.PI) / 180; // 30 degrees
      const hDist = actionDist * Math.cos(actionPitch);

      _desiredCamPos.set(
        charX,
        charY + 6.0,
        charZ + hDist
      );

      // Focus centered at height 1.2 on character body
      _focusCenter.set(charX, charY + 1.2, charZ);
    } else {
      // 6. THIRD-PERSON FOLLOW: Distance 3-35 (default 12), Height 3.8, Look ahead towards screen
      const pitch = currentPitch.current;
      const yaw = currentYaw.current;
      const hDist = currentDist.current * Math.cos(pitch);

      _desiredCamPos.set(
        charX + hDist * Math.sin(yaw),
        charY + 3.8,
        charZ + hDist * Math.cos(yaw)
      );

      const forwardX = -Math.sin(yaw);
      const forwardZ = -Math.cos(yaw);
      _focusCenter.set(
        charX + 4.0 * forwardX,
        charY + 1.8,
        charZ + 4.0 * forwardZ
      );
    }

    // Throttled wall collider check & upward slide (max 20 checks/sec = 50ms)
    if (now - lastWallCheckTime.current >= 50) {
      lastWallCheckTime.current = now;

      const minX = -ROOM_HALF_W + 1.2;
      const maxX = ROOM_HALF_W - 1.2;
      const minZ = SCREEN_Z + 1.5;
      const maxZ = ROOM_BACK_Z - 1.2;

      // If camera hits the back wall (maxZ), slide camera up instead of pulling closer!
      let adjY = _desiredCamPos.y;
      if (_desiredCamPos.z > maxZ) {
        const excessZ = _desiredCamPos.z - maxZ;
        adjY += excessZ * 0.75; // Slide up towards ceiling
      }

      lastClampedPos.current.set(
        THREE.MathUtils.clamp(_desiredCamPos.x, minX, maxX),
        THREE.MathUtils.clamp(adjY, 1.0, 20.5),
        THREE.MathUtils.clamp(_desiredCamPos.z, minZ, maxZ)
      );
    }

    _desiredCamPos.copy(lastClampedPos.current);

    // Smooth damp camera position (~0.5s transition)
    camera.position.x = THREE.MathUtils.damp(camera.position.x, _desiredCamPos.x, 7, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, _desiredCamPos.y, 7, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, _desiredCamPos.z, 7, delta);

    // Smooth damp lookAt target
    currentLookAt.current.x = THREE.MathUtils.damp(currentLookAt.current.x, _focusCenter.x, 8, delta);
    currentLookAt.current.y = THREE.MathUtils.damp(currentLookAt.current.y, _focusCenter.y, 8, delta);
    currentLookAt.current.z = THREE.MathUtils.damp(currentLookAt.current.z, _focusCenter.z, 8, delta);

    camera.lookAt(currentLookAt.current);
  });

  return null;
};
