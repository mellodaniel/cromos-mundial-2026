import { useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { createWorker } from "tesseract.js";
import "./index.css";
import {
  ALL_STICKERS,
  USERS,
  type AlbumOwner,
  type Sticker,
} from "./data/stickers";

type FilterType = "all" | "owned" | "missing" | "duplicates";
type ShareType = "duplicates" | "missing-diego" | "missing-arthur" | null;
type ReportTab = "missing" | "duplicates" | "exchange";
type AccordionSection =
  | "manage"
  | "reports"
  | "progress"
  | "share"
  | "backup"
  | "history";

type CollectionState = Record<string, { diego: number; arthur: number }>;

type ParsedCodesResult = {
  valid: Sticker[];
  invalid: string[];
};

type LastAddResult = {
  title: string;
  added: Sticker[];
  newStickers: Sticker[];
  repeatedStickers: Sticker[];
};

type HistoryEntry = {
  id: string;
  date: string;
  text: string;
};

type ImportMode = "replace" | "merge";

const STORAGE_KEY = "cromos-mundial-2026-state-v1";
const HISTORY_KEY = "cromos-mundial-2026-history-v1";
const MAX_HISTORY = 40;
const MAX_UNDO = 20;

function loadInitialState(): CollectionState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    console.warn("Não foi possível carregar os dados guardados.");
  }

  return {};
}

function loadHistory(): HistoryEntry[] {
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    console.warn("Não foi possível carregar o histórico.");
  }

  return [];
}

function saveState(state: CollectionState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function saveHistory(history: HistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function getQuantity(
  state: CollectionState,
  stickerId: string,
  owner: AlbumOwner
) {
  return state[stickerId]?.[owner] ?? 0;
}

function getStatus(quantity: number) {
  if (quantity === 0) return "Falta";
  if (quantity === 1) return "Tenho";
  return "Repetido";
}

function normalizeCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[_–—]/g, "-")
    .replace(/\s+/g, " ");
}

function parseStickerCodes(input: string): ParsedCodesResult {
  const stickerMap = new Map<string, Sticker>();

  ALL_STICKERS.forEach((sticker) => {
    stickerMap.set(`${sticker.code}-${sticker.number}`, sticker);
    stickerMap.set(`${sticker.code} ${sticker.number}`, sticker);
    stickerMap.set(`${sticker.code}${sticker.number}`, sticker);
    stickerMap.set(sticker.label.toUpperCase(), sticker);
  });

  const matches = input
    .toUpperCase()
    .replace(/CC\s+/g, "CC")
    .match(/\b(FWC|[A-Z]{2,3})[\s-]?\d{1,2}\b/g);

  if (!matches) return { valid: [], invalid: [] };

  const valid: Sticker[] = [];
  const invalid: string[] = [];
  const alreadyAdded = new Set<string>();

  matches.forEach((rawCode) => {
    const normalized = normalizeCode(rawCode).replace(/^CC\s?/, "CC");
    const codeMatch = normalized.match(/^([A-Z]{2,3}|FWC)[\s-]?(\d{1,2})$/);

    if (!codeMatch) {
      invalid.push(rawCode);
      return;
    }

    const code = codeMatch[1];
    const number = Number(codeMatch[2]);

    const possibleKeys = [
      `${code}-${number}`,
      `${code} ${number}`,
      `${code}${number}`,
    ];

    let sticker: Sticker | undefined;

    for (const key of possibleKeys) {
      sticker = stickerMap.get(key);
      if (sticker) break;
    }

    if (!sticker && code === "CC") {
      sticker = stickerMap.get(`CC${number}`) ?? stickerMap.get(`CC-${number}`);
    }

    if (!sticker) {
      invalid.push(rawCode);
      return;
    }

    if (!alreadyAdded.has(sticker.id)) {
      valid.push(sticker);
      alreadyAdded.add(sticker.id);
    }
  });

  return { valid, invalid };
}

function formatCodes(stickers: Sticker[]) {
  return stickers.map((sticker) => sticker.label).join(", ");
}

function groupBySection(stickers: Sticker[]) {
  return stickers.reduce<Record<string, Sticker[]>>((groups, sticker) => {
    if (!groups[sticker.section]) groups[sticker.section] = [];
    groups[sticker.section].push(sticker);
    return groups;
  }, {});
}

