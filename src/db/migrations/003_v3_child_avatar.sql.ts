// v3 — add the `avatar` column to `children`. The new column is NOT NULL
// with a default of 'face-wink' so existing rows fill in automatically;
// new inserts must supply an explicit AvatarKey (see AVATAR_KEYS in
// src/domain/avatar.ts). Pairing rule with color_index is enforced at
// the application layer (kid-edit screen always dispatches both via the
// AVATAR_KEYS index mapping).
export const migration003 = `
ALTER TABLE children ADD COLUMN avatar TEXT NOT NULL DEFAULT 'face-wink';
`;
