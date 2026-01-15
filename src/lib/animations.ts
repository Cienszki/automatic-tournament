// src/lib/animations.ts
// Animation utilities using Framer Motion

import { Variants, Transition } from 'framer-motion';

/**
 * Standard transitions
 */
export const TRANSITIONS = {
  // Fast and snappy for micro-interactions
  fast: {
    type: 'spring',
    stiffness: 400,
    damping: 30,
  } as Transition,
  
  // Default transition - balanced
  default: {
    type: 'spring',
    stiffness: 260,
    damping: 25,
  } as Transition,
  
  // Smooth and elegant for larger movements
  smooth: {
    type: 'spring',
    stiffness: 200,
    damping: 30,
  } as Transition,
  
  // Slow and dramatic for hero sections
  slow: {
    type: 'spring',
    stiffness: 100,
    damping: 20,
  } as Transition,
  
  // Ease-based transitions for specific use cases
  easeOut: {
    type: 'tween',
    ease: 'easeOut',
    duration: 0.3,
  } as Transition,
  
  easeInOut: {
    type: 'tween',
    ease: 'easeInOut',
    duration: 0.4,
  } as Transition,
  
  // Bounce effect for playful interactions
  bounce: {
    type: 'spring',
    stiffness: 400,
    damping: 15,
  } as Transition,
} as const;

/**
 * Fade animations
 */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: TRANSITIONS.default,
  },
  exit: { 
    opacity: 0,
    transition: TRANSITIONS.fast,
  },
};

export const fadeInUp: Variants = {
  hidden: { 
    opacity: 0, 
    y: 20,
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: TRANSITIONS.default,
  },
  exit: { 
    opacity: 0, 
    y: -10,
    transition: TRANSITIONS.fast,
  },
};

export const fadeInDown: Variants = {
  hidden: { 
    opacity: 0, 
    y: -20,
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: TRANSITIONS.default,
  },
  exit: { 
    opacity: 0, 
    y: 10,
    transition: TRANSITIONS.fast,
  },
};

export const fadeInLeft: Variants = {
  hidden: { 
    opacity: 0, 
    x: -30,
  },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: TRANSITIONS.default,
  },
  exit: { 
    opacity: 0, 
    x: 30,
    transition: TRANSITIONS.fast,
  },
};

export const fadeInRight: Variants = {
  hidden: { 
    opacity: 0, 
    x: 30,
  },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: TRANSITIONS.default,
  },
  exit: { 
    opacity: 0, 
    x: -30,
    transition: TRANSITIONS.fast,
  },
};

/**
 * Scale animations
 */
export const scaleIn: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.9,
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: TRANSITIONS.default,
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: TRANSITIONS.fast,
  },
};

export const scaleUp: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.5,
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: TRANSITIONS.bounce,
  },
  exit: { 
    opacity: 0, 
    scale: 0.8,
    transition: TRANSITIONS.fast,
  },
};

export const popIn: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.7,
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 25,
    },
  },
  exit: { 
    opacity: 0, 
    scale: 0.9,
    transition: TRANSITIONS.fast,
  },
};

/**
 * Slide animations
 */
export const slideUp: Variants = {
  hidden: { 
    y: '100%',
  },
  visible: { 
    y: 0,
    transition: TRANSITIONS.smooth,
  },
  exit: { 
    y: '100%',
    transition: TRANSITIONS.fast,
  },
};

export const slideDown: Variants = {
  hidden: { 
    y: '-100%',
  },
  visible: { 
    y: 0,
    transition: TRANSITIONS.smooth,
  },
  exit: { 
    y: '-100%',
    transition: TRANSITIONS.fast,
  },
};

export const slideLeft: Variants = {
  hidden: { 
    x: '100%',
  },
  visible: { 
    x: 0,
    transition: TRANSITIONS.smooth,
  },
  exit: { 
    x: '100%',
    transition: TRANSITIONS.fast,
  },
};

export const slideRight: Variants = {
  hidden: { 
    x: '-100%',
  },
  visible: { 
    x: 0,
    transition: TRANSITIONS.smooth,
  },
  exit: { 
    x: '-100%',
    transition: TRANSITIONS.fast,
  },
};

/**
 * Stagger containers - wrap children with staggered animations
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

export const staggerContainerFast: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
  exit: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

export const staggerContainerSlow: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
  exit: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      staggerDirection: -1,
    },
  },
};

/**
 * List item animations - use with stagger containers
 */
export const listItem: Variants = {
  hidden: { 
    opacity: 0, 
    y: 20,
    scale: 0.95,
  },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: TRANSITIONS.default,
  },
  exit: { 
    opacity: 0, 
    y: -10,
    scale: 0.98,
    transition: TRANSITIONS.fast,
  },
};

export const gridItem: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.8,
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: TRANSITIONS.default,
  },
  exit: { 
    opacity: 0, 
    scale: 0.9,
    transition: TRANSITIONS.fast,
  },
};

/**
 * Hover animations
 */
export const hoverScale = {
  scale: 1.02,
  transition: TRANSITIONS.fast,
};

export const hoverScaleLarge = {
  scale: 1.05,
  transition: TRANSITIONS.fast,
};

export const hoverLift = {
  y: -4,
  transition: TRANSITIONS.fast,
};

export const hoverGlow = {
  boxShadow: '0 0 20px rgba(var(--primary), 0.3)',
  transition: TRANSITIONS.fast,
};

