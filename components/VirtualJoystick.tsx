'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useCinemaStore } from '../lib/store';

export const VirtualJoystick: React.FC = () => {
  const [touchActive, setTouchActive] = useState(false);
  const [handlePos, setHandlePos] = useState({ x: 0, y: 0 });
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const baseRef = useRef<HTMLDivElement>(null);
  const touchIdRef = useRef<number | null>(null);
  const setJoystickVector = useCinemaStore((state) => state.setJoystickVector);
  const isSeated = useCinemaStore((state) => state.isSeated);

  useEffect(() => {
    // Only enable if device has touch / coarse pointer (hidden on desktop mouse/keyboard)
    const matchCoarse = window.matchMedia('(pointer: coarse)').matches;
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setIsTouchDevice(matchCoarse || hasTouch);
  }, []);

  const radius = 42; // Joystick max radius

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isSeated) return;
    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;
    setTouchActive(true);
    updatePosition(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchActive) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        updatePosition(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleTouchEnd = () => {
    touchIdRef.current = null;
    setTouchActive(false);
    setHandlePos({ x: 0, y: 0 });
    setJoystickVector({ x: 0, y: 0 });
  };

  const updatePosition = (clientX: number, clientY: number) => {
    if (!baseRef.current) return;
    const rect = baseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    let clampedX = dx;
    let clampedY = dy;
    if (dist > radius) {
      clampedX = (dx / dist) * radius;
      clampedY = (dy / dist) * radius;
    }

    setHandlePos({ x: clampedX, y: clampedY });
    setJoystickVector({
      x: clampedX / radius,
      y: clampedY / radius,
    });
  };

  if (isSeated || !isTouchDevice) return null;

  return (
    <div
      ref={baseRef}
      className="virtual-joystick-base"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      aria-label="Cần điều khiển di chuyển"
    >
      <div
        className="virtual-joystick-thumb"
        style={{
          transform: `translate(${handlePos.x}px, ${handlePos.y}px)`,
        }}
      />
    </div>
  );
};
