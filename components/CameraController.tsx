'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useCinemaStore } from '../lib/store';
import { cameraYawRef, localPosRef, remotePlayersMap } from '../lib/playerRefs';

interface CameraControllerProps {
  selfActionTime?: number;
}

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

  // Orbit angle (yaw and pitch in radians)
  // Pitch clamped: 10 deg (0.174 rad) to 55 deg (0.96 rad)
  const MIN_PITCH = (10 * Math.PI) / 180;
  const MAX_PITCH = (55 * Math.PI) / 180;

  const targetYaw = useRef(0);
  const targetPitch = useRef((28 * Math.PI) / 180); // Default ~28 deg looking slightly down
  const currentYaw = useRef(0);
  const currentPitch = useRef((28 * Math.PI) / 180);

  const isDragging = useRef(false);
  const startMousePos = useRef({ x: 0, y: 0 });
  const lastMousePos = useRef({ x: 0, y: 0 });
  const hasMovedPastThreshold = useRef(false);

  // Current camera smoothed lookAt target
  const currentLookAt = useRef(new THREE.Vector3(0, 1.2, 0));

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest('button, input, textarea, footer, header, .chat-form, .modal-backdrop')) return;

      const mode = useCinemaStore.getState().controlMode;
      // Keyboard mode: Left button (0) to drag orbit
      // Mouse mode: Right button (2) to drag orbit
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

    // Prevent context menu on right click when in mouse control mode
    const handleContextMenu = (e: MouseEvent) => {
      const mode = useCinemaStore.getState().controlMode;
      if (mode === 'mouse') {
        e.preventDefault();
      }
    };

    // Keyboard shortcuts: C for cinema view, Z for camera near/far preset
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.repeat) return; // Ignore repeat for toggles

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

  // Frame update for Camera smooth follow & wall collision avoidance
  useFrame((_, delta) => {
    const now = Date.now();

    // Smooth damp yaw & pitch
    currentYaw.current = THREE.MathUtils.damp(currentYaw.current, targetYaw.current, 14, delta);
    currentPitch.current = THREE.MathUtils.damp(currentPitch.current, targetPitch.current, 14, delta);

    // Save camera yaw for WASD camera-relative direction
    cameraYawRef.value = currentYaw.current;

    // 1. CINEMA VIEW (Key 'C')
    if (cameraMode === 'cinema') {
      const targetCamPos = new THREE.Vector3(0, 3.2, 1.5);
      const targetScreenLookAt = new THREE.Vector3(0, 4.6, -13.0);

      camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamPos.x, 6, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamPos.y, 6, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamPos.z, 6, delta);

      currentLookAt.current.x = THREE.MathUtils.damp(currentLookAt.current.x, targetScreenLookAt.x, 6, delta);
      currentLookAt.current.y = THREE.MathUtils.damp(currentLookAt.current.y, targetScreenLookAt.y, 6, delta);
      currentLookAt.current.z = THREE.MathUtils.damp(currentLookAt.current.z, targetScreenLookAt.z, 6, delta);

      camera.lookAt(currentLookAt.current);
      return;
    }

    // 2. TARGET FOCUS & CAMERA DISTANCE
    let focusCenter = new THREE.Vector3(localPosRef.x, localPosRef.y + 0.8, localPosRef.z);

    // Preset distances: Far = ~6.5 (default), Near = ~4.2
    let targetDist = cameraDistancePreset === 'far' ? 6.5 : 4.2;

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
        focusCenter.set(p.x, p.y + 0.8, p.z);
        targetDist = 2.4;
      }
    }

    // 3. OVER THE SHOULDER VIEW WHEN SITTING
    let desiredCamPos = new THREE.Vector3();
    if (isSeated && (!selfActionTime || now - selfActionTime >= 2200)) {
      // Over the right shoulder facing screen
      desiredCamPos.set(localPosRef.x + 0.65, localPosRef.y + 1.15, localPosRef.z + 1.7);
      focusCenter.set(localPosRef.x, localPosRef.y + 1.5, localPosRef.z - 8.0);
    } else {
      // Spherical coordinates with clamped pitch & yaw
      const pitch = currentPitch.current;
      const yaw = currentYaw.current;

      const horizontalDist = targetDist * Math.cos(pitch);
      const verticalHeight = targetDist * Math.sin(pitch);

      desiredCamPos.set(
        focusCenter.x + horizontalDist * Math.sin(yaw),
        focusCenter.y + verticalHeight,
        focusCenter.z + horizontalDist * Math.cos(yaw)
      );

      // Raycast wall collision avoidance:
      // Cinema walls bounds: x in [-9.2, 9.2], z in [-11.0, 14.2], y in [0.6, 8.8]
      // If desiredCamPos penetrates or goes outside, pull distance inward
      const minX = -9.1;
      const maxX = 9.1;
      const minZ = -11.0;
      const maxZ = 14.2;

      if (
        desiredCamPos.x < minX ||
        desiredCamPos.x > maxX ||
        desiredCamPos.z < minZ ||
        desiredCamPos.z > maxZ
      ) {
        // Clamp position to inside the walls
        desiredCamPos.x = THREE.MathUtils.clamp(desiredCamPos.x, minX, maxX);
        desiredCamPos.z = THREE.MathUtils.clamp(desiredCamPos.z, minZ, maxZ);
      }
    }

    // Smooth damp camera position
    camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredCamPos.x, 8, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredCamPos.y, 8, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredCamPos.z, 8, delta);

    // Smooth damp lookAt target
    currentLookAt.current.x = THREE.MathUtils.damp(currentLookAt.current.x, focusCenter.x, 9, delta);
    currentLookAt.current.y = THREE.MathUtils.damp(currentLookAt.current.y, focusCenter.y, 9, delta);
    currentLookAt.current.z = THREE.MathUtils.damp(currentLookAt.current.z, focusCenter.z, 9, delta);

    camera.lookAt(currentLookAt.current);
  });

  return null;
};
