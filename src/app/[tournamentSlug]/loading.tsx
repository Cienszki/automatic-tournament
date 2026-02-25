import { LoadingScreen } from '@/components/ui/LoadingScreen';

/**
 * Next.js Suspense-based loading UI for all tournament pages.
 * Shown while JS route chunks are being fetched.
 */
export default function TournamentLoading() {
  return <LoadingScreen />;
}
