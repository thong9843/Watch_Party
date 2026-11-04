'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useCinemaStore } from '../lib/store';
import { cameraYawRef, localPosRef, remotePlayersMap } from '../lib/playerRefs';

interface CameraControllerProps {
  selfActionTime?: number;
}

// Module-scope static vectors to eliminate GC memory allocations in useFrame
const _camCinemaTarget = new THREE.Vector3(0, 3.8, 1.5);
const _targetScreenLookAt = new THREE.Vector3(0, 5.0, -14.0);
const _focusCenter = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _lobbyLookAt = new THREE.Vector3(0, 2.2, -3.0);
const _enterTargetCamPos = new THREE.Vector3(0, 3.8, 15.0);
const _enterTargetLookAt = new THREE.Vector3(0, 2.2, 4.0);

export const CameraController: React.FC<CameraControllerProps> = ({
  selfActionTime,
}) => {
  const { camera } = useThree();

  const isSeated = useCinemaStore((state) => state.isSeated);
  const cameraMode = useCinemaStore((state) => state.cameraMode);
  const setCameraMode = useCinemaStore((state) => state.setCameraMode);
  const cameraDistancePreset = useCinemaStore((state) => state.cameraDistancePreset);
  const toggleCameraDistance = useCinemaStore((state) => state.toggleCameraDistance);
  const actionFocusTarget = useCinemaStore((state) => state.actionFocusTarget);
  const followOtherActions = useCinemaStore((state) => state.followOtherActions);

  // Pitch clamped: 10 deg to 55 deg
  const MIN_PITCH = (10 * Math.PI) / 180;
  const MAX_PITCH = (55 * Math.PI) / 180;

  const targetYaw = useRef(0);
  const targetPitch = useRef((28 * Math.PI) / 180); // Default ~28 deg looking down
  const currentYaw = useRef(0);
  const currentPitch = useRef((28 * Math.PI) / 180);

  const isDragging = useRef(false);
  const startMousePos = useRef({ x: 0, y: 0 });
  const lastMousePos = useRef({ x: 0, y: 0 });
  const hasMovedPastThreshold = useRef(false);

  // Current camera smoothed lookAt target
  const currentLookAt = useRef(new THREE.Vector3(0, 1.2, 0));

  // Lobby slow rotation angle
  const lobbyOrbitAngle = useRef(0.6);

  // Entering animation start timestamp
  const enterStartTime = useRef<number | null>(null);

  // Wall check throttled (max 20 times/sec = 50ms interval)
  const lastWallCheckTime = useRef(0);
  const lastClampedPos = useRef(new THREE.Vector3());

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest('button, input, textarea, footer, header, .chat-form, .modal-backdrop, .lobby-overlay-container')) return;

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

      const dist = Math.hypot(e.clientX - startMousePos.current.x, e.clientY - startMousePos.current.y);
      if (dist > 5) {
        hasMovedPastThreshold.current = true;
      }

      if (hasMovedPastThreshold.current) {
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        lastMousePos.current = { x: e.clientX, y: e.clientY };

        targetYaw.current -= dx * 0.0055;
        targetPitch.current = Math.max(
          MIN_PITCH,
          Math.min(MAX_PITCH, targetPitch.current + dy * 0.0045)
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

    // Keyboard shortcuts: C for cinema view, Z for near/far preset
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.repeat) return;

      const key = e.key.toLowerCase();
      if (key === 'c') {
        e.preventDefault();
        setCameraMode(cameraMode === 'cinema' ? 'follow' : 'cinema');
      } else if (key === 'z') {
        e.preventDefault();
        toggleCameraDistance();
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [cameraMode, setCameraMode, toggleCameraDistance, MIN_PITCH, MAX_PITCH]);

  // Frame update for Camera smooth follow & wall collision avoidance (Zero object creation)
  useFrame((_, delta) => {
    const now = Date.now();

    // 1. LOBBY ISOMETRIC ROTATING CAMERA
    if (cameraMode === 'lobby') {
      // Slow pendulum sweep INSIDE the room (walls at x=±11.8, ceiling 13).
      // The old 360° orbit (radius 18.5) put the camera outside the walls → black screen.
      lobbyOrbitAngle.current += delta * 0.12;
      const sweep = Math.sin(lobbyOrbitAngle.current) * 1.0; // -1..1 rad
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

    // 2. ENTERING CINEMA CAMERA FLIGHT (1.2s smooth swoop)
    if (cameraMode === 'entering') {
      if (!enterStartTime.current) {
        enterStartTime.current = now;
      }
      const elapsed = (now - enterStartTime.current) / 1200; // 0 to 1
      const p = Math.min(1.0, elapsed);
      // Smooth cubic ease out
      const ease = 1 - Math.pow(1 - p, 3);

      camera.position.x = THREE.MathUtils.lerp(camera.position.x, _enterTargetCamPos.x, ease * 0.15 + 0.05);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, _enterTargetCamPos.y, ease * 0.15 + 0.05);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, _enterTargetCamPos.z, ease * 0.15 + 0.05);

      currentLookAt.current.x = THREE.MathUtils.lerp(currentLookAt.current.x, _enterTargetLookAt.x, 0.1);
      currentLookAt.current.y = THREE.MathUtils.lerp(currentLookAt.current.y, _enterTargetLookAt.y, 0.1);
      currentLookAt.current.z = THREE.MathUtils.lerp(currentLookAt.current.z, _enterTargetLookAt.z, 0.1);

      camera.lookAt(currentLookAt.current);

      if (p >= 1.0) {
        setCameraMode('follow');
        enterStartTime.current = null;
      }
      return;
    }

    // Smooth damp yaw & pitch
    currentYaw.current = THREE.MathUtils.damp(currentYaw.current, targetYaw.current, 14, delta);
    currentPitch.current = THREE.MathUtils.damp(currentPitch.current, targetPitch.current, 14, delta);

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

    // 4. TARGET FOCUS & CAMERA DISTANCE
    _focusCenter.set(localPosRef.x, localPosRef.y + 0.8, localPosRef.z);

    // Preset distances: Far = ~6.8, Near = ~4.5 (adapted for 30% wider cinema)
    let targetDist = cameraDistancePreset === 'far' ? 6.8 : 4.5;

    // Self action zoom (< 2.2s)
    if (selfActionTime && now - selfActionTime < 2200) {
      targetDist = 2.4;
    } else if (
      followOtherActions &&
      actionFocusTarget &&
      now - actionFocusTarget.time < 2600
    ) {
      const p = remotePlayersMap.get(actionFocusTarget.id);
      if (p) {
        _focusCenter.set(p.x, p.y + 0.8, p.z);
        targetDist = 2.4;
      }
    }

    // 5. OVER THE SHOULDER VIEW WHEN SITTING
    if (isSeated && (!selfActionTime || now - selfActionTime >= 2200)) {
      _desiredCamPos.set(localPosRef.x + 0.7, localPosRef.y + 1.2, localPosRef.z + 1.8);
      _focusCenter.set(localPosRef.x, localPosRef.y + 1.5, localPosRef.z - 8.0);
    } else {
      // Spherical coordinates with clamped pitch & yaw
      const pitch = currentPitch.current;
      const yaw = currentYaw.current;

      const horizontalDist = targetDist * Math.cos(pitch);
      const verticalHeight = targetDist * Math.sin(pitch);

      _desiredCamPos.set(
        _focusCenter.x + horizontalDist * Math.sin(yaw),
        _focusCenter.y + verticalHeight,
        _focusCenter.z + horizontalDist * Math.cos(yaw)
      );

      // Throttled wall collider check (max 20 checks/second = 50ms)
      if (now - lastWallCheckTime.current >= 50) {
        lastWallCheckTime.current = now;

        // Cinema walls bounds (30% wider: x in [-11.2, 11.2], z in [-13.0, 15.6], y in [0.8, 12.0])
        const minX = -11.1;
        const maxX = 11.1;
        const minZ = -13.0;
        const maxZ = 15.6;

        lastClampedPos.current.set(
          THREE.MathUtils.clamp(_desiredCamPos.x, minX, maxX),
          THREE.MathUtils.clamp(_desiredCamPos.y, 0.8, 11.5),
          THREE.MathUtils.clamp(_desiredCamPos.z, minZ, maxZ)
        );
      }

      _desiredCamPos.copy(lastClampedPos.current);
    }

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
