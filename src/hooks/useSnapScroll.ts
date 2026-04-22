'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSnapScrollOptions {
  totalSections: number;
  /** Cooldown in ms between scroll transitions */
  cooldown?: number;
  /** Transition duration in ms (for CSS) */
  transitionDuration?: number;
}

interface UseSnapScrollReturn {
  currentSection: number;
  goToSection: (index: number) => void;
  goNext: () => void;
  goPrev: () => void;
  containerRef: React.RefObject<HTMLDivElement>;
  isTransitioning: boolean;
}

export function useSnapScroll({
  totalSections,
  cooldown = 800,
  transitionDuration = 700,
}: UseSnapScrollOptions): UseSnapScrollReturn {
  const [currentSection, setCurrentSection] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef(0);

  const goToSection = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, totalSections - 1));
      if (clamped === currentSection) return;

      const now = Date.now();
      if (now - lastScrollTime.current < cooldown) return;
      lastScrollTime.current = now;

      setIsTransitioning(true);
      setCurrentSection(clamped);

      setTimeout(() => setIsTransitioning(false), transitionDuration);
    },
    [currentSection, totalSections, cooldown, transitionDuration],
  );

  const goNext = useCallback(() => {
    goToSection(currentSection + 1);
  }, [currentSection, goToSection]);

  const goPrev = useCallback(() => {
    goToSection(currentSection - 1);
  }, [currentSection, goToSection]);

  // Wheel handler — any scroll tick triggers a section change
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (Math.abs(e.deltaY) < 5) return; // ignore micro-scrolls
      if (e.deltaY > 0) goNext();
      else goPrev();
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [goNext, goPrev]);

  // Keyboard handler — arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToSection(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goToSection(totalSections - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev, goToSection, totalSections]);

  // Touch handler for mobile swipe
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const deltaY = touchStartY - e.changedTouches[0].clientY;
      if (Math.abs(deltaY) < 50) return; // minimum swipe distance
      if (deltaY > 0) goNext();
      else goPrev();
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [goNext, goPrev]);

  return {
    currentSection,
    goToSection,
    goNext,
    goPrev,
    containerRef,
    isTransitioning,
  };
}
