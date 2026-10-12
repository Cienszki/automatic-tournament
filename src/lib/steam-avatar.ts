/**
 * Steam serves each avatar in three sizes that differ only by suffix:
 * `<hash>.jpg` (32px), `<hash>_medium.jpg` (64px), `<hash>_full.jpg` (184px).
 * Older rosters stored only the small URL, so the bigger one is derived from it when missing.
 */
type AvatarFields = { avatar?: string | null; avatarmedium?: string | null; avatarfull?: string | null };

// Small avatar = 40-hex hash + .jpg (avatars.steamstatic.com, older steamcdn/akamai URLs alike)
const STEAM_SMALL_AVATAR = /^(https?:\/\/.+\/[0-9a-f]{40})\.jpg$/i;

function derive(small: string | null | undefined, suffix: "_medium" | "_full"): string | undefined {
  const m = small ? STEAM_SMALL_AVATAR.exec(small) : null;
  return m ? `${m[1]}${suffix}.jpg` : undefined;
}

/** Best avatar URL for the given display size ('' when the player has none). */
export function steamAvatarUrl(p: AvatarFields, size: "medium" | "full"): string {
  if (size === "full") {
    return p.avatarfull || derive(p.avatar, "_full") || p.avatarmedium || p.avatar || "";
  }
  return p.avatarmedium || derive(p.avatar, "_medium") || p.avatarfull || p.avatar || "";
}
