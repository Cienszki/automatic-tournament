// src/app/page.tsx
// Redirect to PDL tournament page

import { redirect } from 'next/navigation';

/**
 * Landing page - redirects to PDL
 * When Letnia Batalia or other tournaments are active again,
 * this can be restored to show the full landing page
 */
export default function LandingPage() {
  redirect('/pdl');
}
