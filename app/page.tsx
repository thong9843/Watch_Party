'use client';

import React, { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { JoinScreen } from '../components/JoinScreen';
import { Room } from '../components/Room';
import { extractYouTubeId } from '../components/Screen';
import { getStoredProfile } from '../lib/realtime';

function WatchPartyContent() {
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<{ name: string; color: string }>(() =>
    getStoredProfile()
  );
  const [isJoined, setIsJoined] = useState(false);

  const videoId = useMemo(() => {
    const queryV = searchParams.get('v');
    const defaultEnvId = process.env.NEXT_PUBLIC_YT_VIDEO_ID || 'jfKfPfyJRdk';
    return extractYouTubeId(queryV || defaultEnvId);
  }, [searchParams]);

  const handleJoin = (name: string, color: string) => {
    setProfile({ name, color });
    setIsJoined(true);
  };

  if (!isJoined) {
    return <JoinScreen onJoin={handleJoin} />;
  }

  return (
    <Room
      initialName={profile.name}
      initialColor={profile.color}
      videoId={videoId}
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
            background: '#09090b',
            color: '#f59e0b',
            fontSize: '16px',
            fontWeight: 700,
          }}
        >
          Đang khởi tạo Rạp Chiếu Phim...
        </div>
      }
    >
      <WatchPartyContent />
    </Suspense>
  );
}

