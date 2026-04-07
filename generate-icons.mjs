// Run: node generate-icons.mjs
// Generates PWA icons using canvas (no extra deps needed in Node 18+)
import { createCanvas } from 'node:canvas';
import { writeFileSync } from 'node:fs';

function makeIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#7c3aed';
  const r = size * 0.22;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();

  // Shekel sign ₪
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.55}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('₪', size / 2, size / 2 + size * 0.03);

  return canvas.toBuffer('image/png');
}

try {
  writeFileSync('public/icon-192.png', makeIcon(192));
  writeFileSync('public/icon-512.png', makeIcon(512));
  console.log('Icons generated!');
} catch {
  console.log('canvas not available - using fallback SVG icons');
}
