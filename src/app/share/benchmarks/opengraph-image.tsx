import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image({ searchParams }: { searchParams: Record<string, string> }) {
  const top = Number.isFinite(Number(searchParams.top)) ? Math.round(Number(searchParams.top)) : null;
  const country = (searchParams.country || 'UK').toUpperCase();
  const home = (searchParams.home || '').toString();
  const income = (searchParams.income || '').toString();
  const label = [country, home, income].filter(Boolean).join(', ');

  return new ImageResponse(
    (
      <div
        style={{
          width: `${size.width}px`,
          height: `${size.height}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 80%)',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
        }}
      >
        <div style={{ width: '100%', height: '100%', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 28, color: '#065f46', border: '2px solid #065f46', borderRadius: 999, padding: '8px 18px' }}>Prosper • People like you</div>
          <div style={{ marginTop: 16, fontSize: 96, fontWeight: 800, color: '#111827' }}>Top {top ?? '—'}% of peers</div>
          <div style={{ marginTop: 8, fontSize: 32, color: '#4b5563' }}>{label}</div>
          <div style={{ position: 'absolute', bottom: 40, fontSize: 28, color: '#6b7280' }}>Made with Prosper — your personal wealth coach</div>
        </div>
      </div>
    ),
    { ...size }
  );
}

