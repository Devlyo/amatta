// v4 — one-off realignment of children.color_index to match each row's
// avatar after the AVATAR_KEYS index map was reordered to follow the
// canonical pairing from docs/design/amatta-v1/app-tokens.jsx KIDS demo.
//
// Pre-v4 (commit f3c40be), the AVATAR_KEYS slot order was an arbitrary
// guess; from v4 onward it's:
//   face-wink     → 0 (Petunia Pink / peach)
//   face-dizzy    → 1 (Vibrant Mint)
//   face-cool     → 2 (Glacier Blue / sky)
//   face-sleep    → 3 (Soft Peach / butter)
//   face-surprise → 4 (Citrus Green)
//   face-calm     → 5 (French Lavender)
//
// Rows inserted with the old mapping now carry a color_index that
// disagrees with their avatar's canonical palette slot. This migration
// rewrites color_index in-place using the avatar as source of truth.
// Rows whose avatar is somehow unknown stay untouched (CASE…ELSE).
export const migration004 = `
UPDATE children
SET color_index = CASE avatar
  WHEN 'face-wink'     THEN 0
  WHEN 'face-dizzy'    THEN 1
  WHEN 'face-cool'     THEN 2
  WHEN 'face-sleep'    THEN 3
  WHEN 'face-surprise' THEN 4
  WHEN 'face-calm'     THEN 5
  ELSE color_index
END;
`;
