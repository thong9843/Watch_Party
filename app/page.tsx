'use client';

import React, { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Room } from '../components/Room';
import { extractYouTubeId } from '../components/Screen3D';

function WatchPartyContent() {
  const searchParams = useSearchParams();

  const videoId = useMemo(() => {
    const queryV = searchParams.get('v');
    const defaultEnvId = process.env.NEXT_PUBLIC_YT_VIDEO_ID || 'jfKfPfyJRdk';
    return extractYouTubeId(queryV || defaultEnvId);
  }, [searchParams]);

  const roomId = useMemo(() => {
    return searchParams.get('room') || 'room-cktg-1';
  }, [searchParams]);

  return (
    <Room
      videoId={videoId}
      roomId={roomId}
    />
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#07070a',
            color: '#f59e0b',
            fontSize: '16px',
            fontWeight: 700,
          }}
        >
          Đang khởi tạo Rạp Chiếu Phim 3D CKTG...
        </div>
      }
    >
      <WatchPartyContent />
    </Suspense>
  );
}
