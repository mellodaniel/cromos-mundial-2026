import { supabase } from "./supabase";

export type StockStatus = "available" | "unavailable" | "unknown";

export type StockWatchItem = {
  id: number;
  source_name: string;
  product_name: string;
  product_url: string;
  status: StockStatus;
  price: string | null;
  last_checked_at: string | null;
  last_success_at: string | null;
  status_text: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchStockWatch() {
  const { data, error } = await supabase
    .from("stock_watch")
    .select("*")
    .order("source_name", { ascending: true });

  if (error) {
    console.error("Erro fetchStockWatch:", error);
    throw error;
  }

  return (data ?? []) as StockWatchItem[];
}