// Where a closed guide went: a ring pulses around the button that brings it back, so the player
// knows where to find it later. Plain DOM (no React), so it outlives the guide that called it.

export function pulseAt(selector: string, color = 'var(--tournament-primary, #c0392b)') {
  const el = typeof document !== 'undefined' ? document.querySelector(selector) : null;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const ring = document.createElement('div');
  Object.assign(ring.style, {
    position: 'fixed', left: `${r.left - 6}px`, top: `${r.top - 6}px`, width: `${r.width + 12}px`, height: `${r.height + 12}px`,
    borderRadius: '9999px', boxShadow: `0 0 0 3px ${color}, 0 0 24px ${color}`, pointerEvents: 'none', zIndex: '300',
  });
  document.body.appendChild(ring);
  const a = ring.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.9)' }], { duration: 850, iterations: 3, easing: 'ease-out' });
  a.onfinish = () => ring.remove();
}

/** Centre of an element on screen (null when it is not there) */
export function centreOf(selector: string): { x: number; y: number } | null {
  const el = typeof document !== 'undefined' ? document.querySelector(selector) : null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width || r.height ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
}
