'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ActionType } from '../lib/types';
import { useCinemaStore } from '../lib/store';

interface ActionBarProps {
  onSendChat: (text: string) => void;
  onTriggerAction: (action: ActionType) => void;
  onRequestOxygen: () => void;
  onStandUp: () => void;
  isSeated: boolean;
  isBreathing: boolean;
  cooldowns: {
    crow: number;
    shout: number;
    siuu: number;
    oxygen: number;
  };
  onShowToast: (msg: string) => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  onSendChat,
  onTriggerAction,
  onRequestOxygen,
  onStandUp,
  isSeated,
  isBreathing,
  cooldowns,
  onShowToast,
}) => {
  const [chatInput, setChatInput] = useState('');
  const lastChatSentRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const cameraMode = useCinemaStore((state) => state.cameraMode);
  const setCameraMode = useCinemaStore((state) => state.setCameraMode);
  const followOtherActions = useCinemaStore((state) => state.followOtherActions);
  const setFollowOtherActions = useCinemaStore((state) => state.setFollowOtherActions);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);

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
      onShowToast('Chạm vào một ghế trống để ngồi trước khi quẩy!');
      return;
    }
    if (isBreathing) {
      onShowToast('Đang thở oxi, không thể thực hiện lúc này!');
      return;
    }
    const cdEnd = cooldowns[action];
    if (now < cdEnd) return;
    onTriggerAction(action);
  };

  const handleOxygenClick = () => {
    if (!isSeated) {
      onShowToast('Cần ngồi vào ghế trước khi đi thở oxi!');
      return;
    }
    if (isBreathing) return;
    const cdEnd = cooldowns.oxygen;
    if (now < cdEnd) return;
    onRequestOxygen();
  };

  // Keyboard shortcuts: 1-4 when not focused on input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;
      if (e.repeat) return;

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
    <footer className="action-bar-wrap" role="toolbar" aria-label="Bảng điều khiển">
      <div className="action-bar-container">
        {/* Chat input form */}
        <form className="chat-form" onSubmit={handleSendChat}>
          <input
            ref={inputRef}
            type="text"
            className="chat-input"
            placeholder={
              !isSeated
                ? 'Chat hiện trên đầu chibi (Enter gửi)...'
                : 'Chat với rạp chiếu (Enter gửi)...'
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

        {/* Action Buttons & Utilities */}
        <div className="actions-button-group">
          {/* Stand up button if seated */}
          {isSeated && (
            <button
              type="button"
              className="action-btn btn-standup"
              onClick={onStandUp}
              disabled={isBreathing}
              title="Đứng dậy rời ghế (Phím E)"
            >
              <div className="btn-content">
                <span className="btn-icon">🧍</span>
                <span className="btn-text">Đứng dậy</span>
                <span className="btn-badge">E</span>
              </div>
            </button>
          )}

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
              <div className="btn-cooldown-bar" style={{ width: `${oxygenCd}%` }} />
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
              <div className="btn-cooldown-bar" style={{ width: `${crowCd}%` }} />
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
              <div className="btn-cooldown-bar" style={{ width: `${shoutCd}%` }} />
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
              <div className="btn-cooldown-bar" style={{ width: `${siuuCd}%` }} />
            )}
          </button>

          {/* Cinema Screen Toggle (Phím C) */}
          <button
            type="button"
            className={`action-btn btn-util ${cameraMode === 'cinema' ? 'is-active' : ''}`}
            onClick={() => setCameraMode(cameraMode === 'cinema' ? 'follow' : 'cinema')}
            title="Chuyển chế độ xem toàn màn chiếu (Phím C)"
          >
            <div className="btn-content">
              <span className="btn-icon">🎬</span>
              <span className="btn-text">Màn chiếu</span>
              <span className="btn-badge">C</span>
            </div>
          </button>

          {/* Follow other actions toggle */}
          <button
            type="button"
            className={`action-btn btn-util ${followOtherActions ? 'is-active' : ''}`}
            onClick={() => setFollowOtherActions(!followOtherActions)}
            title="Tự động lia camera khi người khác làm action (Mặc định: Tắt)"
          >
            <div className="btn-content">
              <span className="btn-icon">🎥</span>
              <span className="btn-text">Theo dõi</span>
            </div>
          </button>
        </div>
      </div>
    </footer>
  );
};
