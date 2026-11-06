'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { extractYouTubeId } from '../../components/Screen3D';
import { DEFAULT_BOTTOM_BANNER, DEFAULT_TOP_BANNER } from '../../lib/banners';

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const urlKey = searchParams.get('key');
  const [activeKey, setActiveKey] = useState<string>('');
  const [keyInput, setKeyInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [roomId, setRoomId] = useState('room-cktg-1');
  const [videoInput, setVideoInput] = useState('');
  const [topBannerInput, setTopBannerInput] = useState(DEFAULT_TOP_BANNER);
  const [bottomBannerInput, setBottomBannerInput] = useState(DEFAULT_BOTTOM_BANNER);

  // Synchronized Playback Control States (SPEC V3.1)
  const [playbackState, setPlaybackState] = useState<'playing' | 'paused'>('playing');
  const [playbackPosition, setPlaybackPosition] = useState<number>(0);
  const [playbackIsLive, setPlaybackIsLive] = useState<boolean>(false);
  const [jumpTimeInput, setJumpTimeInput] = useState<string>('');
  const [playbackStatusMsg, setPlaybackStatusMsg] = useState<string | null>(null);

  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bannerStatusMsg, setBannerStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  // Video suggestions from viewers
  const [suggestions, setSuggestions] = useState<Array<{
    id: string;
    video_url: string;
    title: string | null;
    suggested_by: string;
    created_at: string;
  }>>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Spec V3.1: Unlock body overflow on admin page to ensure smooth scrolling
  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyHeight = document.body.style.height;
    const prevUserSelect = document.body.style.userSelect;

    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    document.body.style.userSelect = 'auto';

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.height = prevBodyHeight;
      document.body.style.userSelect = prevUserSelect;
    };
  }, []);

  const verifyKeyWithServer = async (candidate: string, showError = false) => {
    const trimmed = candidate.trim();
    if (!trimmed) {
      setIsAuthorized(false);
      return;
    }
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'x-admin-key': trimmed },
      });
      if (res.ok) {
        setActiveKey(trimmed);
        setIsAuthorized(true);
        setAuthError(null);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('admin_key', trimmed);
        }
      } else {
        setIsAuthorized(false);
        if (showError) {
          if (res.status === 500) {
            setAuthError('Server chưa cấu hình biến môi trường ADMIN_KEY (hãy thêm trên Vercel rồi Redeploy)!');
          } else if (res.status === 429) {
            setAuthError('Thử quá nhiều lần (tối đa 10 lần/phút). Vui lòng đợi 1 phút!');
          } else {
            setAuthError('Admin Key không chính xác!');
          }
        }
      }
    } catch {
      setIsAuthorized(false);
      if (showError) setAuthError('Không thể kết nối tới máy chủ!');
    }
  };

  // Verify Admin Key securely from URL ?key= or sessionStorage
  useEffect(() => {
    const initial =
      urlKey?.trim() ||
      (typeof window !== 'undefined' ? sessionStorage.getItem('admin_key')?.trim() : '') ||
      '';
    if (initial) {
      verifyKeyWithServer(initial, Boolean(urlKey));
    } else {
      setIsAuthorized(false);
    }
  }, [urlKey]);

  const fetchSuggestions = async () => {
    if (!activeKey) return;
    setLoadingSuggestions(true);
    try {
      const res = await fetch(`/api/admin/suggestions?roomId=${encodeURIComponent(roomId)}`, {
        headers: { 'x-admin-key': activeKey },
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch {}
    setLoadingSuggestions(false);
  };

  useEffect(() => {
    if (isAuthorized && activeKey) {
      fetchSuggestions();
    }
  }, [isAuthorized, activeKey, roomId]);

  const previewId = useMemo(() => {
    if (!videoInput.trim()) return null;
    return extractYouTubeId(videoInput.trim());
  }, [videoInput]);

  const [savingVideo, setSavingVideo] = useState(false);

  const playVideoId = async (targetId: string) => {
    setSavingVideo(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': activeKey,
        },
        body: JSON.stringify({
          roomId,
          videoUrl: targetId,
          senderName: 'Admin',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi cập nhật server');

      setStatusMsg({
        type: 'success',
        text: `✅ Đã đổi video màn chiếu sang (ID: ${targetId}) cho phòng ${roomId} lúc ${new Date().toLocaleTimeString()}. Người xem trong phòng sẽ thấy ngay.`,
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setSavingVideo(false);
    }
  };

  const handlePlaybackAction = async (action: {
    state?: 'playing' | 'paused';
    position?: number;
    isLive?: boolean;
  }) => {
    if (!activeKey) return;
    setPlaybackStatusMsg('Đang gửi lệnh đồng bộ...');
    try {
      const res = await fetch('/api/admin/playback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': activeKey,
        },
        body: JSON.stringify({
          roomId,
          ...action,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi gửi lệnh phát');
      if (action.state) setPlaybackState(action.state);
      if (typeof action.position === 'number') setPlaybackPosition(action.position);
      if (typeof action.isLive === 'boolean') setPlaybackIsLive(action.isLive);
      setPlaybackStatusMsg(`✅ Đã gửi lệnh đồng bộ (${action.state || ''} ${typeof action.position === 'number' ? action.position + 's' : ''}) lúc ${new Date().toLocaleTimeString()}!`);
    } catch (err: any) {
      setPlaybackStatusMsg(`❌ Lỗi: ${err.message}`);
    }
  };

  const handleBroadcastVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewId) {
      setStatusMsg({ type: 'error', text: 'URL hoặc ID YouTube không hợp lệ!' });
      return;
    }
    await playVideoId(previewId);
  };

  const handleBroadcastBanners = async (e: React.FormEvent) => {
    e.preventDefault();
    const top = topBannerInput.trim() || DEFAULT_TOP_BANNER;
    const bottom = bottomBannerInput.trim() || DEFAULT_BOTTOM_BANNER;

    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': activeKey,
        },
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
        <div className="admin-card" style={{ borderColor: authError ? '#ef4444' : '#3f3f46', maxWidth: '460px' }}>
          <div style={{ fontSize: '36px', marginBottom: '10px' }}>🔐</div>
          <h1 style={{ color: '#f59e0b', fontSize: '21px', fontWeight: 700, marginBottom: '8px' }}>
            Đăng Nhập Quản Trị Rạp Chiếu
          </h1>
          <p style={{ color: '#a1a1aa', fontSize: '13.5px', lineHeight: 1.5, marginBottom: '18px' }}>
            Nhập mã <code>ADMIN_KEY</code> để truy cập bảng điều khiển (tránh bị cắt ký tự đặc biệt ở cuối URL).
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              verifyKeyWithServer(keyInput, true);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            <input
              type="password"
              className="chat-input"
              placeholder="Nhập ADMIN_KEY..."
              value={keyInput}
              onChange={(e) => {
                setKeyInput(e.target.value);
                if (authError) setAuthError(null);
              }}
              style={{ width: '100%', height: '42px', borderRadius: '8px' }}
              autoFocus
            />
            {authError && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: '#7f1d1d',
                  color: '#fca5a5',
                  border: '1px solid #dc2626',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                ⚠️ {authError}
              </div>
            )}
            <button
              type="submit"
              className="modal-confirm-btn"
              disabled={!keyInput.trim()}
              style={{ width: '100%', margin: 0, padding: '11px' }}
            >
              🔓 Xác thực Admin
            </button>
          </form>
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
          <span className="mode-badge badge-online">● Quản trị viên</span>
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
              disabled={!previewId || savingVideo}
            >
              {savingVideo ? '⏳ Đang đổi video...' : '📡 Đổi video phòng ngay'}
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

        {/* Section 1.5: Synchronized Playback Control (V3.1) */}
        <div style={{ marginBottom: '32px', padding: '18px', background: '#141417', borderRadius: '10px', border: '1px solid #27272a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '15px', color: '#fef08a', fontWeight: 700, margin: 0 }}>
              🎛️ Điều Khiển Phát Video Toàn Phòng (Chỉ Admin)
            </h2>
            <span
              style={{
                fontSize: '12px',
                padding: '4px 10px',
                borderRadius: '12px',
                background: playbackState === 'playing' ? '#064e3b' : '#78350f',
                color: playbackState === 'playing' ? '#34d399' : '#fcd34d',
                fontWeight: 700,
              }}
            >
              {playbackState === 'playing' ? '▶ ĐANG PHÁT' : '⏸ ĐANG TẠM DỪNG'}
            </span>
          </div>

          <p style={{ fontSize: '13px', color: '#a1a1aa', marginTop: 0, marginBottom: '16px' }}>
            Mọi thao tác Play, Pause hoặc Tua bên dưới sẽ đồng bộ lập tức tới màn chiếu của tất cả người xem trong phòng <code>{roomId}</code>.
          </p>

          {/* Livestream checkbox */}
          <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="is-live-checkbox"
              checked={playbackIsLive}
              onChange={(e) => handlePlaybackAction({ isLive: e.target.checked })}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#ef4444' }}
            />
            <label htmlFor="is-live-checkbox" style={{ fontSize: '13px', fontWeight: 600, color: '#fca5a5', cursor: 'pointer' }}>
              🔴 Đây là livestream (người xem luôn bám sát live edge, khóa tính năng tua)
            </label>
          </div>

          {!playbackIsLive && (
            <>
              {/* Playback action buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                {playbackState === 'paused' ? (
                  <button
                    type="button"
                    onClick={() => handlePlaybackAction({ state: 'playing' })}
                    style={{
                      background: '#10b981',
                      color: '#000000',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 18px',
                      fontWeight: 800,
                      fontSize: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    ▶ TIẾP TỤC PHÁT (PLAY)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePlaybackAction({ state: 'paused' })}
                    style={{
                      background: '#f59e0b',
                      color: '#000000',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 18px',
                      fontWeight: 800,
                      fontSize: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    ⏸ TẠM DỪNG (PAUSE)
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handlePlaybackAction({ position: Math.max(0, playbackPosition - 10) })}
                  style={{
                    background: '#27272a',
                    color: '#ffffff',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  ⏪ -10s
                </button>

                <button
                  type="button"
                  onClick={() => handlePlaybackAction({ position: playbackPosition + 10 })}
                  style={{
                    background: '#27272a',
                    color: '#ffffff',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  ⏩ +10s
                </button>

                <button
                  type="button"
                  onClick={() => handlePlaybackAction({ state: playbackState, position: playbackPosition })}
                  style={{
                    background: '#3b82f6',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  🔄 Đồng bộ lại mọi người
                </button>
              </div>

              {/* Jump to specific time */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                <label style={{ fontSize: '13px', color: '#d4d4d8', fontWeight: 600 }}>
                  Tua tới mốc:
                </label>
                <input
                  type="text"
                  className="chat-input"
                  placeholder="VD: 30:00 hoặc 05:20"
                  value={jumpTimeInput}
                  onChange={(e) => setJumpTimeInput(e.target.value)}
                  style={{ width: '160px', height: '36px', borderRadius: '6px' }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const parts = jumpTimeInput.trim().split(':').map(Number);
                    if (parts.some(isNaN) || parts.length === 0) return;
                    let sec = 0;
                    if (parts.length === 2) sec = parts[0] * 60 + parts[1];
                    else if (parts.length === 3) sec = parts[0] * 3600 + parts[1] * 60 + parts[2];
                    else if (parts.length === 1) sec = parts[0];
                    handlePlaybackAction({ position: sec });
                  }}
                  style={{
                    background: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 14px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Nhảy tới mốc này
                </button>
              </div>
            </>
          )}

          {playbackStatusMsg && (
            <div style={{ fontSize: '12.5px', color: '#38bdf8', marginTop: '10px', fontStyle: 'italic' }}>
              {playbackStatusMsg}
            </div>
          )}
        </div>

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

        <hr style={{ borderColor: '#27272a', margin: '28px 0' }} />

        {/* Section 3: Video Suggestions from Viewers */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '15px', color: '#fef08a', fontWeight: 700, margin: 0 }}>
              💡 3. Danh Sách Đề Xuất Video Từ Khán Giả
            </h2>
            <button
              type="button"
              onClick={fetchSuggestions}
              disabled={loadingSuggestions}
              style={{
                background: '#27272a',
                color: '#e4e4e7',
                border: '1px solid #3f3f46',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {loadingSuggestions ? 'Đang tải...' : '🔄 Làm mới'}
            </button>
          </div>

          {suggestions.length === 0 ? (
            <p style={{ color: '#71717a', fontSize: '13px', fontStyle: 'italic', margin: '12px 0' }}>
              Chưa có đề xuất video nào từ khán giả cho phòng này.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {suggestions.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    background: '#18181b',
                    borderRadius: '8px',
                    border: '1px solid #27272a',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <img
                      src={`https://i.ytimg.com/vi/${item.video_url}/default.jpg`}
                      alt="Thumbnail"
                      style={{ width: '64px', height: '48px', objectFit: 'cover', borderRadius: '4px' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: '#f4f4f5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.title || `Video ID: ${item.video_url}`}
                      </div>
                      <div style={{ fontSize: '11px', color: '#a1a1aa', marginTop: '2px' }}>
                        Bởi: <span style={{ color: '#eab308' }}>{item.suggested_by}</span> · {new Date(item.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setVideoInput(item.video_url);
                      playVideoId(item.video_url);
                    }}
                    style={{
                      background: '#10b981',
                      color: '#000',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 14px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ▶ Chiếu video này
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
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
