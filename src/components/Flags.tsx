export function FlagIL({ size = 20 }: { size?: number }) {
  const h = Math.round(size * 2 / 3);
  return (
    <svg width={size} height={h} viewBox="0 0 90 60" xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', borderRadius: 2, flexShrink: 0 }}>
      <rect width="90" height="60" fill="#fff"/>
      <rect width="90" height="11" y="8"  fill="#0038B8"/>
      <rect width="90" height="11" y="41" fill="#0038B8"/>
      {/* Star of David — two overlapping equilateral triangles */}
      <polygon points="45,22 53,35 37,35" fill="none" stroke="#0038B8" strokeWidth="2.8"/>
      <polygon points="45,38 37,25 53,25" fill="none" stroke="#0038B8" strokeWidth="2.8"/>
    </svg>
  );
}

export function FlagGB({ size = 20 }: { size?: number }) {
  const h = Math.round(size * 0.5);
  return (
    <svg width={size} height={h} viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', borderRadius: 2, flexShrink: 0 }}>
      <rect width="60" height="30" fill="#012169"/>
      {/* White diagonals */}
      <line x1="0" y1="0"  x2="60" y2="30" stroke="#fff" strokeWidth="7"/>
      <line x1="60" y1="0" x2="0"  y2="30" stroke="#fff" strokeWidth="7"/>
      {/* Red diagonals (offset for St Patrick's cross) */}
      <line x1="0" y1="0"  x2="60" y2="30" stroke="#C8102E" strokeWidth="4"/>
      <line x1="60" y1="0" x2="0"  y2="30" stroke="#C8102E" strokeWidth="4"/>
      {/* White St George cross */}
      <rect x="25" y="0"  width="10" height="30" fill="#fff"/>
      <rect x="0"  y="10" width="60" height="10" fill="#fff"/>
      {/* Red St George cross */}
      <rect x="27" y="0"  width="6"  height="30" fill="#C8102E"/>
      <rect x="0"  y="12" width="60" height="6"  fill="#C8102E"/>
    </svg>
  );
}
