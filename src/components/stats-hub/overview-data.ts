// What the overview shows, as plain data: computed by the stats feature (src/features/stats/domain/overview.ts,
// moved there in WP-15); shared by the overview and its preloader, so the pictures warmed in the
// background are exactly the ones the overview will draw.
export { buildOverview, type OverviewData, type RecordTeaser } from '@/features/stats/domain/overview';

/** `sizes` of the gallery's hero renders (the open panel is ~60% of the middle column) */
export const GALLERY_RENDER_SIZES = '(min-width: 1024px) 30vw, 80vw';
