import { ALL_STICKERS } from "../data/stickers";
import { supabase } from "./supabase";
import type { V2Profile } from "./v2Auth";

export type V2CollectorStats = {
  profile: V2Profile;
  owned: number;
  missing: number;
  duplicates: number;
  totalQuantity: number;
  percentage: number;
};

type AlbumRow = {
  profile_id: string;
  sticker_id: string;
  quantity: number;
};

async function fetchAlbumRowsForProfile(profileId: string) {
  const allRows: AlbumRow[] = [];
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from("v2_album_stickers")
      .select("profile_id, sticker_id, quantity")
      .eq("profile_id", profileId)
      .gt("quantity", 0)
      .range(from, to);

    if (error) {
      console.error("Erro fetchAlbumRowsForProfile:", error);
      throw error;
    }

    const rows = (data ?? []) as AlbumRow[];
    allRows.push(...rows);

    hasMore = rows.length === pageSize;
    from += pageSize;
  }

  return allRows;
}

function calculateStats(profile: V2Profile, rows: AlbumRow[], totalStickers: number) {
  const owned = rows.length;

  const totalQuantity = rows.reduce((total, row) => {
    return total + (row.quantity ?? 0);
  }, 0);

  const duplicates = rows.reduce((total, row) => {
    return total + Math.max(0, (row.quantity ?? 0) - 1);
  }, 0);

  const missing = Math.max(0, totalStickers - owned);

  const percentage =
    totalStickers > 0 ? Math.round((owned / totalStickers) * 100) : 0;

  return {
    profile,
    owned,
    missing,
    duplicates,
    totalQuantity,
    percentage,
  };
}

export async function fetchV2CollectorsStats(totalStickers = ALL_STICKERS.length) {
  const { data: profilesData, error: profilesError } = await supabase
    .from("v2_profiles")
    .select("*")
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  if (profilesError) {
    console.error("Erro fetchV2CollectorsStats profiles:", profilesError);
    throw profilesError;
  }

  const profiles = (profilesData ?? []) as V2Profile[];

  const stats = await Promise.all(
    profiles.map(async (profile) => {
      const rows = await fetchAlbumRowsForProfile(profile.id);
      return calculateStats(profile, rows, totalStickers);
    })
  );

  return stats.sort((a, b) => {
    if (b.percentage !== a.percentage) return b.percentage - a.percentage;
    if (b.owned !== a.owned) return b.owned - a.owned;

    return a.profile.display_name.localeCompare(b.profile.display_name, "pt", {
      sensitivity: "base",
    });
  });
}