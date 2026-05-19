import { supabase } from "./supabase";
import type { V2Profile } from "./v2Auth";

export type V2Suggestion = {
  sticker_id: string;
  needed_by_profile_id: string;
  offered_by_profile_id: string;
  offered_by_name: string;
  offered_by_username: string;
  offered_by_quantity: number;
  available_duplicates: number;
};

type V2AlbumRow = {
  profile_id: string;
  sticker_id: string;
  quantity: number;
};

export async function fetchV2GroupProfiles(groupId: string) {
  const { data, error } = await supabase
    .from("v2_profiles")
    .select("*")
    .eq("group_id", groupId)
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  if (error) {
    console.error("Erro fetchV2GroupProfiles:", error);
    throw error;
  }

  return (data ?? []) as V2Profile[];
}

export async function fetchV2GroupAlbumRows(groupId: string) {
  const profiles = await fetchV2GroupProfiles(groupId);
  const profileIds = profiles.map((profile) => profile.id);

  if (profileIds.length === 0) {
    return {
      profiles,
      rows: [] as V2AlbumRow[],
    };
  }

  const { data, error } = await supabase
    .from("v2_album_stickers")
    .select("profile_id, sticker_id, quantity")
    .in("profile_id", profileIds);

  if (error) {
    console.error("Erro fetchV2GroupAlbumRows:", error);
    throw error;
  }

  return {
    profiles,
    rows: (data ?? []) as V2AlbumRow[],
  };
}

export async function fetchV2SuggestionsForProfile(profile: V2Profile) {
  if (!profile.group_id) {
    return [];
  }

  const { profiles, rows } = await fetchV2GroupAlbumRows(profile.group_id);

  const currentProfileRows = rows.filter(
    (row) => row.profile_id === profile.id
  );

  const currentProfileQuantities = new Map<string, number>();

  currentProfileRows.forEach((row) => {
    currentProfileQuantities.set(row.sticker_id, row.quantity);
  });

  const suggestions: V2Suggestion[] = [];

  rows.forEach((row) => {
    if (row.profile_id === profile.id) return;
    if (row.quantity <= 1) return;

    const myQuantity = currentProfileQuantities.get(row.sticker_id) ?? 0;

    if (myQuantity > 0) return;

    const offeredBy = profiles.find((item) => item.id === row.profile_id);

    if (!offeredBy) return;

    suggestions.push({
      sticker_id: row.sticker_id,
      needed_by_profile_id: profile.id,
      offered_by_profile_id: row.profile_id,
      offered_by_name: offeredBy.display_name,
      offered_by_username: offeredBy.username,
      offered_by_quantity: row.quantity,
      available_duplicates: row.quantity - 1,
    });
  });

  return suggestions.sort((a, b) =>
    `${a.offered_by_name}-${a.sticker_id}`.localeCompare(
      `${b.offered_by_name}-${b.sticker_id}`,
      "pt",
      { sensitivity: "base" }
    )
  );
}