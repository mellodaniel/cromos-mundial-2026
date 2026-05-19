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
  created_at: string | null;
  updated_at: string | null;
};

type RawStockRow = Record<string, any>;

function normalizeStockStatus(value: unknown): V2StockStatus {
  if (value === "available") return "available";
  if (value === "unavailable") return "unavailable";
  return "unknown";
}

function normalizeStockItem(row: RawStockRow): V2StockItem {
  return {
    id: Number(row.id),
    source:
      row.source ??
      row.store ??
      row.store_name ??
      row.shop ??
      row.name ??
      "Loja",
    product:
      row.product ??
      row.product_name ??
      row.title ??
      row.description ??
      null,
    url:
      row.url ??
      row.product_url ??
      row.link ??
      row.href ??
      "#",
    price:
      row.price ??
      row.current_price ??
      row.price_text ??
      null,
    status: normalizeStockStatus(row.status),
    last_checked_at:
      row.last_checked_at ??
      row.checked_at ??
      row.last_check ??
      null,
    last_success_at:
      row.last_success_at ??
      row.success_at ??
      null,
    status_text:
      row.status_text ??
      row.reading_status ??
      row.last_error ??
      row.error ??
      null,
    notes:
      row.notes ??
      row.note ??
      null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export async function fetchV2StockItems() {
  const { data, error } = await supabase
    .from("stock_watch")
    .select("*");

  if (error) {
    console.error("Erro fetchV2StockItems:", error);
    throw error;
  }

  return (data ?? [])
    .map(normalizeStockItem)
    .sort((a, b) =>
      a.source.localeCompare(b.source, "pt", { sensitivity: "base" })
    );
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