import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { Member, RoomConn, RoomEvent, RoomConfigData } from './types';

export function getStoredProfile(): { name: string; color: string } {
  const defaultColors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#06b6d4', '#3b82f6', '#a855f7', '#ec4899',
  ];
  const fallback = {
    name: 'Khách ' + Math.floor(100 + Math.random() * 900),
    color: defaultColors[Math.floor(Math.random() * defaultColors.length)],
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem('esports_user_profile');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.name && parsed.color) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return fallback;
}

export function setStoredProfile(name: string, color: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('esports_user_profile', JSON.stringify({ name, color }));
  } catch {
    // ignore
  }
}

// Clock-skew compensation cache for oxygen sessions: ${memberId}-${tank}-${start} -> adjustedStart
const oxygenTimeCache = new Map<string, number>();

function normalizeOxygen(member: Member, selfId: string): Member {
  if (!member.oxygen || member.id === selfId) return member;
  const key = `${member.id}-${member.oxygen.tank}-${member.oxygen.start}`;
  let adjusted = oxygenTimeCache.get(key);
  if (adjusted === undefined) {
    const now = Date.now();
    if (Math.abs(now - member.oxygen.start) < 4000) {
      adjusted = now;
    } else {
      adjusted = member.oxygen.start;
    }
    oxygenTimeCache.set(key, adjusted);
  }
  return {
    ...member,
    oxygen: {
      ...member.oxygen,
      start: adjusted,
    },
  };
}

// Anti-spam receiver filters: drop messages exceeding limits
const peerLastChatTime = new Map<string, number>();
const peerLastActionTime = new Map<string, number>();

function isSpam(e: RoomEvent): boolean {
  const now = Date.now();
  if (Array.isArray(e)) {
    // CompactPosTuple: [id, x, z, rotY, pose]
    return false;
  }
  if (e.type === 'chat') {
    if (!e.text || e.text.length > 80) return true;
    const last = peerLastChatTime.get(e.id) || 0;
    if (now - last < 800) return true; // 1 msg / 1s rate limit
    peerLastChatTime.set(e.id, now);
  } else if (e.type === 'action') {
    const last = peerLastActionTime.get(e.id) || 0;
    if (now - last < 3500) return true; // 4s action cooldown
    peerLastActionTime.set(e.id, now);
  }
  return false;
}

function cleanPresenceMember(m: Member): Member {
  return {
    id: m.id,
    name: m.name,
    color: m.color,
    seat: m.seat,
    seatAt: m.seatAt,
    oxygen: m.oxygen,
    videoVersion: m.videoVersion,
  };
}

