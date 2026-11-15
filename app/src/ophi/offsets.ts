/**
 * Per-route bottom offsets for Ophi when a screen has buttons or inputs near the bottom right.
 * Keeps Ophi from sitting on top of screen controls at 360 px without editing screens.
 */
export const ROUTE_BOTTOM_OFFSETS: Record<string, string> = {
  // Empty by default as all current screens have adequate bottom padding (pb-28 on main)
}
