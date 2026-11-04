'use client';

import React from 'react';
import { ActionType, Member } from '../lib/types';

interface CharacterProps {
  member: Member;
  isSelf: boolean;
  x: number;
  y: number;
  pose: 'sit' | 'crawl' | 'breathe';
  dir?: -1 | 1;
  activeChat?: { text: string; time: number } | null;
  activeAction?: { type: ActionType; time: number } | null;
  now: number;
}

export const Character: React.FC<CharacterProps> = ({
  member,
  isSelf,
  x,
  y,
  pose,
  dir = 1,
  activeChat,
  activeAction,
  now,
}) => {
  const isChatting = Boolean(activeChat && now - activeChat.time < 5000);
  const isActionActive = Boolean(activeAction && now - activeAction.time < 2600);
  const currentAction = isActionActive ? activeAction?.type : null;
  const actionKey = activeAction ? `${activeAction.type}-${activeAction.time}` : 'none';

  return (
    <div
      className={`char-wrapper ${isSelf ? 'is-self' : ''}`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        zIndex: Math.round(y),
      }}
    >
      {/* Action floating text */}
      {isActionActive && (
        <div key={`fx-text-${actionKey}`} className={`action-popup fx-${currentAction}`}>
          {currentAction === 'crow' && 'Ò Ó O! Dễ!! 🐓'}
          {currentAction === 'shout' && 'AAAAAA! 📣'}
          {currentAction === 'siuu' && 'SIUUUU! 🙌'}
        </div>
      )}

      {/* Confetti particles for SIUU */}
      {isActionActive && currentAction === 'siuu' && (
        <div key={`confetti-${actionKey}`} className="confetti-burst">
          {Array.from({ length: 16 }).map((_, i) => (
            <span
              key={i}
              className={`confetti-item c-${i % 4}`}
              style={
                {
                  '--angle': `${i * 22.5}deg`,
                  '--dist': `${35 + (i % 4) * 16}px`,
                  '--rot': `${i * 45}deg`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

      {/* Sound wave rings for shout */}
      {isActionActive && currentAction === 'shout' && (
        <div key={`shout-waves-${actionKey}`} className="shout-waves-box">
          <span className="shout-wave w1" />
          <span className="shout-wave w2" />
          <span className="shout-wave w3" />
        </div>
      )}

      {/* Chat bubble */}
      {isChatting && activeChat && (
        <div className="char-chat-bubble">
          <div className="bubble-text">{activeChat.text}</div>
          <div className="bubble-tail" />
        </div>
      )}

      {/* Oxygen bubbles when breathing */}
      {pose === 'breathe' && (
        <div className="oxygen-bubbles">
          <span className="o2-bubble ob1" />
          <span className="o2-bubble ob2" />
          <span className="o2-bubble ob3" />
          <span className="o2-bubble ob4" />
        </div>
      )}

      {/* Nested hierarchy: .char -> .fx -> .figure -> svg */}
      <div
        className={`char-fx ${currentAction ? `fx-anim-${currentAction}` : ''}`}
        key={`fx-anim-${actionKey}`}
      >
        <div
          className={`char-figure pose-${pose}`}
          style={
            {
              '--dir': dir,
              transform:
                pose === 'crawl'
                  ? `scaleX(${dir}) rotate(78deg)`
                  : dir === -1
                  ? 'scaleX(-1)'
                  : 'none',
            } as React.CSSProperties
          }
        >
          <svg
            className={`chibi-svg ${pose === 'crawl' ? 'flail-anim' : ''} ${
              pose === 'breathe' ? 'breathe-heave' : ''
            }`}
            viewBox="0 0 60 68"
            width="60"
            height="68"
          >
            {/* Chibi feet */}
            <ellipse cx="23" cy="64" rx="7" ry="3.5" fill="#18181b" />
            <ellipse cx="37" cy="64" rx="7" ry="3.5" fill="#18181b" />

            {/* Chibi body with user's chosen color */}
            <path
              d="M19 40 C19 34, 41 34, 41 40 L44 60 C44 63, 16 63, 16 60 Z"
              fill={member.color}
            />

            {/* Left Arm */}
            {currentAction === 'siuu' ? (
              // Raised high in triumph
              <path
                d="M18 42 Q10 28 12 16"
                stroke={member.color}
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
              />
            ) : pose === 'crawl' ? (
              <path
                className="arm-left-crawl"
                d="M18 44 Q10 48 8 58"
                stroke={member.color}
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
              />
            ) : (
              <path
                d="M18 42 Q13 48 16 54"
                stroke={member.color}
                strokeWidth="5.5"
                strokeLinecap="round"
                fill="none"
              />
            )}

            {/* Right Arm */}
            {currentAction === 'siuu' ? (
              // Raised high in triumph
              <path
                d="M42 42 Q50 28 48 16"
                stroke={member.color}
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
              />
            ) : pose === 'crawl' ? (
              <path
                className="arm-right-crawl"
                d="M42 44 Q50 48 52 58"
                stroke={member.color}
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
              />
            ) : (
              <path
                d="M42 42 Q47 48 44 54"
                stroke={member.color}
                strokeWidth="5.5"
                strokeLinecap="round"
                fill="none"
              />
            )}

            {/* Hands */}
            {currentAction === 'siuu' ? (
              <>
                <circle cx="12" cy="16" r="3.5" fill="#ffdcb8" />
                <circle cx="48" cy="16" r="3.5" fill="#ffdcb8" />
              </>
            ) : (
              <>
                <circle cx="16" cy="54" r="3" fill="#ffdcb8" />
                <circle cx="44" cy="54" r="3" fill="#ffdcb8" />
              </>
            )}

            {/* Head (skin #ffdcb8) */}
            <circle cx="30" cy="24" r="15" fill="#ffdcb8" />

            {/* Dark Hair */}
            <path
              d="M15 22 C15 13 22 9 30 9 C38 9 45 13 45 22 C43 18 39 16 34 17 C29 18 24 16 20 19 C17 21 16 22 15 22 Z"
              fill="#18181b"
            />
            {/* Bangs */}
            <path d="M22 18 Q27 22 30 18 Q34 22 38 18" stroke="#18181b" strokeWidth="2.5" fill="none" />

            {/* Blush */}
            <circle cx="22" cy="28" r="2.5" fill="#f87171" opacity="0.45" />
            <circle cx="38" cy="28" r="2.5" fill="#f87171" opacity="0.45" />

            {/* Eyes */}
            {currentAction === 'crow' ? (
              // Smug / squinting eyes
              <>
                <path d="M22 23 Q25 21 27 24" stroke="#18181b" strokeWidth="2" fill="none" strokeLinecap="round" />
                <path d="M33 24 Q35 21 38 23" stroke="#18181b" strokeWidth="2" fill="none" strokeLinecap="round" />
              </>
            ) : currentAction === 'shout' || currentAction === 'siuu' ? (
              // Wide happy eyes with sparkles
              <>
                <circle cx="25" cy="23" r="2.8" fill="#18181b" />
                <circle cx="24.2" cy="22.2" r="1" fill="#ffffff" />
                <circle cx="35" cy="23" r="2.8" fill="#18181b" />
                <circle cx="34.2" cy="22.2" r="1" fill="#ffffff" />
              </>
            ) : (
              // Normal cute eyes
              <>
                <circle cx="25" cy="24" r="2.2" fill="#18181b" />
                <circle cx="24.4" cy="23.4" r="0.8" fill="#ffffff" />
                <circle cx="35" cy="24" r="2.2" fill="#18181b" />
                <circle cx="34.4" cy="23.4" r="0.8" fill="#ffffff" />
              </>
            )}

            {/* Mouth / Oxygen Mask */}
            {pose === 'breathe' ? (
              // Cyan/teal oxygen mask over mouth and nose
              <g className="oxygen-mask">
                {/* Strap */}
                <path d="M16 29 Q30 33 44 29" stroke="#0f766e" strokeWidth="1.6" fill="none" />
                {/* Mask body */}
                <path
                  d="M23 27 C23 25, 37 25, 37 27 L36 33 C36 36, 24 36, 24 33 Z"
                  fill="#2dd4bf"
                  stroke="#0f766e"
                  strokeWidth="1.2"
                />
                <circle cx="30" cy="31" r="2" fill="#0d9488" />
              </g>
            ) : currentAction === 'crow' ? (
              // Smirk mouth
              <path d="M26 31 Q31 32 35 29" stroke="#18181b" strokeWidth="2" fill="none" strokeLinecap="round" />
            ) : currentAction === 'shout' ? (
              // Wide shouting mouth
              <ellipse cx="30" cy="31" rx="4.5" ry="5.5" fill="#dc2626" />
            ) : currentAction === 'siuu' ? (
              // Big cheering open smile
              <path d="M25 29 Q30 36 35 29 Z" fill="#dc2626" />
            ) : (
              // Gentle cute smile
              <path d="M27 30 Q30 33 33 30" stroke="#18181b" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            )}
          </svg>
        </div>
      </div>

      {/* Name tag */}
      <div className={`char-name-tag ${isSelf ? 'name-self' : ''}`}>
        {isSelf ? `★ ${member.name}` : member.name}
      </div>
    </div>
  );
};

