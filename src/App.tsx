import { useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
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
  | "backup";

type CollectionState = Record<string, { diego: number; arthur: number }>;

const STORAGE_KEY = "cromos-mundial-2026-state-v1";

function loadInitialState(): CollectionState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    console.warn("Não foi possível carregar os dados guardados.");
  }

  return {};
}

function saveState(state: CollectionState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

function App() {
  const [owner, setOwner] = useState<AlbumOwner>("diego");
  const [state, setState] = useState<CollectionState>(() => loadInitialState());
  const [selectedSection, setSelectedSection] = useState<string>("Todas");
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [shareType, setShareType] = useState<ShareType>(null);
  const [reportTab, setReportTab] = useState<ReportTab>("missing");
  const [openSections, setOpenSections] = useState<
    Record<AccordionSection, boolean>
  >({
    manage: true,
    reports: false,
    progress: false,
    share: false,
    backup: false,
  });

  const shareCardRef = useRef<HTMLDivElement | null>(null);

  const sections = useMemo(() => {
    return ["Todas", ...Array.from(new Set(ALL_STICKERS.map((s) => s.section)))];
  }, []);

  const toggleSection = (section: AccordionSection) => {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const updateQuantity = (
    stickerId: string,
    ownerId: AlbumOwner,
    change: number
  ) => {
    setState((current) => {
      const currentQty = getQuantity(current, stickerId, ownerId);
      const nextQty = Math.max(0, currentQty + change);

      const nextState = {
        ...current,
        [stickerId]: {
          diego: current[stickerId]?.diego ?? 0,
          arthur: current[stickerId]?.arthur ?? 0,
          [ownerId]: nextQty,
        },
      };

      saveState(nextState);
      return nextState;
    });
  };

  const resetAll = () => {
    const confirmReset = window.confirm(
      "Tens a certeza que queres apagar todos os dados?"
    );

    if (!confirmReset) return;

    localStorage.removeItem(STORAGE_KEY);
    setState({});
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
  };

  const importBackup = (file: File | null) => {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const importedState = parsed.collection ?? parsed;

        saveState(importedState);
        setState(importedState);

        alert("Backup importado com sucesso.");
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

  const diegoSummary = useMemo(() => {
    const total = ALL_STICKERS.length;
    let owned = 0;
    let missing = 0;
    let duplicates = 0;

    ALL_STICKERS.forEach((sticker) => {
      const quantity = getQuantity(state, sticker.id, "diego");

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
  }, [state]);

  const arthurSummary = useMemo(() => {
    const total = ALL_STICKERS.length;
    let owned = 0;
    let missing = 0;
    let duplicates = 0;

    ALL_STICKERS.forEach((sticker) => {
      const quantity = getQuantity(state, sticker.id, "arthur");

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
  }, [state]);

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
        const percentage = total > 0 ? Math.round((owned / total) * 100) : 0;

        return {
          section,
          owned,
          total,
          percentage,
        };
      })
      .sort((a, b) => b.percentage - a.percentage);
  }, [sections, state, owner]);

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
    }, 150);
  };

  const currentUserName =
    USERS.find((user) => user.id === owner)?.name ?? "Diego";

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
        <button onClick={() => toggleSection("share")}>Partilhar</button>
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
            <span>Relatórios</span>
            <strong>{openSections.reports ? "−" : "+"}</strong>
          </button>

          {openSections.reports && (
            <div className="accordion-content">
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

                    <small>{item.percentage}% completo</small>
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
                    Gera imagens prontas para enviar no WhatsApp, Instagram ou
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
                    Exporta um ficheiro para guardar o progresso ou importa um
                    backup antigo.
                  </p>
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

                  <button className="danger" onClick={resetAll}>
                    Apagar tudo
                  </button>
                </div>
              </section>
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
                <h2>Diego</h2>

                <div className="share-chip-list">
                  {ALL_STICKERS.filter(
                    (sticker) => getQuantity(state, sticker.id, "diego") > 1
                  )
                    .slice(0, 120)
                    .map((sticker) => {
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
                  {ALL_STICKERS.filter(
                    (sticker) => getQuantity(state, sticker.id, "arthur") > 1
                  )
                    .slice(0, 120)
                    .map((sticker) => {
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
              <div className="share-chip-list">
                {ALL_STICKERS.filter(
                  (sticker) => getQuantity(state, sticker.id, "diego") === 0
                )
                  .slice(0, 180)
                  .map((sticker) => (
                    <span key={`missing-diego-${sticker.id}`}>
                      {sticker.label}
                    </span>
                  ))}
              </div>
            )}

            {shareType === "missing-arthur" && (
              <div className="share-chip-list">
                {ALL_STICKERS.filter(
                  (sticker) => getQuantity(state, sticker.id, "arthur") === 0
                )
                  .slice(0, 180)
                  .map((sticker) => (
                    <span key={`missing-arthur-${sticker.id}`}>
                      {sticker.label}
                    </span>
                  ))}
              </div>
            )}

            <p className="share-footer">Quem tiver para trocar, fala comigo ⚽</p>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;