import type { V2AlbumState } from "./v2Album";
import type { V2Profile } from "./v2Auth";
import type { Sticker } from "../data/stickers";

export type V2DuplicateSticker = {
  sticker: Sticker;
  quantity: number;
  duplicates: number;
};

const COUNTRY_FLAGS: Record<string, string> = {
  "portugal": "🇵🇹",
  "brasil": "🇧🇷",
  "brazil": "🇧🇷",
  "argentina": "🇦🇷",
  "espanha": "🇪🇸",
  "spain": "🇪🇸",
  "frança": "🇫🇷",
  "france": "🇫🇷",
  "alemanha": "🇩🇪",
  "germany": "🇩🇪",
  "itália": "🇮🇹",
  "italia": "🇮🇹",
  "italy": "🇮🇹",
  "inglaterra": "🏴",
  "england": "🏴",
  "holanda": "🇳🇱",
  "netherlands": "🇳🇱",
  "países baixos": "🇳🇱",
  "paises baixos": "🇳🇱",
  "uruguai": "🇺🇾",
  "uruguay": "🇺🇾",
  "croácia": "🇭🇷",
  "croacia": "🇭🇷",
  "croatia": "🇭🇷",
  "bélgica": "🇧🇪",
  "belgica": "🇧🇪",
  "belgium": "🇧🇪",
  "suíça": "🇨🇭",
  "suica": "🇨🇭",
  "switzerland": "🇨🇭",
  "dinamarca": "🇩🇰",
  "denmark": "🇩🇰",
  "méxico": "🇲🇽",
  "mexico": "🇲🇽",
  "eua": "🇺🇸",
  "usa": "🇺🇸",
  "united states": "🇺🇸",
  "estados unidos": "🇺🇸",
  "canadá": "🇨🇦",
  "canada": "🇨🇦",
  "japão": "🇯🇵",
  "japao": "🇯🇵",
  "japan": "🇯🇵",
  "coreia": "🇰🇷",
  "coreia do sul": "🇰🇷",
  "south korea": "🇰🇷",
  "marrocos": "🇲🇦",
  "morocco": "🇲🇦",
  "senegal": "🇸🇳",
  "gana": "🇬🇭",
  "ghana": "🇬🇭",
  "camarões": "🇨🇲",
  "camaroes": "🇨🇲",
  "cameroon": "🇨🇲",
  "tunísia": "🇹🇳",
  "tunisia": "🇹🇳",
  "austrália": "🇦🇺",
  "australia": "🇦🇺",
  "irã": "🇮🇷",
  "ira": "🇮🇷",
  "iran": "🇮🇷",
  "arábia saudita": "🇸🇦",
  "arabia saudita": "🇸🇦",
  "saudi arabia": "🇸🇦",
  "catar": "🇶🇦",
  "qatar": "🇶🇦",
  "polónia": "🇵🇱",
  "polonia": "🇵🇱",
  "poland": "🇵🇱",
  "sérvia": "🇷🇸",
  "servia": "🇷🇸",
  "serbia": "🇷🇸",
  "equador": "🇪🇨",
  "ecuador": "🇪🇨",
  "austria": "🇦🇹",
  "áustria": "🇦🇹",
  "turquia": "🇹🇷",
  "türkiye": "🇹🇷",
  "turkey": "🇹🇷",
  "noruega": "🇳🇴",
  "norway": "🇳🇴",
  "argélia": "🇩🇿",
  "argelia": "🇩🇿",
  "algeria": "🇩🇿",
};

const COUNTRY_CODE_FLAGS: Record<string, string> = {
  "POR": "🇵🇹",
  "BRA": "🇧🇷",
  "ARG": "🇦🇷",
  "ESP": "🇪🇸",
  "SPA": "🇪🇸",
  "FRA": "🇫🇷",
  "GER": "🇩🇪",
  "DEU": "🇩🇪",
  "ITA": "🇮🇹",
  "ENG": "🏴",
  "NED": "🇳🇱",
  "HOL": "🇳🇱",
  "URU": "🇺🇾",
  "CRO": "🇭🇷",
  "BEL": "🇧🇪",
  "SUI": "🇨🇭",
  "DEN": "🇩🇰",
  "MEX": "🇲🇽",
  "USA": "🇺🇸",
  "CAN": "🇨🇦",
  "JPN": "🇯🇵",
  "KOR": "🇰🇷",
  "MAR": "🇲🇦",
  "SEN": "🇸🇳",
  "GHA": "🇬🇭",
  "CMR": "🇨🇲",
  "TUN": "🇹🇳",
  "AUS": "🇦🇺",
  "IRN": "🇮🇷",
  "KSA": "🇸🇦",
  "QAT": "🇶🇦",
  "POL": "🇵🇱",
  "SRB": "🇷🇸",
  "ECU": "🇪🇨",
  "AUT": "🇦🇹",
  "TUR": "🇹🇷",
  "NOR": "🇳🇴",
  "ALG": "🇩🇿",
};

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function getV2StickerFlag(sticker: Sticker) {
  const sectionKey = normalizeText(sticker.section);
  const codePrefix = sticker.label.split(" ")[0]?.toUpperCase();

  if (codePrefix && COUNTRY_CODE_FLAGS[codePrefix]) {
    return COUNTRY_CODE_FLAGS[codePrefix];
  }

  if (COUNTRY_FLAGS[sectionKey]) {
    return COUNTRY_FLAGS[sectionKey];
  }

  const foundKey = Object.keys(COUNTRY_FLAGS).find((country) =>
    sectionKey.includes(normalizeText(country))
  );

  if (foundKey) {
    return COUNTRY_FLAGS[foundKey];
  }

  return "🏆";
}

