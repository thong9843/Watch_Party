'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { CheeringBanners3D } from './CheeringBanners3D';

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
      } catch {
        // ignore
      }

      const playerDiv = document.createElement('div');
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(playerDiv);

      try {
        playerRef.current = new w.YT.Player(playerDiv, {
          videoId: rawId,
          playerVars: {
            autoplay: 1,
            mute: 1, // Autoplay requires mute in modern browsers
            controls: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (isCancelled) return;
              setPlayerLoaded(true);
            },
            onStateChange: () => {
              // Track if live stream is delayed
              if (playerRef.current) {
                try {
                  const dur = playerRef.current.getDuration();
                  const cur = playerRef.current.getCurrentTime();
                  if (dur > 0 && dur - cur > 30) {
                    setIsBehindLive(true);
                  } else {
                    setIsBehindLive(false);
                  }
                } catch {
                  // ignore
                }
              }
            },
          },
        });
      } catch {
        // ignore
      }
    }

    const win = window as WindowWithYT;
    if (!win.YT || !win.YT.Player) {
      if (!document.getElementById('yt-iframe-api')) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      }

      const prevReady = win.onYouTubeIframeAPIReady;
      win.onYouTubeIframeAPIReady = () => {
        if (prevReady) prevReady();
        initPlayer();
      };

      const checkInterval = setInterval(() => {
        if (win.YT && win.YT.Player) {
          clearInterval(checkInterval);
          initPlayer();
        }
      }, 250);

      return () => {
        isCancelled = true;
        clearInterval(checkInterval);
        if (playerRef.current) {
          try {
            playerRef.current.destroy();
          } catch {
            // ignore
          }
          playerRef.current = null;
        }
      };
    } else {
      initPlayer();
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

  const handleReturnToLive = () => {
    const player = playerRef.current;
    if (player) {
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
    <group>
      {/* 2 Cheering Banner Ribbons (Above and Below Screen) */}
      <CheeringBanners3D />

      {/* Screen Frame elevated to Y = 8.7 (Bottom edge at Y = 3.5m above flat floor) */}
      <group position={[0, 8.7, -14.2]}>
        {/* 3D Cinema Screen Frame */}
        <mesh position={[0, 0, -0.1]}>
          <boxGeometry args={[18.4, 10.4, 0.4]} />
          <meshStandardMaterial color="#0c0a09" roughness={0.8} />
        </mesh>

        {/* Screen Border Frame Accent (Slight dark bronze) */}
        <mesh position={[0, 0, -0.05]}>
          <boxGeometry args={[18.1, 10.1, 0.2]} />
          <meshBasicMaterial color="#271f16" />
        </mesh>

        {/* Screen Canvas Matte (Black) */}
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[17.8, 9.8]} />
          <meshBasicMaterial color="#000000" />
        </mesh>

        {/* Left Dark Velvet Curtain (Đỏ đô sẫm #3b0808) */}
        <mesh position={[-9.8, 0, 0.3]} rotation={[0, 0.25, 0]}>
          <boxGeometry args={[1.8, 10.8, 0.6]} />
          <meshStandardMaterial color="#3b0808" roughness={0.95} />
        </mesh>
        {/* Right Dark Velvet Curtain (Đỏ đô sẫm #3b0808) */}
        <mesh position={[9.8, 0, 0.3]} rotation={[0, -0.25, 0]}>
          <boxGeometry args={[1.8, 10.8, 0.6]} />
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
                <div style={{ fontSize: '24px' }}>📡</div>
                <div style={{ fontSize: '13px', fontWeight: 500, letterSpacing: '0.5px' }}>
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
    </group>
  );
});