export function createRoomConnection(selfId: string, roomId = 'room-cktg-1'): RoomConn {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const useSupabase = Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.trim() !== '' &&
    supabaseAnonKey.trim() !== ''
  );

  let membersCb: ((members: Member[]) => void) | null = null;
  let eventCb: ((event: RoomEvent) => void) | null = null;
  let configCb: ((config: RoomConfigData) => void) | null = null;

  if (useSupabase && supabaseUrl && supabaseAnonKey) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 20,
        },
      },
    });

    let isSubscribed = false;
    let pendingTrack: Member | null = null;
    let channel: RealtimeChannel | null = null;

    const fetchInitialConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('room_config')
          .select('*')
          .eq('room_id', roomId)
          .maybeSingle();
        if (!error && data && configCb) {
          configCb(data as RoomConfigData);
        }
      } catch {}
    };

    try {
      channel = supabase.channel(roomId, {
        config: {
          broadcast: { self: false },
          presence: { key: selfId },
        },
      });

      const notifyMembers = () => {
        if (!channel || !membersCb) return;
        const state = channel.presenceState();
        const list: Member[] = [];
        for (const key of Object.keys(state)) {
          const metas = state[key];
          if (metas && metas.length > 0) {
            const rawMember = metas[metas.length - 1] as unknown as Member;
            if (rawMember && rawMember.id) {
              list.push(normalizeOxygen(rawMember, selfId));
            }
          }
        }
        membersCb(list);
      };

      channel
        .on('presence', { event: 'sync' }, () => {
          notifyMembers();
        })
        .on('presence', { event: 'join' }, () => {
          notifyMembers();
        })
        .on('presence', { event: 'leave' }, () => {
          notifyMembers();
        })
        .on('broadcast', { event: 'evt' }, (payload) => {
          if (eventCb && payload.payload) {
            const e = payload.payload as RoomEvent;
            if (!isSpam(e)) {
              eventCb(e);
            }
          }
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'room_config',
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            if (configCb && payload.new) {
              configCb(payload.new as RoomConfigData);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            isSubscribed = true;
            if (pendingTrack) {
              channel?.track(cleanPresenceMember(pendingTrack)).catch((err) => console.warn('Supabase track error:', err));
              pendingTrack = null;
            }
          }
        });

      fetchInitialConfig();
    } catch (e) {
      console.warn('Failed to initialize Supabase realtime:', e);
    }

    return {
      mode: 'supabase',
      track(m: Member) {
        const cleaned = cleanPresenceMember(m);
        if (isSubscribed && channel) {
          channel.track(cleaned).catch((err) => console.warn('Supabase track error:', err));
        } else {
          pendingTrack = cleaned;
        }
      },
      send(e: RoomEvent) {
        if (channel) {
          channel.send({
            type: 'broadcast',
            event: 'evt',
            payload: e,
          }).catch((err) => console.warn('Supabase broadcast send error:', err));
        }
      },
      onMembers(cb) {
        membersCb = cb;
      },
      onEvent(cb) {
        eventCb = cb;
      },
      onConfig(cb) {
        configCb = cb;
        fetchInitialConfig();
      },
      close() {
        if (channel) {
          channel.untrack().catch(() => {});
          supabase.removeChannel(channel).catch(() => {});
        }
      },
    };
  }

  // LOCAL MODE with BroadcastChannel
  const channelName = `esports-${roomId}`;
  let bc: BroadcastChannel | null = null;
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    bc = new BroadcastChannel(channelName);
  }

  const memberStore = new Map<string, { member: Member; lastSeen: number }>();
  let currentSelfMember: Member | null = null;

  const emitMembers = () => {
    if (!membersCb) return;
    const now = Date.now();
    const list: Member[] = [];
    memberStore.forEach((val, id) => {
      // 6s timeout for peer presence
      if (id === selfId || now - val.lastSeen <= 6000) {
        list.push(normalizeOxygen(val.member, selfId));
      }
    });
    membersCb(list);
  };

  if (bc) {
    bc.onmessage = (evt) => {
      const data = evt.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'hello') {
        if (data.member && data.member.id !== selfId) {
          memberStore.set(data.member.id, { member: data.member, lastSeen: Date.now() });
        }
        if (currentSelfMember && bc) {
          bc.postMessage({ type: 'state', member: currentSelfMember });
        }
        emitMembers();
      } else if (data.type === 'state') {
        if (data.member && data.member.id !== selfId) {
          memberStore.set(data.member.id, { member: data.member, lastSeen: Date.now() });
          emitMembers();
        }
      } else if (data.type === 'heartbeat') {
        if (data.id && data.id !== selfId && memberStore.has(data.id)) {
          const entry = memberStore.get(data.id)!;
          entry.lastSeen = Date.now();
        }
      } else if (data.type === 'leave') {
        if (data.id && data.id !== selfId) {
          memberStore.delete(data.id);
          emitMembers();
        }
      } else if (data.type === 'config') {
        if (data.config && configCb) {
          configCb(data.config);
        }
      } else if (data.type === 'event') {
        if (data.event && eventCb && data.event.id !== selfId) {
          const e = data.event as RoomEvent;
          if (!isSpam(e)) {
            eventCb(e);
          }
        }
      }
    };
  }

  // Periodic heartbeat every 2s
  const heartbeatTimer = setInterval(() => {
    if (bc && currentSelfMember) {
      bc.postMessage({ type: 'heartbeat', id: selfId });
    }
    const now = Date.now();
    let changed = false;
    memberStore.forEach((val, id) => {
      if (id !== selfId && now - val.lastSeen > 6000) {
        memberStore.delete(id);
        changed = true;
      }
    });
    if (changed) {
      emitMembers();
    }
  }, 2000);

  return {
    mode: 'local',
    track(m: Member) {
      const cleaned = cleanPresenceMember(m);
      currentSelfMember = cleaned;
      memberStore.set(selfId, { member: cleaned, lastSeen: Date.now() });
      if (bc) {
        bc.postMessage({ type: 'state', member: cleaned });
      }
      emitMembers();
    },
    send(e: RoomEvent) {
      if (bc) {
        bc.postMessage({ type: 'event', event: e });
      }
    },
    onMembers(cb) {
      membersCb = cb;
      if (bc && currentSelfMember) {
        bc.postMessage({ type: 'hello', member: currentSelfMember });
      } else if (bc) {
        bc.postMessage({ type: 'hello' });
      }
      emitMembers();
    },
    onEvent(cb) {
      eventCb = cb;
    },
    onConfig(cb) {
      configCb = cb;
      // Emit cached config if exists
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem(`room_config_${roomId}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            cb(parsed);
          }
        } catch {}
      }
    },
    close() {
      clearInterval(heartbeatTimer);
      if (bc) {
        try {
          bc.postMessage({ type: 'leave', id: selfId });
          bc.close();
        } catch {
          // ignore
        }
      }
    },
  };
}
