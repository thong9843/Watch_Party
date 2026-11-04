'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Html } from '@react-three/drei';

export function extractYouTubeId(input: string | null | undefined): string {
  if (!input) return 'jfKfPfyJRdk';
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  const liveMatch = trimmed.match(/\/live\/([a-zA-Z0-9_-]{11})/);
  if (liveMatch) return liveMatch[1];

  const embedMatch = trimmed.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];

  const vParamMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (vParamMatch) return vParamMatch[1];

  return trimmed || 'jfKfPfyJRdk';
}

interface YTPlayer {
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  getDuration(): number;
  getCurrentTime(): number;
  getVideoData(): { isLive?: boolean; title?: string };
  destroy(): void;
}

interface WindowWithYT extends Window {
  YT?: any;
  onYouTubeIframeAPIReady?: () => void;
}

interface Screen3DProps {
  videoId: string;
}

export const Screen3D: React.FC<Screen3DProps> = React.memo(function Screen3D({ videoId }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [isBehindLive, setIsBehindLive] = useState(false);
  const [playerLoaded, setPlayerLoaded] = useState(false);

  useEffect(() => {
    let checkInterval: NodeJS.Timeout | null = null;
    let isCancelled = false;

    const win = window as WindowWithYT;
    const initPlayer = () => {
      if (isCancelled || !containerRef.current || !win.YT || !win.YT.Player) return;

      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
      }

      try {
        playerRef.current = new win.YT.Player(containerRef.current, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            mute: 1,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: () => {
              if (!isCancelled) {
                setPlayerLoaded(true);
              }
            },
          },
        });
      } catch (err) {
        console.warn('Failed to construct YT.Player:', err);
      }
    };

    if (win.YT && win.YT.Player) {
      initPlayer();
    } else {
      const existingScript = document.getElementById('yt-iframe-api');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      }

      const prevCallback = win.onYouTubeIframeAPIReady;
      win.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        initPlayer();
      };
    }

    checkInterval = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      try {
        if (typeof player.getVideoData === 'function' && typeof player.getDuration === 'function') {
          const data = player.getVideoData();
          if (data && data.isLive) {
            const current = player.getCurrentTime();
            const duration = player.getDuration();
            if (duration > 0 && duration - current > 8) {
              setIsBehindLive(true);
            } else {
              setIsBehindLive(false);
            }
          } else {
            setIsBehindLive(false);
          }
        }
      } catch {
        // ignore
      }
    }, 1500);

    return () => {
      isCancelled = true;
      if (checkInterval) clearInterval(checkInterval);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }
    };
  }, [videoId]);

  const handleReturnToLive = () => {
    const player = playerRef.current;
    if (player && typeof player.seekTo === 'function' && typeof player.getDuration === 'function') {
      try {
        const dur = player.getDuration();
        player.seekTo(dur, true);
        setIsBehindLive(false);
      } catch {
        // ignore
      }
    }
  };

  return (
    <group position={[0, 4.6, -13.0]}>
      {/* 3D Cinema Screen Frame */}
      <mesh position={[0, 0, -0.1]}>
        <boxGeometry args={[16.6, 9.5, 0.4]} />
        <meshStandardMaterial color="#111116" roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Screen Border Glow (Warm Cinema Red/Gold) */}
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[16.2, 9.2, 0.3]} />
        <meshBasicMaterial color="#b91c1c" />
      </mesh>

      {/* Screen Canvas Matte */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[16.0, 9.0]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Left Velvet Curtain */}
      <mesh position={[-8.8, 0, 0.3]} rotation={[0, 0.25, 0]}>
        <boxGeometry args={[1.6, 9.8, 0.6]} />
        <meshStandardMaterial color="#7f1d1d" roughness={0.9} />
      </mesh>
      {/* Right Velvet Curtain */}
      <mesh position={[8.8, 0, 0.3]} rotation={[0, -0.25, 0]}>
        <boxGeometry args={[1.6, 9.8, 0.6]} />
        <meshStandardMaterial color="#7f1d1d" roughness={0.9} />
      </mesh>

      {/* Light coming from cinema screen */}
      <pointLight position={[0, 1, 3]} intensity={18} distance={22} color="#fef08a" />

      {/* Embedded HTML YouTube Player on the 3D screen face */}
      <Html
        transform
        occlude="blending"
        position={[0, 0, 0.02]}
        distanceFactor={6.8}
        style={{
          width: '960px',
          height: '540px',
          background: '#000000',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '4px',
        }}
      >
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

          {!playerLoaded && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: '#09090b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f59e0b',
                fontWeight: 700,
                fontSize: '18px',
              }}
            >
              Đang kết nối tín hiệu CKTG Live...
            </div>
          )}

          {isBehindLive && (
            <button
              type="button"
              onClick={handleReturnToLive}
              style={{
                position: 'absolute',
                bottom: '16px',
                right: '16px',
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '6px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.8)',
                zIndex: 30,
              }}
            >
              ● VỀ LIVE
            </button>
          )}
        </div>
      </Html>
    </group>
  );
});

