'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { CheeringBanners3D } from './CheeringBanners3D';
import { SCREEN_CENTER_Y, SCREEN_W, SCREEN_H, SCREEN_Z } from '../lib/layout';
import { extractYouTubeId } from '../lib/youtube';
export { extractYouTubeId };

interface YTPlayer {
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  getDuration(): number;
  getCurrentTime(): number;
  getVideoData(): { isLive?: boolean; title?: string };
  loadVideoById(id: string): void;
  playVideo(): void;
  unMute(): void;
  mute(): void;
  isMuted(): boolean;
  setVolume(volume: number): void;
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
  // Video ID actually loaded into the player
  const currentVideoIdRef = useRef<string>('');
  // Latest requested video ID (always up to date, even before the player is ready)
  const desiredVideoIdRef = useRef<string>(extractYouTubeId(videoId));
  // True only after YT onReady fired (player methods are not available before that)
  const playerReadyRef = useRef(false);
  desiredVideoIdRef.current = extractYouTubeId(videoId);
  const [videoStatus, setVideoStatus] = useState<'loading' | 'ready' | 'playing' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlayerMuted, setIsPlayerMuted] = useState(true);
  const [isBehindLive, setIsBehindLive] = useState(false);

  // Initialize YT.Player ONCE only
  useEffect(() => {
    let isCancelled = false;

    function createPlayer() {
      if (isCancelled) return;
      const w = window as WindowWithYT;
      if (!w.YT || !w.YT.Player || !containerRef.current) return;

      // Always use the LATEST requested id (room_config may have arrived while the API was loading)
      const rawId = desiredVideoIdRef.current;
      try {
        console.log('[Video] Initializing YT.Player once with videoId:', rawId);
        currentVideoIdRef.current = rawId;
        setVideoStatus('loading');
        setErrorMessage(null);

        playerRef.current = new w.YT.Player(containerRef.current, {
          videoId: rawId,
          playerVars: {
            autoplay: 1,
            mute: 1, // Autoplay requires muted to start immediately
            controls: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            origin: typeof window !== 'undefined' ? window.location.origin : '',
          },
          events: {
            onReady: (evt: any) => {
              if (isCancelled) return;
              playerReadyRef.current = true;
              setVideoStatus('ready');
              try {
                // Video changed while the player was initializing → load the latest one now
                const latest = desiredVideoIdRef.current;
                if (latest && latest !== currentVideoIdRef.current) {
                  console.log('[Video] Applying pending videoId after ready:', latest);
                  currentVideoIdRef.current = latest;
                  setVideoStatus('loading');
                  evt.target.loadVideoById(latest);
                }
                evt.target.playVideo();
                setIsPlayerMuted(Boolean(evt.target.isMuted()));
              } catch {}
            },
            onStateChange: (evt: any) => {
              if (isCancelled) return;
              // 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING
              if (evt.data === 1) {
                setVideoStatus('playing');
                setErrorMessage(null);
                try {
                  const vd = evt.target.getVideoData?.();
                  console.log('[Video] Now playing:', vd?.video_id || '(unknown)');
                } catch {}
              }
              try {
                if (playerRef.current) {
                  setIsPlayerMuted(Boolean(playerRef.current.isMuted()));
                }
              } catch {}
            },
            onError: (evt: any) => {
              if (isCancelled) return;
              setVideoStatus('error');
              const code = evt.data;
              if (code === 101 || code === 150) {
                setErrorMessage('Kênh này không cho nhúng video');
              } else if (code === 2 || code === 100) {
                setErrorMessage('Link không hợp lệ');
              } else {
                setErrorMessage(`Không thể phát video (Mã lỗi: ${code})`);
              }
            },
          },
        });
      } catch (err) {
        console.error('[Video] Error initializing YT.Player:', err);
      }
    }

    const w = window as WindowWithYT;
    if (w.YT && w.YT.Player) {
      createPlayer();
    } else {
      const prevCallback = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        createPlayer();
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
      playerReadyRef.current = false;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {}
        playerRef.current = null;
      }
    };
  }, []); // Only run once on mount!

  // React to videoId prop changes: call player.loadVideoById(id) WITHOUT recreate/destroy
  useEffect(() => {
    const nextId = extractYouTubeId(videoId);
    if (!nextId) return;

    if (nextId === currentVideoIdRef.current) {
      return;
    }

    console.log('[Video] videoId changed to:', nextId);

    const player = playerRef.current;
    // Player not ready yet: keep it pending in desiredVideoIdRef; onReady will load it.
    if (!player || !playerReadyRef.current || typeof player.loadVideoById !== 'function') {
      console.log('[Video] Player not ready yet, videoId queued:', nextId);
      return;
    }

    currentVideoIdRef.current = nextId;
    setVideoStatus('loading');
    setErrorMessage(null);
    try {
      player.loadVideoById(nextId);
      player.playVideo();
    } catch (err) {
      console.error('[Video] Error loading video by id:', err);
    }
  }, [videoId]);

  // Periodic check for mute status and live edge
  useEffect(() => {
    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;

      try {
        if (typeof player.isMuted === 'function') {
          setIsPlayerMuted(Boolean(player.isMuted()));
        }

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
      } catch {}
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleUnmute = () => {
    const player = playerRef.current;
    if (!player) return;
    try {
      player.unMute();
      player.setVolume(100);
      setIsPlayerMuted(false);
    } catch (err) {
      console.error('[Video] Error unmuting:', err);
    }
  };

  const handleReturnToLive = () => {
    const player = playerRef.current;
    if (!player) return;
    try {
      const duration = player.getDuration();
      player.seekTo(duration, true);
      setIsBehindLive(false);
    } catch {}
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
          // blending đặt iframe dưới canvas → bị che
          zIndexRange={[10, 0]}
          position={[0, 0, 0.02]}
          distanceFactor={(SCREEN_W * 400) / 1280}
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

            {/* Loading Spinner Overlay */}
            {videoStatus === 'loading' && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: '#07070a',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#e4e4e7',
                  gap: '14px',
                  zIndex: 35,
                  pointerEvents: 'none',
                }}
              >
                <div className="video-loading-spinner" />
                <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.5px' }}>
                  Đang tải video…
                </div>
              </div>
            )}

            {/* Error Message Overlay */}
            {videoStatus === 'error' && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(9, 9, 11, 0.94)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f87171',
                  gap: '12px',
                  zIndex: 45,
                  padding: '30px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '42px' }}>⚠️</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff' }}>
                  {errorMessage || 'Không thể phát video này'}
                </div>
                <div style={{ fontSize: '15px', color: '#a1a1aa' }}>
                  Hãy bấm &quot;📺 Đổi video&quot; trên thanh menu để chọn một video YouTube khác
                </div>
              </div>
            )}

            {/* Unmute Button Overlay */}
            {isPlayerMuted && (videoStatus === 'playing' || videoStatus === 'ready') && (
              <button
                type="button"
                onClick={handleUnmute}
                className="video-unmute-btn"
                title="Bấm để bật âm thanh màn chiếu"
                aria-label="Bật tiếng"
              >
                <span style={{ fontSize: '20px' }}>🔊</span>
                <span>Bật tiếng</span>
              </button>
            )}

            {isBehindLive && (
              <button
                type="button"
                onClick={handleReturnToLive}
                style={{
                  position: 'absolute',
                  bottom: '24px',
                  right: '24px',
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px 22px',
                  borderRadius: '30px',
                  fontWeight: 800,
                  fontSize: '15px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.8)',
                  zIndex: 40,
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
