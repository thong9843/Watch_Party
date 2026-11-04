'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { findBestOxygenTank } from '../lib/layout';
import { createRoomConnection } from '../lib/realtime';
import {
  isMuted,
  playActionSound,
  playOxygenHiss,
  playPop,
  toggleMute,
} from '../lib/sfx';
import { ActionType, Member, RoomConn, RoomEvent } from '../lib/types';
import { ActionBar } from './ActionBar';
import { Hall, useNow } from './Hall';
import { Screen } from './Screen';

interface RoomProps {
  initialName: string;
  initialColor: string;
  videoId: string;
}

export const Room: React.FC<RoomProps> = ({ initialName, initialColor, videoId }) => {
  // Generate random user ID once on client load
  const [selfId] = useState(() => 'u_' + Math.random().toString(36).substring(2, 9));
  const now = useNow(30);

  const [members, setMembers] = useState<Member[]>([]);
  const [mySeat, setMySeat] = useState<string | null>(null);
  const [seatAt, setSeatAt] = useState<number>(0);
  const [myOxygen, setMyOxygen] = useState<{ tank: number; start: number } | null>(null);
  const [connMode, setConnMode] = useState<'supabase' | 'local'>('local');
  const [muted, setMutedState] = useState(isMuted());

  // Recent chat & action popups: key is memberId
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

  // References to keep current state in callbacks
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

  // Helper to publish own member update
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
    const conn = createRoomConnection(selfId);
    connRef.current = conn;
    setConnMode(conn.mode);

    // Initial presence registration
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

      // Check seat contention (Tranh ghế)
      const current = stateRef.current;
      if (current.seat) {
        for (const other of remoteMembers) {
          if (other.id !== selfId && other.seat === current.seat) {
            // Compare seatAt, then tie break by ID
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
        setActions((prev) => ({
          ...prev,
          [evt.id]: { type: evt.action, time: Date.now() },
        }));
        playActionSound(evt.action);
      }
    });

    return () => {
      conn.close();
      connRef.current = null;
    };
  }, [selfId, initialName, initialColor, addToast, syncSelf]);

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
      // Send broadcast
      if (conn) conn.send(evt);

      // Apply locally immediately
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

      // Apply locally immediately
      setActions((prev) => ({
        ...prev,
        [selfId]: { type: action, time: Date.now() },
      }));
      playActionSound(action);

      // Set 4s cooldown
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
      addToast('Bạn cần chọn ghế ngồi trước khi đi thở oxi!');
      return;
    }

    // Determine occupied tanks from all current members
    const occupiedTanks = new Set<number>();
    for (const m of members) {
      if (m.oxygen) {
        occupiedTanks.add(m.oxygen.tank);
      }
    }

    const bestTank = findBestOxygenTank(mySeat, occupiedTanks);
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

  // Oxygen round trip finished
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

  return (
    <div className="cinema-room-layout">
      {/* 1. Header */}
      <header className="cinema-header" role="banner">
        <div className="header-left">
          <div className="brand-logo">
            <span className="brand-icon">⚡</span>
            <span className="brand-title">Watch Party · CKTG</span>
          </div>
          <span
            className={`mode-badge ${
              connMode === 'supabase' ? 'badge-online' : 'badge-local'
            }`}
          >
            {connMode === 'supabase' ? '● Online' : '● Demo local'}
          </span>
        </div>

        <div className="header-right">
          <div className="online-counter" title="Số khán giả trong phòng">
            <span className="online-icon">👥</span>
            <span>{onlineCount} người xem</span>
          </div>
          <button
            type="button"
            className={`audio-toggle-btn ${muted ? 'is-muted' : ''}`}
            onClick={handleToggleSound}
            title={muted ? 'Bật âm thanh hiệu ứng' : 'Tắt âm thanh hiệu ứng'}
            aria-label="Tắt bật âm thanh"
          >
            <span>{muted ? '🔇' : '🔊'}</span>
            <span className="audio-btn-label">{muted ? 'Tắt âm' : 'Bật âm'}</span>
          </button>
        </div>
      </header>

      {/* Main Room Body */}
      <main className="cinema-body">
        {/* 2. Màn chiếu (YouTube Player 16:9) */}
        <Screen videoId={videoId} />

        {/* 3. Khán phòng (Hall) */}
        <Hall
          members={members}
          selfId={selfId}
          mySeat={mySeat}
          onSelectSeat={handleSelectSeat}
          chats={chats}
          actions={actions}
          onOxygenComplete={handleOxygenComplete}
          now={now}
        />
      </main>

      {/* 4. ActionBar Sticky Bottom */}
      <ActionBar
        onSendChat={handleSendChat}
        onTriggerAction={handleTriggerAction}
        onRequestOxygen={handleRequestOxygen}
        isSeated={Boolean(mySeat)}
        isBreathing={Boolean(myOxygen)}
        cooldowns={cooldowns}
        now={now}
        onShowToast={addToast}
      />

      {/* Toast Notifications */}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast-item">
            <span className="toast-icon">⚠️</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

