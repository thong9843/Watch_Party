'use client';

import React, { useState } from 'react';
import { Member } from '../lib/types';
import { useCinemaStore } from '../lib/store';

interface UserModerationModalProps {
  targetMember: Member;
  currentRoomId: string;
  selfId: string;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export const UserModerationModal: React.FC<UserModerationModalProps> = ({
  targetMember,
  currentRoomId,
  selfId,
  onClose,
  onToast,
}) => {
  const mutedUsers = useCinemaStore((state) => state.mutedUsers);
  const toggleMuteUser = useCinemaStore((state) => state.toggleMuteUser);

  const isMuted = mutedUsers.includes(targetMember.id);
  const [reason, setReason] = useState('Spam tin nhắn / phá rối');
  const [submitting, setSubmitting] = useState(false);
  const [reportedSuccess, setReportedSuccess] = useState(false);

  const handleToggleMute = () => {
    toggleMuteUser(targetMember.id);
    onToast(isMuted ? `Đã bỏ ẩn ${targetMember.name}` : `Đã ẩn chat và hành động của ${targetMember.name}`);
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterId: selfId,
          reportedId: targetMember.id,
          reason,
          roomId: currentRoomId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi gửi báo cáo');
      setReportedSuccess(true);
      onToast('🚩 Đã gửi báo cáo vi phạm tới Ban quản trị!');
      setTimeout(() => onClose(), 1200);
    } catch (err: any) {
      onToast(`Lỗi: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="moderation-modal-overlay" onClick={onClose}>
      <div className="moderation-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="moderation-modal-header">
          <div className="moderation-user-info">
            <span
              className="moderation-avatar-dot"
              style={{ backgroundColor: targetMember.color }}
            />
            <h3>{targetMember.name}</h3>
            {targetMember.seat && <span className="moderation-seat-tag">Ghế {targetMember.seat}</span>}
          </div>
          <button type="button" className="moderation-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="moderation-actions">
          {/* Mute Toggle */}
          <button
            type="button"
            className={`moderation-mute-btn ${isMuted ? 'is-muted' : ''}`}
            onClick={handleToggleMute}
          >
            <span>{isMuted ? '🔊' : '🔇'}</span>
            <span>{isMuted ? 'Bỏ ẩn người này' : 'Ẩn tin nhắn & action của người này'}</span>
          </button>

          {/* Report Form */}
          <form onSubmit={handleReport} className="moderation-report-form">
            <label className="moderation-label">🚩 Báo cáo vi phạm</label>
            <select
              className="moderation-select"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting || reportedSuccess}
            >
              <option value="Spam tin nhắn / phá rối">Spam tin nhắn / phá rối</option>
              <option value="Tên hoặc nội dung phản cảm">Tên hoặc nội dung phản cảm</option>
              <option value="Quấy rối / công kích cá nhân">Quấy rối / công kích cá nhân</option>
              <option value="Gian lận hoặc giả mạo">Gian lận hoặc giả mạo</option>
            </select>

            <button
              type="submit"
              className="moderation-submit-btn"
              disabled={submitting || reportedSuccess}
            >
              {reportedSuccess ? '✓ Đã báo cáo' : submitting ? 'Đang gửi...' : 'Gửi báo cáo'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

