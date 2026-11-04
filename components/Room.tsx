'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { findBestOxygenTank3D } from '../lib/layout';
import { createRoomConnection } from '../lib/realtime';
import {
  isMuted,
  playActionSound,
  playOxygenHiss,
  playPop,
  toggleMute,
} from '../lib/sfx';
import { ActionType, Member, RoomConn, RoomEvent } from '../lib/types';
import { useCinemaStore } from '../lib/store';
import { removeRemotePlayerData, setRemotePlayerData } from '../lib/playerRefs';
import { ActionBar } from './ActionBar';
import { Cinema3D } from './Cinema3D';
import { VirtualJoystick } from './VirtualJoystick';
import { ControlModeModal } from './ControlModeModal';
import { extractYouTubeId } from './Screen3D';

interface RoomProps {
  initialName: string;
  initialColor: string;
  videoId: string;
  roomId?: string;
}

export const Room: React.FC<RoomProps> = ({
  initialName,
  initialColor,
  videoId,
  roomId = 'room-cktg-1',
}) => {
  const [selfId] = useState(() => 'u_' + Math.random().toString(36).substring(2, 9));

  const [members, setMembers] = useState<Member[]>([]);
  const [mySeat, setMySeat] = useState<string | null>(null);
  const [seatAt, setSeatAt] = useState<number>(0);
  const [myOxygen, setMyOxygen] = useState<{ tank: number; start: number } | null>(null);
  const [connMode, setConnMode] = useState<'supabase' | 'local'>('local');
  const [muted, setMutedState] = useState(isMuted());

  // Recent chat & action popups
  const [chats, setChats] = useState<Record<string, { text: string; time: number }>>({});
  const [actions, setActions] = useState<Record<string, { type: ActionType; time: number }>>({});

  // Cooldowns
  const [cooldowns, setCooldowns] = useState({
    crow: 0,
    shout: 0,
    siuu: 0,
    oxygen: 0,
  });

  // Toasts
  const [toasts, setToasts] = useState<Array<{ id: number; message: string }>>([]);

  const addToast = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const connRef = useRef<RoomConn | null>(null);
  const lastOtherActionFocus = useRef<number>(0);

  const setActionFocusTarget = useCinemaStore((state) => state.setActionFocusTarget);
  const controlMode = useCinemaStore((state) => state.controlMode);
  const showControlModal = useCinemaStore((state) => state.showControlModal);
  const setShowControlModal = useCinemaStore((state) => state.setShowControlModal);
  const adminVideoId = useCinemaStore((state) => state.adminVideoId);
  const setAdminVideoId = useCinemaStore((state) => state.setAdminVideoId);

  // Show control modal on first join (if not mobile device)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isMobile) return;

    try {
      const shown = localStorage.getItem('esports_control_modal_shown');
      if (!shown) {
        setShowControlModal(true);
      }
    } catch {
      // ignore
    }
  }, [setShowControlModal]);

  const handleCloseControlModal = () => {
    setShowControlModal(false);
    try {
      localStorage.setItem('esports_control_modal_shown', 'true');
    } catch {
      // ignore
    }
  };

  const stateRef = useRef({
    selfId,
    name: initialName,
    color: initialColor,
    seat: mySeat,
    seatAt,
    oxygen: myOxygen,
  });
  stateRef.current = {
    selfId,
    name: initialName,
    color: initialColor,
    seat: mySeat,
    seatAt,
    oxygen: myOxygen,
  };

  const syncSelf = useCallback((overrides?: Partial<Member>) => {
    const conn = connRef.current;
    if (!conn) return;
    const current = stateRef.current;
    const updated: Member = {
      id: current.selfId,
      name: current.name,
      color: current.color,
      seat: current.seat,
      seatAt: current.seatAt,
      oxygen: current.oxygen,
      ...overrides,
    };
    conn.track(updated);
  }, []);

  // Initialize Room Connection
  useEffect(() => {
    const conn = createRoomConnection(selfId, roomId);
    connRef.current = conn;
    setConnMode(conn.mode);

    conn.track({
      id: selfId,
      name: initialName,
      color: initialColor,
      seat: null,
      seatAt: 0,
      oxygen: null,
    });

    conn.onMembers((remoteMembers) => {
      setMembers(remoteMembers);

      // Clean up disconnected remote players in playerRefs Map
      const activeIds = new Set(remoteMembers.map((m) => m.id));
      remoteMembers.forEach((m) => {
        if (!activeIds.has(m.id)) {
          removeRemotePlayerData(m.id);
        }
      });

      // Check seat contention (Tranh ghế)
      const current = stateRef.current;
      if (current.seat) {
        for (const other of remoteMembers) {
          if (other.id !== selfId && other.seat === current.seat) {
            const otherWins =
              other.seatAt < current.seatAt ||
              (other.seatAt === current.seatAt && other.id < current.selfId);

            if (otherWins) {
              setMySeat(null);
              setSeatAt(0);
              syncSelf({ seat: null, seatAt: 0 });
              addToast('Ghế vừa có người ngồi, chọn ghế khác nhé!');
              break;
            }
          }
        }
      }
    });

    conn.onEvent((evt: RoomEvent) => {
      if (evt.type === 'chat') {
        setChats((prev) => ({
          ...prev,
          [evt.id]: { text: evt.text, time: Date.now() },
        }));
        playPop();
      } else if (evt.type === 'action') {
        const curTime = Date.now();
        setActions((prev) => ({
          ...prev,
          [evt.id]: { type: evt.action, time: curTime },
        }));
        playActionSound(evt.action);

        if (useCinemaStore.getState().followOtherActions) {
          if (curTime - lastOtherActionFocus.current >= 3000) {
            lastOtherActionFocus.current = curTime;
            setActionFocusTarget({ id: evt.id, time: curTime });
          }
        }
      } else if (evt.type === 'admin_video') {
        // Admin broadcasted new video
        setAdminVideoId(evt.videoId);
        addToast(`Admin vừa đổi màn chiếu sang video mới! 🎬`);
      } else if (evt.type === 'pos') {
        // High frequency position updates written straight to playerRefs Map (zero React state re-renders)
        setRemotePlayerData(evt.id, {
          x: evt.x,
          y: evt.y,
          z: evt.z,
          rotY: evt.rotY,
          isMoving: evt.isMoving,
          pose: evt.pose as any,
        });
      }
    });

    return () => {
      conn.close();
      connRef.current = null;
    };
  }, [selfId, initialName, initialColor, roomId, addToast, syncSelf, setActionFocusTarget, setAdminVideoId]);

  // Select / change / vacate seat
  const handleSelectSeat = useCallback(
    (newSeat: string | null) => {
      if (myOxygen) {
        addToast('Đang thở oxi, hãy đợi trở về ghế nhé!');
        return;
      }
      const newSeatAt = newSeat ? Date.now() : 0;
      setMySeat(newSeat);
      setSeatAt(newSeatAt);
      syncSelf({ seat: newSeat, seatAt: newSeatAt });
      if (newSeat) {
        addToast(`Đã ngồi vào ghế ${newSeat} 🎬`);
      }
    },
    [myOxygen, syncSelf, addToast]
  );

  // Send Chat
  const handleSendChat = useCallback(
    (text: string) => {
      const conn = connRef.current;
      const evt: RoomEvent = {
        type: 'chat',
        id: selfId,
        text,
      };
      if (conn) conn.send(evt);

      setChats((prev) => ({
        ...prev,
        [selfId]: { text, time: Date.now() },
      }));
      playPop();
    },
    [selfId]
  );

  // Trigger Action
  const handleTriggerAction = useCallback(
    (action: ActionType) => {
      const conn = connRef.current;
      const evt: RoomEvent = {
        type: 'action',
        id: selfId,
        action,
      };
      if (conn) conn.send(evt);

      setActions((prev) => ({
        ...prev,
        [selfId]: { type: action, time: Date.now() },
      }));
      playActionSound(action);

      setCooldowns((prev) => ({
        ...prev,
        [action]: Date.now() + 4000,
      }));
    },
    [selfId]
  );

  // Request Oxygen
  const handleRequestOxygen = useCallback(() => {
    if (!mySeat) {
      addToast('Cần ngồi vào ghế trước khi đi thở oxi!');
      return;
    }

    const occupiedTanks = new Set<number>();
    for (const m of members) {
      if (m.oxygen) {
        occupiedTanks.add(m.oxygen.tank);
      }
    }

    const bestTank = findBestOxygenTank3D(mySeat, occupiedTanks);
    if (bestTank === null) {
      addToast('Hết bình oxi rồi, đợi chút!');
      return;
    }

    const session = {
      tank: bestTank,
      start: Date.now(),
    };

    setMyOxygen(session);
    syncSelf({ oxygen: session });
    playOxygenHiss();

    setCooldowns((prev) => ({
      ...prev,
      oxygen: Date.now() + 4000,
    }));
  }, [mySeat, members, syncSelf, addToast]);

  const handleOxygenComplete = useCallback(() => {
    setMyOxygen(null);
    syncSelf({ oxygen: null });
  }, [syncSelf]);

  const handleToggleSound = () => {
    const isNowMuted = toggleMute();
    setMutedState(isNowMuted);
  };

  const onlineCount = useMemo(() => {
    const ids = new Set(members.map((m) => m.id));
    ids.add(selfId);
    return ids.size;
  }, [members, selfId]);

  const seatedCount = useMemo(() => {
    let count = 0;
    for (const m of members) {
      if (m.seat) count++;
    }
    return count;
  }, [members]);

  const isRoomFull = seatedCount >= 60 && !mySeat;
  const isDebug = typeof window !== 'undefined' && window.location.search.includes('debug=1');

  // Priority chain: query ?v= > adminVideoId > initial videoId
  const effectiveVideoId = useMemo(() => {
    if (typeof window !== 'undefined') {
      const qv = new URLSearchParams(window.location.search).get('v');
      if (qv) return extractYouTubeId(qv);
    }
    if (adminVideoId) return extractYouTubeId(adminVideoId);
    return videoId;
  }, [adminVideoId, videoId]);

  return (
    <div className="cinema-room-layout-3d">
      {/* 1. Header */}
      <header className="cinema-header" role="banner">
        <div className="header-left">
          <div className="brand-logo">
            <span className="brand-icon">⚡</span>
            <span className="brand-title">Watch Party · CKTG 3D</span>
          </div>
          <span
            className={`mode-badge ${
              connMode === 'supabase' ? 'badge-online' : 'badge-local'
            }`}
          >
            {connMode === 'supabase' ? '● Online' : '● Demo local'}
          </span>
          <span className="room-indicator-badge">Phòng: {roomId}</span>
        </div>

        <div className="header-right">
          <div className="online-counter" title="Số khán giả trong phòng">
            <span className="online-icon">👥</span>
            <span>{onlineCount} người ({seatedCount}/60 ghế)</span>
          </div>

          {/* Settings button to reopen Control Mode modal */}
          <button
            type="button"
            className="control-settings-btn"
            onClick={() => setShowControlModal(true)}
            title="Đổi cách điều khiển"
            aria-label="Cài đặt điều khiển"
          >
            <span>⚙️</span>
            <span className="control-btn-label">Điều khiển</span>
          </button>

          <button
            type="button"
            className={`audio-toggle-btn ${muted ? 'is-muted' : ''}`}
            onClick={handleToggleSound}
            title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            aria-label="Tắt bật âm thanh"
          >
            <span>{muted ? '🔇' : '🔊'}</span>
            <span className="audio-btn-label">{muted ? 'Tắt âm' : 'Bật âm'}</span>
          </button>
        </div>
      </header>

      {/* 2. 3D Canvas Scene */}
      <main className="cinema-canvas-container">
        <Cinema3D
          videoId={effectiveVideoId}
          members={members}
          selfId={selfId}
          selfName={initialName}
          selfColor={initialColor}
          mySeat={mySeat}
          myOxygen={myOxygen}
          onSelectSeat={handleSelectSeat}
          onOxygenComplete={handleOxygenComplete}
          conn={connRef.current}
          chats={chats}
          actions={actions}
          debugMode={isDebug}
        />

        {/* Sansa Temple Tooltip for unseated player */}
        {!mySeat && (
          <div className="sansa-welcome-banner">
            <span className="sansa-hand-icon">👆</span>
            <span>Chạm vào ghế trống để tự đi tới ngồi (hoặc dùng WASD / click sàn để đi)</span>
          </div>
        )}

        {/* Control Mode Hint Pill at Corner */}
        <div className="control-hint-pill" role="status" aria-live="polite">
          {controlMode === 'keyboard' ? (
            <span>⌨️ WASD di chuyển · Giữ chuột trái xoay camera · Z đổi góc xa/gần · E ngồi/đứng · C xem màn chiếu</span>
          ) : (
            <span>🖱️ Click sàn/ghế để đi · Giữ chuột phải xoay · Z đổi góc · E ngồi/đứng</span>
          )}
        </div>

        {/* Queue Notice if 60/60 seats are occupied */}
        {isRoomFull && (
          <div className="cinema-queue-overlay">
            <div className="queue-card">
              <span className="queue-icon">⏳</span>
              <h3>Rạp đã kín chỗ (60/60 ghế)</h3>
              <p>Bạn đang ở hàng chờ. Khi có khán giả rời ghế, bạn có thể bấm để nhận chỗ ngay!</p>
            </div>
          </div>
        )}

        {/* Mobile Virtual Joystick */}
        <VirtualJoystick />
      </main>

      {/* 3. Sticky Bottom ActionBar */}
      <ActionBar
        onSendChat={handleSendChat}
        onTriggerAction={handleTriggerAction}
        onRequestOxygen={handleRequestOxygen}
        onStandUp={() => handleSelectSeat(null)}
        isSeated={Boolean(mySeat)}
        isBreathing={Boolean(myOxygen)}
        cooldowns={cooldowns}
        onShowToast={addToast}
      />

      {/* Control Mode Modal */}
      <ControlModeModal
        isOpen={showControlModal}
        onClose={handleCloseControlModal}
      />

      {/* Toast Notifications */}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast-item">
            <span className="toast-icon">ℹ️</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};