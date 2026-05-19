import { supabase } from "./supabase";

export type V2AlbumStickerRow = {
  id: string;
  profile_id: string;
  sticker_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
};

export type V2AlbumState = Record<string, number>;

export async function fetchV2Album(profileId: string) {
  const { data, error } = await supabase
    .from("v2_album_stickers")
    .select("*")
    .eq("profile_id", profileId);

  if (error) {
    console.error("Erro fetchV2Album:", error);
    throw error;
  }

  const state: V2AlbumState = {};

  (data ?? []).forEach((row) => {
    state[row.sticker_id] = row.quantity;
  });

  return state;
}

export async function upsertV2StickerQuantity(
  profileId: string,
  stickerId: string,
  quantity: number
) {
  const safeQuantity = Math.max(0, quantity);

  const { error } = await supabase.from("v2_album_stickers").upsert(
    {
      profile_id: profileId,
      sticker_id: stickerId,
      quantity: safeQuantity,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "profile_id,sticker_id",
    }
  );

  if (error) {
    console.error("Erro upsertV2StickerQuantity:", error);
    throw error;
  }
}

export async function incrementV2StickerQuantity(
  profileId: string,
  stickerId: string,
  currentQuantity: number,
  change: number
) {
  const nextQuantity = Math.max(0, currentQuantity + change);

  await upsertV2StickerQuantity(profileId, stickerId, nextQuantity);

  return nextQuantity;
}