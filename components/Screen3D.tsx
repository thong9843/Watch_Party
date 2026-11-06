'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { CheeringBanners3D } from './CheeringBanners3D';
import { SCREEN_CENTER_Y, SCREEN_W, SCREEN_H, SCREEN_Z } from '../lib/layout';
import { extractYouTubeId } from '../lib/youtube';
import { useCinemaStore } from '../lib/store';
import { getServerTime } from '../lib/clockSync';
export { extractYouTubeId };

function formatDuration(sec: number): string {
  if (isNaN(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  if (hh > 0) {
    return `${hh}:${String(mm).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface YTPlayer {
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  getDuration(): number;
  getCurrentTime(): number;
  getVideoData(): { isLive?: boolean; title?: string };
  loadVideoById(id: string): void;
  playVideo(): void;
  pauseVideo(): void;
  unMute(): void;
  mute(): void;
  isMuted(): boolean;
  setVolume(volume: number): void;
  getVolume(): number;
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

  // Playback sync store values
  const playbackState = useCinemaStore((s) => s.playbackState);
  const playbackPosition = useCinemaStore((s) => s.playbackPosition);
  const playbackUpdatedAt = useCinemaStore((s) => s.playbackUpdatedAt);
  const storeIsLive = useCinemaStore((s) => s.isLive);

  // Local private volume (not synchronized)
  const [localVolume, setLocalVolume] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const v = Number(localStorage.getItem('cinema_player_volume'));
      return isNaN(v) ? 100 : Math.max(0, Math.min(100, v));
    }
    return 100;
  });

  // Read-only time display
  const [displayCurrentTime, setDisplayCurrentTime] = useState(0);
  const [displayDuration, setDisplayDuration] = useState(0);
  const [detectedLive, setDetectedLive] = useState(false);

  const isActuallyLive = storeIsLive || detectedLive;

  // Calculate authoritative target playback time based on server clock
  const getAuthoritativePosition = () => {
    const state = useCinemaStore.getState();
    if (state.isLive) return null;
    const nowServer = getServerTime();
    const elapsed = Math.max(0, (nowServer - state.playbackUpdatedAt) / 1000);
    return state.playbackState === 'playing' ? state.playbackPosition + elapsed : state.playbackPosition;
  };

  // Initialize YT.Player ONCE only
  useEffect(() => {
    let isCancelled = false;

    function createPlayer() {
      if (isCancelled) return;
      const w = window as WindowWithYT;
      if (!w.YT || !w.YT.Player || !containerRef.current) return;

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
            controls: 0, // SPEC V3.1: khóa controls ở người xem
            disablekb: 1, // SPEC V3.1: khóa bàn phím tua video
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
                // Apply pending videoId if changed while loading
                const latest = desiredVideoIdRef.current;
                if (latest && latest !== currentVideoIdRef.current) {
                  currentVideoIdRef.current = latest;
                  setVideoStatus('loading');
                  evt.target.loadVideoById(latest);
                }

                // Restore user volume (unmuted if user explicitly unmuted earlier)
                evt.target.setVolume(localVolume);

                // Detect if live stream
                const live = Boolean(evt.target.getVideoData?.()?.isLive);
                setDetectedLive(live);

                // Sync playback on ready
                const curState = useCinemaStore.getState();
                if (!curState.isLive && !live) {
                  const targetTime = getAuthoritativePosition();
                  if (targetTime !== null && targetTime > 0) {
                    console.log('[Video] Initial seek to authoritative position:', targetTime);
                    evt.target.seekTo(targetTime, true);
                  }
                }

                if (curState.playbackState === 'paused') {
                  evt.target.pauseVideo();
                } else {
                  evt.target.playVideo();
                }

                setIsPlayerMuted(Boolean(evt.target.isMuted()));
              } catch (err) {
                console.error('[Video] Error in onReady:', err);
              }
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
                  if (vd?.isLive) setDetectedLive(true);
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
                setErrorMessage('Kênh này không cho phép nhúng video ngoài YouTube');
              } else if (code === 2 || code === 100) {
                setErrorMessage('Link video YouTube không hợp lệ hoặc bị xóa');
              } else {
                setErrorMessage(`Không thể phát video (Mã lỗi YouTube: ${code})`);
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

  // React to videoId prop changes
  useEffect(() => {
    const nextId = extractYouTubeId(videoId);
    if (!nextId) return;

    if (nextId === currentVideoIdRef.current) {
      return;
    }

    console.log('[Video] videoId changed to:', nextId);

    const player = playerRef.current;
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

  // Sync to incoming playback state changes from Admin (via store)
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !playerReadyRef.current) return;

    if (playbackState === 'paused') {
      try {
        player.pauseVideo();
      } catch {}
    } else if (playbackState === 'playing') {
      try {
        player.playVideo();
      } catch {}
    }

    if (!isActuallyLive) {
      const target = getAuthoritativePosition();
      if (target !== null && typeof player.getCurrentTime === 'function') {
        try {
          const cur = player.getCurrentTime();
          if (Math.abs(cur - target) > 1.8) {
            console.log(`[Video] Syncing position: cur=${cur.toFixed(1)} -> target=${target.toFixed(1)}`);
            player.seekTo(target, true);
          }
        } catch {}
      }
    }
  }, [playbackState, playbackPosition, playbackUpdatedAt, isActuallyLive]);

  // Periodic clock: updates time display and checks sync threshold
  useEffect(() => {
    let tickCount = 0;
    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player || !playerReadyRef.current) return;

      tickCount++;

      try {
        if (typeof player.isMuted === 'function') {
          setIsPlayerMuted(Boolean(player.isMuted()));
        }

        const live = Boolean(player.getVideoData?.()?.isLive) || storeIsLive;
        if (live !== detectedLive) setDetectedLive(live);

        const cur = typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : 0;
        const dur = typeof player.getDuration === 'function' ? player.getDuration() : 0;
        setDisplayCurrentTime(cur);
        setDisplayDuration(dur);

        // Livestream handling: check live edge every 10s (tickCount % 10 === 0)
        if (live) {
          if (dur > 0 && dur - cur > 8) {
            setIsBehindLive(true);
            if (tickCount % 10 === 0) {
              console.log('[Video] Auto catch-up to live edge:', dur);
              player.seekTo(dur, true);
              setIsBehindLive(false);
            }
          } else {
            setIsBehindLive(false);
          }
          return;
        }

        // VOD handling: check sync every 5 seconds (tickCount % 5 === 0)
        if (tickCount % 5 === 0) {
          const target = getAuthoritativePosition();
          if (target !== null) {
            const diff = Math.abs(cur - target);
            if (diff > 2.0) {
              console.log(`[Video] Drift detected (${diff.toFixed(2)}s > 2s). Re-seeking to ${target.toFixed(2)}s`);
              player.seekTo(target, true);
            }
            if (playbackState === 'paused') {
              player.pauseVideo();
            }
          }
        }
      } catch {}
    }, 1000);

    return () => clearInterval(interval);
  }, [playbackState, storeIsLive, detectedLive]);

  const handleUnmute = () => {
    const player = playerRef.current;
    if (!player) return;
    try {
      player.unMute();
      player.setVolume(localVolume || 100);
      setIsPlayerMuted(false);
    } catch (err) {
      console.error('[Video] Error unmuting:', err);
    }
  };

  const handleVolumeChange = (vol: number) => {
    const clamped = Math.max(0, Math.min(100, vol));
    setLocalVolume(clamped);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cinema_player_volume', String(clamped));
    }
    const player = playerRef.current;
    if (player && typeof player.setVolume === 'function') {
      try {
        player.setVolume(clamped);
        if (clamped > 0 && isPlayerMuted) {
          player.unMute();
          setIsPlayerMuted(false);
        } else if (clamped === 0) {
          player.mute();
          setIsPlayerMuted(true);
        }
      } catch {}
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

            {/* SPEC V3.1: Transparent Shield Overlay to lock player clicks and prevents viewers from seeking */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 20,
                pointerEvents: 'auto',
                cursor: 'default',
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
            />

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

            {/* Custom Private Audio & Time Badge Bar (Overlay zIndex 30) */}
            <div
              style={{
                position: 'absolute',
                bottom: '16px',
                left: '20px',
                right: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                zIndex: 30,
                pointerEvents: 'none',
              }}
            >
              {/* Left: Time / Live Indicator Badge (Read-only) */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(12, 10, 9, 0.85)',
                  backdropFilter: 'blur(6px)',
                  padding: '8px 16px',
                  borderRadius: '24px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#ffffff',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                }}
              >
                {isActuallyLive ? (
                  <>
                    <span style={{ color: '#ef4444', fontSize: '16px', animation: 'pulse 1.5s infinite' }}>●</span>
                    <span style={{ color: '#f87171', letterSpacing: '0.5px' }}>LIVE TRỰC TIẾP</span>
                  </>
                ) : (
                  <>
                    <span style={{ color: playbackState === 'paused' ? '#eab308' : '#22c55e' }}>
                      {playbackState === 'paused' ? '⏸' : '▶'}
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatDuration(displayCurrentTime)} / {formatDuration(displayDuration)}
                    </span>
                    {playbackState === 'paused' && (
                      <span style={{ fontSize: '11px', color: '#eab308', marginLeft: '4px' }}>(Admin tạm dừng)</span>
                    )}
                  </>
                )}
              </div>

              {/* Right: Personal Volume Slider & Mute button */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: 'rgba(12, 10, 9, 0.85)',
                  backdropFilter: 'blur(6px)',
                  padding: '8px 16px',
                  borderRadius: '24px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  pointerEvents: 'auto',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                }}
              >
                <button
                  type="button"
                  onClick={isPlayerMuted ? handleUnmute : () => handleVolumeChange(0)}
                  style={{
                    background: isPlayerMuted ? '#ef4444' : 'transparent',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '16px',
                  }}
                  title={isPlayerMuted ? 'Bật tiếng' : 'Tắt tiếng'}
                >
                  {isPlayerMuted ? '🔇' : localVolume > 50 ? '🔊' : '🔉'}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isPlayerMuted ? 0 : localVolume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  style={{
                    width: '80px',
                    cursor: 'pointer',
                    accentColor: '#f59e0b',
                  }}
                  title={`Âm lượng riêng: ${isPlayerMuted ? 0 : localVolume}%`}
                />
                <span style={{ fontSize: '12px', color: '#a1a1aa', minWidth: '32px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {isPlayerMuted ? '0%' : `${localVolume}%`}
                </span>
              </div>
            </div>

            {/* Unmute prompt banner on initial load */}
            {isPlayerMuted && (videoStatus === 'playing' || videoStatus === 'ready') && (
              <button
                type="button"
                onClick={handleUnmute}
                className="video-unmute-btn"
                title="Bấm để bật âm thanh màn chiếu"
                aria-label="Bật tiếng"
                style={{ zIndex: 35 }}
              >
                <span style={{ fontSize: '20px' }}>🔊</span>
                <span>Bật tiếng rạp chiếu</span>
              </button>
            )}

            {isBehindLive && isActuallyLive && (
              <button
                type="button"
                onClick={handleReturnToLive}
                style={{
                  position: 'absolute',
                  bottom: '70px',
                  right: '24px',
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '30px',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.8)',
                  zIndex: 40,
                }}
              >
                ● VỀ LIVE TRỰC TIẾP
              </button>
            )}
          </div>
        </Html>
      </group>
    </group>
  );
});
