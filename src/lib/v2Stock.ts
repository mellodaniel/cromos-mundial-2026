import { supabase } from "./supabase";

export type V2StockStatus = "available" | "unavailable" | "unknown";

export type V2StockItem = {
  id: number;
  source: string;
  product: string | null;
  url: string;
  price: string | null;
  status: V2StockStatus | null;
  last_checked_at: string | null;
  last_success_at: string | null;
  status_text: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchV2StockItems() {
  const { data, error } = await supabase
    .from("stock_watch")
    .select("*")
    .order("source", { ascending: true });

  if (error) {
    console.error("Erro fetchV2StockItems:", error);
    throw error;
  }

  return (data ?? []) as V2StockItem[];
}

export async function runV2StockCheck() {
  const { data, error } = await supabase.functions.invoke("check-stock", {
    body: {
      source: "v2-app",
    },
  });

  if (error) {
    console.error("Erro runV2StockCheck:", error);
    throw error;
  }

  if (!data?.ok) {
    throw new Error(data?.error ?? "Não foi possível verificar o stock agora.");
  }

  return data;
}