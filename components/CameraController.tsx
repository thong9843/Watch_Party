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

// Stepped discrete zoom levels (Roblox style)
// Level 0 = First-Person View (FPS)
export const ZOOM_LEVELS = [0, 2.5, 4, 6, 8.5, 12, 17, 24, 35] as const;
const DEFAULT_ZOOM_INDEX = 3; // Level 6.0

// Module-scope static vectors to eliminate GC memory allocations in useFrame
const _camCinemaTarget = new THREE.Vector3(0, 8.0, 0.0);
const _targetScreenLookAt = new THREE.Vector3(0, SCREEN_CENTER_Y, SCREEN_Z);
const _focusCenter = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _lobbyLookAt = new THREE.Vector3(0, 4.0, -2.0);

// Spawn position: (0, 0, 10.5). Default camera: distance 6.0, height 4.0, looking at (charX, 5.0, charZ - 12.0)
const _enterTargetCamPos = new THREE.Vector3(0, 4.0, 18.0);
const _enterTargetLookAt = new THREE.Vector3(0, 5.0, -1.5);

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

  // Pitch clamped:
  // 3rd-person: 10 deg to 65 deg
  // 1st-person: -80 deg to +80 deg
  const MIN_3RD_PITCH = (10 * Math.PI) / 180;
  const MAX_3RD_PITCH = (65 * Math.PI) / 180;
  const MIN_FPS_PITCH = (-80 * Math.PI) / 180;
  const MAX_FPS_PITCH = (80 * Math.PI) / 180;

  // Discrete zoom level index (0 = FPS, 1..8 = 3rd person)
  const zoomIndexRef = useRef<number>(DEFAULT_ZOOM_INDEX);
  const targetDist = useRef<number>(ZOOM_LEVELS[DEFAULT_ZOOM_INDEX]);
  const currentDist = useRef<number>(ZOOM_LEVELS[DEFAULT_ZOOM_INDEX]);

  const targetYaw = useRef(0);
  const currentYaw = useRef(0);
  const targetPitch = useRef((18 * Math.PI) / 180);
  const currentPitch = useRef((18 * Math.PI) / 180);
  const pitchDragOffset = useRef(0);

  const isDragging = useRef(false);
  const startMousePos = useRef({ x: 0, y: 0 });
  const lastMousePos = useRef({ x: 0, y: 0 });
  const hasMovedPastThreshold = useRef(false);

  // Smooth remote action tracking target (Item 6: no hard lock, gently leans toward target)
  const trackingTargetId = useRef<string | null>(null);
  const trackingEndTime = useRef(0);

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

  // Function to step zoom in/out with discrete Roblox-style levels
  const changeZoomLevel = (deltaStep: number) => {
    const prevIndex = zoomIndexRef.current;
    const nextIndex = THREE.MathUtils.clamp(prevIndex + deltaStep, 0, ZOOM_LEVELS.length - 1);
    if (nextIndex === prevIndex) return;

    zoomIndexRef.current = nextIndex;
    targetDist.current = ZOOM_LEVELS[nextIndex];

    if (nextIndex === 0 && prevIndex !== 0) {
      // Enter First-Person View (FPS)
      useCinemaStore.getState().setIsFirstPerson(true);
      useCinemaStore.getState().setCameraToast('👁 Góc nhìn thứ nhất');
      targetPitch.current = 0;
      currentPitch.current = 0;
      pitchDragOffset.current = 0;
    } else if (nextIndex !== 0 && prevIndex === 0) {
      // Exit First-Person View to 3rd-person
      useCinemaStore.getState().setIsFirstPerson(false);
      useCinemaStore.getState().setCameraToast('🎥 Góc nhìn thứ ba');
      targetPitch.current = (18 * Math.PI) / 180;
      pitchDragOffset.current = 0;
    }
  };

  // Listen for remote action trigger (when followOtherActions is enabled)
  useEffect(() => {
    if (
      followOtherActions &&
      actionFocusTarget &&
      actionFocusTarget.time !== prevActionFocusTargetTime.current
    ) {
      prevActionFocusTargetTime.current = actionFocusTarget.time;
      trackingTargetId.current = actionFocusTarget.id;
      trackingEndTime.current = actionFocusTarget.time + 2600;
    }
  }, [followOtherActions, actionFocusTarget]);

  // Mouse drag, Pointer Lock & Stepped Zoom event handlers
  // Item 6: Camera is NEVER locked during local actions or breathing oxygen!
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const targetEl = e.target as HTMLElement;
      if (
        targetEl?.closest(
          'button, input, textarea, footer, header, .chat-form, .modal-backdrop, .lobby-3d-card, .lobby-3d-overlay, .admin-page-wrap, .change-video-modal'
        )
      ) {
        return;
      }

      // Pointer lock on canvas click in FPS mode
      if (zoomIndexRef.current === 0 && targetEl?.tagName === 'CANVAS') {
        if (document.pointerLockElement !== document.body && document.body.requestPointerLock) {
          try {
            document.body.requestPointerLock();
          } catch {}
        }
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
      // If user drags mouse, cancel remote action tracking immediately
      if (trackingTargetId.current) {
        trackingTargetId.current = null;
        useCinemaStore.getState().setActionFocusTarget(null);
      }

      // Handle Pointer Lock mouse movement in FPS mode
      if (document.pointerLockElement === document.body && zoomIndexRef.current === 0) {
        targetYaw.current -= e.movementX * 0.0035;
        targetPitch.current = THREE.MathUtils.clamp(
          targetPitch.current - e.movementY * 0.0035,
          MIN_FPS_PITCH,
          MAX_FPS_PITCH
        );
        return;
      }

      if (!isDragging.current) return;

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

        if (zoomIndexRef.current === 0) {
          // FPS pitch adjustment
          targetPitch.current = THREE.MathUtils.clamp(
            targetPitch.current - dy * 0.005,
            MIN_FPS_PITCH,
            MAX_FPS_PITCH
          );
        } else {
          // 3rd-person pitch drag offset
          pitchDragOffset.current += dy * 0.0045;
          pitchDragOffset.current = THREE.MathUtils.clamp(
            pitchDragOffset.current,
            -Math.PI / 6,
            Math.PI / 4
          );
        }
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

    // Stepped Wheel Zoom (Roblox style)
    const handleWheel = (e: WheelEvent) => {
      if (
        (e.target as HTMLElement)?.closest(
          'input, textarea, .chat-messages-scroll, .modal-backdrop, .lobby-3d-card, .lobby-3d-overlay, .admin-page-wrap, .change-video-modal'
        )
      ) {
        return;
      }
      e.preventDefault();

      if (e.deltaY > 0) {
        // Scroll down: Zoom out 1 level
        changeZoomLevel(1);
      } else if (e.deltaY < 0) {
        // Scroll up: Zoom in 1 level
        changeZoomLevel(-1);
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
      } else if (key === 'i') {
        // Roblox standard: I to zoom In
        e.preventDefault();
        changeZoomLevel(-1);
      } else if (key === 'o') {
        // Roblox standard: O to zoom Out
        e.preventDefault();
        changeZoomLevel(1);
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
        zoomIndexRef.current = DEFAULT_ZOOM_INDEX;
        targetDist.current = ZOOM_LEVELS[DEFAULT_ZOOM_INDEX];
        currentDist.current = ZOOM_LEVELS[DEFAULT_ZOOM_INDEX];
        pitchDragOffset.current = 0;
        setCameraMode('follow');
        enterStartTime.current = null;
      }
      return;
    }

    // Smooth damp zoom distance (~0.15s)
    currentDist.current = THREE.MathUtils.damp(currentDist.current, targetDist.current, 12, delta);

    const isFPS = zoomIndexRef.current === 0;

    if (!isFPS) {
      // 3rd person dynamic base pitch
      const zoomProgress = THREE.MathUtils.clamp((currentDist.current - 2.5) / 32.5, 0, 1);
      const dynamicBasePitch = ((18 + zoomProgress * 20) * Math.PI) / 180;
      targetPitch.current = THREE.MathUtils.clamp(
        dynamicBasePitch + pitchDragOffset.current,
        MIN_3RD_PITCH,
        MAX_3RD_PITCH
      );
    }

    // Smooth damp yaw & pitch
    currentYaw.current = THREE.MathUtils.damp(currentYaw.current, targetYaw.current, 14, delta);
    currentPitch.current = THREE.MathUtils.damp(currentPitch.current, targetPitch.current, 14, delta);

    // Save camera yaw for camera-relative WASD walking
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

    // Target player coordinates (Self vs Remote action tracking)
    let charX = localPosRef.x;
    let charY = localPosRef.y;
    let charZ = localPosRef.z;

    const isTrackingRemote = trackingTargetId.current && now < trackingEndTime.current;
    if (isTrackingRemote && trackingTargetId.current) {
      const rp = remotePlayersMap.get(trackingTargetId.current);
      if (rp) {
        charX = rp.x;
        charY = rp.y;
        charZ = rp.z;
      }
    }

    if (isFPS) {
      // 4. FIRST-PERSON VIEW (FPS Mode)
      // Camera placed exactly at eye level (y + 1.5)
      _desiredCamPos.set(charX, charY + 1.5, charZ);

      // Mouse look forward vector
      const cosP = Math.cos(currentPitch.current);
      const sinP = Math.sin(currentPitch.current);
      const lookForwardX = -Math.sin(currentYaw.current) * cosP;
      const lookForwardY = sinP;
      const lookForwardZ = -Math.cos(currentYaw.current) * cosP;

      _focusCenter.set(
        charX + lookForwardX * 10,
        charY + 1.5 + lookForwardY * 10,
        charZ + lookForwardZ * 10
      );
    } else {
      // 5. THIRD-PERSON FOLLOW (Roblox Stepped Distance 2.5..35)
      // Camera smoothly orbits character, looking directly at character's upper torso/head!
      const focalY = isSeated ? charY + 0.85 : charY + 1.25;
      const pitch = currentPitch.current;
      const yaw = currentYaw.current;

      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      const hDist = currentDist.current * cosP;
      const vDist = currentDist.current * sinP;

      _desiredCamPos.set(
        charX + hDist * Math.sin(yaw),
        focalY + vDist,
        charZ + hDist * Math.cos(yaw)
      );

      // Camera look target is centered right on character (+0.25 offset so cinema screen is in upper half)
      _focusCenter.set(charX, focalY + 0.25, charZ);
    }

    // Throttled wall collider check & upward slide for 3rd person (max 20 checks/sec = 50ms)
    if (!isFPS && now - lastWallCheckTime.current >= 50) {
      lastWallCheckTime.current = now;

      const minX = -ROOM_HALF_W + 1.0;
      const maxX = ROOM_HALF_W - 1.0;
      const minZ = SCREEN_Z + 1.5;
      const maxZ = ROOM_BACK_Z - 1.0;

      // If camera hits the back wall (maxZ), slide camera up instead of pulling closer!
      let adjY = _desiredCamPos.y;
      if (_desiredCamPos.z > maxZ) {
        const excessZ = _desiredCamPos.z - maxZ;
        adjY += excessZ * 0.85; // Slide up towards ceiling
      }

      lastClampedPos.current.set(
        THREE.MathUtils.clamp(_desiredCamPos.x, minX, maxX),
        THREE.MathUtils.clamp(adjY, 1.0, 20.5),
        THREE.MathUtils.clamp(_desiredCamPos.z, minZ, maxZ)
      );
    }

    if (!isFPS) {
      _desiredCamPos.copy(lastClampedPos.current);
    }

    // Smooth damp camera position
    const camSpeed = isFPS ? 24 : 10;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, _desiredCamPos.x, camSpeed, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, _desiredCamPos.y, camSpeed, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, _desiredCamPos.z, camSpeed, delta);

    // Smooth damp lookAt target
    const lookSpeed = isFPS ? 28 : 12;
    currentLookAt.current.x = THREE.MathUtils.damp(currentLookAt.current.x, _focusCenter.x, lookSpeed, delta);
    currentLookAt.current.y = THREE.MathUtils.damp(currentLookAt.current.y, _focusCenter.y, lookSpeed, delta);
    currentLookAt.current.z = THREE.MathUtils.damp(currentLookAt.current.z, _focusCenter.z, lookSpeed, delta);

    camera.lookAt(currentLookAt.current);
  });

  return null;
};
