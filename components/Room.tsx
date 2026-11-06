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
import { useCinemaStore, GraphicsQuality } from '../lib/store';
import { removeRemotePlayerData, setRemotePlayerData, remotePlayersMap } from '../lib/playerRefs';
import { seatPos3D } from '../lib/layout';
import { ActionBar } from './ActionBar';
import { Cinema3D } from './Cinema3D';
import { VirtualJoystick } from './VirtualJoystick';
import { ControlModeModal } from './ControlModeModal';
import { UserModerationModal } from './UserModerationModal';
import { WebGLErrorBoundary } from './WebGLErrorBoundary';
import { extractYouTubeId } from './Screen3D';
import { syncServerTime } from '../lib/clockSync';

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

export const AVAILABLE_ROOMS = [
  { id: 'room-cktg-1', name: 'Phòng 1' },
  { id: 'room-cktg-2', name: 'Phòng 2' },
  { id: 'room-cktg-3', name: 'Phòng 3' },
  { id: 'room-cktg-4', name: 'Phòng 4' },
];

export const Room: React.FC<RoomProps> = ({
  videoId,
  roomId = 'room-cktg-1',
}) => {
  const [currentRoomId, setCurrentRoomId] = useState(() => roomId || 'room-cktg-1');
  const [showRoomSelector, setShowRoomSelector] = useState(false);
  const lastChatTimeRef = useRef<number>(0);

  const [selfId] = useState(() => 'u_' + Math.random().toString(36).substring(2, 9));

  // Profile state for lobby
  const [initialProfile] = useState(() => getStoredProfile());
  const [profileName, setProfileName] = useState(initialProfile.name);
  const [profileColor, setProfileColor] = useState(initialProfile.color);
  const [lobbyError, setLobbyError] = useState<string | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const botsRef = useRef<Member[]>([]);
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

  // Change Video / Suggestion / Admin States (V3-O3 Security)
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminKey, setAdminKey] = useState<string>('');
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminLoginKeyInput, setAdminLoginKeyInput] = useState('');
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);

  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestUrl, setSuggestUrl] = useState('');
  const [suggestTitle, setSuggestTitle] = useState('');
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const [showChangeVideoModal, setShowChangeVideoModal] = useState(false);
  const [changeVideoInput, setChangeVideoInput] = useState('');
  const [changeVideoError, setChangeVideoError] = useState<string | null>(null);
  const [moderationMember, setModerationMember] = useState<Member | null>(null);

  // Check saved admin key in sessionStorage on mount
  useEffect(() => {
    syncServerTime();
    const clockTimer = setInterval(() => {
      syncServerTime();
    }, 60000);
    return () => clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('admin_key');
      if (stored) {
        fetch('/api/admin/verify', {
          method: 'POST',
          headers: { 'x-admin-key': stored },
        })
          .then((res) => {
            if (res.ok) {
              setIsAdmin(true);
              setAdminKey(stored);
            } else {
              sessionStorage.removeItem('admin_key');
            }
          })
          .catch(() => {});
      }
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
  const graphicsQuality = useCinemaStore((state) => state.graphicsQuality);
  const setGraphicsQuality = useCinemaStore((state) => state.setGraphicsQuality);
  const cameraToast = useCinemaStore((state) => state.cameraToast);

  useEffect(() => {
    if (cameraToast) {
      addToast(cameraToast);
      useCinemaStore.getState().setCameraToast(null);
    }
  }, [cameraToast, addToast]);

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
  });
  stateRef.current = {
    selfId,
    name: profileName,
    color: profileColor,
    seat: mySeat,
    seatAt,
    oxygen: myOxygen,
    isLobby,
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
      ...overrides,
    };
    conn.track(updated);
  }, []);

  // Initialize Room Connection (SPECTATOR ONLY when in lobby, NO track() until enter)
  useEffect(() => {
    const conn = createRoomConnection(selfId, currentRoomId);
    connRef.current = conn;
    setConnMode(conn.mode);

    // Listen to authoritative room_config from Supabase Postgres changes / DB
    let lastConfigVideo: string | null = null;
    if (conn.onConfig) {
      conn.onConfig((cfg) => {
        if (cfg.video_url) {
          const nextVideo = extractYouTubeId(cfg.video_url);
          if (lastConfigVideo !== null && nextVideo && nextVideo !== lastConfigVideo) {
            addToast('🎬 Admin vừa đổi video màn chiếu!');
          }
          lastConfigVideo = nextVideo || lastConfigVideo;
          setAdminVideoId(nextVideo || cfg.video_url);
        }
        if (
          cfg.playback_state ||
          typeof cfg.playback_position === 'number' ||
          cfg.playback_updated_at !== undefined ||
          cfg.is_live !== undefined
        ) {
          useCinemaStore.getState().setPlayback({
            state: cfg.playback_state,
            position: cfg.playback_position,
            updatedAt: cfg.playback_updated_at,
            isLive: cfg.is_live,
          });
        }
        if (cfg.top_banner || cfg.bottom_banner) {
          setBanners(cfg.top_banner || '', cfg.bottom_banner || '');
        }
        if (cfg.cinema_lights) {
          useCinemaStore.getState().setCinemaLights(cfg.cinema_lights);
        }
      });
    }

    conn.onMembers((remoteMembers) => {
      setMembers([...remoteMembers, ...botsRef.current]);

      // Clean up disconnected remote players in playerRefs Map (exclude bots)
      const activeIds = new Set(remoteMembers.map((m) => m.id));
      remoteMembers.forEach((m) => {
        if (!m.id.startsWith('bot-') && !activeIds.has(m.id)) {
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
      if (Array.isArray(evt)) {
        // CompactPosTuple: [id, x, z, rotY, pose]
        const [id, x, z, rotY, poseCode] = evt;
        const poseMap = ['idle', 'walk', 'sit', 'crawl', 'breathe'] as const;
        setRemotePlayerData(id, {
          x,
          y: 0,
          z,
          rotY,
          isMoving: poseCode === 1,
          pose: (poseMap[poseCode] || 'idle') as any,
        });
      } else if (evt.type === 'chat') {
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
        const senderPos = remotePlayersMap.get(evt.id);
        playActionSound(evt.action, senderPos ? { x: senderPos.x, z: senderPos.z } : undefined);

        if (useCinemaStore.getState().followOtherActions) {
          if (curTime - lastOtherActionFocus.current >= 3000) {
            lastOtherActionFocus.current = curTime;
            setActionFocusTarget({ id: evt.id, time: curTime });
          }
        }
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
  }, [selfId, currentRoomId, addToast, syncSelf, setActionFocusTarget, setAdminVideoId, setBanners]);

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

  // --------------------------------------------------------------------------
  // BOT SIMULATION (?bots=N, default 60 bots)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const botsParam = params.get('bots');
    if (botsParam === null) return;

    const botCount = Math.max(1, Math.min(100, parseInt(botsParam, 10) || 60));
    console.log(`[BotSimulation] Spawning ${botCount} simulated audience bots...`);

    const seatCodes: string[] = [];
    ['B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach((row) => {
      for (let col = 1; col <= 14; col++) {
        seatCodes.push(`${row}${col}`);
      }
    });

    const botList: Member[] = [];
    for (let i = 0; i < botCount; i++) {
      const bId = `bot-${i + 1}`;
      const color = PRESET_COLORS[i % PRESET_COLORS.length];
      const name = `Fan #${String(i + 1).padStart(2, '0')}`;
      const isSeated = i < seatCodes.length && i < Math.floor(botCount * 0.7);
      const seat = isSeated ? seatCodes[i] : null;

      const botMember: Member = {
        id: bId,
        name,
        color,
        seat,
        seatAt: isSeated ? Date.now() : 0,
        oxygen: null,
      };
      botList.push(botMember);

      if (isSeated && seat) {
        const s = seatPos3D(seat);
        setRemotePlayerData(bId, s.x, s.y, s.z, Math.PI, false);
      } else {
        const randX = (Math.random() - 0.5) * 1.6;
        const randZ = 4.0 + Math.random() * 8.0;
        setRemotePlayerData(bId, randX, 0, randZ, 0, false);
      }
    }

    botsRef.current = botList;
    setMembers((prev) => {
      const nonBots = prev.filter((m) => !m.id.startsWith('bot-'));
      return [...nonBots, ...botList];
    });

    const botInterval = setInterval(() => {
      const randBotIdx = Math.floor(Math.random() * botCount);
      const b = botList[randBotIdx];
      if (!b) return;

      const roll = Math.random();
      if (roll < 0.25) {
        const actionTypes: ActionType[] = ['siuu', 'crow', 'shout'];
        const act = actionTypes[Math.floor(Math.random() * actionTypes.length)];
        const curTime = Date.now();
        setActions((prev) => ({ ...prev, [b.id]: { type: act, time: curTime } }));
        const pos = remotePlayersMap.get(b.id);
        playActionSound(act, pos ? { x: pos.x, z: pos.z } : undefined);
      } else if (roll < 0.45) {
        const sampleChats = [
          'SIUUUU!',
          'Gáy lên anh em ơi!',
          'Quá kinh khủng!',
          'Đỉnh nóc kịch trần!',
          'Cố lên T1!',
          'Hay quá đi!',
          'Cho xin tí oxi :v',
        ];
        const text = sampleChats[Math.floor(Math.random() * sampleChats.length)];
        setChats((prev) => ({ ...prev, [b.id]: { text, time: Date.now() } }));
      } else if (roll < 0.75 && !b.seat) {
        const newX = (Math.random() - 0.5) * 1.8;
        const newZ = 2.0 + Math.random() * 10.0;
        const target = remotePlayersMap.get(b.id);
        if (target) {
          target.x = newX;
          target.z = newZ;
          target.rotY = Math.random() * Math.PI * 2;
          target.isMoving = true;
          setTimeout(() => {
            if (target) target.isMoving = false;
          }, 1800);
        }
      }
    }, 1800);

    return () => {
      clearInterval(botInterval);
      botsRef.current = [];
      for (let i = 0; i < botCount; i++) {
        removeRemotePlayerData(`bot-${i + 1}`);
      }
    };
  }, []);

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

    // Auto room partition: if current room >= 60, auto-advance to next room
    if (members.length >= 60) {
      const idx = AVAILABLE_ROOMS.findIndex((r) => r.id === currentRoomId);
      if (idx !== -1 && idx < AVAILABLE_ROOMS.length - 1) {
        const nextRoom = AVAILABLE_ROOMS[idx + 1];
        setCurrentRoomId(nextRoom.id);
        addToast(`Phòng hiện tại đã đầy (60/60). Đã tự động chuyển bạn sang ${nextRoom.name}! 🚀`);
      }
    }

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

  // Send Chat (Anti-spam: rate limit 1 msg/s, max 60 chars, persist via server API)
  const handleSendChat = useCallback(
    (text: string) => {
      const now = Date.now();
      if (now - lastChatTimeRef.current < 1000) {
        addToast('Vui lòng đợi 1 giây trước khi gửi tin nhắn tiếp theo!');
        return;
      }
      const trimmed = text.trim().slice(0, 60);
      if (!trimmed) return;
      lastChatTimeRef.current = now;

      const conn = connRef.current;
      const evt: RoomEvent = {
        type: 'chat',
        id: selfId,
        text: trimmed,
      };
      if (conn) conn.send(evt);

      setChats((prev) => ({
        ...prev,
        [selfId]: { text: trimmed, time: now },
      }));
      playPop();

      // Persist to database via server API (rate-limited, bad-words filtered)
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: currentRoomId,
          senderId: selfId,
          senderName: profileName.trim(),
          message: trimmed,
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            if (res.status === 429) {
              addToast('Bạn chat quá nhanh (tối đa 1 tin/giây)!');
            } else if (data.error) {
              addToast(data.error);
            }
          }
        })
        .catch(() => {});
    },
    [selfId, currentRoomId, profileName, addToast]
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
          <span className="room-indicator-badge">
            {AVAILABLE_ROOMS.find((r) => r.id === currentRoomId)?.name || currentRoomId}
          </span>
        </div>

        <div className="header-right">
          <div className="online-counter" title="Số khán giả trong phòng">
            <span className="online-icon">👥</span>
            <span>{onlineCount} người ({seatedCount}/{TOTAL_SEATS} ghế)</span>
          </div>

          {/* Change Video Button (Admin) or Suggest Video Button (Viewer) - V3-O3 */}
          {isAdmin ? (
            <button
              type="button"
              className="change-video-btn admin-badge-active"
              onClick={() => {
                setChangeVideoInput(effectiveVideoId);
                setChangeVideoError(null);
                setShowChangeVideoModal(true);
              }}
              title="Admin: Đổi video YouTube đang chiếu trên màn hình rạp"
              aria-label="Đổi video"
            >
              <span>📺</span>
              <span className="light-btn-label">Đổi video (Admin)</span>
            </button>
          ) : (
            <button
              type="button"
              className="change-video-btn"
              onClick={() => {
                setSuggestUrl('');
                setSuggestTitle('');
                setSuggestError(null);
                setShowSuggestModal(true);
              }}
              title="Đề xuất video YouTube chiếu lên màn hình rạp"
              aria-label="Đề xuất video"
            >
              <span>💡</span>
              <span className="light-btn-label">Đề xuất video</span>
            </button>
          )}

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

          {/* Graphics Quality Setting: Thấp / Vừa / Cao / Tự động */}
          <button
            type="button"
            className="graphics-quality-btn"
            onClick={() => {
              const order: Record<GraphicsQuality, GraphicsQuality> = {
                auto: 'low',
                low: 'med',
                med: 'high',
                high: 'auto',
              };
              setGraphicsQuality(order[graphicsQuality]);
            }}
            title="Đổi mức chất lượng đồ họa: Thấp / Vừa / Cao / Tự động (Lưu vào máy)"
            aria-label="Chất lượng đồ họa"
          >
            <span>✨</span>
            <span className="light-btn-label">
              {graphicsQuality === 'auto' && 'Chất lượng: Tự động'}
              {graphicsQuality === 'high' && 'Chất lượng: Cao'}
              {graphicsQuality === 'med' && 'Chất lượng: Vừa'}
              {graphicsQuality === 'low' && 'Chất lượng: Thấp'}
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
        <WebGLErrorBoundary>
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
            onSelectMember={setModerationMember}
          />
        </WebGLErrorBoundary>

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

                {/* Room Partition Selector (V3 O2) */}
                <div className="lobby-room-partition-box">
                  <div className="lobby-room-status-row">
                    <span>
                      Phòng đang chọn:{' '}
                      <strong>{AVAILABLE_ROOMS.find((r) => r.id === currentRoomId)?.name || 'Phòng 1'}</strong> (
                      {members.length}/60 người)
                    </span>
                    <button
                      type="button"
                      className="lobby-room-switch-toggle"
                      onClick={() => setShowRoomSelector((prev) => !prev)}
                    >
                      {showRoomSelector ? '[Đóng]' : '[Đổi phòng]'}
                    </button>
                  </div>

                  {showRoomSelector && (
                    <div className="lobby-room-list">
                      {AVAILABLE_ROOMS.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className={`lobby-room-item ${r.id === currentRoomId ? 'is-selected' : ''}`}
                          onClick={() => {
                            setCurrentRoomId(r.id);
                            setShowRoomSelector(false);
                            addToast(`Đã chuyển sang ${r.name}`);
                          }}
                        >
                          <span>{r.name}</span>
                          <span className="room-count">
                            {r.id === currentRoomId ? `${members.length}/60 người` : 'Vào phòng'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

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

      {/* Change Video Modal (Admin Only - V3-O3) */}
      {showChangeVideoModal && (
        <div className="modal-backdrop" onClick={() => setShowChangeVideoModal(false)}>
          <div
            className="modal-card change-video-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="change-video-title"
          >
            <div className="modal-header">
              <h2 id="change-video-title">📺 Đổi Video YouTube (Admin)</h2>
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
              Admin đổi video phát trực tiếp trên màn chiếu rạp. Thay đổi sẽ cập nhật realtime tới mọi khán giả trong phòng thông qua cơ sở dữ liệu có kiểm tra quyền.
            </p>

            <form
              className="change-video-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const targetId = extractYouTubeId(changeVideoInput.trim());
                if (!targetId) {
                  setChangeVideoError('Link YouTube hoặc Video ID không hợp lệ! Hãy thử lại.');
                  return;
                }
                setChangeVideoError(null);

                const currentKey =
                  adminKey ||
                  (typeof window !== 'undefined' ? sessionStorage.getItem('admin_key') : '') ||
                  '';

                try {
                  const res = await fetch('/api/admin/config', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'x-admin-key': currentKey,
                    },
                    body: JSON.stringify({
                      roomId: currentRoomId,
                      videoUrl: targetId,
                      senderName: profileName.trim() || 'Admin',
                    }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    if (res.status === 401) {
                      setIsAdmin(false);
                      if (typeof window !== 'undefined') {
                        sessionStorage.removeItem('admin_key');
                      }
                      throw new Error('Admin key không hợp lệ hoặc đã hết hạn!');
                    }
                    throw new Error(data.error || 'Lỗi server');
                  }
                  setAdminVideoId(targetId);
                  addToast(`🎬 Đã đổi video sang "${targetId}" thành công!`);
                  setShowChangeVideoModal(false);
                } catch (err: any) {
                  setChangeVideoError(err.message || 'Lỗi xử lý');
                  addToast(`Lỗi: ${err.message}`);
                }
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

      {/* Suggest Video Modal (For Viewers - V3-O3) */}
      {showSuggestModal && (
        <div className="modal-backdrop" onClick={() => setShowSuggestModal(false)}>
          <div
            className="modal-card change-video-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="suggest-video-title"
          >
            <div className="modal-header">
              <h2 id="suggest-video-title">💡 Đề Xuất Video YouTube</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowSuggestModal(false)}
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            <p className="modal-subtitle">
              Gửi đề xuất video bạn muốn xem cho Quản trị viên phòng rạp. Quản trị viên sẽ xem xét duyệt phát lên màn chiếu chính!
            </p>

            <form
              className="change-video-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setSuggestError(null);
                const vid = extractYouTubeId(suggestUrl.trim());
                if (!vid) {
                  setSuggestError('Vui lòng nhập link YouTube hoặc Video ID hợp lệ!');
                  return;
                }
                setSuggestLoading(true);
                try {
                  const res = await fetch('/api/suggest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      roomId: currentRoomId,
                      videoUrl: vid,
                      title: suggestTitle.trim() || undefined,
                      suggestedBy: profileName.trim() || 'Khán giả',
                    }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    if (res.status === 429) {
                      throw new Error('Bạn gửi đề xuất quá nhanh (tối đa 3 lần/phút)!');
                    }
                    throw new Error(data.error || 'Lỗi gửi đề xuất');
                  }
                  addToast('💡 Đã gửi đề xuất video thành công tới Quản trị viên!');
                  setShowSuggestModal(false);
                  setSuggestUrl('');
                  setSuggestTitle('');
                } catch (err: any) {
                  setSuggestError(err.message || 'Lỗi hệ thống');
                } finally {
                  setSuggestLoading(false);
                }
              }}
            >
              <div>
                <label htmlFor="suggest-video-url-input" className="lobby-label">
                  Link YouTube hoặc Video ID:
                </label>
                <input
                  id="suggest-video-url-input"
                  type="text"
                  className="change-video-input"
                  value={suggestUrl}
                  onChange={(e) => {
                    setSuggestUrl(e.target.value);
                    if (suggestError) setSuggestError(null);
                  }}
                  placeholder="https://www.youtube.com/watch?v=..."
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="suggest-video-title-input" className="lobby-label" style={{ marginTop: '0.75rem' }}>
                  Tiêu đề video / Ghi chú (tùy chọn):
                </label>
                <input
                  id="suggest-video-title-input"
                  type="text"
                  className="change-video-input"
                  value={suggestTitle}
                  onChange={(e) => setSuggestTitle(e.target.value)}
                  placeholder="VD: Chung kết T1 vs WBG Highlight..."
                  maxLength={100}
                />
              </div>

              {suggestError && (
                <div className="change-video-error">
                  <span>⚠️</span>
                  <span>{suggestError}</span>
                </div>
              )}

              {(() => {
                const previewId = extractYouTubeId(suggestUrl.trim());
                if (!previewId) return null;
                return (
                  <div className="change-video-preview">
                    <div className="change-video-thumb-wrap">
                      <img
                        src={`https://i.ytimg.com/vi/${previewId}/mqdefault.jpg`}
                        alt="Preview"
                        className="change-video-thumb-img"
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
                  onClick={() => setShowSuggestModal(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="modal-confirm-btn"
                  disabled={suggestLoading || !extractYouTubeId(suggestUrl.trim())}
                >
                  {suggestLoading ? 'Đang gửi...' : '🚀 Gửi đề xuất'}
                </button>
              </div>

              <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.82rem', color: '#888' }}>
                <span>Bạn là Quản trị viên phòng? </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowSuggestModal(false);
                    setAdminLoginKeyInput('');
                    setAdminLoginError(null);
                    setShowAdminLoginModal(true);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#eab308',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  Đăng nhập Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Login Modal (V3-O3) */}
      {showAdminLoginModal && (
        <div className="modal-backdrop" onClick={() => setShowAdminLoginModal(false)}>
          <div
            className="modal-card change-video-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="admin-login-title"
          >
            <div className="modal-header">
              <h2 id="admin-login-title">🔐 Đăng Nhập Quản Trị Viên</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowAdminLoginModal(false)}
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            <p className="modal-subtitle">
              Nhập mã bí mật <code>ADMIN_KEY</code> để cấp quyền đổi video và cấu hình rạp chiếu trực tiếp.
            </p>

            <form
              className="change-video-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setAdminLoginError(null);
                const key = adminLoginKeyInput.trim();
                if (!key) {
                  setAdminLoginError('Vui lòng nhập Admin Key!');
                  return;
                }
                try {
                  const res = await fetch('/api/admin/verify', {
                    method: 'POST',
                    headers: { 'x-admin-key': key },
                  });
                  if (res.ok) {
                    if (typeof window !== 'undefined') {
                      sessionStorage.setItem('admin_key', key);
                    }
                    setIsAdmin(true);
                    setAdminKey(key);
                    setShowAdminLoginModal(false);
                    setAdminLoginKeyInput('');
                    addToast('Đã xác thực quyền Admin rạp chiếu! 🎬');
                  } else if (res.status === 429) {
                    setAdminLoginError('Bạn thử quá nhiều lần (tối đa 10 lần/phút)!');
                  } else if (res.status === 500) {
                    setAdminLoginError(
                      'Server chưa cấu hình biến môi trường ADMIN_KEY (hãy thêm ADMIN_KEY trên Vercel rồi Redeploy)!'
                    );
                  } else {
                    setAdminLoginError('Admin Key không chính xác!');
                  }
                } catch {
                  setAdminLoginError('Không thể kết nối máy chủ!');
                }
              }}
            >
              <div>
                <label htmlFor="admin-key-input-field" className="lobby-label">
                  Mã Admin Key:
                </label>
                <input
                  id="admin-key-input-field"
                  type="password"
                  className="change-video-input"
                  value={adminLoginKeyInput}
                  onChange={(e) => {
                    setAdminLoginKeyInput(e.target.value);
                    if (adminLoginError) setAdminLoginError(null);
                  }}
                  placeholder="Nhập ADMIN_KEY..."
                  autoFocus
                />
              </div>

              {adminLoginError && (
                <div className="change-video-error">
                  <span>⚠️</span>
                  <span>{adminLoginError}</span>
                </div>
              )}

              <div className="change-video-actions">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setShowAdminLoginModal(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="modal-confirm-btn"
                  disabled={!adminLoginKeyInput.trim()}
                >
                  🔓 Đăng nhập
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Moderation & Report Modal */}
      {moderationMember && (
        <UserModerationModal
          targetMember={moderationMember}
          currentRoomId={currentRoomId}
          selfId={selfId}
          onClose={() => setModerationMember(null)}
          onToast={addToast}
        />
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
