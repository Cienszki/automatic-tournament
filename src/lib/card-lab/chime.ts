'use client';

// Short sounds for things a player must not miss (your turn, a challenge), made on the spot with Web
// Audio: no files to load. Browsers allow sound once the page has been clicked, which a player has.

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

/** `turn`: two rising notes · `challenge`: three quick ones */
export function chime(kind: 'turn' | 'challenge') {
  const a = audio(); if (!a) return;
  const notes = kind === 'turn' ? [660, 880] : [784, 988, 1175];
  notes.forEach((f, i) => {
    const t = a.currentTime + i * (kind === 'turn' ? 0.14 : 0.1);
    const o = a.createOscillator(); const g = a.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.32);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.34);
  });
}

/** While something waits for the player in another tab: the tab title blinks (`null` stops it) */
let blink: ReturnType<typeof setInterval> | null = null; let base = '';
export function titleAlert(text: string | null) {
  if (typeof document === 'undefined') return;
  if (blink) { clearInterval(blink); blink = null; document.title = base; }
  if (!text) return;
  base = document.title;
  let on = false;
  blink = setInterval(() => { on = !on; document.title = on ? `● ${text}` : base; }, 900);
  const stop = () => { if (document.visibilityState === 'visible') { titleAlert(null); document.removeEventListener('visibilitychange', stop); } };
  if (document.visibilityState === 'visible') setTimeout(() => titleAlert(null), 2500);
  else document.addEventListener('visibilitychange', stop);
}
