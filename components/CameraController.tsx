'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useCinemaStore } from '../lib/store';
import { cameraYawRef, localPosRef, localRotRef, remotePlayersMap } from '../lib/playerRefs';

interface CameraControllerProps {
  selfActionTime?: number;
}

// Module-scope static vectors to eliminate GC memory allocations in useFrame
const _camCinemaTarget = new THREE.Vector3(0, 4.5, 2.0);
const _targetScreenLookAt = new THREE.Vector3(0, 8.7, -14.0);
const _focusCenter = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _lobbyLookAt = new THREE.Vector3(0, 2.2, -3.0);

// Player enters at (0, 0, 11.5). With yaw=0, pitch=20deg, distance=7.5:
// hDist = 7.5 * cos(20deg) ~= 7.05 -> targetCamPos = (0, 3.2, 18.55)
// targetLookAt = (0, 1.2, 8.5)
const _enterTargetCamPos = new THREE.Vector3(0, 3.2, 18.55);
const _enterTargetLookAt = new THREE.Vector3(0, 1.2, 8.5);

export const CameraController: React.FC<CameraControllerProps> = ({
  selfActionTime,
}) => {
  const { camera } = useThree();

  const isSeated = useCinemaStore((state) => state.isSeated);
  const cameraMode = useCinemaStore((state) => state.cameraMode);
  const setCameraMode = useCinemaStore((state) => state.setCameraMode);
  const actionFocusTarget = useCinemaStore((state) => state.actionFocusTarget);
  const followOtherActions = useCinemaStore((state) => state.followOtherActions);

  // Pitch clamped: 10 deg to 60 deg.
  const MIN_PITCH = (10 * Math.PI) / 180;
  const MAX_PITCH = (60 * Math.PI) / 180;

  // Wheel zoom distance: 3 to 18, default 7.5
  const targetDist = useRef(7.5);
  const currentDist = useRef(7.5);

  const targetYaw = useRef(0);
  const currentYaw = useRef(0);
  const targetPitch = useRef((20 * Math.PI) / 180);
  const currentPitch = useRef((20 * Math.PI) / 180);
  const pitchDragOffset = useRef(0);

  const isDragging = useRef(false);
  const startMousePos = useRef({ x: 0, y: 0 });
  const lastMousePos = useRef({ x: 0, y: 0 });
  const hasMovedPastThreshold = useRef(false);

  // Action camera state (3/4 front angle, max(zoom, 6), height ~2.8, non-locking)
  const isAutoActionCamActive = useRef(false);
  const actionEndTime = useRef(0);
  const savedYaw = useRef(0);
  const prevSelfActionTime = useRef<number | undefined>(undefined);
  const prevActionFocusTargetTime = useRef<number | undefined>(undefined);
  const actionTargetId = useRef<string | null>(null);

  // Current camera smoothed lookAt target
  const currentLookAt = useRef(new THREE.Vector3(0, 1.2, 8.5));

  // Lobby slow rotation angle
  const lobbyOrbitAngle = useRef(0.6);

  // Entering animation start timestamp
  const enterStartTime = useRef<number | null>(null);

  // Wall check throttled (max 20 times/sec = 50ms interval)
  const lastWallCheckTime = useRef(0);
  const lastClampedPos = useRef(new THREE.Vector3());

  // Listen for action triggers (Local & Remote)
  useEffect(() => {
    const now = Date.now();
    // 1. Local action trigger
    if (selfActionTime && selfActionTime !== prevSelfActionTime.current) {
      prevSelfActionTime.current = selfActionTime;
      savedYaw.current = targetYaw.current;
      isAutoActionCamActive.current = true;
      actionEndTime.current = now + 2500;
      actionTargetId.current = null;
      // 3/4 front view: character forward is localRotRef.y. Front is localRotRef.y + PI, offset 0.65 (~37 deg)
      targetYaw.current = localRotRef.y + Math.PI - 0.65;
    }
  }, [selfActionTime]);

  useEffect(() => {
    // 2. Remote action trigger (when followOtherActions is enabled)
    if (
      followOtherActions &&
      actionFocusTarget &&
      actionFocusTarget.time !== prevActionFocusTargetTime.current
    ) {
      prevActionFocusTargetTime.current = actionFocusTarget.time;
      savedYaw.current = targetYaw.current;
      isAutoActionCamActive.current = true;
      actionEndTime.current = actionFocusTarget.time + 2500;
      actionTargetId.current = actionFocusTarget.id;
      const remoteP = remotePlayersMap.get(actionFocusTarget.id);
      if (remoteP) {
        targetYaw.current = remoteP.rotY + Math.PI - 0.65;
      }
    }
  }, [followOtherActions, actionFocusTarget]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (
        (e.target as HTMLElement)?.closest(
          'button, input, textarea, footer, header, .chat-form, .modal-backdrop, .lobby-card, .lobby-3d-overlay'
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
      if (!isDragging.current) return;

      const dist = Math.hypot(
        e.clientX - startMousePos.current.x,
        e.clientY - startMousePos.current.y
      );
      if (dist > 5) {
        hasMovedPastThreshold.current = true;
        // User dragged during action -> cancel auto action camera immediately
        isAutoActionCamActive.current = false;
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

    // Wheel listener for smooth zoom (3 to 18, default 7.5)
    const handleWheel = (e: WheelEvent) => {
      if (
        (e.target as HTMLElement)?.closest(
          'input, textarea, .chat-messages-scroll, .modal-backdrop, .lobby-card'
        )
      ) {
        return;
      }
      e.preventDefault();

      // Scrolling cancels auto action camera immediately
      isAutoActionCamActive.current = false;

      if (e.deltaY > 0) {
        // Scroll down: zoom out
        targetDist.current = Math.min(18.0, targetDist.current * 1.12);
      } else if (e.deltaY < 0) {
        // Scroll up: zoom in
        targetDist.current = Math.max(3.0, targetDist.current / 1.12);
      }
    };

    // Keyboard shortcuts: C for cinema view (Z removed in v2.2)
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
  }, [cameraMode, setCameraMode]);

  // Frame update for Camera smooth follow, zoom & wall collision avoidance
  useFrame((_, delta) => {
    const now = Date.now();

    // 1. LOBBY ISOMETRIC ROTATING CAMERA
    if (cameraMode === 'lobby') {
      lobbyOrbitAngle.current += delta * 0.12;
      const sweep = Math.sin(lobbyOrbitAngle.current) * 1.0;
      const camX = Math.sin(sweep) * 8.5;
      const camZ = 8.5 + Math.cos(sweep) * 3.0;
      const camY = 9.5;

      camera.position.x = THREE.MathUtils.damp(camera.position.x, camX, 4, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, camY, 4, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, camZ, 4, delta);

      currentLookAt.current.x = THREE.MathUtils.damp(currentLookAt.current.x, _lobbyLookAt.x, 5, delta);
      currentLookAt.current.y = THREE.MathUtils.damp(currentLookAt.current.y, _lobbyLookAt.y, 5, delta);
      currentLookAt.current.z = THREE.MathUtils.damp(currentLookAt.current.z, _lobbyLookAt.z, 5, delta);

      camera.lookAt(currentLookAt.current);
      return;
    }

    // 2. ENTERING CINEMA CAMERA FLIGHT (1.2s smooth swoop to exact follow position)
    if (cameraMode === 'entering') {
      if (!enterStartTime.current) {
        enterStartTime.current = now;
      }
      const elapsed = (now - enterStartTime.current) / 1200; // 0 to 1
      const p = Math.min(1.0, elapsed);
      const ease = 1 - Math.pow(1 - p, 3);

      camera.position.x = THREE.MathUtils.lerp(camera.position.x, _enterTargetCamPos.x, ease * 0.15 + 0.05);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, _enterTargetCamPos.y, ease * 0.15 + 0.05);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, _enterTargetCamPos.z, ease * 0.15 + 0.05);

      currentLookAt.current.x = THREE.MathUtils.lerp(currentLookAt.current.x, _enterTargetLookAt.x, 0.1);
      currentLookAt.current.y = THREE.MathUtils.lerp(currentLookAt.current.y, _enterTargetLookAt.y, 0.1);
      currentLookAt.current.z = THREE.MathUtils.lerp(currentLookAt.current.z, _enterTargetLookAt.z, 0.1);

      camera.lookAt(currentLookAt.current);

      if (p >= 1.0) {
        targetYaw.current = 0;
        currentYaw.current = 0;
        targetDist.current = 7.5;
        currentDist.current = 7.5;
        pitchDragOffset.current = 0;
        setCameraMode('follow');
        enterStartTime.current = null;
      }
      return;
    }

    // Smooth damp zoom distance
    currentDist.current = THREE.MathUtils.damp(currentDist.current, targetDist.current, 10, delta);

    // Zoom-dependent base pitch: increases from 20 deg (dist=3) to 40 deg (dist=18)
    const zoomProgress = THREE.MathUtils.clamp((currentDist.current - 3.0) / 15.0, 0, 1);
    const dynamicBasePitch = ((20 + zoomProgress * 20) * Math.PI) / 180;
    targetPitch.current = THREE.MathUtils.clamp(
      dynamicBasePitch + pitchDragOffset.current,
      MIN_PITCH,
      MAX_PITCH
    );

    // Action camera expiration check
    if (isAutoActionCamActive.current && now >= actionEndTime.current) {
      targetYaw.current = savedYaw.current;
      isAutoActionCamActive.current = false;
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

    const isDoingAction = now < actionEndTime.current;

    if (actionTargetId.current && isDoingAction) {
      const rp = remotePlayersMap.get(actionTargetId.current);
      if (rp) {
        charX = rp.x;
        charY = rp.y;
        charZ = rp.z;
      }
    }

    // 4. OVER THE SHOULDER VIEW WHEN SITTING (No active action)
    if (isSeated && !isDoingAction && !actionTargetId.current) {
      _desiredCamPos.set(charX + 0.65, charY + 1.25, charZ + 1.7);
      _focusCenter.set(charX, charY + 1.2, charZ - 8.0);
    } else if (isDoingAction) {
      // 5. ACTION CAMERA: 3/4 front view, distance = max(zoom, 6), height ~2.8
      const effectiveActionDist = Math.max(currentDist.current, 6.0);
      const pitch = currentPitch.current;
      const yaw = currentYaw.current;
      const hDist = effectiveActionDist * Math.cos(pitch);

      _desiredCamPos.set(
        charX + hDist * Math.sin(yaw),
        charY + 2.8,
        charZ + hDist * Math.cos(yaw)
      );

      // Focus centered on character body to see full body, confetti & sound effects
      _focusCenter.set(charX, charY + 1.15, charZ);
    } else {
      // 6. THIRD-PERSON FOLLOW: Distance 3-18 (default 7.5), Height 3.2, Look 3 units ahead
      const pitch = currentPitch.current;
      const yaw = currentYaw.current;
      const hDist = currentDist.current * Math.cos(pitch);

      _desiredCamPos.set(
        charX + hDist * Math.sin(yaw),
        charY + 3.2,
        charZ + hDist * Math.cos(yaw)
      );

      const forwardX = -Math.sin(yaw);
      const forwardZ = -Math.cos(yaw);
      _focusCenter.set(
        charX + 3.0 * forwardX,
        charY + 1.2,
        charZ + 3.0 * forwardZ
      );
    }

    // Throttled wall collider check (max 20 checks/second = 50ms)
    if (now - lastWallCheckTime.current >= 50) {
      lastWallCheckTime.current = now;

      const minX = -11.2;
      const maxX = 11.2;
      const minZ = -13.5;
      const maxZ = 19.0;

      lastClampedPos.current.set(
        THREE.MathUtils.clamp(_desiredCamPos.x, minX, maxX),
        THREE.MathUtils.clamp(_desiredCamPos.y, 0.8, 14.0),
        THREE.MathUtils.clamp(_desiredCamPos.z, minZ, maxZ)
      );
    }

    _desiredCamPos.copy(lastClampedPos.current);

    // Smooth damp camera position
    camera.position.x = THREE.MathUtils.damp(camera.position.x, _desiredCamPos.x, 8, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, _desiredCamPos.y, 8, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, _desiredCamPos.z, 8, delta);

    // Smooth damp lookAt target
    currentLookAt.current.x = THREE.MathUtils.damp(currentLookAt.current.x, _focusCenter.x, 9, delta);
    currentLookAt.current.y = THREE.MathUtils.damp(currentLookAt.current.y, _focusCenter.y, 9, delta);
    currentLookAt.current.z = THREE.MathUtils.damp(currentLookAt.current.z, _focusCenter.z, 9, delta);

    camera.lookAt(currentLookAt.current);
  });

  return null;
};
