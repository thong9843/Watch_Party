'use client';

import React, { useEffect, useRef, useState } from 'react';

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

interface ScreenProps {
  videoId: string;
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

export const Screen = React.memo(function Screen({ videoId }: ScreenProps) {
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
    <section className="cinema-screen-wrap" aria-label="Màn chiếu CKTG">
      {/* Velvet curtains on left and right */}
      <div className="curtain curtain-left" aria-hidden="true" />
      <div className="curtain curtain-right" aria-hidden="true" />

      {/* Screen frame with glow */}
      <div className="screen-frame">
        <div className="screen-inner">
          <div ref={containerRef} className="yt-embed-box" />
          {!playerLoaded && (
            <div className="screen-loading-overlay">
              <span className="screen-spinner" />
              <span>Đang kết nối tín hiệu CKTG...</span>
            </div>
          )}
          {isBehindLive && (
            <button
              type="button"
              className="live-sync-btn"
              onClick={handleReturnToLive}
              title="Đang trễ so với trực tiếp. Bấm để về LIVE"
            >
              <span className="live-dot" />
              <span>Về LIVE</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
});
