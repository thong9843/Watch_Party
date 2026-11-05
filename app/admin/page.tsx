'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { extractYouTubeId } from '../../components/Screen3D';
import { createRoomConnection } from '../../lib/realtime';
import { RoomConn } from '../../lib/types';
import { DEFAULT_BOTTOM_BANNER, DEFAULT_TOP_BANNER } from '../../lib/banners';
import { verifyAdminKey } from './actions';

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const key = searchParams.get('key');
  const [roomId, setRoomId] = useState('room-cktg-1');
  const [videoInput, setVideoInput] = useState('');
  const [topBannerInput, setTopBannerInput] = useState(DEFAULT_TOP_BANNER);
  const [bottomBannerInput, setBottomBannerInput] = useState(DEFAULT_BOTTOM_BANNER);

  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bannerStatusMsg, setBannerStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [connStatus, setConnStatus] = useState<'connecting' | 'connected'>('connecting');

  const connRef = useRef<RoomConn | null>(null);

  // Verify Admin Key securely
  useEffect(() => {
    let isMounted = true;
    verifyAdminKey(key).then((valid) => {
      if (isMounted) setIsAuthorized(valid);
    });
    return () => {
      isMounted = false;
    };
  }, [key]);

  // Connect to room connection
  useEffect(() => {
    if (!isAuthorized) return;

    const adminId = 'admin_' + Math.random().toString(36).substring(2, 7);
    const conn = createRoomConnection(adminId, roomId);
    connRef.current = conn;
    setConnStatus('connected');

    return () => {
      conn.close();
      connRef.current = null;
    };
  }, [isAuthorized, roomId]);

  const previewId = useMemo(() => {
    if (!videoInput.trim()) return null;
    return extractYouTubeId(videoInput.trim());
  }, [videoInput]);

  const handleBroadcastVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewId) {
      setStatusMsg({ type: 'error', text: 'URL hoặc ID YouTube không hợp lệ!' });
      return;
    }

    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          videoUrl: previewId,
          senderName: 'Admin',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi cập nhật server');

      setStatusMsg({
        type: 'success',
        text: `Đã cập nhật video (ID: ${previewId}) qua Server API cho phòng ${roomId}!`,
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  const handleBroadcastBanners = async (e: React.FormEvent) => {
    e.preventDefault();
    const top = topBannerInput.trim() || DEFAULT_TOP_BANNER;
    const bottom = bottomBannerInput.trim() || DEFAULT_BOTTOM_BANNER;

    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          topBanner: top,
          bottomBanner: bottom,
          senderName: 'Admin',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi cập nhật server');

      setBannerStatusMsg({
        type: 'success',
        text: `Đã cập nhật biểu ngữ qua Server API thành công!`,
      });
    } catch (err: any) {
      setBannerStatusMsg({ type: 'error', text: err.message });
    }
  };

  if (isAuthorized === null) {
    return (
      <div className="admin-page-wrap">
        <div className="admin-card">
          <p style={{ color: '#f59e0b', fontWeight: 600 }}>Đang xác thực quyền Admin...</p>
        </div>
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="admin-page-wrap">
        <div className="admin-card" style={{ borderColor: '#ef4444' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🚫</div>
          <h1 style={{ color: '#ef4444', fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>
            403 Forbidden
          </h1>
          <p style={{ color: '#a1a1aa', fontSize: '14px', lineHeight: 1.6 }}>
            Truy cập bị từ chối. Vui lòng cung cấp <code>?key=&lt;ADMIN_KEY&gt;</code> chính xác trên URL để sử dụng bảng điều khiển Admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page-wrap">
      <div className="admin-card">
        {/* Header */}
        <div className="admin-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '28px' }}>⚡</span>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#f59e0b' }}>
                Bảng Quản Trị Rạp Chiếu 3D
              </h1>
              <p style={{ fontSize: '13px', color: '#a1a1aa' }}>
                Đổi nguồn phát video & cập nhật 2 dải banner cổ vũ realtime
              </p>
            </div>
          </div>
          <span className="mode-badge badge-online">
            {connStatus === 'connected' ? '● Đã kết nối' : 'Đang kết nối...'}
          </span>
        </div>

        {/* Section 1: Video Management */}
        <form onSubmit={handleBroadcastVideo} style={{ marginTop: '24px' }}>
          <h2 style={{ fontSize: '15px', color: '#fef08a', fontWeight: 700, marginBottom: '14px' }}>
            🎬 1. Nguồn Phát YouTube Live
          </h2>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#e4e4e7', marginBottom: '6px' }}>
              Mã phòng (Room ID)
            </label>
            <input
              type="text"
              className="chat-input"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.trim() || 'room-cktg-1')}
              style={{ width: '100%', height: '42px', borderRadius: '8px' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#e4e4e7', marginBottom: '6px' }}>
              Link hoặc Video ID YouTube
            </label>
            <input
              type="text"
              className="chat-input"
              placeholder="VD: https://www.youtube.com/watch?v=jfKfPfyJRdk hoặc jfKfPfyJRdk"
              value={videoInput}
              onChange={(e) => setVideoInput(e.target.value)}
              style={{ width: '100%', height: '42px', borderRadius: '8px' }}
              required
            />
          </div>

          {previewId && (
            <div style={{ marginBottom: '20px', padding: '12px', background: '#18181b', borderRadius: '8px', border: '1px solid #27272a' }}>
              <p style={{ fontSize: '12px', color: '#10b981', fontWeight: 600, marginBottom: '8px' }}>
                ✓ Đã nhận diện Video ID: <code>{previewId}</code>
              </p>
              <div style={{ position: 'relative', width: '100%', paddingBottom: '45%', borderRadius: '6px', overflow: 'hidden' }}>
                <iframe
                  src={`https://www.youtube.com/embed/${previewId}?autoplay=0&mute=1`}
                  title="YouTube Preview"
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                />
              </div>
            </div>
          )}

          {statusMsg && (
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '14px',
                fontWeight: 600,
                background: statusMsg.type === 'success' ? '#064e3b' : '#7f1d1d',
                color: statusMsg.type === 'success' ? '#34d399' : '#f87171',
                border: `1px solid ${statusMsg.type === 'success' ? '#059669' : '#dc2626'}`,
              }}
            >
              {statusMsg.text}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '32px' }}>
            <button
              type="submit"
              className="modal-confirm-btn"
              style={{ flex: 1, margin: 0, padding: '12px' }}
              disabled={!previewId}
            >
              📡 Đổi video phòng ngay
            </button>
            <a
              href={`/?room=${roomId}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '12px 18px',
                background: '#27272a',
                color: '#e4e4e7',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              Mở phòng xem ↗
            </a>
          </div>
        </form>

        <hr style={{ borderColor: '#27272a', marginBottom: '24px' }} />

        {/* Section 2: Cheering Banners Management */}
        <form onSubmit={handleBroadcastBanners}>
          <h2 style={{ fontSize: '15px', color: '#fef08a', fontWeight: 700, marginBottom: '14px' }}>
            📢 2. Quản Trị Hai Dải Banner Cổ Vũ
          </h2>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#e4e4e7', marginBottom: '6px' }}>
              Dải trên (mép trên màn chiếu · Vàng óng):
            </label>
            <input
              type="text"
              className="chat-input"
              value={topBannerInput}
              onChange={(e) => setTopBannerInput(e.target.value)}
              style={{ width: '100%', height: '42px', borderRadius: '8px' }}
              placeholder="VD: T1 FIGHTING! ★ GEN.G VÔ ĐỊCH! ★ BLG BÙNG NỔ!..."
              required
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#e4e4e7', marginBottom: '6px' }}>
              Dải dưới (mép dưới màn chiếu · Xanh neon):
            </label>
            <input
              type="text"
              className="chat-input"
              value={bottomBannerInput}
              onChange={(e) => setBottomBannerInput(e.target.value)}
              style={{ width: '100%', height: '42px', borderRadius: '8px' }}
              placeholder="VD: HÒ HÉT ĐI NÀO! • SIUUUUU! • THỞ OXI CẤP CỨU!..."
              required
            />
          </div>

          {bannerStatusMsg && (
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '14px',
                fontWeight: 600,
                background: bannerStatusMsg.type === 'success' ? '#064e3b' : '#7f1d1d',
                color: bannerStatusMsg.type === 'success' ? '#34d399' : '#f87171',
                border: `1px solid ${bannerStatusMsg.type === 'success' ? '#059669' : '#dc2626'}`,
              }}
            >
              {bannerStatusMsg.text}
            </div>
          )}

          <button
            type="submit"
            className="modal-confirm-btn"
            style={{ width: '100%', margin: 0, padding: '12px', background: '#0284c7', borderColor: '#38bdf8' }}
          >
            📢 Cập nhật 2 dải banner cổ vũ ngay
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-page-wrap">
          <div className="admin-card">
            <p style={{ color: '#f59e0b' }}>Đang tải...</p>
          </div>
        </div>
      }
    >
      <AdminDashboardContent />
    </Suspense>
  );
}
