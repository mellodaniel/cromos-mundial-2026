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

export type V2PerfectTradeSuggestion = {
  other_profile_id: string;
  other_name: string;
  other_username: string;

  sticker_i_need_id: string;
  other_has_quantity: number;
  other_available_duplicates: number;

  sticker_they_need_id: string;
  my_has_quantity: number;
  my_available_duplicates: number;
};

type V2AlbumRow = {
  profile_id: string;
  sticker_id: string;
  quantity: number;
};

export async function fetchV2ActiveProfiles() {
  const { data, error } = await supabase
    .from("v2_profiles")
    .select("*")
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  if (error) {
    console.error("Erro fetchV2ActiveProfiles:", error);
    throw error;
  }

  return (data ?? []) as V2Profile[];
}

export async function fetchV2AllAlbumRows(profileIds: string[]) {
  if (profileIds.length === 0) {
    return [] as V2AlbumRow[];
  }

  const { data, error } = await supabase
    .from("v2_album_stickers")
    .select("profile_id, sticker_id, quantity")
    .in("profile_id", profileIds);

  if (error) {
    console.error("Erro fetchV2AllAlbumRows:", error);
    throw error;
  }

  return (data ?? []) as V2AlbumRow[];
}

async function fetchOpenPlatformData() {
  const profiles = await fetchV2ActiveProfiles();
  const profileIds = profiles.map((profile) => profile.id);
  const rows = await fetchV2AllAlbumRows(profileIds);

  return {
    profiles,
    rows,
  };
}

function buildQuantityMap(rows: V2AlbumRow[]) {
  const map = new Map<string, number>();

  rows.forEach((row) => {
    map.set(`${row.profile_id}:${row.sticker_id}`, row.quantity);
  });

  return map;
}

export async function fetchV2SuggestionsForProfile(profile: V2Profile) {
  const { profiles, rows } = await fetchOpenPlatformData();

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

export async function fetchV2PerfectTradesForProfile(profile: V2Profile) {
  const { profiles, rows } = await fetchOpenPlatformData();
  const quantityMap = buildQuantityMap(rows);

  const otherProfiles = profiles.filter((item) => item.id !== profile.id);

  const myRows = rows.filter((row) => row.profile_id === profile.id);
  const myDuplicates = myRows.filter((row) => row.quantity > 1);

  const perfectTrades: V2PerfectTradeSuggestion[] = [];

  otherProfiles.forEach((otherProfile) => {
    const otherRows = rows.filter((row) => row.profile_id === otherProfile.id);
    const otherDuplicates = otherRows.filter((row) => row.quantity > 1);

    otherDuplicates.forEach((otherDuplicate) => {
      const myQuantityForOtherSticker =
        quantityMap.get(`${profile.id}:${otherDuplicate.sticker_id}`) ?? 0;

      if (myQuantityForOtherSticker > 0) return;

      myDuplicates.forEach((myDuplicate) => {
        const otherQuantityForMySticker =
          quantityMap.get(`${otherProfile.id}:${myDuplicate.sticker_id}`) ?? 0;

        if (otherQuantityForMySticker > 0) return;

        perfectTrades.push({
          other_profile_id: otherProfile.id,
          other_name: otherProfile.display_name,
          other_username: otherProfile.username,

          sticker_i_need_id: otherDuplicate.sticker_id,
          other_has_quantity: otherDuplicate.quantity,
          other_available_duplicates: otherDuplicate.quantity - 1,

          sticker_they_need_id: myDuplicate.sticker_id,
          my_has_quantity: myDuplicate.quantity,
          my_available_duplicates: myDuplicate.quantity - 1,
        });
      });
    });
  });

  return perfectTrades.sort((a, b) =>
    `${a.other_name}-${a.sticker_i_need_id}-${a.sticker_they_need_id}`.localeCompare(
      `${b.other_name}-${b.sticker_i_need_id}-${b.sticker_they_need_id}`,
      "pt",
      { sensitivity: "base" }
    )
  );
}