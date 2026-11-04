'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useCinemaStore } from '../lib/store';
import { localPosRef, remotePlayersMap } from '../lib/playerRefs';

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
  const actionFocusTarget = useCinemaStore((state) => state.actionFocusTarget);
  const followOtherActions = useCinemaStore((state) => state.followOtherActions);

  // Orbit angle and distance
  const orbitTheta = useRef(0);
  const orbitPhi = useRef(Math.PI / 4.2);
  const orbitRadius = useRef(4.2);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Current camera smoothed lookAt target
  const currentLookAt = useRef(new THREE.Vector3(0, 1.2, 0));

  // Handle Drag to orbit & Scroll to zoom
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest('button, input, footer, header, .chat-form')) return;
      isDragging.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.clientX, y: e.clientY };

      orbitTheta.current -= dx * 0.006;
      orbitPhi.current = Math.max(
        0.15,
        Math.min(Math.PI / 2.1, orbitPhi.current - dy * 0.006)
      );
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      orbitRadius.current = Math.max(
        2.2,
        Math.min(7.8, orbitRadius.current + e.deltaY * 0.003)
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;
      if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setCameraMode(cameraMode === 'cinema' ? 'follow' : 'cinema');
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [cameraMode, setCameraMode]);

  // Frame update for Camera smooth follow with damping (reads localPosRef directly, zero React re-renders)
  useFrame((_, delta) => {
    const now = Date.now();

    // 1. CINEMA MODE (Key 'C' or looking straight at screen)
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

    // 2. ACTION ZOOM FOCUS (reads localPosRef or remotePlayersMap)
    let focusCenter = new THREE.Vector3(localPosRef.x, localPosRef.y + 0.6, localPosRef.z);
    let targetDist = orbitRadius.current;

    // Self action zoom (< 2.2s)
    if (selfActionTime && now - selfActionTime < 2200) {
      targetDist = 2.4;
    } else if (
      followOtherActions &&
      actionFocusTarget &&
      now - actionFocusTarget.time < 2600
    ) {
      // Read other player position directly from remotePlayersMap (zero re-render)
      const p = remotePlayersMap.get(actionFocusTarget.id);
      if (p) {
        focusCenter.set(p.x, p.y + 0.6, p.z);
        targetDist = 2.4;
      }
    }

    // 3. OVER THE SHOULDER VIEW WHEN SITTING
    let desiredCamPos = new THREE.Vector3();
    if (isSeated && (!selfActionTime || now - selfActionTime >= 2200)) {
      desiredCamPos.set(localPosRef.x + 0.6, localPosRef.y + 1.1, localPosRef.z + 1.8);
      focusCenter.set(localPosRef.x, localPosRef.y + 1.4, localPosRef.z - 8.0);
    } else {
      const phi = orbitPhi.current;
      const theta = orbitTheta.current;
      const r = targetDist;

      desiredCamPos.set(
        focusCenter.x + r * Math.sin(phi) * Math.sin(theta),
        focusCenter.y + r * Math.cos(phi),
        focusCenter.z + r * Math.sin(phi) * Math.cos(theta)
      );
    }

    // Clamp within cinema walls to prevent clipping
    desiredCamPos.x = THREE.MathUtils.clamp(desiredCamPos.x, -9.2, 9.2);
    desiredCamPos.y = THREE.MathUtils.clamp(desiredCamPos.y, 0.4, 8.8);
    desiredCamPos.z = THREE.MathUtils.clamp(desiredCamPos.z, -11.0, 14.8);

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
