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

export function FlagUS({ size = 20 }: { size?: number }) {
  const h = Math.round(size * 30 / 57);
  // 13 stripes, canton covers top-left 2/5 width × 7 stripes height
  const stripeH = 30 / 13;
  const cantonW = 57 * 0.4;
  const cantonH = stripeH * 7;
  const stripes = Array.from({ length: 13 }, (_, i) => i);
  return (
    <svg width={size} height={h} viewBox="0 0 57 30" xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', borderRadius: 2, flexShrink: 0 }}>
      {/* Red background (all odd stripes) */}
      <rect width="57" height="30" fill="#B22234"/>
      {/* White even stripes */}
      {stripes.filter(i => i % 2 === 1).map(i => (
        <rect key={i} x="0" y={i * stripeH} width="57" height={stripeH} fill="#fff"/>
      ))}
      {/* Blue canton */}
      <rect x="0" y="0" width={cantonW} height={cantonH} fill="#3C3B6E"/>
      {/* Stars — 5×3 simplified grid in canton */}
      {[0,1,2,3,4].map(col => [0,1,2].map(row => (
        <circle key={`${col}-${row}`}
          cx={cantonW * (col + 0.5) / 5}
          cy={cantonH * (row + 0.5) / 3}
          r={0.9} fill="#fff"/>
      )))}
    </svg>
  );
}
