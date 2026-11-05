'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useCinemaStore } from '../lib/store';

function createBannerCanvasTexture(
  text: string,
  glowColor: string,
  textColor: string
): { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = 4096;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // Dark background
  ctx.fillStyle = '#050508';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border accent lines
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(canvas.width, 2);
  ctx.moveTo(0, canvas.height - 2);
  ctx.lineTo(canvas.width, canvas.height - 2);
  ctx.stroke();

  // Font setup
  ctx.font = 'bold 50px "Be Vietnam Pro", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const fullUnit = text.trim() + '      ';
  const unitWidth = Math.max(80, ctx.measureText(fullUnit).width);
  const repeatCount = Math.ceil(canvas.width / unitWidth) + 2;

  let stream = '';
  for (let i = 0; i < repeatCount; i++) {
    stream += fullUnit;
  }

  // Draw glow shadow
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 14;
  ctx.fillStyle = textColor;
  ctx.fillText(stream, 16, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  return { canvas, texture };
}

export const CheeringBanners3D: React.FC = () => {
  const topBanner = useCinemaStore((state) => state.topBanner);
  const bottomBanner = useCinemaStore((state) => state.bottomBanner);

  const topTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const bottomTextureRef = useRef<THREE.CanvasTexture | null>(null);

  const topMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const bottomMaterialRef = useRef<THREE.MeshBasicMaterial>(null);

  // Ensure Be Vietnam Pro font is loaded before drawing on canvas
  useEffect(() => {
    let active = true;

    async function loadFontAndInit() {
      try {
        if (typeof document !== 'undefined' && 'fonts' in document) {
          const font = new FontFace(
            'Be Vietnam Pro',
            'url(/fonts/BeVietnamPro-Bold.ttf)',
            { weight: 'bold' }
          );
          await font.load();
          document.fonts.add(font);
        }
      } catch {
        // Fallback to system sans-serif
      }

      if (!active) return;

      // 1. Top Banner (Warm Golden Glow, runs left)
      if (topTextureRef.current) topTextureRef.current.dispose();
      const topData = createBannerCanvasTexture(
        topBanner,
        '#f59e0b',
        '#fef08a'
      );
      topTextureRef.current = topData.texture;
      if (topMaterialRef.current) {
        topMaterialRef.current.map = topData.texture;
        topMaterialRef.current.needsUpdate = true;
      }

      // 2. Bottom Banner (Electric Cyan Glow, runs right)
      if (bottomTextureRef.current) bottomTextureRef.current.dispose();
      const bottomData = createBannerCanvasTexture(
        bottomBanner,
        '#0284c7',
        '#e0f2fe'
      );
      bottomTextureRef.current = bottomData.texture;
      if (bottomMaterialRef.current) {
        bottomMaterialRef.current.map = bottomData.texture;
        bottomMaterialRef.current.needsUpdate = true;
      }
    }

    loadFontAndInit();

    return () => {
      active = false;
      if (topTextureRef.current) topTextureRef.current.dispose();
      if (bottomTextureRef.current) bottomTextureRef.current.dispose();
    };
  }, [topBanner, bottomBanner]);

  // High-performance continuous UV scrolling in useFrame (Zero canvas redraw, zero memory allocation)
  useFrame((_, delta) => {
    if (topTextureRef.current) {
      // Moves to the left
      topTextureRef.current.offset.x -= delta * 0.042;
    }
    if (bottomTextureRef.current) {
      // Moves to the right with different speed
      bottomTextureRef.current.offset.x += delta * 0.052;
    }
  });

  return (
    <group>
      {/* ====================================================================
          TOP BANNER RIBBON (Right above top frame edge: Y = 14.25, Z = -14.15)
          ==================================================================== */}
      <group position={[0, 14.25, -14.15]}>
        {/* Frame / Backing box with emissive glow edge */}
        <mesh position={[0, 0, -0.04]}>
          <boxGeometry args={[20.24, 0.64, 0.08]} />
          <meshStandardMaterial color="#09090b" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0, -0.02]}>
          <boxGeometry args={[20.28, 0.68, 0.02]} />
          <meshBasicMaterial color="#d97706" transparent opacity={0.65} />
        </mesh>

        {/* Scrolling CanvasTexture Display Surface */}
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[20.15, 0.54]} />
          <meshBasicMaterial ref={topMaterialRef as any} />
        </mesh>
      </group>

      {/* ====================================================================
          BOTTOM BANNER RIBBON (Right below bottom frame edge: Y = 3.15, Z = -14.15)
          ==================================================================== */}
      <group position={[0, 3.15, -14.15]}>
        {/* Frame / Backing box with emissive glow edge */}
        <mesh position={[0, 0, -0.04]}>
          <boxGeometry args={[20.24, 0.64, 0.08]} />
          <meshStandardMaterial color="#09090b" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0, -0.02]}>
          <boxGeometry args={[20.28, 0.68, 0.02]} />
          <meshBasicMaterial color="#0284c7" transparent opacity={0.65} />
        </mesh>

        {/* Scrolling CanvasTexture Display Surface */}
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[20.15, 0.54]} />
          <meshBasicMaterial ref={bottomMaterialRef as any} />
        </mesh>
      </group>
    </group>
  );
};
