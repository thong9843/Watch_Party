'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { findBestOxygenTank3D, resolveVideoId, TOTAL_SEATS } from '../lib/layout';
import { createRoomConnection, getStoredProfile, setStoredProfile } from '../lib/realtime';
import {
  isMuted,
  playActionSound,
  playOxygenHiss,
  playPop,
  toggleMute,
} from '../lib/sfx';
import { ActionType, ControlMode, Member, RoomConn, RoomEvent } from '../lib/types';
import { useCinemaStore } from '../lib/store';
import { removeRemotePlayerData, setRemotePlayerData } from '../lib/playerRefs';
import { ActionBar } from './ActionBar';
import { Cinema3D } from './Cinema3D';
import { VirtualJoystick } from './VirtualJoystick';
import { ControlModeModal } from './ControlModeModal';
import { extractYouTubeId } from './Screen3D';

interface RoomProps {
  videoId: string;
  roomId?: string;
}

const PRESET_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Amber/Yellow
  '#22c55e', // Green
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#a855f7', // Purple
  '#ec4899', // Pink
];

export const Room: React.FC<RoomProps> = ({
  videoId,
  roomId = 'room-cktg-1',
}) => {
  const [selfId] = useState(() => 'u_' + Math.random().toString(36).substring(2, 9));

  // Profile state for lobby
  const [initialProfile] = useState(() => getStoredProfile());
  const [profileName, setProfileName] = useState(initialProfile.name);
  const [profileColor, setProfileColor] = useState(initialProfile.color);
  const [lobbyError, setLobbyError] = useState<string | null>(null);

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

  // Change Video Modal State (V2.3)
  const [savedVideoId, setSavedVideoId] = useState<string | null>(null);
  const [showChangeVideoModal, setShowChangeVideoModal] = useState(false);
  const [changeVideoInput, setChangeVideoInput] = useState('');
  const [changeVideoError, setChangeVideoError] = useState<string | null>(null);

  // Read saved videoId from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('cinema_room_video_id');
      if (stored) setSavedVideoId(stored);
    }
  }, []);

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

  // Zustand Store
  const isLobby = useCinemaStore((state) => state.isLobby);
  const setIsLobby = useCinemaStore((state) => state.setIsLobby);
  const setCameraMode = useCinemaStore((state) => state.setCameraMode);
  const cinemaLights = useCinemaStore((state) => state.cinemaLights);
  const toggleCinemaLights = useCinemaStore((state) => state.toggleCinemaLights);
  const controlMode = useCinemaStore((state) => state.controlMode);
  const setControlMode = useCinemaStore((state) => state.setControlMode);
  const showControlModal = useCinemaStore((state) => state.showControlModal);
  const setShowControlModal = useCinemaStore((state) => state.setShowControlModal);
  const setActionFocusTarget = useCinemaStore((state) => state.setActionFocusTarget);
  const adminVideoId = useCinemaStore((state) => state.adminVideoId);
  const setAdminVideoId = useCinemaStore((state) => state.setAdminVideoId);
  const setBanners = useCinemaStore((state) => state.setBanners);

  // Single source of truth: Priority chain handled in resolveVideoId:
  // ?v= on URL > adminVideoId (room) > localStorage > default videoId (env)
  const effectiveVideoId = useMemo(() => {
    return extractYouTubeId(resolveVideoId(adminVideoId, videoId));
  }, [adminVideoId, videoId]);

  // Hint pill visibility: auto-hides 6 seconds after entering theater
  const [showControlHint, setShowControlHint] = useState(true);

  useEffect(() => {
    if (!isLobby) {
      const timer = setTimeout(() => {
        setShowControlHint(false);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [isLobby]);

  const stateRef = useRef({
    selfId,
    name: profileName,
    color: profileColor,
    seat: mySeat,
    seatAt,
    oxygen: myOxygen,
    isLobby,
    effectiveVideoId,
  });
  stateRef.current = {
    selfId,
    name: profileName,
    color: profileColor,
    seat: mySeat,
    seatAt,
    oxygen: myOxygen,
    isLobby,
    effectiveVideoId,
  };

  const syncSelf = useCallback((overrides?: Partial<Member>) => {
    const conn = connRef.current;
    if (!conn || stateRef.current.isLobby) return;
    const current = stateRef.current;
    const updated: Member = {
      id: current.selfId,
      name: current.name,
      color: current.color,
      seat: current.seat,
      seatAt: current.seatAt,
      oxygen: current.oxygen,
      videoId: current.effectiveVideoId,
      ...overrides,
    };
    conn.track(updated);
  }, []);

  // Initialize Room Connection (SPECTATOR ONLY when in lobby, NO track() until enter)
  useEffect(() => {
    const conn = createRoomConnection(selfId, roomId);
    connRef.current = conn;
    setConnMode(conn.mode);

    conn.onMembers((remoteMembers) => {
      setMembers(remoteMembers);

      // Clean up disconnected remote players in playerRefs Map
      const activeIds = new Set(remoteMembers.map((m) => m.id));
      remoteMembers.forEach((m) => {
        if (!activeIds.has(m.id)) {
          removeRemotePlayerData(m.id);
        }
      });

      // Synchronize videoId from existing peers if not yet set
      for (const other of remoteMembers) {
        if (other.videoId && !useCinemaStore.getState().adminVideoId) {
          setAdminVideoId(other.videoId);
          break;
        }
      }

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
        setAdminVideoId(evt.videoId);
        if (typeof window !== 'undefined') {
          localStorage.setItem('cinema_room_video_id', evt.videoId);
        }
        const sender = evt.senderName || 'Khán giả';
        addToast(`🎬 ${sender} đã đổi video màn chiếu!`);
      } else if (evt.type === 'admin_banners') {
        setBanners(evt.topBanner, evt.bottomBanner);
        addToast(`Admin vừa cập nhật biểu ngữ cổ vũ trên khán đài! 📢`);
      } else if (evt.type === 'pos') {
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
  }, [selfId, roomId, addToast, syncSelf, setActionFocusTarget, setAdminVideoId, setBanners]);

  // Seated & Online Counts
  const seatedCount = useMemo(() => {
    let count = 0;
    for (const m of members) {
      if (m.seat) count++;
    }
    return count;
  }, [members]);

  const onlineCount = useMemo(() => {
    if (isLobby) return members.length;
    const ids = new Set(members.map((m) => m.id));
    ids.add(selfId);
    return ids.size;
  }, [members, selfId, isLobby]);

  // Handler: Enter Cinema from 3D Lobby
  const handleEnterCinema = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = profileName.trim();
    if (trimmed.length < 2 || trimmed.length > 16) {
      setLobbyError('Biệt danh phải từ 2 đến 16 ký tự!');
      return;
    }
    setLobbyError(null);
    setStoredProfile(trimmed, profileColor);

    // 1. Trigger 1.2s smooth camera swoop from high lobby isometric down to entrance
    setCameraMode('entering');

    // 2. Officially join Presence after swoop finishes
    setTimeout(() => {
      setIsLobby(false);
      const conn = connRef.current;
      if (conn) {
        conn.track({
          id: selfId,
          name: trimmed,
          color: profileColor,
          seat: null,
          seatAt: 0,
          oxygen: null,
        });
      }
      addToast(`Chào mừng ${trimmed} đã vào rạp CKTG 3D! 🎬`);
    }, 1200);
  };

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

  const isRoomFull = seatedCount >= TOTAL_SEATS && !mySeat;
  const isDebug = typeof window !== 'undefined' && window.location.search.includes('debug=1');
  const isMobile = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  return (
    <div className="cinema-room-layout-3d">
      {/* 1. Cinema Header */}
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
            <span>{onlineCount} người ({seatedCount}/{TOTAL_SEATS} ghế)</span>
          </div>

          {/* Change Video Button (V2.3) */}
          <button
            type="button"
            className="change-video-btn"
            onClick={() => {
              setChangeVideoInput(effectiveVideoId);
              setChangeVideoError(null);
              setShowChangeVideoModal(true);
            }}
            title="Đổi video YouTube đang chiếu trên màn hình rạp"
            aria-label="Đổi video"
          >
            <span>📺</span>
            <span className="light-btn-label">Đổi video</span>
          </button>

          {/* Theater Lights Mode Switch (Lerp 0.6s) */}
          <button
            type="button"
            className={`cinema-light-toggle-btn ${cinemaLights === 'off' ? 'is-movie-mode' : ''}`}
            onClick={toggleCinemaLights}
            title="Bật / Tắt đèn rạp chiếu (Chế độ xem phim)"
            aria-label="Đèn rạp"
          >
            <span>{cinemaLights === 'on' ? '💡' : '🌙'}</span>
            <span className="light-btn-label">
              {cinemaLights === 'on' ? 'Đèn rạp: BẬT' : 'Đèn rạp: TẮT'}
            </span>
          </button>

          {/* Settings button to reopen Control Mode modal */}
          {!isLobby && !isMobile && (
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
          )}

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

      {/* 2. 3D Canvas Scene (Runs live behind the lobby) */}
      <main className="cinema-canvas-container">
        <Cinema3D
          videoId={effectiveVideoId}
          members={members}
          selfId={selfId}
          selfName={profileName}
          selfColor={profileColor}
          mySeat={mySeat}
          myOxygen={myOxygen}
          onSelectSeat={handleSelectSeat}
          onOxygenComplete={handleOxygenComplete}
          conn={connRef.current}
          chats={chats}
          actions={actions}
          debugMode={isDebug}
        />

        {/* 3. LOBBY 3D CARD OVERLAY (When in lobby) */}
        {isLobby && (
          <div className={`lobby-3d-overlay ${isMobile ? 'is-mobile' : ''}`}>
            <div className="lobby-3d-card">
              <div className="lobby-badge-row">
                <span className="trophy-badge">🏆 CKTG 2024 · LIVE WATCH PARTY</span>
                <span className="lobby-live-pill">
                  🟢 {members.length} người đang xem · {seatedCount}/{TOTAL_SEATS} ghế
                </span>
              </div>

              <h1 className="lobby-title">Esports Watch Party 3D</h1>
              <p className="lobby-subtitle">
                Rạp chiếu phim 3D trực tiếp CKTG LMHT · Cùng quẩy realtime với anh em
              </p>

              {/* Chibi Character Preview Area */}
              <div className="lobby-preview-container">
                <div className="preview-pedestal">
                  <svg viewBox="0 0 60 68" width="68" height="76" className="preview-chibi-svg">
                    <ellipse cx="23" cy="64" rx="7" ry="3.5" fill="#18181b" />
                    <ellipse cx="37" cy="64" rx="7" ry="3.5" fill="#18181b" />
                    <path d="M19 40 C19 34, 41 34, 41 40 L44 60 C44 63, 16 63, 16 60 Z" fill={profileColor} />
                    <path d="M18 42 Q13 48 16 54" stroke={profileColor} strokeWidth="5.5" strokeLinecap="round" fill="none" />
                    <path d="M42 42 Q47 48 44 54" stroke={profileColor} strokeWidth="5.5" strokeLinecap="round" fill="none" />
                    <circle cx="16" cy="54" r="3" fill="#ffdcb8" />
                    <circle cx="44" cy="54" r="3" fill="#ffdcb8" />
                    <circle cx="30" cy="24" r="15" fill="#ffdcb8" />
                    <path d="M15 22 C15 13 22 9 30 9 C38 9 45 13 45 22 C43 18 39 16 34 17 C29 18 24 16 20 19 C17 21 16 22 15 22 Z" fill="#18181b" />
                    <circle cx="22" cy="28" r="2.5" fill="#f87171" opacity="0.45" />
                    <circle cx="38" cy="28" r="2.5" fill="#f87171" opacity="0.45" />
                    <circle cx="25" cy="24" r="2.2" fill="#18181b" />
                    <circle cx="24.4" cy="23.4" r="0.8" fill="#ffffff" />
                    <circle cx="35" cy="24" r="2.2" fill="#18181b" />
                    <circle cx="34.4" cy="23.4" r="0.8" fill="#ffffff" />
                  </svg>
                </div>
              </div>

              <form onSubmit={handleEnterCinema} className="lobby-form">
                {/* Nickname Input */}
                <div className="lobby-input-group">
                  <label htmlFor="lobby-nickname" className="lobby-label">
                    Biệt danh của bạn
                  </label>
                  <input
                    id="lobby-nickname"
                    type="text"
                    className="chat-input lobby-input"
                    value={profileName}
                    onChange={(e) => {
                      setProfileName(e.target.value);
                      if (lobbyError) setLobbyError(null);
                    }}
                    maxLength={16}
                    placeholder="VD: Faker, Chovy, Gumayusi..."
                    required
                  />
                  {lobbyError && <p className="lobby-error-text">{lobbyError}</p>}
                </div>

                {/* Color Palette */}
                <div className="lobby-input-group">
                  <label className="lobby-label">Màu áo nhân vật</label>
                  <div className="color-palette-grid">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`color-bubble-btn ${profileColor === c ? 'is-active' : ''}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setProfileColor(c)}
                        title={`Chọn màu ${c}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Control Mode Selection (Desktop only) */}
                {!isMobile && (
                  <div className="lobby-input-group">
                    <label className="lobby-label">Cách điều khiển</label>
                    <div className="lobby-control-toggle-row">
                      <button
                        type="button"
                        className={`lobby-mode-btn ${controlMode === 'keyboard' ? 'is-selected' : ''}`}
                        onClick={() => setControlMode('keyboard')}
                      >
                        <span className="mode-btn-icon">⌨️</span>
                        <div className="mode-btn-text">
                          <strong>Bàn phím</strong>
                          <span>WASD + Chuột trái xoay</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        className={`lobby-mode-btn ${controlMode === 'mouse' ? 'is-selected' : ''}`}
                        onClick={() => setControlMode('mouse')}
                      >
                        <span className="mode-btn-icon">🖱️</span>
                        <div className="mode-btn-text">
                          <strong>Chuột</strong>
                          <span>Click sàn/ghế để đi</span>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Enter Button */}
                <button
                  type="submit"
                  className="modal-confirm-btn lobby-enter-btn"
                  disabled={!profileName.trim()}
                >
                  {seatedCount >= TOTAL_SEATS ? `⏳ Xếp hàng vào rạp (#${seatedCount - TOTAL_SEATS + 1})` : 'Vào rạp thưởng thức trận đấu 🎬'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Sansa Temple Tooltip for unseated player */}
        {!isLobby && !mySeat && (
          <div className="sansa-welcome-banner">
            <span className="sansa-hand-icon">👆</span>
            <span>Chạm vào ghế trống để tự đi tới ngồi (hoặc dùng WASD / click sàn để đi)</span>
          </div>
        )}

        {/* Control Mode Hint Pill (Right above ActionBar, auto-hides after 6s) */}
        {!isLobby && showControlHint && (
          <div className="control-hint-pill" role="status" aria-live="polite">
            {controlMode === 'keyboard' ? (
              <span>⌨️ WASD di chuyển · Giữ chuột trái xoay camera · Cuộn chuột zoom · E ngồi/đứng · C xem màn chiếu</span>
            ) : (
              <span>🖱️ Click sàn/ghế để đi · Giữ chuột phải xoay · Cuộn chuột zoom · E ngồi/đứng</span>
            )}
          </div>
        )}

        {/* Queue Notice if all seats are occupied */}
        {!isLobby && isRoomFull && (
          <div className="cinema-queue-overlay">
            <div className="queue-card">
              <span className="queue-icon">⏳</span>
              <h3>Rạp đã kín chỗ ({TOTAL_SEATS}/{TOTAL_SEATS} ghế)</h3>
              <p>Bạn đang ở hàng chờ. Khi có khán giả rời ghế, bạn có thể bấm để nhận chỗ ngay!</p>
            </div>
          </div>
        )}

        {/* Mobile Virtual Joystick */}
        {!isLobby && <VirtualJoystick />}
      </main>

      {/* 4. Sticky Bottom ActionBar (When inside theater) */}
      {!isLobby && (
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
      )}

      {/* Control Mode Modal (When opened from header settings button) */}
      <ControlModeModal
        isOpen={showControlModal}
        onClose={() => setShowControlModal(false)}
      />

      {/* Change Video Modal (V2.3) */}
      {showChangeVideoModal && (
        <div className="modal-backdrop" onClick={() => setShowChangeVideoModal(false)}>
          <div
            className="modal-card change-video-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="change-video-title"
          >
            <div className="modal-header">
              <h2 id="change-video-title">📺 Đổi Video YouTube Màn Chiếu</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowChangeVideoModal(false)}
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            <p className="modal-subtitle">
              Dán link YouTube bất kỳ (Live hoặc VOD) hoặc Video ID để phát trực tiếp lên màn chiếu 28m của rạp. Tất cả khán giả trong phòng đều xem realtime!
            </p>

            <form
              className="change-video-form"
              onSubmit={(e) => {
                e.preventDefault();
                const targetId = extractYouTubeId(changeVideoInput.trim());
                if (!targetId) {
                  setChangeVideoError('Link YouTube hoặc Video ID không hợp lệ! Hãy thử lại.');
                  return;
                }
                setChangeVideoError(null);
                setAdminVideoId(targetId);
                if (typeof window !== 'undefined') {
                  localStorage.setItem('cinema_room_video_id', targetId);
                }
                if (connRef.current) {
                  connRef.current.send({
                    type: 'admin_video',
                    videoId: targetId,
                    senderName: profileName.trim() || 'Khán giả',
                  });
                }
                syncSelf({ videoId: targetId });
                addToast(`🎬 Bạn đã đổi video sang "${targetId}"!`);
                setShowChangeVideoModal(false);
              }}
            >
              <div>
                <label htmlFor="change-video-input-field" className="lobby-label">
                  Link YouTube hoặc Video ID:
                </label>
                <input
                  id="change-video-input-field"
                  type="text"
                  className="change-video-input"
                  value={changeVideoInput}
                  onChange={(e) => {
                    setChangeVideoInput(e.target.value);
                    if (changeVideoError) setChangeVideoError(null);
                  }}
                  placeholder="VD: https://www.youtube.com/watch?v=dQw4w9WgXcQ hoặc dQw4w9WgXcQ"
                  autoFocus
                />
              </div>

              {changeVideoError && (
                <div className="change-video-error">
                  <span>⚠️</span>
                  <span>{changeVideoError}</span>
                </div>
              )}

              {(() => {
                const previewId = extractYouTubeId(changeVideoInput.trim());
                if (!previewId) return null;
                return (
                  <div className="change-video-preview">
                    <div className="change-video-thumb-wrap">
                      <img
                        src={`https://i.ytimg.com/vi/${previewId}/mqdefault.jpg`}
                        alt="YouTube Thumbnail Preview"
                        className="change-video-thumb-img"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="%23222"/><text x="50%" y="50%" fill="%23aaa" dominant-baseline="middle" text-anchor="middle" font-size="14">YouTube Preview</text></svg>';
                        }}
                      />
                    </div>
                    <div className="change-video-meta">
                      <span className="badge-detected">✓ Đã nhận diện ID:</span>
                      <span className="video-id-code">{previewId}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="change-video-actions">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setShowChangeVideoModal(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="modal-confirm-btn"
                  disabled={!extractYouTubeId(changeVideoInput.trim())}
                >
                  💾 Lưu & chiếu ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
