'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ActionType } from '../lib/types';

interface ActionBarProps {
  onSendChat: (text: string) => void;
  onTriggerAction: (action: ActionType) => void;
  onRequestOxygen: () => void;
  isSeated: boolean;
  isBreathing: boolean;
  cooldowns: {
    crow: number;
    shout: number;
    siuu: number;
    oxygen: number;
  };
  now: number;
  onShowToast: (msg: string) => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  onSendChat,
  onTriggerAction,
  onRequestOxygen,
  isSeated,
  isBreathing,
  cooldowns,
  now,
  onShowToast,
}) => {
  const [chatInput, setChatInput] = useState('');
  const lastChatSentRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;

    const current = Date.now();
    if (current - lastChatSentRef.current < 1000) {
      onShowToast('Gửi tin nhắn chậm lại một chút nhé!');
      return;
    }

    onSendChat(trimmed.slice(0, 60));
    setChatInput('');
    lastChatSentRef.current = current;
  };

  const handleActionClick = (action: ActionType) => {
    if (!isSeated) {
      onShowToast('Bạn cần chọn ghế ngồi trước khi thực hiện hành động!');
      return;
    }
    if (isBreathing) {
      onShowToast('Đang thở oxi, không thể quẩy lúc này!');
      return;
    }
    const cdEnd = cooldowns[action];
    if (now < cdEnd) {
      return;
    }
    onTriggerAction(action);
  };

  const handleOxygenClick = () => {
    if (!isSeated) {
      onShowToast('Bạn cần ngồi vào ghế trước khi đi thở oxi!');
      return;
    }
    if (isBreathing) {
      return;
    }
    const cdEnd = cooldowns.oxygen;
    if (now < cdEnd) {
      return;
    }
    onRequestOxygen();
  };

  // Keyboard shortcuts: 1-4 when not focused on input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === '1') {
        e.preventDefault();
        handleOxygenClick();
      } else if (e.key === '2') {
        e.preventDefault();
        handleActionClick('crow');
      } else if (e.key === '3') {
        e.preventDefault();
        handleActionClick('shout');
      } else if (e.key === '4') {
        e.preventDefault();
        handleActionClick('siuu');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const getCooldownProgress = (targetTime: number) => {
    if (now >= targetTime) return 0;
    const remaining = targetTime - now;
    return Math.min(100, Math.max(0, (remaining / 4000) * 100));
  };

  const crowCd = getCooldownProgress(cooldowns.crow);
  const shoutCd = getCooldownProgress(cooldowns.shout);
  const siuuCd = getCooldownProgress(cooldowns.siuu);
  const oxygenCd = getCooldownProgress(cooldowns.oxygen);

  return (
    <footer className="action-bar-wrap" role="toolbar" aria-label="Bảng điều khiển hành động">
      <div className="action-bar-container">
        {/* Chat input form */}
        <form className="chat-form" onSubmit={handleSendChat}>
          <input
            ref={inputRef}
            type="text"
            className="chat-input"
            placeholder={
              !isSeated
                ? 'Nhập tin nhắn (chat hiện trên đầu bạn)...'
                : 'Chat với rạp chiếu (Enter để gửi)...'
            }
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            maxLength={60}
          />
          <button
            type="submit"
            className="chat-send-btn"
            disabled={!chatInput.trim()}
            title="Gửi tin nhắn"
          >
            <span>Gửi</span>
            <span className="key-hint">↵</span>
          </button>
        </form>

        {/* 4 Action Buttons */}
        <div className="actions-button-group">
          {/* Button 1: Thở Oxi */}
          <button
            type="button"
            className={`action-btn btn-oxygen ${oxygenCd > 0 || isBreathing ? 'btn-cooling' : ''}`}
            onClick={handleOxygenClick}
            disabled={oxygenCd > 0 || isBreathing}
            title="Thở oxi khẩn cấp (Phím 1)"
          >
            <div className="btn-content">
              <span className="btn-icon">😮💨</span>
              <span className="btn-text">Thở oxi</span>
              <span className="btn-badge">1</span>
            </div>
            {oxygenCd > 0 && (
              <div
                className="btn-cooldown-bar"
                style={{ width: `${oxygenCd}%` }}
              />
            )}
          </button>

          {/* Button 2: Gáy bẩn */}
          <button
            type="button"
            className={`action-btn btn-crow ${crowCd > 0 || isBreathing ? 'btn-cooling' : ''}`}
            onClick={() => handleActionClick('crow')}
            disabled={crowCd > 0 || isBreathing}
            title="Gáy bẩn: Ò Ó O (Phím 2)"
          >
            <div className="btn-content">
              <span className="btn-icon">🐓</span>
              <span className="btn-text">Gáy bẩn</span>
              <span className="btn-badge">2</span>
            </div>
            {crowCd > 0 && (
              <div
                className="btn-cooldown-bar"
                style={{ width: `${crowCd}%` }}
              />
            )}
          </button>

          {/* Button 3: Hò hét */}
          <button
            type="button"
            className={`action-btn btn-shout ${shoutCd > 0 || isBreathing ? 'btn-cooling' : ''}`}
            onClick={() => handleActionClick('shout')}
            disabled={shoutCd > 0 || isBreathing}
            title="Hò hét kích động (Phím 3)"
          >
            <div className="btn-content">
              <span className="btn-icon">📣</span>
              <span className="btn-text">Hò hét</span>
              <span className="btn-badge">3</span>
            </div>
            {shoutCd > 0 && (
              <div
                className="btn-cooldown-bar"
                style={{ width: `${shoutCd}%` }}
              />
            )}
          </button>

          {/* Button 4: SIUUU */}
          <button
            type="button"
            className={`action-btn btn-siuu ${siuuCd > 0 || isBreathing ? 'btn-cooling' : ''}`}
            onClick={() => handleActionClick('siuu')}
            disabled={siuuCd > 0 || isBreathing}
            title="Ăn mừng SIUUU (Phím 4)"
          >
            <div className="btn-content">
              <span className="btn-icon">🙌</span>
              <span className="btn-text">SIUUU</span>
              <span className="btn-badge">4</span>
            </div>
            {siuuCd > 0 && (
              <div
                className="btn-cooldown-bar"
                style={{ width: `${siuuCd}%` }}
              />
            )}
          </button>
        </div>
      </div>
    </footer>
  );
};

