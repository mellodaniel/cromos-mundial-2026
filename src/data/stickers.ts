export type AlbumOwner = "diego" | "arthur";

export type Sticker = {
  id: string;
  section: string;
  code: string;
  number: number;
  label: string;
  name: string;
  type: "intro" | "team" | "special";
};

export const USERS: { id: AlbumOwner; name: string }[] = [
  { id: "diego", name: "Diego" },
  { id: "arthur", name: "Arthur" },
];

const COCA_COLA_STICKERS: Sticker[] = [
  { id: "CC-1", section: "Coca-Cola", code: "CC", number: 1, label: "CC1", name: "Lamine Yamal", type: "special" },
  { id: "CC-2", section: "Coca-Cola", code: "CC", number: 2, label: "CC2", name: "Joshua Kimmich", type: "special" },
  { id: "CC-3", section: "Coca-Cola", code: "CC", number: 3, label: "CC3", name: "Eduardo Camavinga", type: "special" },
  { id: "CC-4", section: "Coca-Cola", code: "CC", number: 4, label: "CC4", name: "Joško Gvardiol", type: "special" },
  { id: "CC-5", section: "Coca-Cola", code: "CC", number: 5, label: "CC5", name: "Federico Valverde", type: "special" },
  { id: "CC-6", section: "Coca-Cola", code: "CC", number: 6, label: "CC6", name: "Virgil van Dijk", type: "special" },
  { id: "CC-7", section: "Coca-Cola", code: "CC", number: 7, label: "CC7", name: "Alphonso Davies", type: "special" },
  { id: "CC-8", section: "Coca-Cola", code: "CC", number: 8, label: "CC8", name: "Raúl Jiménez", type: "special" },
  { id: "CC-9", section: "Coca-Cola", code: "CC", number: 9, label: "CC9", name: "William Saliba", type: "special" },
  { id: "CC-10", section: "Coca-Cola", code: "CC", number: 10, label: "CC10", name: "Lautaro Martínez", type: "special" },
  { id: "CC-11", section: "Coca-Cola", code: "CC", number: 11, label: "CC11", name: "Harry Kane", type: "special" },
  { id: "CC-12", section: "Coca-Cola", code: "CC", number: 12, label: "CC12", name: "Antonee Robinson", type: "special" },
];

const TEAMS = [
  { section: "México", code: "MEX" },
  { section: "África do Sul", code: "RSA" },
  { section: "Coreia do Sul", code: "KOR" },
  { section: "Chéquia", code: "CZE" },
  { section: "Canadá", code: "CAN" },
  { section: "Bósnia-Herzegovina", code: "BIH" },
  { section: "Qatar", code: "QAT" },
  { section: "Suíça", code: "SUI" },
  { section: "Brasil", code: "BRA" },
  { section: "Marrocos", code: "MAR" },
  { section: "Haiti", code: "HAI" },
  { section: "Escócia", code: "SCO" },
  { section: "USA", code: "USA" },
  { section: "Austrália", code: "AUS" },
  { section: "Turquia", code: "TUR" },
  { section: "Paraguai", code: "PAR" },
  { section: "Alemanha", code: "GER" },
  { section: "Curaçao", code: "CUW" },
  { section: "Côte d’Ivoire", code: "CIV" },
  { section: "Equador", code: "ECU" },
  { section: "Netherlands", code: "NED" },
  { section: "Japão", code: "JPN" },
  { section: "Suécia", code: "SWE" },
  { section: "Tunísia", code: "TUN" },
  { section: "Bélgica", code: "BEL" },
  { section: "Egito", code: "EGY" },
  { section: "Irão", code: "IRN" },
  { section: "Nova Zelândia", code: "NZL" },
  { section: "Espanha", code: "ESP" },
  { section: "Cabo Verde", code: "CPV" },
  { section: "Arábia Saudita", code: "KSA" },
  { section: "Uruguai", code: "URU" },
  { section: "França", code: "FRA" },
  { section: "Senegal", code: "SEN" },
  { section: "Iraque", code: "IRQ" },
  { section: "Noruega", code: "NOR" },
  { section: "Argentina", code: "ARG" },
  { section: "Argélia", code: "ALG" },

  // Secções adicionais para completar a base inicial.
  { section: "Portugal", code: "POR" },
  { section: "Inglaterra", code: "ENG" },
  { section: "Congo", code: "COD" },
  { section: "Croácia", code: "CRO" },
  { section: "Colômbia", code: "COL" },
  { section: "Uzbekistan", code: "UZB" },
  { section: "Ghana", code: "GHA" },
  { section: "Áustria", code: "AUT" },
  { section: "Jordânia", code: "JOR" },
  { section: "Panama", code: "PAN" },
];

const FWC_STICKERS: Sticker[] = Array.from({ length: 21 }, (_, index) => {
  const number = index;

  return {
    id: `FWC-${number}`,
    section: "FWC / Introdução",
    code: "FWC",
    number,
    label: `FWC ${number}`,
    name: `Cromo introdutório ${number}`,
    type: "intro",
  };
});

function generateTeamStickers(): Sticker[] {
  return TEAMS.flatMap((team) =>
    Array.from({ length: 20 }, (_, index) => {
      const number = index + 1;

      return {
        id: `${team.code}-${number}`,
        section: team.section,
        code: team.code,
        number,
        label: `${team.code} ${number}`,
        name: `${team.code} ${number}`,
        type: "team" as const,
      };
    })
  );
}

export const ALL_STICKERS: Sticker[] = [
  ...FWC_STICKERS,
  ...generateTeamStickers(),
  ...COCA_COLA_STICKERS,
];