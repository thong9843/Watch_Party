'use client';

import React from 'react';
import { ControlMode } from '../lib/types';
import { useCinemaStore } from '../lib/store';

interface ControlModeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ControlModeModal: React.FC<ControlModeModalProps> = ({
  isOpen,
  onClose,
}) => {
  const controlMode = useCinemaStore((state) => state.controlMode);
  const setControlMode = useCinemaStore((state) => state.setControlMode);

  if (!isOpen) return null;

  const handleSelect = (mode: ControlMode) => {
    setControlMode(mode);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-card control-mode-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <span className="modal-icon">🎮</span>
          <h2 className="modal-title">Chọn cách điều khiển</h2>
          <p className="modal-subtitle">
            Bạn có thể đổi lại bất kỳ lúc nào bằng nút ⚙️ trên thanh tiêu đề
          </p>
        </div>

        <div className="control-mode-options">
          {/* Option 1: Keyboard Mode (Default) */}
          <button
            type="button"
            className={`mode-option-card ${controlMode === 'keyboard' ? 'is-selected' : ''}`}
            onClick={() => handleSelect('keyboard')}
          >
            <div className="mode-badge-tag">Khuyên dùng</div>
            <div className="mode-icon-circle">⌨️</div>
            <h3 className="mode-name">Bàn phím (WASD)</h3>
            <ul className="mode-feature-list">
              <li>
                <span className="feat-key">W A S D</span>
                <span>Di chuyển tự do theo hướng camera</span>
              </li>
              <li>
                <span className="feat-key">Chuột TRÁI</span>
                <span>Giữ & kéo để xoay góc nhìn 360°</span>
              </li>
              <li>
                <span className="feat-key">Chạm ghế</span>
                <span>Click ghế trống để tự đi tới ngồi</span>
              </li>
            </ul>
            <div className="mode-select-indicator">
              {controlMode === 'keyboard' ? '✓ Đang chọn' : 'Chọn chế độ này'}
            </div>
          </button>

          {/* Option 2: Mouse Mode (Point & Click) */}
          <button
            type="button"
            className={`mode-option-card ${controlMode === 'mouse' ? 'is-selected' : ''}`}
            onClick={() => handleSelect('mouse')}
          >
            <div className="mode-badge-tag badge-alt">Một chạm</div>
            <div className="mode-icon-circle">🖱️</div>
            <h3 className="mode-name">Chuột (Point & Click)</h3>
            <ul className="mode-feature-list">
              <li>
                <span className="feat-key">Click TRÁI</span>
                <span>Click sàn hoặc ghế để tự đi tới</span>
              </li>
              <li>
                <span className="feat-key">Chuột PHẢI</span>
                <span>Giữ chuột phải & kéo để xoay camera</span>
              </li>
              <li>
                <span className="feat-key">W A S D</span>
                <span>Vẫn dùng được khi muốn đi bộ</span>
              </li>
            </ul>
            <div className="mode-select-indicator">
              {controlMode === 'mouse' ? '✓ Đang chọn' : 'Chọn chế độ này'}
            </div>
          </button>
        </div>

        <button type="button" className="modal-confirm-btn" onClick={onClose}>
          Vào rạp thưởng thức trận đấu 🎬
        </button>
      </div>
    </div>
  );
};
