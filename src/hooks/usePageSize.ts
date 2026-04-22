import { useState, useEffect } from 'react';

/**
 * Returns a dynamic page size based on the viewport height and the approximate
 * height of each row in pixels.
 *
 * Uses screen.height (monitor resolution) rather than window.innerHeight so that
 * browser chrome (address bar, tabs, OS taskbar) doesn't reduce the count.
 *
 * Examples on 1080p (screen.height = 1080):
 *   usePageSize(72)  → 15  (game history rows)
 *   usePageSize(135) → 8   (upcoming match rows)
 */
export function usePageSize(rowHeight: number): number {
  const calc = () =>
    typeof window === 'undefined'
      ? Math.floor(600 / rowHeight)
      : Math.max(3, Math.floor(window.screen.height / rowHeight));

  const [pageSize, setPageSize] = useState<number>(calc);

  useEffect(() => {
    // screen.height is stable — no need to listen to resize
    setPageSize(calc());
  // rowHeight is a stable primitive, intentionally omitted from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return pageSize;
}
