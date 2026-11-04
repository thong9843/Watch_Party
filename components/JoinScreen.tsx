'use client';

import React, { useState } from 'react';
import { getStoredProfile, setStoredProfile } from '../lib/realtime';

interface JoinScreenProps {
  onJoin: (name: string, color: string) => void;
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

export const JoinScreen: React.FC<JoinScreenProps> = ({ onJoin }) => {
  const [initialProfile] = useState(() => getStoredProfile());
  const [name, setName] = useState(initialProfile.name);
  const [color, setColor] = useState(initialProfile.color);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 16) {
      setError('Biệt danh phải từ 2 đến 16 ký tự!');
      return;
    }
    setStoredProfile(trimmed, color);
    onJoin(trimmed, color);
  };

  return (
    <div className="join-screen-overlay">
      <div className="join-card">
        {/* Cinema spotlight header */}
        <div className="join-header">
          <div className="trophy-badge">🏆 CKTG 2024</div>
          <h1 className="join-title">Esports Watch Party</h1>
          <p className="join-subtitle">Rạp chiếu phim ảo cùng quẩy chung kết LMHT</p>
        </div>

        {/* Character Chibi Preview */}
        <div className="join-preview-area">
          <div className="preview-pedestal">
            <svg viewBox="0 0 60 68" width="76" height="86" className="preview-chibi-svg">
              {/* Chibi feet */}
              <ellipse cx="23" cy="64" rx="7" ry="3.5" fill="#18181b" />
              <ellipse cx="37" cy="64" rx="7" ry="3.5" fill="#18181b" />

              {/* Chibi body with user's chosen color */}
              <path
                d="M19 40 C19 34, 41 34, 41 40 L44 60 C44 63, 16 63, 16 60 Z"
                fill={color}
              />

              {/* Arms */}
              <path
                d="M18 42 Q13 48 16 54"
                stroke={color}
                strokeWidth="5.5"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M42 42 Q47 48 44 54"
                stroke={color}
                strokeWidth="5.5"
                strokeLinecap="round"
                fill="none"
              />

              {/* Hands */}
              <circle cx="16" cy="54" r="3" fill="#ffdcb8" />
              <circle cx="44" cy="54" r="3" fill="#ffdcb8" />

              {/* Head */}
              <circle cx="30" cy="24" r="15" fill="#ffdcb8" />

              {/* Dark Hair */}
              <path
                d="M15 22 C15 13 22 9 30 9 C38 9 45 13 45 22 C43 18 39 16 34 17 C29 18 24 16 20 19 C17 21 16 22 15 22 Z"
                fill="#18181b"
              />
              <path d="M22 18 Q27 22 30 18 Q34 22 38 18" stroke="#18181b" strokeWidth="2.5" fill="none" />

              {/* Blush */}
              <circle cx="22" cy="28" r="2.5" fill="#f87171" opacity="0.45" />
              <circle cx="38" cy="28" r="2.5" fill="#f87171" opacity="0.45" />

              {/* Eyes */}
              <circle cx="25" cy="24" r="2.2" fill="#18181b" />
              <circle cx="24.4" cy="23.4" r="0.8" fill="#ffffff" />
              <circle cx="35" cy="24" r="2.2" fill="#18181b" />
              <circle cx="34.4" cy="23.4" r="0.8" fill="#ffffff" />

              {/* Smile */}
              <path d="M27 30 Q30 33 33 30" stroke="#18181b" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            </svg>
            <div className="preview-shadow" />
          </div>
          <span className="preview-label">{name.trim() || 'Chưa đặt tên'}</span>
        </div>

        {/* Join Form */}
        <form className="join-form" onSubmit={handleSubmit}>
          <div className="input-field-group">
            <label htmlFor="nickname-input" className="field-label">
              Biệt danh cổ vũ
            </label>
            <input
              id="nickname-input"
              type="text"
              className="nickname-text-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="VD: Faker_Fan, Chovy..."
              maxLength={16}
              required
            />
          </div>

          <div className="color-picker-group">
            <span className="field-label">Màu áo nhân vật</span>
            <div className="color-swatches" role="radiogroup" aria-label="Chọn màu áo">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch-btn ${color === c ? 'is-selected' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  aria-label={`Màu ${c}`}
                />
              ))}
            </div>
          </div>

          {error && <div className="join-error-box">{error}</div>}

          <button type="submit" className="join-submit-btn">
            <span>Vào rạp</span>
            <span className="btn-cinema-icon">🎬</span>
          </button>
        </form>
      </div>
    </div>
  );
};

