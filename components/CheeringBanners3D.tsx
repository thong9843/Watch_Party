'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useCinemaStore } from '../lib/store';
import { SCREEN_CENTER_Y, SCREEN_H, SCREEN_Z } from '../lib/layout';

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
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 1.5);
  ctx.lineTo(canvas.width, 1.5);
  ctx.moveTo(0, canvas.height - 1.5);
  ctx.lineTo(canvas.width, canvas.height - 1.5);
  ctx.stroke();

  // Font setup: bold 98px on 128px canvas (~80% canvas height)
  ctx.font = 'bold 98px "Be Vietnam Pro", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const fullUnit = text.trim() + '        ';
  const unitWidth = Math.max(140, ctx.measureText(fullUnit).width);
  const repeatCount = Math.ceil(canvas.width / unitWidth) + 2;

  let stream = '';
  for (let i = 0; i < repeatCount; i++) {
    stream += fullUnit;
  }

  // Draw intense glow shadow
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 18;
  ctx.fillStyle = textColor;
  ctx.fillText(stream, 16, canvas.height / 2);

  // Crisp foreground pass
  ctx.shadowBlur = 0;
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

  // High-performance continuous UV scrolling in useFrame
  useFrame((_, delta) => {
    if (topTextureRef.current) {
      topTextureRef.current.offset.x -= delta * 0.042;
    }
    if (bottomTextureRef.current) {
      bottomTextureRef.current.offset.x += delta * 0.052;
    }
  });

  const topBannerY = SCREEN_CENTER_Y + SCREEN_H / 2 + 0.38;
  const bottomBannerY = SCREEN_CENTER_Y - SCREEN_H / 2 - 0.38;
  const bannerZ = SCREEN_Z + 0.25;

  return (
    <group>
      {/* ====================================================================
          TOP BANNER RIBBON (Right at top edge of 28m screen: Y ~ 20.1)
          ==================================================================== */}
      <group position={[0, topBannerY, bannerZ]}>
        {/* Frame / Backing box with emissive glow edge */}
        <mesh position={[0, 0, -0.04]}>
          <boxGeometry args={[28.8, 0.76, 0.08]} />
          <meshStandardMaterial color="#09090b" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0, -0.02]}>
          <boxGeometry args={[28.85, 0.80, 0.02]} />
          <meshBasicMaterial color="#d97706" transparent opacity={0.65} />
        </mesh>

        {/* Scrolling CanvasTexture Display Surface */}
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[28.6, 0.68]} />
          <meshBasicMaterial ref={topMaterialRef as any} />
        </mesh>
      </group>

      {/* ====================================================================
          BOTTOM BANNER RIBBON (Right at bottom edge of 28m screen: Y ~ 3.6)
          ==================================================================== */}
      <group position={[0, bottomBannerY, bannerZ]}>
        {/* Frame / Backing box with emissive glow edge */}
        <mesh position={[0, 0, -0.04]}>
          <boxGeometry args={[28.8, 0.76, 0.08]} />
          <meshStandardMaterial color="#09090b" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0, -0.02]}>
          <boxGeometry args={[28.85, 0.80, 0.02]} />
          <meshBasicMaterial color="#0284c7" transparent opacity={0.65} />
        </mesh>

        {/* Scrolling CanvasTexture Display Surface */}
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[28.6, 0.68]} />
          <meshBasicMaterial ref={bottomMaterialRef as any} />
        </mesh>
      </group>
    </group>
  );
};
