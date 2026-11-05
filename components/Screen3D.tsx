'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { CheeringBanners3D } from './CheeringBanners3D';
import { SCREEN_CENTER_Y, SCREEN_W, SCREEN_H, SCREEN_Z } from '../lib/layout';

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
    const rawId = extractYouTubeId(videoId);
    let isCancelled = false;

    function initPlayer() {
      if (isCancelled) return;
      const w = window as WindowWithYT;
      if (!w.YT || !w.YT.Player || !containerRef.current) return;

      try {
        if (playerRef.current) {
          playerRef.current.destroy();
          playerRef.current = null;
        }

        playerRef.current = new w.YT.Player(containerRef.current, {
          videoId: rawId,
          playerVars: {
            autoplay: 1,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            origin: typeof window !== 'undefined' ? window.location.origin : '',
          },
          events: {
            onReady: () => {
              if (isCancelled) return;
              setPlayerLoaded(true);
            },
          },
        });
      } catch {
        // Iframe sandboxing or script load fallback
      }
    }

    const w = window as WindowWithYT;
    if (w.YT && w.YT.Player) {
      initPlayer();
    } else {
      const prevCallback = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        initPlayer();
      };

      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        document.body.appendChild(tag);
      }
    }

    return () => {
      isCancelled = true;
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

  // Periodic live edge check (5s)
  useEffect(() => {
    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;

      try {
        const isLive = player.getVideoData()?.isLive;
        if (!isLive) {
          setIsBehindLive(false);
          return;
        }

        const duration = player.getDuration();
        const current = player.getCurrentTime();
        if (duration > 0 && duration - current > 15) {
          setIsBehindLive(true);
        } else {
          setIsBehindLive(false);
        }
      } catch {
        // Player not ready
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleReturnToLive = () => {
    const player = playerRef.current;
    if (!player) return;
    try {
      const duration = player.getDuration();
      player.seekTo(duration, true);
      setIsBehindLive(false);
    } catch {
      // ignore
    }
  };

  return (
    <group>
      {/* 2 Cheering Banner Ribbons (Above and Below Screen) */}
      <CheeringBanners3D />

      {/* Screen Frame elevated to Y = 11.875 (Bottom edge at Y = 4.0m above flat floor, Size 28x15.75) */}
      <group position={[0, SCREEN_CENTER_Y, SCREEN_Z]}>
        {/* 3D Cinema Screen Frame */}
        <mesh position={[0, 0, -0.1]}>
          <boxGeometry args={[SCREEN_W + 0.8, SCREEN_H + 0.8, 0.4]} />
          <meshStandardMaterial color="#0c0a09" roughness={0.8} />
        </mesh>

        {/* Screen Border Frame Accent (Slight dark bronze) */}
        <mesh position={[0, 0, -0.05]}>
          <boxGeometry args={[SCREEN_W + 0.4, SCREEN_H + 0.4, 0.2]} />
          <meshBasicMaterial color="#271f16" />
        </mesh>

        {/* Screen Canvas Matte (Black) */}
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[SCREEN_W, SCREEN_H]} />
          <meshBasicMaterial color="#000000" />
        </mesh>

        {/* Left Dark Velvet Curtain (Đỏ đô sẫm #3b0808) */}
        <mesh position={[-SCREEN_W / 2 - 1.2, 0, 0.3]} rotation={[0, 0.25, 0]}>
          <boxGeometry args={[2.4, SCREEN_H + 1.2, 0.8]} />
          <meshStandardMaterial color="#3b0808" roughness={0.95} />
        </mesh>
        {/* Right Dark Velvet Curtain (Đỏ đô sẫm #3b0808) */}
        <mesh position={[SCREEN_W / 2 + 1.2, 0, 0.3]} rotation={[0, -0.25, 0]}>
          <boxGeometry args={[2.4, SCREEN_H + 1.2, 0.8]} />
          <meshStandardMaterial color="#3b0808" roughness={0.95} />
        </mesh>

        {/* Embedded HTML YouTube Player on 3D screen face */}
        <Html
          transform
          occlude="blending"
          // drei puts the canvas at zIndexRange[0]/2 for blending. The default range (~16M)
          // painted the canvas over every UI overlay (lobby card invisible).
          zIndexRange={[10, 0]}
          position={[0, 0, 0.02]}
          distanceFactor={4.3}
          style={{
            width: '1280px',
            height: '720px',
            background: '#000000',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '6px',
          }}
        >
          <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000000' }}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

            {!playerLoaded && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: '#07070a',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#71717a',
                  gap: '8px',
                }}
              >
                <div style={{ fontSize: '32px' }}>📡</div>
                <div style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '0.5px' }}>
                  Đang chờ tín hiệu màn chiếu…
                </div>
              </div>
            )}

            {isBehindLive && (
              <button
                type="button"
                onClick={handleReturnToLive}
                style={{
                  position: 'absolute',
                  bottom: '20px',
                  right: '20px',
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 18px',
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
    </group>
  );
});
