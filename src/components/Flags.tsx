function star(cx: number, cy: number, R: number, r: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const a = Math.PI * i / 5 - Math.PI / 2;
    const rad = i % 2 === 0 ? R : r;
    return `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
  }).join(' ');
}

export function FlagIL({ size = 22 }: { size?: number }) {
  const h = Math.round(size * 2 / 3);
  return (
    <svg width={size} height={h} viewBox="0 0 90 60" xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true" style={{ display: 'block', borderRadius: 2, flexShrink: 0 }}>
      <rect width="90" height="60" fill="#fff"/>
      <rect width="90" height="11" y="8"  fill="#0038B8"/>
      <rect width="90" height="11" y="41" fill="#0038B8"/>
      <polygon points="45,21 53.5,35 36.5,35" fill="none" stroke="#0038B8" strokeWidth="2.8"/>
      <polygon points="45,39 36.5,25 53.5,25" fill="none" stroke="#0038B8" strokeWidth="2.8"/>
    </svg>
  );
}

export function FlagUS({ size = 22 }: { size?: number }) {
  const h = Math.round(size * 10 / 19);
  const sh = 30 / 13;
  const cw = 57 * 0.408;
  const ch = sh * 7;
  const cols = 5, rows = 3;
  const sx = cw / cols, sy = ch / rows;
  return (
    <svg width={size} height={h} viewBox="0 0 57 30" xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true" style={{ display: 'block', borderRadius: 2, flexShrink: 0 }}>
      <rect width="57" height="30" fill="#B22234"/>
      {[1,3,5,7,9,11].map(i => (
        <rect key={i} x="0" y={i * sh} width="57" height={sh} fill="#fff"/>
      ))}
      <rect x="0" y="0" width={cw} height={ch} fill="#3C3B6E"/>
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => (
          <polygon key={`${r}-${c}`}
            points={star(sx*(c+0.5), sy*(r+0.5), 1.3, 0.55)}
            fill="#fff"/>
        ))
      )}
    </svg>
  );
}
