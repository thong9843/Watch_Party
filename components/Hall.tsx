'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ALL_SEATS,
  COLS,
  ROWS,
  TOTAL_TANKS,
  oxygenState,
  parseSeat,
  seatPos,
  tankPos,
} from '../lib/layout';
import { ActionType, Member } from '../lib/types';
import { Character } from './Character';

interface HallProps {
  members: Member[];
  selfId: string;
  mySeat: string | null;
  onSelectSeat: (seat: string | null) => void;
  chats: Record<string, { text: string; time: number }>;
  actions: Record<string, { type: ActionType; time: number }>;
  onOxygenComplete?: () => void;
  now: number;
}

export function useNow(fps = 30): number {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    let animId: number;
    let lastTime = 0;
    const interval = 1000 / fps;

    const tick = (currentTime: number) => {
      if (currentTime - lastTime >= interval) {
        lastTime = currentTime;
        setNow(Date.now());
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [fps]);

  return now;
}

export const Hall: React.FC<HallProps> = ({
  members,
  selfId,
  mySeat,
  onSelectSeat,
  chats,
  actions,
  onOxygenComplete,
  now,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // ResizeObserver to scale 1000x600 coordinate system cleanly
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateScale = () => {
      const parentWidth = el.parentElement?.clientWidth || window.innerWidth;
      const nextScale = Math.min(1.25, Math.max(0.3, parentWidth / 1000));
      setScale(nextScale);
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el.parentElement || el);
    window.addEventListener('resize', updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, []);

  // Map occupied seats and oxygen status
  const { occupiedSeatsMap, occupiedTanksSet } = useMemo(() => {
    const seatMap = new Map<string, Member>();
    const tankSet = new Set<number>();

    for (const m of members) {
      if (m.seat) {
        seatMap.set(m.seat, m);
      }
      if (m.oxygen) {
        tankSet.add(m.oxygen.tank);
      }
    }
    return { occupiedSeatsMap: seatMap, occupiedTanksSet: tankSet };
  }, [members]);

  // Handle self oxygen completion
  const selfMember = members.find((m) => m.id === selfId);
  useEffect(() => {
    if (selfMember?.oxygen && selfMember.seat && onOxygenComplete) {
      const elapsed = now - selfMember.oxygen.start;
      const state = oxygenState(selfMember.seat, selfMember.oxygen.tank, elapsed);
      if (state.done) {
        onOxygenComplete();
      }
    }
  }, [now, selfMember, onOxygenComplete]);

  // Seated characters info
  const characterRenders = useMemo(() => {
    return members
      .filter((m) => Boolean(m.seat))
      .map((m) => {
        const seat = m.seat!;
        const isSelf = m.id === selfId;
        const activeChat = chats[m.id] || null;
        const activeAction = actions[m.id] || null;

        if (m.oxygen) {
          const elapsed = now - m.oxygen.start;
          const { x, y, pose, dir } = oxygenState(seat, m.oxygen.tank, elapsed);
          return {
            member: m,
            isSelf,
            x,
            y,
            pose,
            dir,
            activeChat,
            activeAction,
            oxygenTank: pose === 'breathe' ? m.oxygen.tank : null,
          };
        }

        const pos = seatPos(seat);
        return {
          member: m,
          isSelf,
          x: pos.x,
          y: pos.y,
          pose: 'sit' as const,
          dir: 1 as const,
          activeChat,
          activeAction,
          oxygenTank: null,
        };
      });
  }, [members, selfId, chats, actions, now]);

  return (
    <div
      ref={containerRef}
      className="hall-viewport"
      style={{
        height: `${600 * scale}px`,
      }}
    >
      <div
        className="hall-stage"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: '1000px',
          height: '600px',
        }}
      >
        {/* Left Wall: Oxygen Station area (x: 0-120) */}
        <div className="oxygen-station-zone">
          <div className="oxygen-station-sign">
            <span className="sign-icon">🏥</span>
            <span className="sign-text">TRẠM OXI</span>
          </div>

          {/* 7 Oxygen Tanks */}
          {Array.from({ length: TOTAL_TANKS }).map((_, i) => {
            const pos = tankPos(i);
            const isOccupied = occupiedTanksSet.has(i);
            return (
              <div
                key={`tank-${i}`}
                className={`oxygen-tank-box ${isOccupied ? 'is-active-tank' : ''}`}
                style={{
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                }}
              >
                <svg
                  viewBox="0 0 44 68"
                  width="44"
                  height="68"
                  className="tank-svg"
                  style={{ transform: 'translate(-50%, -100%)' }}
                >
                  {/* Valve on top */}
                  <rect x="18" y="2" width="8" height="6" rx="2" fill="#d1d5db" />
                  <circle cx="22" cy="3" r="3" fill="#9ca3af" />

                  {/* Pressure gauge */}
                  <circle cx="22" cy="18" r="6" fill="#f3f4f6" stroke="#4b5563" strokeWidth="1.2" />
                  <line
                    x1="22"
                    y1="18"
                    x2={isOccupied ? '25' : '19'}
                    y2={isOccupied ? '14' : '15'}
                    stroke="#dc2626"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />

                  {/* Tank Cylinder */}
                  <path
                    d="M9 14 C9 9 35 9 35 14 L35 62 C35 66 9 66 9 62 Z"
                    fill={isOccupied ? '#10b981' : '#059669'}
                    stroke="#047857"
                    strokeWidth="1.5"
                  />

                  {/* Tank Highlighting sheen */}
                  <path d="M12 16 L12 60" stroke="#6ee7b7" strokeWidth="1.8" opacity="0.6" strokeLinecap="round" />

                  {/* Tank Label O2 */}
                  <text
                    x="22"
                    y="42"
                    fill="#ffffff"
                    fontSize="13"
                    fontWeight="800"
                    textAnchor="middle"
                    fontFamily="sans-serif"
                    letterSpacing="0.5"
                  >
                    O₂
                  </text>
                  <text x="29" y="45" fill="#ffffff" fontSize="9" fontWeight="800">
                    2
                  </text>
                </svg>
                <span className="tank-label">Bình #{i + 1}</span>
              </div>
            );
          })}
        </div>

        {/* Vertical Aisle guide line */}
        <div className="aisle-marker" />

        {/* Tier strips and Row Labels A-F */}
        {ROWS.map((rowLetter, rIndex) => {
          const tierY = 72 + rIndex * 86;
          return (
            <div
              key={`tier-${rowLetter}`}
              className="hall-tier-strip"
              style={{ top: `${tierY}px` }}
            >
              <div className="tier-row-label">{rowLetter}</div>
            </div>
          );
        })}

        {/* Seat Grid: 60 Seats (A1 - F10) */}
        {ALL_SEATS.map((seatCode) => {
          const pos = seatPos(seatCode);
          const occupant = occupiedSeatsMap.get(seatCode);
          const isMySeat = mySeat === seatCode;
          const isOccupiedByOther = Boolean(occupant && occupant.id !== selfId);
          const isAway = Boolean(occupant?.oxygen);

          return (
            <button
              key={seatCode}
              type="button"
              className={`hall-seat-btn ${isMySeat ? 'seat-mine' : ''} ${
                isOccupiedByOther ? 'seat-occupied' : 'seat-available'
              } ${isAway ? 'seat-reserved' : ''}`}
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
              }}
              onClick={() => {
                if (isMySeat) {
                  // Click own seat again -> stand up
                  onSelectSeat(null);
                } else if (!isOccupiedByOther) {
                  // Click vacant seat -> sit or switch seats
                  onSelectSeat(seatCode);
                }
              }}
              disabled={isOccupiedByOther}
              title={
                isMySeat
                  ? `Ghế ${seatCode} (của bạn - bấm để đứng dậy)`
                  : isOccupiedByOther
                  ? isAway
                    ? `Ghế ${seatCode} (${occupant?.name} đang thở oxi - giữ chỗ)`
                    : `Ghế ${seatCode} (${occupant?.name} đang ngồi)`
                  : `Ghế ${seatCode} (trống - bấm để ngồi)`
              }
            >
              <svg viewBox="0 0 52 56" width="52" height="56" className="seat-svg">
                {/* Backrest */}
                <rect
                  x="8"
                  y="4"
                  width="36"
                  height="26"
                  rx="6"
                  className="seat-backrest"
                  fill="#7f1d1d"
                  stroke="#991b1b"
                  strokeWidth="1.5"
                />
                {/* Seat Cushion */}
                <rect
                  x="6"
                  y="26"
                  width="40"
                  height="22"
                  rx="5"
                  className="seat-cushion"
                  fill="#991b1b"
                  stroke="#b91c1c"
                  strokeWidth="1.5"
                />
                {/* Left Armrest */}
                <rect x="2" y="18" width="6" height="24" rx="3" fill="#450a0a" />
                {/* Right Armrest */}
                <rect x="44" y="18" width="6" height="24" rx="3" fill="#450a0a" />
              </svg>
              <span className="seat-code-tag">
                {isAway ? 'Giữ chỗ' : seatCode}
              </span>
            </button>
          );
        })}

        {/* Breathing Oxygen Tubes (Curved quadratic path from tank to character mouth) */}
        <svg className="tubes-overlay-svg" width="1000" height="600">
          {characterRenders.map(({ member, x, y, oxygenTank, pose }) => {
            if (pose !== 'breathe' || oxygenTank === null) return null;
            const t = tankPos(oxygenTank);
            const tankValveX = t.x;
            const tankValveY = t.y - 64;
            const mouthX = x;
            const mouthY = y - 36;
            const ctrlX = (tankValveX + mouthX) / 2;
            const ctrlY = Math.min(tankValveY, mouthY) - 24;

            return (
              <path
                key={`tube-${member.id}`}
                d={`M ${tankValveX} ${tankValveY} Q ${ctrlX} ${ctrlY} ${mouthX} ${mouthY}`}
                stroke="#2dd4bf"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
                className="oxygen-tube-line"
              />
            );
          })}
        </svg>

        {/* Characters rendered sorted by y position */}
        {characterRenders.map((cr) => (
          <Character
            key={cr.member.id}
            member={cr.member}
            isSelf={cr.isSelf}
            x={cr.x}
            y={cr.y}
            pose={cr.pose}
            dir={cr.dir}
            activeChat={cr.activeChat}
            activeAction={cr.activeAction}
            now={now}
          />
        ))}

        {/* Banner if user has not picked a seat */}
        {!mySeat && (
          <div className="unseated-banner">
            <span className="banner-pulse-dot" />
            <span>Chọn một ghế trống để ngồi xem trận đấu nhé!</span>
          </div>
        )}
      </div>
    </div>
  );
};

