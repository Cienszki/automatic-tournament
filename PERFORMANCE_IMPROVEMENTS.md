# Performance Improvement Plan

Based on PageSpeed Insights Report (Score: 67/100)
Generated: January 28, 2026

## Critical Issues

### 1. Largest Contentful Paint (LCP): 7.0s ❌
**Target:** <2.5s
**Current:** 7.0s
**Impact:** Major performance bottleneck

### 2. Speed Index: 10.7s ❌
**Target:** <3.4s
**Current:** 10.7s

### 3. Main-thread Work: 9.7s ❌
**Problem:** JavaScript execution blocking render

---

## Immediate Actions (High Priority)

### 1. Add Security & Caching Headers
**Impact:** +15-20 points, improved security, faster repeat visits

Create `firebase.json` rewrites for headers:

```json
{
  "hosting": {
    "headers": [
      {
        "source": "**/*.@(jpg|jpeg|gif|png|webp|avif)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "**",
        "headers": [
          {
            "key": "X-Content-Type-Options",
            "value": "nosniff"
          },
          {
            "key": "X-Frame-Options",
            "value": "DENY"
          },
          {
            "key": "X-XSS-Protection",
            "value": "1; mode=block"
          },
          {
            "key": "Referrer-Policy",
            "value": "strict-origin-when-cross-origin"
          },
          {
            "key": "Permissions-Policy",
            "value": "geolocation=(), microphone=(), camera=()"
          }
        ]
      },
      {
        "source": "/",
        "headers": [
          {
            "key": "Content-Security-Policy",
            "value": "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://firestore.googleapis.com wss://*.firebaseio.com; frame-src 'self' https://www.youtube.com;"
          },
          {
            "key": "Strict-Transport-Security",
            "value": "max-age=31536000; includeSubDomains; preload"
          }
        ]
      }
    ]
  }
}
```

### 2. Optimize Images (Est. Savings: 604 KiB)

**Current:** Large images loaded upfront
**Solution:** Lazy loading + proper sizing

In `next.config.ts`:
- ✅ Already enabled AVIF/WebP
- ⚠️ Need to add proper image sizes

Add to all `<Image>` components:
```tsx
<Image
  src="/path/to/image.png"
  alt="Description"
  width={actual_width}
  height={actual_height}
  loading="lazy"  // Add this
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"  // Add this
/>
```

### 3. Convert Pages to Server Components
**Impact:** Major - Reduce client JS by ~50%

**Problem:** ALL pages use `"use client"` directive
**Solution:** Remove `"use client"` where not needed

Pages that CAN be Server Components:
- `/[tournamentSlug]/rules` (static content)
- `/[tournamentSlug]/faq` (static content)
- `/[tournamentSlug]/about` (static content)

Pages that MUST stay Client:
- `/[tournamentSlug]/fantasy` (uses forms/state)
- `/[tournamentSlug]/admin` (interactive)
- `/[tournamentSlug]/my-team` (auth-dependent)

### 4. Code Splitting & Dynamic Imports
**Impact:** Reduce initial bundle size

Replace static imports with dynamic:

```tsx
// Before
import { HeavyComponent } from '@/components/HeavyComponent';

// After
const HeavyComponent = dynamic(() => import('@/components/HeavyComponent'), {
  loading: () => <Loader />,
  ssr: false // if it's client-only
});
```

Target components:
- Chart libraries
- Three.js components
- Heavy UI libraries

### 5. Reduce Unused JavaScript (116 KiB)

**Problem:** Loading entire UI library bundles
**Solution:** Tree-shaking and selective imports

Example for lucide-react:
```tsx
// Before
import { ChevronDown, Home, Menu, Settings } from 'lucide-react';

// After - if bundle is still large, consider switching to lucide-static
// Or use individual icon imports
```

### 6. Fix Console Errors
**Best Practices dropped to 96%**

Check browser console for:
- Firebase initialization errors
- Missing environment variables
- React hydration mismatches
- Unhandled promise rejections

---

## Medium Priority

### 7. Preconnect to Required Origins

Add to `app/layout.tsx`:
```tsx
<head>
  <link rel="preconnect" href="https://firebasestorage.googleapis.com" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="dns-prefetch" href="https://www.googleapis.com" />
</head>
```

### 8. Font Optimization

Use `next/font` for Google Fonts:
```tsx
import { Inter } from 'next/font/google';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap', // Important for performance
  preload: true
});
```

### 9. Reduce CSS Bundle (20 KiB unused)

- Run PurgeCSS on Tailwind
- Check if all shadcn/ui components are needed
- Remove unused utility classes

### 10. Avoid Non-Composited Animations

**Problem:** 4 animated elements using non-GPU properties
**Solution:** Use `transform` and `opacity` only

```css
/* Bad - causes repaints */
.element {
  animation: move 1s;
}
@keyframes move {
  to { left: 100px; } /* ❌ */
}

/* Good - GPU accelerated */
.element {
  animation: move 1s;
  will-change: transform; /* ✅ */
}
@keyframes move {
  to { transform: translateX(100px); } /* ✅ */
}
```

---

## Low Priority (Polish)

### 11. Implement Service Worker for Offline Support
### 12. Add Resource Hints (prefetch/preload)
### 13. Use Intersection Observer for lazy loading
### 14. Implement Virtual Scrolling for long lists

---

## Expected Improvements

After implementing high priority fixes:

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Performance | 67 | 85-90 | +18-23 points |
| LCP | 7.0s | <2.5s | 64% faster |
| Speed Index | 10.7s | <4.0s | 63% faster |
| Best Practices | 96 | 100 | +4 points |

---

## Implementation Order

### Week 1: Quick Wins
1. ✅ Add security headers to firebase.json
2. ✅ Fix console errors
3. ✅ Add lazy loading to images
4. ✅ Add preconnect links

### Week 2: Structural Changes
5. Convert static pages to Server Components
6. Implement dynamic imports for heavy components
7. Optimize fonts with next/font

### Week 3: Advanced Optimizations
8. Code splitting analysis
9. Remove unused CSS/JS
10. Optimize animations

### Week 4: Testing & Monitoring
11. Re-run PageSpeed Insights
12. Test on real devices
13. Set up performance monitoring

---

## Tools for Monitoring

1. **Chrome DevTools Lighthouse** - Local testing
2. **PageSpeed Insights** - Google's official tool
3. **WebPageTest** - Detailed waterfall analysis
4. **Firebase Performance Monitoring** - Real user metrics

---

## Resources

- [Next.js Performance Optimization](https://nextjs.org/docs/app/building-your-application/optimizing)
- [Web.dev Performance](https://web.dev/performance/)
- [Firebase Hosting Headers](https://firebase.google.com/docs/hosting/full-config#headers)
