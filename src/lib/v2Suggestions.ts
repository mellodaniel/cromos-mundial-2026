import { ALL_STICKERS } from "../data/stickers";
import { supabase } from "./supabase";
import type { V2Profile } from "./v2Auth";

export type V2Suggestion = {
  sticker_id: string;
  offered_by_profile_id: string;
  offered_by_name: string;
  offered_by_username: string;
  available_duplicates: number;
};

export type V2PerfectTradeSuggestion = {
  other_profile_id: string;
  other_name: string;
  other_username: string;
  sticker_i_need_id: string;
  sticker_they_need_id: string;
  other_available_duplicates: number;
  my_available_duplicates: number;
};

type AlbumRow = {
  profile_id: string;
  sticker_id: string;
  quantity: number;
};

type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  role: string;
  is_active: boolean;
};

function buildAlbumMap(rows: AlbumRow[]) {
  const map: Record<string, number> = {};

  rows.forEach((row) => {
    map[row.sticker_id] = row.quantity ?? 0;
  });

  return map;
}

function getQuantity(album: Record<string, number>, stickerId: string) {
  return album[stickerId] ?? 0;
}

async function fetchActiveCollectorsExcept(profileId: string) {
  const { data, error } = await supabase
    .from("v2_profiles")
    .select("id, username, display_name, role, is_active")
    .eq("is_active", true)
    .neq("id", profileId)
    .order("display_name", { ascending: true });

  if (error) {
    console.error("Erro fetchActiveCollectorsExcept:", error);
    throw error;
  }

  return (data ?? []) as ProfileRow[];
}

async function fetchAlbumRowsForProfiles(profileIds: string[]) {
  if (profileIds.length === 0) return [] as AlbumRow[];

  const { data, error } = await supabase
    .from("v2_album_stickers")
    .select("profile_id, sticker_id, quantity")
    .in("profile_id", profileIds);

  if (error) {
    console.error("Erro fetchAlbumRowsForProfiles:", error);
    throw error;
  }

  return (data ?? []) as AlbumRow[];
}

export async function fetchV2SuggestionsForProfile(profile: V2Profile) {
  const otherProfiles = await fetchActiveCollectorsExcept(profile.id);
  const profileIds = [profile.id, ...otherProfiles.map((item) => item.id)];
  const albumRows = await fetchAlbumRowsForProfiles(profileIds);

  const myAlbum = buildAlbumMap(
    albumRows.filter((row) => row.profile_id === profile.id)
  );

  const suggestions: V2Suggestion[] = [];

  otherProfiles.forEach((otherProfile) => {
    const otherAlbum = buildAlbumMap(
      albumRows.filter((row) => row.profile_id === otherProfile.id)
    );

    ALL_STICKERS.forEach((sticker) => {
      const myQuantity = getQuantity(myAlbum, sticker.id);
      const otherQuantity = getQuantity(otherAlbum, sticker.id);
      const availableDuplicates = Math.max(0, otherQuantity - 1);

      if (myQuantity === 0 && availableDuplicates > 0) {
        suggestions.push({
          sticker_id: sticker.id,
          offered_by_profile_id: otherProfile.id,
          offered_by_name: otherProfile.display_name,
          offered_by_username: otherProfile.username,
          available_duplicates: availableDuplicates,
        });
      }
    });
  });

  return suggestions.sort((a, b) => {
    const nameCompare = a.offered_by_name.localeCompare(b.offered_by_name, "pt", {
      sensitivity: "base",
    });

    if (nameCompare !== 0) return nameCompare;

    return a.sticker_id.localeCompare(b.sticker_id, "pt", {
      sensitivity: "base",
    });
  });
}

export async function fetchV2PerfectTradesForProfile(profile: V2Profile) {
  const otherProfiles = await fetchActiveCollectorsExcept(profile.id);
  const profileIds = [profile.id, ...otherProfiles.map((item) => item.id)];
  const albumRows = await fetchAlbumRowsForProfiles(profileIds);

  const myAlbum = buildAlbumMap(
    albumRows.filter((row) => row.profile_id === profile.id)
  );

  const perfectTrades: V2PerfectTradeSuggestion[] = [];

  otherProfiles.forEach((otherProfile) => {
    const otherAlbum = buildAlbumMap(
      albumRows.filter((row) => row.profile_id === otherProfile.id)
    );

    const stickersINeed = ALL_STICKERS.filter((sticker) => {
      const myQuantity = getQuantity(myAlbum, sticker.id);
      const otherQuantity = getQuantity(otherAlbum, sticker.id);

      return myQuantity === 0 && otherQuantity > 1;
    });

    const stickersTheyNeed = ALL_STICKERS.filter((sticker) => {
      const myQuantity = getQuantity(myAlbum, sticker.id);
      const otherQuantity = getQuantity(otherAlbum, sticker.id);

      return myQuantity > 1 && otherQuantity === 0;
    });

    stickersINeed.forEach((stickerINeed) => {
      stickersTheyNeed.forEach((stickerTheyNeed) => {
        perfectTrades.push({
          other_profile_id: otherProfile.id,
          other_name: otherProfile.display_name,
          other_username: otherProfile.username,
          sticker_i_need_id: stickerINeed.id,
          sticker_they_need_id: stickerTheyNeed.id,
          other_available_duplicates: Math.max(
            0,
            getQuantity(otherAlbum, stickerINeed.id) - 1
          ),
          my_available_duplicates: Math.max(
            0,
            getQuantity(myAlbum, stickerTheyNeed.id) - 1
          ),
        });
      });
    });
  });

  return perfectTrades.sort((a, b) => {
    const nameCompare = a.other_name.localeCompare(b.other_name, "pt", {
      sensitivity: "base",
    });

    if (nameCompare !== 0) return nameCompare;

    const stickerNeedCompare = a.sticker_i_need_id.localeCompare(
      b.sticker_i_need_id,
      "pt",
      { sensitivity: "base" }
    );

    if (stickerNeedCompare !== 0) return stickerNeedCompare;

    return a.sticker_they_need_id.localeCompare(b.sticker_they_need_id, "pt", {
      sensitivity: "base",
    });
  });
}