function App() {
  const [owner, setOwner] = useState<AlbumOwner>("diego");
  const [state, setState] = useState<CollectionState>(() => loadInitialState());
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [undoStack, setUndoStack] = useState<CollectionState[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>("Todas");
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [shareType, setShareType] = useState<ShareType>(null);
  const [reportTab, setReportTab] = useState<ReportTab>("missing");
  const [quickInput, setQuickInput] = useState("");
  const [quickValid, setQuickValid] = useState<Sticker[]>([]);
  const [quickInvalid, setQuickInvalid] = useState<string[]>([]);
  const [ocrText, setOcrText] = useState("");
  const [ocrReview, setOcrReview] = useState<Sticker[]>([]);
  const [ocrInvalid, setOcrInvalid] = useState<string[]>([]);
  const [isReadingImage, setIsReadingImage] = useState(false);
  const [lastAddResult, setLastAddResult] = useState<LastAddResult | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>("replace");
  const [copyFeedback, setCopyFeedback] = useState("");
  const [openSections, setOpenSections] = useState<
    Record<AccordionSection, boolean>
  >({
    manage: true,
    reports: false,
    progress: false,
    share: false,
    backup: false,
    history: false,
  });

  const shareCardRef = useRef<HTMLDivElement | null>(null);

  const sections = useMemo(() => {
    return ["Todas", ...Array.from(new Set(ALL_STICKERS.map((s) => s.section)))];
  }, []);

  const currentUserName =
    USERS.find((user) => user.id === owner)?.name ?? "Diego";

  const addHistoryEntry = (text: string) => {
    const entry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      date: new Date().toISOString(),
      text,
    };

    setHistory((current) => {
      const next = [entry, ...current].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  };

  const commitState = (
    producer: (current: CollectionState) => CollectionState,
    historyText?: string
  ) => {
    setState((current) => {
      const next = producer(current);

      setUndoStack((stack) => [current, ...stack].slice(0, MAX_UNDO));
      saveState(next);

      if (historyText) addHistoryEntry(historyText);

      return next;
    });
  };

  const undoLastAction = () => {
    const previous = undoStack[0];

    if (!previous) {
      alert("Não há alterações para desfazer.");
      return;
    }

    setUndoStack((current) => current.slice(1));
    setState(previous);
    saveState(previous);
    addHistoryEntry("Última alteração desfeita");
  };

  const toggleSection = (section: AccordionSection) => {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const addStickersToOwner = (
    stickers: Sticker[],
    ownerId: AlbumOwner,
    source: string
  ) => {
    if (stickers.length === 0) return;

    const newStickers: Sticker[] = [];
    const repeatedStickers: Sticker[] = [];

    stickers.forEach((sticker) => {
      const currentQty = getQuantity(state, sticker.id, ownerId);
      if (currentQty === 0) newStickers.push(sticker);
      else repeatedStickers.push(sticker);
    });

    commitState(
      (current) => {
        const nextState: CollectionState = { ...current };

        stickers.forEach((sticker) => {
          const currentQty = getQuantity(nextState, sticker.id, ownerId);

          nextState[sticker.id] = {
            diego: nextState[sticker.id]?.diego ?? 0,
            arthur: nextState[sticker.id]?.arthur ?? 0,
            [ownerId]: currentQty + 1,
          };
        });

        return nextState;
      },
      `${source}: ${stickers.length} cromo(s) adicionados ao ${currentUserName}`
    );

    setLastAddResult({
      title: `${stickers.length} cromo(s) adicionados ao ${currentUserName}`,
      added: stickers,
      newStickers,
      repeatedStickers,
    });
  };

  const updateQuantity = (
    stickerId: string,
    ownerId: AlbumOwner,
    change: number
  ) => {
    const sticker = ALL_STICKERS.find((item) => item.id === stickerId);

    commitState(
      (current) => {
        const currentQty = getQuantity(current, stickerId, ownerId);
        const nextQty = Math.max(0, currentQty + change);

        return {
          ...current,
          [stickerId]: {
            diego: current[stickerId]?.diego ?? 0,
            arthur: current[stickerId]?.arthur ?? 0,
            [ownerId]: nextQty,
          },
        };
      },
      `${currentUserName}: ${change > 0 ? "adicionou" : "removeu"} ${
        sticker?.label ?? stickerId
      }`
    );
  };

  const handleQuickInputChange = (value: string) => {
    setQuickInput(value);
    const result = parseStickerCodes(value);
    setQuickValid(result.valid);
    setQuickInvalid(result.invalid);
  };

  const confirmQuickAdd = () => {
    addStickersToOwner(quickValid, owner, "Entrada rápida por texto");
    setQuickInput("");
    setQuickValid([]);
    setQuickInvalid([]);
  };

  const handleImageUpload = async (file: File | null) => {
    if (!file) return;

    setIsReadingImage(true);
    setOcrText("");
    setOcrReview([]);
    setOcrInvalid([]);

    try {
      const worker = await createWorker("eng");
      const result = await worker.recognize(file);
      await worker.terminate();

      const text = result.data.text;
      const parsed = parseStickerCodes(text);

      setOcrText(text);
      setOcrReview(parsed.valid);
      setOcrInvalid(parsed.invalid);
    } catch (error) {
      console.error(error);
      alert("Não foi possível ler a imagem. Tenta com uma foto mais nítida.");
    } finally {
      setIsReadingImage(false);
    }
  };

  const removeOcrReviewSticker = (stickerId: string) => {
    setOcrReview((current) =>
      current.filter((sticker) => sticker.id !== stickerId)
    );
  };

  const confirmOcrAdd = () => {
    addStickersToOwner(ocrReview, owner, "Entrada rápida por imagem");
    setOcrText("");
    setOcrReview([]);
    setOcrInvalid([]);
  };

  const resetAll = () => {
    const confirmReset = window.confirm(
      "Tens a certeza que queres apagar todos os dados?"
    );

    if (!confirmReset) return;

    setUndoStack((stack) => [state, ...stack].slice(0, MAX_UNDO));
    localStorage.removeItem(STORAGE_KEY);
    setState({});
    addHistoryEntry("Todos os dados foram apagados");
  };

  const exportBackup = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      app: "Cromos Mundial 2026",
      version: 1,
      collection: state,
    };

    const file = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(file);
    const link = document.createElement("a");

    link.href = url;
    link.download = "backup-cromos-mundial-2026.json";
    link.click();

    URL.revokeObjectURL(url);
    addHistoryEntry("Backup exportado");
  };

  const mergeStates = (
    currentState: CollectionState,
    importedState: CollectionState
  ): CollectionState => {
    const allIds = new Set([
      ...Object.keys(currentState),
      ...Object.keys(importedState),
    ]);

    const merged: CollectionState = {};

    allIds.forEach((id) => {
      merged[id] = {
        diego: Math.max(
          currentState[id]?.diego ?? 0,
          importedState[id]?.diego ?? 0
        ),
        arthur: Math.max(
          currentState[id]?.arthur ?? 0,
          importedState[id]?.arthur ?? 0
        ),
      };
    });

    return merged;
  };

  const importBackup = (file: File | null) => {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const importedState: CollectionState = parsed.collection ?? parsed;

        commitState(
          (current) =>
            importMode === "merge"
              ? mergeStates(current, importedState)
              : importedState,
          importMode === "merge"
            ? "Backup importado e juntado aos dados atuais"
            : "Backup importado e substituiu os dados atuais"
        );

        alert(
          importMode === "merge"
            ? "Backup juntado com sucesso."
            : "Backup importado com sucesso."
        );
      } catch {
        alert("Erro ao importar backup. Verifica se o ficheiro é válido.");
      }
    };

    reader.readAsText(file);
  };

  const filteredStickers = useMemo(() => {
    return ALL_STICKERS.filter((sticker) => {
      const quantity = getQuantity(state, sticker.id, owner);
      const normalizedSearch = search.trim().toLowerCase();

      const matchesSection =
        selectedSection === "Todas" || sticker.section === selectedSection;

      const matchesSearch =
        !normalizedSearch ||
        sticker.label.toLowerCase().includes(normalizedSearch) ||
        sticker.name.toLowerCase().includes(normalizedSearch) ||
        sticker.section.toLowerCase().includes(normalizedSearch) ||
        sticker.code.toLowerCase().includes(normalizedSearch);

      const matchesFilter =
        filter === "all" ||
        (filter === "owned" && quantity > 0) ||
        (filter === "missing" && quantity === 0) ||
        (filter === "duplicates" && quantity > 1);

      return matchesSection && matchesSearch && matchesFilter;
    });
  }, [state, owner, selectedSection, search, filter]);

  const summary = useMemo(() => {
    const total = ALL_STICKERS.length;
    let owned = 0;
    let missing = 0;
    let duplicates = 0;

    ALL_STICKERS.forEach((sticker) => {
      const quantity = getQuantity(state, sticker.id, owner);

      if (quantity > 0) owned += 1;
      if (quantity === 0) missing += 1;
      if (quantity > 1) duplicates += quantity - 1;
    });

    return {
      total,
      owned,
      missing,
      duplicates,
      percentage: total > 0 ? Math.round((owned / total) * 100) : 0,
    };
  }, [state, owner]);

  const makeUserSummary = (ownerId: AlbumOwner) => {
    const total = ALL_STICKERS.length;
    let owned = 0;
    let missing = 0;
    let duplicates = 0;

    ALL_STICKERS.forEach((sticker) => {
      const quantity = getQuantity(state, sticker.id, ownerId);

      if (quantity > 0) owned += 1;
      if (quantity === 0) missing += 1;
      if (quantity > 1) duplicates += quantity - 1;
    });

    return {
      total,
      owned,
      missing,
      duplicates,
      percentage: total > 0 ? Math.round((owned / total) * 100) : 0,
    };
  };

  const diegoSummary = useMemo(() => makeUserSummary("diego"), [state]);
  const arthurSummary = useMemo(() => makeUserSummary("arthur"), [state]);

  const missingList = useMemo(() => {
    return ALL_STICKERS.filter(
      (sticker) => getQuantity(state, sticker.id, owner) === 0
    );
  }, [state, owner]);

  const duplicateList = useMemo(() => {
    return ALL_STICKERS.filter(
      (sticker) => getQuantity(state, sticker.id, owner) > 1
    );
  }, [state, owner]);

  const exchangeSuggestions = useMemo(() => {
    const diegoCanGiveToArthur: Sticker[] = [];
    const arthurCanGiveToDiego: Sticker[] = [];

    ALL_STICKERS.forEach((sticker) => {
      const diegoQty = getQuantity(state, sticker.id, "diego");
      const arthurQty = getQuantity(state, sticker.id, "arthur");

      if (diegoQty > 1 && arthurQty === 0) {
        diegoCanGiveToArthur.push(sticker);
      }

      if (arthurQty > 1 && diegoQty === 0) {
        arthurCanGiveToDiego.push(sticker);
      }
    });

    return {
      diegoCanGiveToArthur,
      arthurCanGiveToDiego,
    };
  }, [state]);

  const sectionProgress = useMemo(() => {
    return sections
      .filter((section) => section !== "Todas")
      .map((section) => {
        const stickers = ALL_STICKERS.filter(
          (sticker) => sticker.section === section
        );

        const owned = stickers.filter(
          (sticker) => getQuantity(state, sticker.id, owner) > 0
        ).length;

        const total = stickers.length;
        const missing = total - owned;
        const percentage = total > 0 ? Math.round((owned / total) * 100) : 0;

        return { section, owned, total, missing, percentage };
      })
      .sort((a, b) => b.percentage - a.percentage);
  }, [sections, state, owner]);

  const nearlyComplete = useMemo(() => {
    return sectionProgress
      .filter((item) => item.missing > 0 && item.owned > 0)
      .sort((a, b) => a.missing - b.missing || b.percentage - a.percentage)
      .slice(0, 8);
  }, [sectionProgress]);

  const buildMissingText = (ownerId: AlbumOwner) => {
    const userName = USERS.find((user) => user.id === ownerId)?.name ?? ownerId;
    const stickers = ALL_STICKERS.filter(
      (sticker) => getQuantity(state, sticker.id, ownerId) === 0
    );

    return `Cromos que faltam ao ${userName} — Mundial 2026\n\n${formatCodes(
      stickers
    )}\n\nQuem tiver para trocar, fala comigo ⚽`;
  };

  const buildDuplicatesText = (ownerId: AlbumOwner) => {
    const userName = USERS.find((user) => user.id === ownerId)?.name ?? ownerId;
    const stickers = ALL_STICKERS.filter(
      (sticker) => getQuantity(state, sticker.id, ownerId) > 1
    );

    const codes = stickers
      .map((sticker) => {
        const quantity = getQuantity(state, sticker.id, ownerId);
        return `${sticker.label} +${quantity - 1}`;
      })
      .join(", ");

    return `Cromos repetidos do ${userName} — Mundial 2026\n\n${
      codes || "Ainda não há repetidos."
    }\n\nQuem quiser trocar, fala comigo ⚽`;
  };

  const buildExchangeText = () => {
    return `Trocas possíveis entre Diego e Arthur — Mundial 2026\n\nDiego pode dar ao Arthur:\n${
      formatCodes(exchangeSuggestions.diegoCanGiveToArthur) || "Nenhum"
    }\n\nArthur pode dar ao Diego:\n${
      formatCodes(exchangeSuggestions.arthurCanGiveToDiego) || "Nenhum"
    }`;
  };

  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(`${label} copiado.`);
      addHistoryEntry(`${label} copiado para partilha`);
      setTimeout(() => setCopyFeedback(""), 2500);
    } catch {
      alert("Não foi possível copiar. Tenta novamente.");
    }
  };

  const downloadShareImage = async (
    type: "duplicates" | "missing-diego" | "missing-arthur"
  ) => {
    setShareType(type);

    setTimeout(async () => {
      if (!shareCardRef.current) return;

      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: "#f4f0f8",
        scale: 2,
      });

      const link = document.createElement("a");

      const fileName =
        type === "duplicates"
          ? "cromos-repetidos-mundial-2026.png"
          : type === "missing-diego"
          ? "faltam-diego-mundial-2026.png"
          : "faltam-arthur-mundial-2026.png";

      link.download = fileName;
      link.href = canvas.toDataURL("image/png");
      link.click();

      setShareType(null);
      addHistoryEntry(`Imagem gerada: ${fileName}`);
    }, 150);
  };

  const shareMissingDiego = ALL_STICKERS.filter(
    (sticker) => getQuantity(state, sticker.id, "diego") === 0
  );
  const shareMissingArthur = ALL_STICKERS.filter(
    (sticker) => getQuantity(state, sticker.id, "arthur") === 0
  );
  const shareDuplicatesDiego = ALL_STICKERS.filter(
    (sticker) => getQuantity(state, sticker.id, "diego") > 1
  );
  const shareDuplicatesArthur = ALL_STICKERS.filter(
    (sticker) => getQuantity(state, sticker.id, "arthur") > 1
  );

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Caderneta Panini</p>
          <h1>Cromos Mundial 2026</h1>
          <p className="subtitle">
            Controlo simples das cadernetas do Diego e do Arthur.
          </p>
        </div>

        <div className="owner-switch">
          {USERS.map((user) => (
            <button
              key={user.id}
              className={owner === user.id ? "active" : ""}
              onClick={() => setOwner(user.id)}
            >
              {user.name}
            </button>
          ))}
        </div>
      </header>

      <section className="compact-summary card">
        <div>
          <span className="summary-label">Caderneta</span>
          <strong>{currentUserName}</strong>
        </div>

        <div>
          <span className="summary-label">Já tem</span>
          <strong>{summary.owned}</strong>
        </div>

        <div>
          <span className="summary-label">Faltam</span>
          <strong>{summary.missing}</strong>
        </div>

        <div>
          <span className="summary-label">Repetidos</span>
          <strong>{summary.duplicates}</strong>
        </div>

        <div className="summary-highlight">
          <span className="summary-label">Completo</span>
          <strong>{summary.percentage}%</strong>
        </div>
      </section>

      <section className="progress-card card">
        <div className="progress-header">
          <strong>Progresso da caderneta do {currentUserName}</strong>
          <span>
            {summary.owned} de {summary.total}
          </span>
        </div>

        <div className="progress-bar">
          <div style={{ width: `${summary.percentage}%` }} />
        </div>
      </section>

      <section className="compare-card card">
        <div className="compare-item">
          <strong>Diego</strong>
          <span>{diegoSummary.percentage}% completo</span>
          <div className="mini-progress">
            <div style={{ width: `${diegoSummary.percentage}%` }} />
          </div>
          <small>
            {diegoSummary.owned} tem · {diegoSummary.missing} faltam ·{" "}
            {diegoSummary.duplicates} repetidos
          </small>
        </div>

        <div className="compare-item">
          <strong>Arthur</strong>
          <span>{arthurSummary.percentage}% completo</span>
          <div className="mini-progress">
            <div style={{ width: `${arthurSummary.percentage}%` }} />
          </div>
          <small>
            {arthurSummary.owned} tem · {arthurSummary.missing} faltam ·{" "}
            {arthurSummary.duplicates} repetidos
          </small>
        </div>
      </section>

      <section className="quick-actions">
        <button onClick={() => toggleSection("manage")}>
          Adicionar cromos
        </button>
        <button
          onClick={() => {
            setReportTab("missing");
            setOpenSections((current) => ({ ...current, reports: true }));
          }}
        >
          Ver faltas
        </button>
        <button
          onClick={() => {
            setReportTab("duplicates");
            setOpenSections((current) => ({ ...current, reports: true }));
          }}
        >
          Ver repetidos
        </button>
        <button onClick={undoLastAction}>Desfazer</button>
      </section>

      <section className="accordion">
        <div className="accordion-item card">
          <button
            className="accordion-header"
            onClick={() => toggleSection("manage")}
          >
            <span>Adicionar / atualizar cromos</span>
            <strong>{openSections.manage ? "−" : "+"}</strong>
          </button>

          {openSections.manage && (
            <div className="accordion-content">
              <section className="quick-add-panel">
                <div className="quick-add-box">
                  <h2>Entrada rápida por texto</h2>
                  <p>
                    Escreve códigos como <strong>BRA 10</strong>,{" "}
                    <strong>ARG 17</strong>, <strong>CC1</strong> ou{" "}
                    <strong>FWC 7</strong>.
                  </p>

                  <textarea
                    value={quickInput}
                    onChange={(event) =>
                      handleQuickInputChange(event.target.value)
                    }
                    placeholder="Ex: BRA 10, ARG 17, CC1, FWC 7"
                  />

                  <div className="quick-results">
                    <strong>Válidos: {quickValid.length}</strong>
                    <strong>Inválidos: {quickInvalid.length}</strong>
                  </div>

                  {quickValid.length > 0 && (
                    <div className="mini-list quick-list">
                      {quickValid.map((sticker) => (
                        <span key={sticker.id}>{sticker.label}</span>
                      ))}
                    </div>
                  )}

                  {quickInvalid.length > 0 && (
                    <div className="invalid-list">
                      Não encontrados: {quickInvalid.join(", ")}
                    </div>
                  )}

                  <button
                    className="primary-action"
                    onClick={confirmQuickAdd}
                    disabled={quickValid.length === 0}
                  >
                    Adicionar à caderneta do {currentUserName}
                  </button>
                </div>

                <div className="quick-add-box">
                  <h2>Entrada rápida por imagem</h2>
                  <p>
                    Envia uma foto onde apareçam os códigos dos cromos. Revê a
                    lista antes de confirmar.
                  </p>

                  <label className="image-upload-button">
                    {isReadingImage ? "A ler imagem..." : "Escolher imagem"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        handleImageUpload(event.target.files?.[0] ?? null)
                      }
                      disabled={isReadingImage}
                    />
                  </label>

                  {isReadingImage && (
                    <div className="ocr-loading">
                      A processar imagem. Pode demorar alguns segundos...
                    </div>
                  )}

                  {ocrReview.length > 0 && (
                    <>
                      <div className="quick-results">
                        <strong>Códigos para confirmar: {ocrReview.length}</strong>
                        <strong>Inválidos: {ocrInvalid.length}</strong>
                      </div>

                      <div className="review-list">
                        {ocrReview.map((sticker) => (
                          <span key={sticker.id}>
                            {sticker.label}
                            <button
                              onClick={() => removeOcrReviewSticker(sticker.id)}
                              title="Remover da confirmação"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>

                      <button className="primary-action" onClick={confirmOcrAdd}>
                        Confirmar e adicionar ao {currentUserName}
                      </button>
                    </>
                  )}

                  {ocrInvalid.length > 0 && (
                    <div className="invalid-list">
                      Não encontrados: {ocrInvalid.join(", ")}
                    </div>
                  )}

                  {ocrText && (
                    <details className="ocr-details">
                      <summary>Ver texto lido pela imagem</summary>
                      <pre>{ocrText}</pre>
                    </details>
                  )}
                </div>
              </section>

              {lastAddResult && (
                <section className="last-add-result">
                  <h2>{lastAddResult.title}</h2>
                  <p>
                    Novos: {lastAddResult.newStickers.length} · Repetidos:{" "}
                    {lastAddResult.repeatedStickers.length}
                  </p>

                  <div className="result-columns">
                    <div>
                      <h3>Novos</h3>
                      <div className="mini-list">
                        {lastAddResult.newStickers.map((sticker) => (
                          <span key={sticker.id}>{sticker.label}</span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3>Repetidos</h3>
                      <div className="mini-list">
                        {lastAddResult.repeatedStickers.map((sticker) => (
                          <span key={sticker.id}>{sticker.label}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              <section className="controls">
                <div className="control-group">
                  <label>Secção / País</label>

                  <select
                    value={selectedSection}
                    onChange={(event) => setSelectedSection(event.target.value)}
                  >
                    {sections.map((section) => (
                      <option key={section} value={section}>
                        {section}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="control-group">
                  <label>Pesquisar</label>

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Ex: ARG 17, Brasil, CC1..."
                  />
                </div>

                <div className="filter-buttons">
                  <button
                    className={filter === "all" ? "active" : ""}
                    onClick={() => setFilter("all")}
                  >
                    Todos
                  </button>

                  <button
                    className={filter === "owned" ? "active" : ""}
                    onClick={() => setFilter("owned")}
                  >
                    Tenho
                  </button>

                  <button
                    className={filter === "missing" ? "active" : ""}
                    onClick={() => setFilter("missing")}
                  >
                    Faltam
                  </button>

                  <button
                    className={filter === "duplicates" ? "active" : ""}
                    onClick={() => setFilter("duplicates")}
                  >
                    Repetidos
                  </button>
                </div>
              </section>

              <section className="stickers-list">
                {filteredStickers.map((sticker) => {
                  const quantity = getQuantity(state, sticker.id, owner);
                  const status = getStatus(quantity);
                  const duplicateQty = quantity > 1 ? quantity - 1 : 0;

                  return (
                    <article key={sticker.id} className="sticker-card">
                      <div>
                        <div className="sticker-label">{sticker.label}</div>
                        <h3>{sticker.name}</h3>
                        <p>{sticker.section}</p>
                      </div>

                      <div className="quantity-box">
                        <span className={`status ${status.toLowerCase()}`}>
                          {status}
                        </span>

                        {duplicateQty > 0 && (
                          <span className="duplicate-note">
                            {duplicateQty} repetido
                            {duplicateQty > 1 ? "s" : ""}
                          </span>
                        )}

                        <div className="quantity-controls">
                          <button
                            onClick={() =>
                              updateQuantity(sticker.id, owner, -1)
                            }
                          >
                            -
                          </button>

                          <strong>{quantity}</strong>

                          <button
                            onClick={() =>
                              updateQuantity(sticker.id, owner, 1)
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            </div>
          )}
        </div>

        <div className="accordion-item card">
          <button
            className="accordion-header"
            onClick={() => toggleSection("reports")}
          >
            <span>Relatórios e listas para copiar</span>
            <strong>{openSections.reports ? "−" : "+"}</strong>
          </button>

          {openSections.reports && (
            <div className="accordion-content">
              <div className="copy-actions">
                <button onClick={() => copyText("Faltas do Diego", buildMissingText("diego"))}>
                  Copiar faltas do Diego
                </button>
                <button onClick={() => copyText("Repetidos do Diego", buildDuplicatesText("diego"))}>
                  Copiar repetidos do Diego
                </button>
                <button onClick={() => copyText("Faltas do Arthur", buildMissingText("arthur"))}>
                  Copiar faltas do Arthur
                </button>
                <button onClick={() => copyText("Repetidos do Arthur", buildDuplicatesText("arthur"))}>
                  Copiar repetidos do Arthur
                </button>
                <button onClick={() => copyText("Trocas entre irmãos", buildExchangeText())}>
                  Copiar trocas
                </button>
              </div>

              {copyFeedback && <div className="copy-feedback">{copyFeedback}</div>}

              <div className="tabs">
                <button
                  className={reportTab === "missing" ? "active" : ""}
                  onClick={() => setReportTab("missing")}
                >
                  Faltam
                </button>

                <button
                  className={reportTab === "duplicates" ? "active" : ""}
                  onClick={() => setReportTab("duplicates")}
                >
                  Repetidos
                </button>

                <button
                  className={reportTab === "exchange" ? "active" : ""}
                  onClick={() => setReportTab("exchange")}
                >
                  Trocas
                </button>
              </div>

              {reportTab === "missing" && (
                <div className="report-panel">
                  <h2>Faltam — {currentUserName}</h2>
                  <p>{missingList.length} cromos em falta</p>

                  <div className="mini-list">
                    {missingList.map((sticker) => (
                      <span key={sticker.id}>{sticker.label}</span>
                    ))}
                  </div>
                </div>
              )}

              {reportTab === "duplicates" && (
                <div className="report-panel">
                  <h2>Repetidos — {currentUserName}</h2>
                  <p>{duplicateList.length} tipos de cromos repetidos</p>

                  <div className="mini-list">
                    {duplicateList.map((sticker) => {
                      const quantity = getQuantity(state, sticker.id, owner);

                      return (
                        <span key={sticker.id}>
                          {sticker.label} +{quantity - 1}
                        </span>
                      );
                    })}
                  </div>

                  {duplicateList.length === 0 && (
                    <small>Ainda não há repetidos.</small>
                  )}
                </div>
              )}

              {reportTab === "exchange" && (
                <div className="report-panel">
                  <h2>Trocas entre irmãos</h2>

                  <h3>
                    Diego pode dar ao Arthur —{" "}
                    {exchangeSuggestions.diegoCanGiveToArthur.length}
                  </h3>

                  <div className="mini-list">
                    {exchangeSuggestions.diegoCanGiveToArthur.map((sticker) => (
                      <span key={sticker.id}>{sticker.label}</span>
                    ))}
                  </div>

                  <h3>
                    Arthur pode dar ao Diego —{" "}
                    {exchangeSuggestions.arthurCanGiveToDiego.length}
                  </h3>

                  <div className="mini-list">
                    {exchangeSuggestions.arthurCanGiveToDiego.map((sticker) => (
                      <span key={sticker.id}>{sticker.label}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="accordion-item card">
          <button
            className="accordion-header"
            onClick={() => toggleSection("progress")}
          >
            <span>Progresso por país / secção</span>
            <strong>{openSections.progress ? "−" : "+"}</strong>
          </button>

          {openSections.progress && (
            <div className="accordion-content">
              <section className="nearly-complete">
                <h2>Mais perto de completar — {currentUserName}</h2>

                <div className="nearly-grid">
                  {nearlyComplete.map((item) => (
                    <button
                      key={item.section}
                      onClick={() => {
                        setSelectedSection(item.section);
                        setOpenSections((current) => ({
                          ...current,
                          manage: true,
                        }));
                      }}
                    >
                      <strong>{item.section}</strong>
                      <span>Faltam {item.missing}</span>
                    </button>
                  ))}
                </div>
              </section>

              <div className="section-progress-grid">
                {sectionProgress.map((item) => (
                  <button
                    key={item.section}
                    className="section-progress-item"
                    onClick={() => {
                      setSelectedSection(item.section);
                      setOpenSections((current) => ({
                        ...current,
                        manage: true,
                      }));
                    }}
                  >
                    <div className="section-progress-title">
                      <strong>{item.section}</strong>
                      <span>
                        {item.owned}/{item.total}
                      </span>
                    </div>

                    <div className="small-progress-bar">
                      <div style={{ width: `${item.percentage}%` }} />
                    </div>

                    <small>{item.percentage}% completo · faltam {item.missing}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="accordion-item card">
          <button
            className="accordion-header"
            onClick={() => toggleSection("share")}
          >
            <span>Imagens para partilhar</span>
            <strong>{openSections.share ? "−" : "+"}</strong>
          </button>

          {openSections.share && (
            <div className="accordion-content">
              <div className="share-actions">
                <div>
                  <h2>Partilhar trocas</h2>
                  <p>
                    Gera imagens verticais prontas para WhatsApp, Instagram ou
                    grupos de troca.
                  </p>
                </div>

                <div className="share-buttons">
                  <button onClick={() => downloadShareImage("duplicates")}>
                    Repetidos
                  </button>

                  <button onClick={() => downloadShareImage("missing-diego")}>
                    Faltam ao Diego
                  </button>

                  <button onClick={() => downloadShareImage("missing-arthur")}>
                    Faltam ao Arthur
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="accordion-item card">
          <button
            className="accordion-header"
            onClick={() => toggleSection("backup")}
          >
            <span>Backup e segurança</span>
            <strong>{openSections.backup ? "−" : "+"}</strong>
          </button>

          {openSections.backup && (
            <div className="accordion-content">
              <section className="backup">
                <div>
                  <h2>Guardar os dados</h2>
                  <p>
                    Exporta um ficheiro ou importa um backup. Ao importar, podes
                    substituir tudo ou juntar mantendo as maiores quantidades.
                  </p>
                </div>

                <div className="import-mode">
                  <label>
                    <input
                      type="radio"
                      checked={importMode === "replace"}
                      onChange={() => setImportMode("replace")}
                    />
                    Substituir tudo
                  </label>

                  <label>
                    <input
                      type="radio"
                      checked={importMode === "merge"}
                      onChange={() => setImportMode("merge")}
                    />
                    Juntar com dados atuais
                  </label>
                </div>

                <div className="backup-actions">
                  <button onClick={exportBackup}>Exportar backup</button>

                  <label className="import-button">
                    Importar backup
                    <input
                      type="file"
                      accept="application/json"
                      onChange={(event) =>
                        importBackup(event.target.files?.[0] ?? null)
                      }
                    />
                  </label>

                  <button onClick={undoLastAction}>Desfazer última ação</button>

                  <button className="danger" onClick={resetAll}>
                    Apagar tudo
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>

        <div className="accordion-item card">
          <button
            className="accordion-header"
            onClick={() => toggleSection("history")}
          >
            <span>Histórico de alterações</span>
            <strong>{openSections.history ? "−" : "+"}</strong>
          </button>

          {openSections.history && (
            <div className="accordion-content">
              <div className="history-list">
                {history.length === 0 && <p>Ainda não há histórico.</p>}

                {history.map((entry) => (
                  <div key={entry.id} className="history-item">
                    <strong>
                      {new Date(entry.date).toLocaleString("pt-PT", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </strong>
                    <span>{entry.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {shareType && (
        <div className="share-preview-wrapper">
          <div ref={shareCardRef} className="share-preview-card">
            <p className="share-eyebrow">Caderneta Panini</p>

            <h1>
              {shareType === "duplicates"
                ? "Cromos repetidos para troca"
                : shareType === "missing-diego"
                ? "Cromos que faltam ao Diego"
                : "Cromos que faltam ao Arthur"}
            </h1>

            <p className="share-subtitle">Mundial 2026</p>

            {shareType === "duplicates" && (
              <>
                <div className="share-stat-row">
                  <span>Diego: {shareDuplicatesDiego.length} tipos</span>
                  <span>Arthur: {shareDuplicatesArthur.length} tipos</span>
                </div>

                <h2>Diego</h2>

                <div className="share-chip-list">
                  {shareDuplicatesDiego.slice(0, 90).map((sticker) => {
                    const quantity = getQuantity(state, sticker.id, "diego");

                    return (
                      <span key={`diego-${sticker.id}`}>
                        {sticker.label} +{quantity - 1}
                      </span>
                    );
                  })}
                </div>

                <h2>Arthur</h2>

                <div className="share-chip-list">
                  {shareDuplicatesArthur.slice(0, 90).map((sticker) => {
                    const quantity = getQuantity(state, sticker.id, "arthur");

                    return (
                      <span key={`arthur-${sticker.id}`}>
                        {sticker.label} +{quantity - 1}
                      </span>
                    );
                  })}
                </div>
              </>
            )}

            {shareType === "missing-diego" && (
              <>
                <div className="share-stat-row">
                  <span>Faltam: {shareMissingDiego.length}</span>
                  <span>Completo: {diegoSummary.percentage}%</span>
                </div>

                {Object.entries(groupBySection(shareMissingDiego))
                  .slice(0, 16)
                  .map(([section, stickers]) => (
                    <div key={section} className="share-section-group">
                      <h2>{section}</h2>
                      <div className="share-chip-list">
                        {stickers.slice(0, 14).map((sticker) => (
                          <span key={`missing-diego-${sticker.id}`}>
                            {sticker.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </>
            )}

            {shareType === "missing-arthur" && (
              <>
                <div className="share-stat-row">
                  <span>Faltam: {shareMissingArthur.length}</span>
                  <span>Completo: {arthurSummary.percentage}%</span>
                </div>

                {Object.entries(groupBySection(shareMissingArthur))
                  .slice(0, 16)
                  .map(([section, stickers]) => (
                    <div key={section} className="share-section-group">
                      <h2>{section}</h2>
                      <div className="share-chip-list">
                        {stickers.slice(0, 14).map((sticker) => (
                          <span key={`missing-arthur-${sticker.id}`}>
                            {sticker.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </>
            )}

            <p className="share-footer">Quem tiver para trocar, fala comigo ⚽</p>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;