export function getV2DuplicateStickers(
  stickers: Sticker[],
  album: V2AlbumState
): V2DuplicateSticker[] {
  return stickers
    .map((sticker) => {
      const quantity = album[sticker.id] ?? 0;

      return {
        sticker,
        quantity,
        duplicates: Math.max(0, quantity - 1),
      };
    })
    .filter((item) => item.duplicates > 0)
    .sort((a, b) => {
      const sectionCompare = a.sticker.section.localeCompare(
        b.sticker.section,
        "pt",
        { sensitivity: "base" }
      );

      if (sectionCompare !== 0) return sectionCompare;

      return a.sticker.label.localeCompare(b.sticker.label, "pt", {
        sensitivity: "base",
      });
    });
}

export function buildV2ShareMessage(
  profile: V2Profile,
  duplicates: V2DuplicateSticker[]
) {
  const totalDuplicates = duplicates.reduce(
    (total, item) => total + item.duplicates,
    0
  );

  const lines = duplicates.map((item) => {
    const flag = getV2StickerFlag(item.sticker);

    return `- ${flag} ${item.sticker.label} · ${item.sticker.name} (${item.sticker.section}) x${item.duplicates}`;
  });

  return [
    `Olá! Tenho ${totalDuplicates} cromo(s) repetido(s) para troca no Mundial FIFA 2026.`,
    ``,
    `Repetidos de ${profile.display_name}:`,
    ...lines,
    ``,
    `Também podes usar a app Cromos & Trocas para controlar a tua caderneta e encontrar trocas automaticamente.`,
  ].join("\n");
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

export async function generateV2DuplicatesImage(
  profile: V2Profile,
  duplicates: V2DuplicateSticker[]
) {
  const totalDuplicates = duplicates.reduce(
    (total, item) => total + item.duplicates,
    0
  );

  const maxItems = 34;
  const visibleItems = duplicates.slice(0, maxItems);
  const remainingItems = Math.max(0, duplicates.length - visibleItems.length);

  const width = 1080;
  const padding = 64;
  const headerHeight = 270;
  const itemHeight = 76;
  const footerHeight = 210;
  const height =
    headerHeight + visibleItems.length * itemHeight + footerHeight + padding;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Não foi possível gerar a imagem.");
  }

  ctx.fillStyle = "#0f2f57";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#f7c948";
  roundRect(ctx, padding, padding, width - padding * 2, 150, 34);
  ctx.fill();

  ctx.fillStyle = "#0f2f57";
  ctx.font = "900 54px Arial";
  ctx.fillText("Cromos & Trocas", padding + 42, padding + 66);

  ctx.font = "800 34px Arial";
  ctx.fillText("Mundial FIFA 2026", padding + 42, padding + 115);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 46px Arial";
  ctx.fillText(`Repetidos de ${profile.display_name}`, padding, 270);

  ctx.font = "700 30px Arial";
  ctx.fillStyle = "#dbeafe";
  ctx.fillText(
    `${totalDuplicates} cromo(s) repetido(s) disponíveis para troca`,
    padding,
    318
  );

  let y = 370;

  visibleItems.forEach((item) => {
    const flag = getV2StickerFlag(item.sticker);

    ctx.fillStyle = "#ffffff";
    roundRect(ctx, padding, y, width - padding * 2, 58, 18);
    ctx.fill();

    ctx.fillStyle = "#e8f1fb";
    roundRect(ctx, padding + 18, y + 12, 150, 34, 17);
    ctx.fill();

    ctx.fillStyle = "#0f2f57";
    ctx.font = "900 20px Arial";
    ctx.fillText(`${flag} ${item.sticker.label}`, padding + 32, y + 36);

    ctx.fillStyle = "#0f2f57";
    ctx.font = "800 24px Arial";

    const nameLines = wrapText(
      ctx,
      `${item.sticker.name} · ${item.sticker.section}`,
      600
    );

    ctx.fillText(nameLines[0], padding + 190, y + 37);

    ctx.fillStyle = "#f7c948";
    roundRect(ctx, width - padding - 100, y + 10, 82, 38, 19);
    ctx.fill();

    ctx.fillStyle = "#0f2f57";
    ctx.font = "900 24px Arial";
    ctx.fillText(`x${item.duplicates}`, width - padding - 72, y + 37);

    y += itemHeight;
  });

  if (remainingItems > 0) {
    ctx.fillStyle = "#dbeafe";
    ctx.font = "800 28px Arial";
    ctx.fillText(
      `+ ${remainingItems} outro(s) cromo(s) repetido(s)`,
      padding,
      y + 12
    );
    y += 52;
  }

  ctx.fillStyle = "#f7c948";
  roundRect(ctx, padding, y + 20, width - padding * 2, 120, 28);
  ctx.fill();

  ctx.fillStyle = "#0f2f57";
  ctx.font = "900 30px Arial";
  ctx.fillText("Queres controlar a tua caderneta também?", padding + 34, y + 68);

  ctx.font = "700 24px Arial";
  ctx.fillText(
    "Usa a app Cromos & Trocas e encontra trocas automaticamente.",
    padding + 34,
    y + 104
  );

  return canvas.toDataURL("image/png");
}

export function downloadV2Image(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}