export const tapScale = {
  scale: 0.98,
};

/**
 * Card animations with glow effect
 */
export const cardHover: Variants = {
  rest: {
    scale: 1,
    y: 0,
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  hover: {
    scale: 1.02,
    y: -4,
    boxShadow: '0 12px 24px rgba(0, 0, 0, 0.2)',
    transition: TRANSITIONS.fast,
  },
  tap: {
    scale: 0.98,
    y: 0,
  },
};

/**
 * Page transitions
 */
export const pageTransition: Variants = {
  initial: { 
    opacity: 0,
    y: 20,
  },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.4,
      ease: 'easeOut',
    },
  },
  exit: { 
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.3,
      ease: 'easeIn',
    },
  },
};

/**
 * Loading/skeleton shimmer effect (CSS-based, return as style object)
 */
export const shimmerStyle = {
  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
};

/**
 * Pulse animation for live indicators
 */
export const pulse: Variants = {
  initial: { scale: 1, opacity: 1 },
  animate: {
    scale: [1, 1.1, 1],
    opacity: [1, 0.8, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

/**
 * Number counter animation helper
 * Use with useSpring from framer-motion
 */
export const counterSpring = {
  stiffness: 75,
  damping: 15,
};

/**
 * Tooltip animations
 */
export const tooltip: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.95,
    y: 5,
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
    },
  },
};

/**
 * Modal/Dialog animations
 */
export const modal: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.95,
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: TRANSITIONS.default,
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: TRANSITIONS.fast,
  },
};

export const modalBackdrop: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.2 },
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

/**
 * Progress bar animation
 */
export const progressBar: Variants = {
  initial: { scaleX: 0, originX: 0 },
  animate: (custom: number) => ({
    scaleX: custom,
    transition: {
      type: 'spring',
      stiffness: 50,
      damping: 15,
    },
  }),
};

/**
 * Drawer animations
 */
export const drawerLeft: Variants = {
  hidden: { x: '-100%' },
  visible: { 
    x: 0,
    transition: TRANSITIONS.smooth,
  },
  exit: { 
    x: '-100%',
    transition: TRANSITIONS.fast,
  },
};

export const drawerRight: Variants = {
  hidden: { x: '100%' },
  visible: { 
    x: 0,
    transition: TRANSITIONS.smooth,
  },
  exit: { 
    x: '100%',
    transition: TRANSITIONS.fast,
  },
};

/**
 * Notification animations
 */
export const notification: Variants = {
  hidden: { 
    opacity: 0, 
    y: -50,
    scale: 0.9,
  },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: TRANSITIONS.bounce,
  },
  exit: { 
    opacity: 0, 
    y: -20,
    scale: 0.95,
    transition: TRANSITIONS.fast,
  },
};

/**
 * Hero section animations
 */
export const heroTitle: Variants = {
  hidden: { 
    opacity: 0, 
    y: 30,
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      ...TRANSITIONS.slow,
      delay: 0.2,
    },
  },
};

export const heroSubtitle: Variants = {
  hidden: { 
    opacity: 0, 
    y: 20,
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      ...TRANSITIONS.slow,
      delay: 0.4,
    },
  },
};

export const heroCta: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.9,
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: {
      ...TRANSITIONS.bounce,
      delay: 0.6,
    },
  },
};

/**
 * Tab animations
 */
export const tabContent: Variants = {
  hidden: { 
    opacity: 0, 
    x: 10,
  },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: TRANSITIONS.fast,
  },
  exit: { 
    opacity: 0, 
    x: -10,
    transition: { duration: 0.15 },
  },
};

/**
 * Accordion animations
 */
export const accordion: Variants = {
  collapsed: { 
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: 0.3 },
      opacity: { duration: 0.2 },
    },
  },
  expanded: { 
    height: 'auto',
    opacity: 1,
    transition: {
      height: { duration: 0.3 },
      opacity: { duration: 0.2, delay: 0.1 },
    },
  },
};

/**
 * Utility: Create custom stagger container with options
 */
export function createStaggerContainer(
  staggerChildren: number = 0.1,
  delayChildren: number = 0.1
): Variants {
  return {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren,
        delayChildren,
      },
    },
    exit: {
      opacity: 1,
      transition: {
        staggerChildren: staggerChildren / 2,
        staggerDirection: -1,
      },
    },
  };
}

/**
 * Utility: Create fade with custom direction and distance
 */
export function createFade(
  direction: 'up' | 'down' | 'left' | 'right' = 'up',
  distance: number = 20
): Variants {
  const axis = direction === 'up' || direction === 'down' ? 'y' : 'x';
  const sign = direction === 'up' || direction === 'left' ? 1 : -1;

  return {
    hidden: { 
      opacity: 0, 
      [axis]: distance * sign,
    },
    visible: { 
      opacity: 1, 
      [axis]: 0,
      transition: TRANSITIONS.default,
    },
    exit: { 
      opacity: 0, 
      [axis]: (distance / 2) * -sign,
      transition: TRANSITIONS.fast,
    },
  };
}

/**
 * CSS Keyframes to add to globals.css
 * @shimmer animation for loading states
 */
export const CSS_KEYFRAMES = `
@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 5px rgba(var(--primary-rgb), 0.3);
  }
  50% {
    box-shadow: 0 0 20px rgba(var(--primary-rgb), 0.6);
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes spin-slow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
`;
