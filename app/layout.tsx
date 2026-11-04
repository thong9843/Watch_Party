import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Esports Watch Party · CKTG LMHT',
  description: 'Rạp chiếu phim ảo cùng bạn bè xem CKTG Liên Minh Huyền Thoại với nhân vật Chibi realtime.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}

