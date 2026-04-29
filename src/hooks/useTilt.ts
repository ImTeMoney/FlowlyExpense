import { useRef, useCallback } from 'react';

export function useTilt(maxDeg = 6) {
  const ref = useRef<HTMLDivElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout>>();

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width  - 0.5;
    const y = (e.clientY - rect.top)  / rect.height - 0.5;
    el.style.transition = 'transform 0.08s ease-out';
    el.style.transform = `perspective(1000px) rotateY(${x * maxDeg * 2}deg) rotateX(${-y * maxDeg}deg) scale(1.01)`;
  }, [maxDeg]);

  const onPointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    clearTimeout(resetTimer.current);
    el.style.transition = 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1)';
    el.style.transform = 'perspective(1000px) rotateY(0deg) rotateX(0deg) scale(1)';
    resetTimer.current = setTimeout(() => {
      if (el) el.style.transition = '';
    }, 450);
  }, []);

  return { ref, onPointerMove, onPointerLeave };
}
