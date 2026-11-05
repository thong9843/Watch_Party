import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#09090b', color: '#f4f4f5' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '12px' }}>404 - Không tìm thấy trang</h2>
      <Link href="/" style={{ color: '#f59e0b', textDecoration: 'underline' }}>
        Quay về phòng chiếu
      </Link>
    </div>
  );
}

