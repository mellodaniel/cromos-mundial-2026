import { supabase } from "./supabase";
import type { V2Profile } from "./v2Auth";

export type V2CollectorStats = {
  profile: V2Profile;
  total: number;
  owned: number;
  missing: number;
  duplicates: number;
  percentage: number;
};

type V2AlbumRow = {
  profile_id: string;
  sticker_id: string;
  quantity: number;
};

export async function fetchV2ActiveCollectors() {
  const { data, error } = await supabase
    .from("v2_profiles")
    .select("*")
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  if (error) {
    console.error("Erro fetchV2ActiveCollectors:", error);
    throw error;
  }

  return (data ?? []) as V2Profile[];
}

export async function fetchV2CollectorsAlbumRows(profileIds: string[]) {
  if (profileIds.length === 0) {
    return [] as V2AlbumRow[];
  }

  const { data, error } = await supabase
    .from("v2_album_stickers")
    .select("profile_id, sticker_id, quantity")
    .in("profile_id", profileIds);

  if (error) {
    console.error("Erro fetchV2CollectorsAlbumRows:", error);
    throw error;
  }

  return (data ?? []) as V2AlbumRow[];
}

export async function fetchV2CollectorsStats(totalStickers: number) {
  const collectors = await fetchV2ActiveCollectors();
  const profileIds = collectors.map((collector) => collector.id);
  const albumRows = await fetchV2CollectorsAlbumRows(profileIds);

  const stats: V2CollectorStats[] = collectors.map((collector) => {
    const rows = albumRows.filter((row) => row.profile_id === collector.id);

    let owned = 0;
    let duplicates = 0;

    rows.forEach((row) => {
      if (row.quantity > 0) {
        owned += 1;
      }

      if (row.quantity > 1) {
        duplicates += row.quantity - 1;
      }
    });

    const missing = Math.max(0, totalStickers - owned);
    const percentage =
      totalStickers > 0 ? Math.round((owned / totalStickers) * 100) : 0;

    return {
      profile: collector,
      total: totalStickers,
      owned,
      missing,
      duplicates,
      percentage,
    };
  });

  return stats.sort(
    (a, b) =>
      b.percentage - a.percentage ||
      b.owned - a.owned ||
      a.profile.display_name.localeCompare(b.profile.display_name, "pt", {
        sensitivity: "base",
      })
  );
}