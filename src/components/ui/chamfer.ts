/**
 * Clip path for the angled-corner buttons (top-left and bottom-right corners cut at 10px).
 * The straight edges sit 1px outside the box: a clip edge exactly on a 1px border drops that
 * border whenever the button lands on a fractional pixel — browser zoom, or a ScaledStage on a
 * big screen — so bordered buttons lost their top or side lines.
 */
export const CHAMFER_CLIP =
  'polygon(10px -1px, calc(100% + 1px) -1px, calc(100% + 1px) calc(100% - 10px), calc(100% - 10px) calc(100% + 1px), -1px calc(100% + 1px), -1px 10px)';
