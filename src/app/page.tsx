// src/app/page.tsx
// Redirect to PDL tournament page

import { redirect } from 'next/navigation';

/**
 * Landing page - redirects to PDL
 * When Letnia Batalia or other tournaments are active again,
 * this can be restored to show the full split-screen landing page
 * using TournamentHalf and BottomBar from @/components/landing.
 */
export default function LandingPage() {
  redirect('/pdl');
}

