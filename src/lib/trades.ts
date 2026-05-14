import { supabase, FAMILY_ID, type AlbumOwner } from "./supabase";

export type TradeStatus = "pending" | "reserved" | "cancelled" | "completed";

export type TradeRequest = {
  id: number;
  family_id: string;
  wanted_owner: AlbumOwner;
  wanted_sticker_id: string;
  offered_owner: AlbumOwner | null;
  offered_sticker_code: string;
  person_name: string;
  person_contact: string;
  message: string | null;
  status: TradeStatus;
  created_at: string;
  updated_at: string;
};

export type CreateTradeRequestInput = {
  wanted_owner: AlbumOwner;
  wanted_sticker_id: string;
  offered_owner?: AlbumOwner | null;
  offered_sticker_code: string;
  person_name: string;
  person_contact: string;
  message?: string;
};

export async function fetchTradeRequests() {
  const { data, error } = await supabase
    .from("trade_requests")
    .select("*")
    .eq("family_id", FAMILY_ID)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro fetchTradeRequests:", error);
    throw error;
  }

  return (data ?? []) as TradeRequest[];
}

export async function createTradeRequest(input: CreateTradeRequestInput) {
  const { data, error } = await supabase
    .from("trade_requests")
    .insert({
      family_id: FAMILY_ID,
      wanted_owner: input.wanted_owner,
      wanted_sticker_id: input.wanted_sticker_id,
      offered_owner: input.offered_owner ?? null,
      offered_sticker_code: input.offered_sticker_code.trim().toUpperCase(),
      person_name: input.person_name.trim(),
      person_contact: input.person_contact.trim(),
      message: input.message?.trim() || null,
      status: "pending",
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("Erro createTradeRequest:", error);
    throw error;
  }

  return data as TradeRequest;
}

export async function updateTradeRequestStatus(
  tradeRequestId: number,
  status: TradeStatus
) {
  const { error } = await supabase
    .from("trade_requests")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tradeRequestId)
    .eq("family_id", FAMILY_ID);

  if (error) {
    console.error("Erro updateTradeRequestStatus:", error);
    throw error;
  }
}