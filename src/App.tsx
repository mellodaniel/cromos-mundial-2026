import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import html2canvas from "html2canvas";
import "./index.css";
import { ALL_STICKERS, USERS, type AlbumOwner, type Sticker } from "./data/stickers";
import {
  fetchCloudCollection,
  importLocalCollectionToCloud,
  incrementStickerQuantity,
  upsertStickerQuantity,
} from "./lib/supabase";
import {
  createTradeRequest,
  fetchTradeRequests,
  updateTradeRequestStatus,
  type TradeRequest,
  type TradeStatus,
} from "./lib/trades";

type FilterType = "all" | "owned" | "missing" | "duplicates";
type PanelKey = "add" | "reports" | "progress" | "share" | "trades" | "backup";
type PublicPanelKey = "repeated" | "missing" | "proposal";

type CollectionState = Record<string, { diego: number; arthur: number }>;

const STORAGE_KEY = "cromos-mundial-2026-state-v1";

function loadInitialState(): CollectionState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    console.warn("Não foi possível carregar os dados guardados.");
  }

  return {};
}

function saveState(state: CollectionState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getQuantity(state: CollectionState, stickerId: string, owner: AlbumOwner) {
  return state[stickerId]?.[owner] ?? 0;
}

function getStatus(quantity: number) {
  if (quantity === 0) return "Falta";
  if (quantity === 1) return "Tenho";
  return "Repetido";
}

function getOwnerName(owner: AlbumOwner) {
  return USERS.find((user) => user.id === owner)?.name ?? owner;
}

function getStickerById(stickerId: string) {
  return ALL_STICKERS.find((sticker) => sticker.id === stickerId);
}

function rowsToCollectionState(
  rows: Array<{ album_owner: AlbumOwner; sticker_id: string; quantity: number }>
): CollectionState {
  const nextState: CollectionState = {};

  rows.forEach((row) => {
    if (!nextState[row.sticker_id]) {
      nextState[row.sticker_id] = { diego: 0, arthur: 0 };
    }

    nextState[row.sticker_id][row.album_owner] = row.quantity;
  });

  return nextState;
}

function calculateSummary(state: CollectionState, owner: AlbumOwner) {
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
}

function PublicTradesPage() {
  const [state, setState] = useState<CollectionState>(() => loadInitialState());
  const [tradeRequests, setTradeRequests] = useState<TradeRequest[]>([]);
  const [cloudStatus, setCloudStatus] = useState("A carregar dados...");
  const [openPublicPanel, setOpenPublicPanel] = useState<PublicPanelKey | null>("repeated");

  const [wantedOwner, setWantedOwner] = useState<AlbumOwner>("diego");
  const [wantedStickerId, setWantedStickerId] = useState("");
  const [offeredOwner, setOfferedOwner] = useState<AlbumOwner>("diego");
  const [offeredStickerCode, setOfferedStickerCode] = useState("");
  const [personName, setPersonName] = useState("");
  const [personContact, setPersonContact] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadPublicData = async () => {
    try {
      setCloudStatus("A carregar dados da cloud...");

      const [rows, trades] = await Promise.all([
        fetchCloudCollection(),
        fetchTradeRequests(),
      ]);

      const cloudState = rowsToCollectionState(rows);
      setState(cloudState);
      saveState(cloudState);
      setTradeRequests(trades);
      setCloudStatus("Dados atualizados");
    } catch (error) {
      console.error(error);
      setCloudStatus("Não foi possível carregar os dados.");
    }
  };

  useEffect(() => {
    loadPublicData();
  }, []);

  const repeatedAvailable = useMemo(() => {
    const reservedCount = new Map<string, number>();

    tradeRequests
      .filter((request) => request.status === "pending" || request.status === "reserved")
      .forEach((request) => {
        const key = `${request.wanted_owner}:${request.wanted_sticker_id}`;
        reservedCount.set(key, (reservedCount.get(key) ?? 0) + 1);
      });

    const result: Array<{
      sticker: Sticker;
      owner: AlbumOwner;
      duplicateQty: number;
      reservedQty: number;
      availableQty: number;
    }> = [];

    ALL_STICKERS.forEach((sticker) => {
      USERS.forEach((user) => {
        const ownerId = user.id;
        const quantity = getQuantity(state, sticker.id, ownerId);
        const duplicateQty = Math.max(0, quantity - 1);
        const reservedQty = reservedCount.get(`${ownerId}:${sticker.id}`) ?? 0;
        const availableQty = Math.max(0, duplicateQty - reservedQty);

        if (availableQty > 0) {
          result.push({
            sticker,
            owner: ownerId,
            duplicateQty,
            reservedQty,
            availableQty,
          });
        }
      });
    });

    return result.sort((a, b) =>
      `${a.owner}-${a.sticker.label}`.localeCompare(`${b.owner}-${b.sticker.label}`)
    );
  }, [state, tradeRequests]);

  const repeatedByOwner = useMemo(() => {
    return {
      diego: repeatedAvailable.filter((item) => item.owner === "diego"),
      arthur: repeatedAvailable.filter((item) => item.owner === "arthur"),
    };
  }, [repeatedAvailable]);

  const missingByOwner = useMemo(() => {
    return {
      diego: ALL_STICKERS.filter((sticker) => getQuantity(state, sticker.id, "diego") === 0),
      arthur: ALL_STICKERS.filter((sticker) => getQuantity(state, sticker.id, "arthur") === 0),
    };
  }, [state]);

  const selectedWanted = repeatedAvailable.find(
    (item) => item.owner === wantedOwner && item.sticker.id === wantedStickerId
  );

  const totalAvailable = repeatedAvailable.reduce((total, item) => total + item.availableQty, 0);

  const handleSelectWanted = (owner: AlbumOwner, stickerId: string) => {
    setWantedOwner(owner);
    setWantedStickerId(stickerId);
    setOpenPublicPanel("proposal");
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  const handleSubmitTrade = async (event: FormEvent) => {
    event.preventDefault();

    if (!wantedStickerId) {
      alert("Escolhe primeiro o cromo que queres reservar.");
      return;
    }

    if (!offeredStickerCode.trim()) {
      alert("Indica qual cromo vais entregar.");
      return;
    }

    if (!personName.trim() || !personContact.trim()) {
      alert("Indica o teu nome e contacto.");
      return;
    }

    try {
      setIsSubmitting(true);

      await createTradeRequest({
        wanted_owner: wantedOwner,
        wanted_sticker_id: wantedStickerId,
        offered_owner: offeredOwner,
        offered_sticker_code: offeredStickerCode,
        person_name: personName,
        person_contact: personContact,
        message,
      });

      alert("Proposta enviada com sucesso. Obrigado!");
      setWantedStickerId("");
      setOfferedStickerCode("");
      setPersonName("");
      setPersonContact("");
      setMessage("");
      setOpenPublicPanel("repeated");

      await loadPublicData();
    } catch (error) {
      console.error(error);
      alert("Não foi possível enviar a proposta. Tenta novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPublicPanelHeader = (panel: PublicPanelKey, title: string) => (
    <button
      className="accordion-header"
      onClick={() => setOpenPublicPanel((current) => (current === panel ? null : panel))}
    >
      <span>{title}</span>
      <strong>{openPublicPanel === panel ? "−" : "+"}</strong>
    </button>
  );

  return (
    <main className="app public-app">
      <header className="hero public-hero">
        <div>
          <p className="eyebrow">Trocas Panini</p>
          <h1>Trocas Mundial 2026</h1>
          <p className="subtitle">
            Vê os cromos repetidos disponíveis, consulta o que ainda falta e propõe uma troca.
          </p>
          <p className="cloud-status">☁️ {cloudStatus}</p>
        </div>
      </header>

      <section className="trade-public-summary card">
        <div>
          <span>Repetidos disponíveis</span>
          <strong>{totalAvailable}</strong>
        </div>
        <div>
          <span>Faltam ao Diego</span>
          <strong>{missingByOwner.diego.length}</strong>
        </div>
        <div>
          <span>Faltam ao Arthur</span>
          <strong>{missingByOwner.arthur.length}</strong>
        </div>
      </section>

      <section className="accordion card">
        {renderPublicPanelHeader("repeated", "Repetidos disponíveis")}

        {openPublicPanel === "repeated" && (
          <div className="accordion-content">
            <div className="public-two-columns">
              <div className="public-owner-block">
                <h2>Diego</h2>
                <p>
                  {repeatedByOwner.diego.reduce((total, item) => total + item.availableQty, 0)}{" "}
                  cromos disponíveis
                </p>

                <div className="trade-sticker-grid compact">
                  {repeatedByOwner.diego.map((item) => (
                    <button
                      key={`${item.owner}-${item.sticker.id}`}
                      className={`trade-sticker ${
                        wantedOwner === item.owner && wantedStickerId === item.sticker.id
                          ? "selected"
                          : ""
                      }`}
                      onClick={() => handleSelectWanted(item.owner, item.sticker.id)}
                    >
                      <span>{item.sticker.label}</span>
                      <strong>{item.sticker.name}</strong>
                      <small>{item.availableQty} disponível</small>
                    </button>
                  ))}
                </div>

                {repeatedByOwner.diego.length === 0 && (
                  <p className="empty-message">Sem repetidos disponíveis para o Diego.</p>
                )}
              </div>

              <div className="public-owner-block">
                <h2>Arthur</h2>
                <p>
                  {repeatedByOwner.arthur.reduce((total, item) => total + item.availableQty, 0)}{" "}
                  cromos disponíveis
                </p>

                <div className="trade-sticker-grid compact">
                  {repeatedByOwner.arthur.map((item) => (
                    <button
                      key={`${item.owner}-${item.sticker.id}`}
                      className={`trade-sticker ${
                        wantedOwner === item.owner && wantedStickerId === item.sticker.id
                          ? "selected"
                          : ""
                      }`}
                      onClick={() => handleSelectWanted(item.owner, item.sticker.id)}
                    >
                      <span>{item.sticker.label}</span>
                      <strong>{item.sticker.name}</strong>
                      <small>{item.availableQty} disponível</small>
                    </button>
                  ))}
                </div>

                {repeatedByOwner.arthur.length === 0 && (
                  <p className="empty-message">Sem repetidos disponíveis para o Arthur.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="accordion card">
        {renderPublicPanelHeader("missing", "Cromos em falta")}

        {openPublicPanel === "missing" && (
          <div className="accordion-content">
            <div className="public-two-columns">
              <div className="public-owner-block">
                <h2>Faltam ao Diego</h2>
                <p>{missingByOwner.diego.length} cromos em falta</p>

                <div className="mini-list">
                  {missingByOwner.diego.map((sticker) => (
                    <span key={sticker.id}>{sticker.label}</span>
                  ))}
                </div>
              </div>

              <div className="public-owner-block">
                <h2>Faltam ao Arthur</h2>
                <p>{missingByOwner.arthur.length} cromos em falta</p>

                <div className="mini-list">
                  {missingByOwner.arthur.map((sticker) => (
                    <span key={sticker.id}>{sticker.label}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="accordion card">
        {renderPublicPanelHeader("proposal", "Propor uma troca")}

        {openPublicPanel === "proposal" && (
          <div className="accordion-content">
            <form className="trade-form public-form" onSubmit={handleSubmitTrade}>
              <h2>Propor troca</h2>

              <p className="trade-form-help">
                A tua proposta será enviada para nós e ficará pendente até ser confirmada.
                Depois entraremos em contacto contigo pelo contacto indicado.
              </p>

              <div className="selected-trade-box">
                <span>Cromo escolhido</span>
                <strong>
                  {selectedWanted
                    ? `${getOwnerName(selectedWanted.owner)} — ${selectedWanted.sticker.label} ${selectedWanted.sticker.name}`
                    : "Ainda não escolheste nenhum cromo"}
                </strong>
              </div>

              <div className="form-grid">
                <label>
                  Para qual caderneta?
                  <select
                    value={wantedOwner}
                    onChange={(event) => {
                      setWantedOwner(event.target.value as AlbumOwner);
                      setWantedStickerId("");
                    }}
                  >
                    {USERS.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Cromo que queres reservar
                  <select
                    value={wantedStickerId}
                    onChange={(event) => setWantedStickerId(event.target.value)}
                  >
                    <option value="">Selecionar cromo</option>
                    {repeatedAvailable
                      .filter((item) => item.owner === wantedOwner)
                      .map((item) => (
                        <option key={item.sticker.id} value={item.sticker.id}>
                          {item.sticker.label} — {item.sticker.name}
                        </option>
                      ))}
                  </select>
                </label>

                <label>
                  Para quem é o cromo que vais entregar?
                  <select
                    value={offeredOwner}
                    onChange={(event) => setOfferedOwner(event.target.value as AlbumOwner)}
                  >
                    {USERS.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Cromo que vais entregar
                  <input
                    value={offeredStickerCode}
                    onChange={(event) => setOfferedStickerCode(event.target.value)}
                    placeholder="Ex: POR 3, ARG 10, FWC 0, CC 5"
                  />
                </label>

                <label>
                  O teu nome
                  <input
                    value={personName}
                    onChange={(event) => setPersonName(event.target.value)}
                    placeholder="Ex: João"
                  />
                </label>

                <label>
                  Contacto / WhatsApp
                  <input
                    value={personContact}
                    onChange={(event) => setPersonContact(event.target.value)}
                    placeholder="Ex: 91xxxxxxx"
                  />
                </label>

                <label className="full">
                  Mensagem opcional
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Ex: Posso entregar no treino, na escola, etc."
                  />
                </label>
              </div>

              <button className="submit-trade" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "A enviar..." : "Enviar proposta de troca"}
              </button>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}

function PrivateApp() {
  const [owner, setOwner] = useState<AlbumOwner>("diego");
  const [state, setState] = useState<CollectionState>(() => loadInitialState());
  const [selectedSection, setSelectedSection] = useState<string>("Todas");
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [cloudStatus, setCloudStatus] = useState("A ligar ao Supabase...");
  const [isCloudLoading, setIsCloudLoading] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [openPanel, setOpenPanel] = useState<PanelKey | null>(null);
  const [tradeRequests, setTradeRequests] = useState<TradeRequest[]>([]);
  const [isLoadingTrades, setIsLoadingTrades] = useState(false);

  const shareMissingRef = useRef<HTMLDivElement | null>(null);
  const shareDuplicatesRef = useRef<HTMLDivElement | null>(null);

  const loadTradeRequests = async () => {
    try {
      setIsLoadingTrades(true);
      const requests = await fetchTradeRequests();
      setTradeRequests(requests);
    } catch (error) {
      console.error(error);
      alert("Não foi possível carregar as propostas de troca.");
    } finally {
      setIsLoadingTrades(false);
    }
  };

  useEffect(() => {
    async function loadCloudData() {
      try {
        setIsCloudLoading(true);
        setCloudStatus("A carregar dados da cloud...");

        const [rows, requests] = await Promise.all([
          fetchCloudCollection(),
          fetchTradeRequests(),
        ]);

        const cloudState = rowsToCollectionState(rows);

        setState(cloudState);
        saveState(cloudState);
        setTradeRequests(requests);
        setCloudStatus("Sincronizado com Supabase");
      } catch (error) {
        console.error(error);
        setCloudStatus("Modo local: não foi possível ligar ao Supabase");
      } finally {
        setIsCloudLoading(false);
      }
    }

    loadCloudData();
  }, []);

  const sections = useMemo(() => {
    const uniqueSections = Array.from(
      new Set(ALL_STICKERS.map((sticker) => sticker.section))
    );

    const sortedSections = uniqueSections.sort((a, b) =>
      a.localeCompare(b, "pt", { sensitivity: "base" })
    );

    return ["Todas", ...sortedSections];
  }, []);

  const currentUserName = USERS.find((user) => user.id === owner)?.name ?? "Diego";

  const summary = useMemo(() => calculateSummary(state, owner), [state, owner]);
  const diegoSummary = useMemo(() => calculateSummary(state, "diego"), [state]);
  const arthurSummary = useMemo(() => calculateSummary(state, "arthur"), [state]);

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

  const missingList = useMemo(() => {
    return ALL_STICKERS.filter((sticker) => getQuantity(state, sticker.id, owner) === 0);
  }, [state, owner]);

  const duplicateList = useMemo(() => {
    return ALL_STICKERS.filter((sticker) => getQuantity(state, sticker.id, owner) > 1);
  }, [state, owner]);

  const sectionProgress = useMemo(() => {
    return sections
      .filter((section) => section !== "Todas")
      .map((section) => {
        const stickers = ALL_STICKERS.filter((sticker) => sticker.section === section);
        const owned = stickers.filter((sticker) => getQuantity(state, sticker.id, owner) > 0).length;
        const total = stickers.length;
        const percentage = total > 0 ? Math.round((owned / total) * 100) : 0;

        return {
          section,
          owned,
          total,
          percentage,
        };
      })
      .sort((a, b) => b.percentage - a.percentage || a.section.localeCompare(b.section));
  }, [sections, state, owner]);

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

  const togglePanel = (panel: PanelKey) => {
    setOpenPanel((current) => (current === panel ? null : panel));
  };

  const refreshFromCloud = async () => {
    try {
      setIsCloudLoading(true);
      setCloudStatus("A atualizar dados da cloud...");

      const [rows, requests] = await Promise.all([
        fetchCloudCollection(),
        fetchTradeRequests(),
      ]);

      const cloudState = rowsToCollectionState(rows);

      setState(cloudState);
      saveState(cloudState);
      setTradeRequests(requests);
      setCloudStatus("Sincronizado com Supabase");
    } catch (error) {
      console.error(error);
      alert("Não foi possível atualizar os dados do Supabase.");
      setCloudStatus("Erro ao sincronizar");
    } finally {
      setIsCloudLoading(false);
    }
  };

  const updateQuantity = async (stickerId: string, ownerId: AlbumOwner, change: number) => {
    const currentQty = getQuantity(state, stickerId, ownerId);
    const nextQty = Math.max(0, currentQty + change);
    const realChange = nextQty - currentQty;

    if (realChange === 0) return;

    const previousState = state;

    const nextState = {
      ...state,
      [stickerId]: {
        diego: state[stickerId]?.diego ?? 0,
        arthur: state[stickerId]?.arthur ?? 0,
        [ownerId]: nextQty,
      },
    };

    setState(nextState);
    saveState(nextState);
    setCloudStatus("A guardar alteração...");

    try {
      await incrementStickerQuantity(ownerId, stickerId, realChange);
      setCloudStatus("Sincronizado com Supabase");
    } catch (error) {
      console.error(error);
      setState(previousState);
      saveState(previousState);
      setCloudStatus("Erro ao guardar no Supabase");
      alert("Não foi possível guardar esta alteração na cloud. A alteração foi revertida.");
    }
  };

  const setDirectQuantity = async (
    stickerId: string,
    ownerId: AlbumOwner,
    quantityText: string
  ) => {
    const quantity = Math.max(0, Number(quantityText) || 0);
    const previousState = state;

    const nextState = {
      ...state,
      [stickerId]: {
        diego: state[stickerId]?.diego ?? 0,
        arthur: state[stickerId]?.arthur ?? 0,
        [ownerId]: quantity,
      },
    };

    setState(nextState);
    saveState(nextState);
    setCloudStatus("A guardar alteração...");

    try {
      await upsertStickerQuantity(ownerId, stickerId, quantity);
      setCloudStatus("Sincronizado com Supabase");
    } catch (error) {
      console.error(error);
      setState(previousState);
      saveState(previousState);
      setCloudStatus("Erro ao guardar no Supabase");
      alert("Não foi possível guardar esta alteração na cloud. A alteração foi revertida.");
    }
  };

  const migrateLocalToCloud = async () => {
    const confirmMigration = window.confirm(
      "Isto vai enviar os dados guardados neste navegador para o Supabase. Queres continuar?"
    );

    if (!confirmMigration) return;

    try {
      setIsMigrating(true);
      setCloudStatus("A migrar dados locais para Supabase...");

      const localState = loadInitialState();
      const result = await importLocalCollectionToCloud(localState);

      await refreshFromCloud();

      alert(`Migração concluída. Foram enviados ${result.inserted} registos para o Supabase.`);
      setCloudStatus("Sincronizado com Supabase");
    } catch (error) {
      console.error(error);
      alert("Erro ao migrar dados locais para o Supabase.");
      setCloudStatus("Erro na migração");
    } finally {
      setIsMigrating(false);
    }
  };

  const resetLocalOnly = () => {
    const confirmReset = window.confirm(
      "Isto vai apagar apenas os dados locais deste navegador. Os dados do Supabase não serão apagados. Continuar?"
    );

    if (!confirmReset) return;

    localStorage.removeItem(STORAGE_KEY);
    setState({});
    setCloudStatus("Dados locais apagados. Atualiza da cloud para recuperar.");
  };

  const exportBackup = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      app: "Cromos Mundial 2026",
      version: 2,
      source: "local-cache",
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
        alert(
          "Backup importado localmente com sucesso. Para enviar para a cloud, usa o botão 'Migrar dados locais para Supabase'."
        );
      } catch {
        alert("Erro ao importar backup. Verifica se o ficheiro é válido.");
      }
    };

    reader.readAsText(file);
  };

  const quickAddByText = async () => {
    const rawText = window.prompt(
      "Escreve os cromos separados por espaço, vírgula ou quebra de linha. Exemplo: ARG 17, FWC 0, CC1"
    );

    if (!rawText) return;

    const normalized = rawText
      .replace(/\n/g, " ")
      .replace(/,/g, " ")
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();

    if (!normalized) return;

    const parts = normalized.split(" ");
    const candidates: string[] = [];

    for (let index = 0; index < parts.length; index += 1) {
      const current = parts[index];
      const next = parts[index + 1];

      if (/^[A-Z]{2,4}$/.test(current) && /^\d{1,2}$/.test(next ?? "")) {
        candidates.push(`${current} ${Number(next)}`);
        index += 1;
      } else if (/^CC\d{1,2}$/.test(current)) {
        candidates.push(current.replace("CC", "CC "));
      } else if (/^FWC\d{1,2}$/.test(current)) {
        candidates.push(current.replace("FWC", "FWC "));
      }
    }

    const foundStickers = candidates
      .map((candidate) =>
        ALL_STICKERS.find(
          (sticker) =>
            sticker.label.toUpperCase() === candidate ||
            sticker.label.toUpperCase().replace(" ", "") === candidate.replace(" ", "")
        )
      )
      .filter(Boolean) as Sticker[];

    if (foundStickers.length === 0) {
      alert("Não encontrei nenhum cromo válido nesse texto.");
      return;
    }

    for (const sticker of foundStickers) {
      await updateQuantity(sticker.id, owner, 1);
    }

    alert(`${foundStickers.length} cromo(s) adicionados para ${currentUserName}.`);
  };

  const captureImage = async (element: HTMLDivElement | null, filename: string) => {
    if (!element) return;

    const canvas = await html2canvas(element, {
      backgroundColor: "#f4f0f6",
      scale: 2,
    });

    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
  };

  const updateTradeStatus = async (tradeRequestId: number, status: TradeStatus) => {
    try {
      await updateTradeRequestStatus(tradeRequestId, status);
      await loadTradeRequests();
      alert("Estado da proposta atualizado.");
    } catch (error) {
      console.error(error);
      alert("Não foi possível atualizar a proposta.");
    }
  };

  const renderPanelHeader = (panel: PanelKey, title: string) => (
    <button className="accordion-header" onClick={() => togglePanel(panel)}>
      <span>{title}</span>
      <strong>{openPanel === panel ? "−" : "+"}</strong>
    </button>
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
          <p
            className={`cloud-status ${
              cloudStatus.includes("Erro") || cloudStatus.includes("local") ? "warning" : ""
            }`}
          >
            {isCloudLoading ? "⏳ " : "☁️ "}
            {cloudStatus}
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

      <section className="dashboard compact-dashboard">
        <div className="card stat">
          <span>Caderneta</span>
          <strong>{currentUserName}</strong>
        </div>
        <div className="card stat">
          <span>Já tem</span>
          <strong>{summary.owned}</strong>
        </div>
        <div className="card stat">
          <span>Faltam</span>
          <strong>{summary.missing}</strong>
        </div>
        <div className="card stat">
          <span>Repetidos</span>
          <strong>{summary.duplicates}</strong>
        </div>
        <div className="card stat highlight">
          <span>Completo</span>
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

      <section className="owners-comparison card">
        <div>
          <h3>Diego</h3>
          <strong>{diegoSummary.percentage}% completo</strong>
          <div className="small-progress">
            <div style={{ width: `${diegoSummary.percentage}%` }} />
          </div>
          <p>
            {diegoSummary.owned} tem · {diegoSummary.missing} faltam ·{" "}
            {diegoSummary.duplicates} repetidos
          </p>
        </div>

        <div>
          <h3>Arthur</h3>
          <strong>{arthurSummary.percentage}% completo</strong>
          <div className="small-progress">
            <div style={{ width: `${arthurSummary.percentage}%` }} />
          </div>
          <p>
            {arthurSummary.owned} tem · {arthurSummary.missing} faltam ·{" "}
            {arthurSummary.duplicates} repetidos
          </p>
        </div>
      </section>

      <section className="quick-menu">
        <button onClick={() => setOpenPanel("add")}>Adicionar cromos</button>
        <button onClick={() => setOpenPanel("reports")}>Ver faltas</button>
        <button
          onClick={() => {
            setOpenPanel("reports");
            setFilter("duplicates");
          }}
        >
          Ver repetidos
        </button>
        <a className="quick-menu-link" href="/?view=trocas">
          Página pública de trocas
        </a>
      </section>

      <section className="accordion card">
        {renderPanelHeader("add", "Adicionar / atualizar cromos")}

        {openPanel === "add" && (
          <div className="accordion-content">
            <section className="controls inner-controls">
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
                  placeholder="Ex: ARG 17, Messi, Brasil, CC1..."
                />
              </div>

              <div className="filter-buttons">
                <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
                  Todos
                </button>
                <button className={filter === "owned" ? "active" : ""} onClick={() => setFilter("owned")}>
                  Tenho
                </button>
                <button className={filter === "missing" ? "active" : ""} onClick={() => setFilter("missing")}>
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

            <div className="quick-add-box">
              <button onClick={quickAddByText}>Entrada rápida por texto</button>
              <p>Exemplo: ARG 17, FWC 0, CC1. Cada entrada soma +1 ao cromo.</p>
            </div>

            <section className="stickers-list">
              {filteredStickers.map((sticker) => {
                const quantity = getQuantity(state, sticker.id, owner);
                const status = getStatus(quantity);
                const duplicateQty = quantity > 1 ? quantity - 1 : 0;

                return (
                  <article key={sticker.id} className="sticker-card card">
                    <div>
                      <div className="sticker-label">{sticker.label}</div>
                      <h3>{sticker.name}</h3>
                      <p>{sticker.section}</p>
                    </div>

                    <div className="quantity-box">
                      <span className={`status ${status.toLowerCase()}`}>{status}</span>

                      {duplicateQty > 0 && (
                        <span className="duplicate-note">
                          {duplicateQty} repetido{duplicateQty > 1 ? "s" : ""}
                        </span>
                      )}

                      <div className="quantity-controls">
                        <button onClick={() => updateQuantity(sticker.id, owner, -1)}>-</button>
                        <input
                          value={quantity}
                          inputMode="numeric"
                          onChange={(event) =>
                            setDirectQuantity(sticker.id, owner, event.target.value)
                          }
                          aria-label={`Quantidade de ${sticker.label}`}
                        />
                        <button onClick={() => updateQuantity(sticker.id, owner, 1)}>+</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          </div>
        )}
      </section>

      <section className="accordion card">
        {renderPanelHeader("reports", "Relatórios")}

        {openPanel === "reports" && (
          <div className="accordion-content">
            <section className="reports">
              <div className="card report">
                <h2>Faltam — {currentUserName}</h2>
                <p>{missingList.length} cromos em falta</p>
                <div className="mini-list">
                  {missingList.slice(0, 120).map((sticker) => (
                    <span key={sticker.id}>{sticker.label}</span>
                  ))}
                </div>
                {missingList.length > 120 && <small>Mostrando os primeiros 120.</small>}
              </div>

              <div className="card report">
                <h2>Repetidos — {currentUserName}</h2>
                <p>{duplicateList.length} tipos de cromos repetidos</p>
                <div className="mini-list">
                  {duplicateList.slice(0, 120).map((sticker) => {
                    const quantity = getQuantity(state, sticker.id, owner);
                    return (
                      <span key={sticker.id}>
                        {sticker.label} +{quantity - 1}
                      </span>
                    );
                  })}
                </div>
                {duplicateList.length === 0 && <small>Ainda não há repetidos.</small>}
              </div>

              <div className="card report">
                <h2>Trocas entre irmãos</h2>

                <h3>Diego pode dar ao Arthur</h3>
                <div className="mini-list">
                  {exchangeSuggestions.diegoCanGiveToArthur.slice(0, 80).map((sticker) => (
                    <span key={sticker.id}>{sticker.label}</span>
                  ))}
                </div>
                {exchangeSuggestions.diegoCanGiveToArthur.length === 0 && (
                  <small>Nenhuma sugestão por enquanto.</small>
                )}

                <h3>Arthur pode dar ao Diego</h3>
                <div className="mini-list">
                  {exchangeSuggestions.arthurCanGiveToDiego.slice(0, 80).map((sticker) => (
                    <span key={sticker.id}>{sticker.label}</span>
                  ))}
                </div>
                {exchangeSuggestions.arthurCanGiveToDiego.length === 0 && (
                  <small>Nenhuma sugestão por enquanto.</small>
                )}
              </div>
            </section>
          </div>
        )}
      </section>

      <section className="accordion card">
        {renderPanelHeader("trades", "Propostas de troca")}

        {openPanel === "trades" && (
          <div className="accordion-content">
            <div className="trade-admin-header">
              <div>
                <h2>Propostas recebidas</h2>
                <p>Gerir reservas e propostas enviadas pela página pública.</p>
              </div>
              <button onClick={loadTradeRequests} disabled={isLoadingTrades}>
                {isLoadingTrades ? "A carregar..." : "Atualizar propostas"}
              </button>
            </div>

            <div className="trade-admin-list">
              {tradeRequests.map((request) => {
                const wantedSticker = getStickerById(request.wanted_sticker_id);

                return (
                  <article className="trade-admin-card" key={request.id}>
                    <div>
                      <span className={`trade-status ${request.status}`}>
                        {request.status}
                      </span>
                      <h3>{request.person_name}</h3>
                      <p>
                        Quer:{" "}
                        <strong>
                          {getOwnerName(request.wanted_owner)} —{" "}
                          {wantedSticker?.label ?? request.wanted_sticker_id}
                        </strong>
                      </p>
                      <p>
                        Entrega para{" "}
                        {request.offered_owner ? getOwnerName(request.offered_owner) : "—"}:{" "}
                        <strong>{request.offered_sticker_code}</strong>
                      </p>
                      <p>
                        Contacto: <strong>{request.person_contact}</strong>
                      </p>
                      {request.message && <p>Mensagem: {request.message}</p>}
                    </div>

                    <div className="trade-admin-actions">
                      <button onClick={() => updateTradeStatus(request.id, "reserved")}>
                        Reservar
                      </button>
                      <button onClick={() => updateTradeStatus(request.id, "completed")}>
                        Concluir
                      </button>
                      <button className="danger" onClick={() => updateTradeStatus(request.id, "cancelled")}>
                        Cancelar
                      </button>
                    </div>
                  </article>
                );
              })}

              {tradeRequests.length === 0 && (
                <p className="empty-message">Ainda não existem propostas de troca.</p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="accordion card">
        {renderPanelHeader("progress", "Progresso por país / secção")}

        {openPanel === "progress" && (
          <div className="accordion-content">
            <section className="section-progress-grid">
              {sectionProgress.map((item) => (
                <div className="section-progress-card" key={item.section}>
                  <div>
                    <strong>{item.section}</strong>
                    <span>
                      {item.owned}/{item.total}
                    </span>
                  </div>
                  <div className="small-progress">
                    <div style={{ width: `${item.percentage}%` }} />
                  </div>
                  <p>{item.percentage}% completo</p>
                </div>
              ))}
            </section>
          </div>
        )}
      </section>

      <section className="accordion card">
        {renderPanelHeader("share", "Imagens para partilhar")}

        {openPanel === "share" && (
          <div className="accordion-content">
            <div className="share-actions">
              <button
                onClick={() =>
                  captureImage(
                    shareMissingRef.current,
                    `faltam-${currentUserName.toLowerCase()}-mundial-2026.png`
                  )
                }
              >
                Gerar imagem de faltas
              </button>

              <button
                onClick={() =>
                  captureImage(
                    shareDuplicatesRef.current,
                    `repetidos-${currentUserName.toLowerCase()}-mundial-2026.png`
                  )
                }
              >
                Gerar imagem de repetidos
              </button>
            </div>

            <div className="share-preview-grid">
              <div className="share-card" ref={shareMissingRef}>
                <p className="eyebrow dark">Cromos Mundial 2026</p>
                <h2>Faltam para {currentUserName}</h2>
                <p className="share-subtitle">
                  {missingList.length} cromos em falta · {summary.percentage}% completo
                </p>
                <div className="share-list">
                  {missingList.slice(0, 90).map((sticker) => (
                    <span key={sticker.id}>{sticker.label}</span>
                  ))}
                </div>
                <footer>Trocas abertas ⚽ Panini World Cup 2026</footer>
              </div>

              <div className="share-card" ref={shareDuplicatesRef}>
                <p className="eyebrow dark">Cromos Mundial 2026</p>
                <h2>Repetidos de {currentUserName}</h2>
                <p className="share-subtitle">
                  {summary.duplicates} cromos repetidos disponíveis para troca
                </p>
                <div className="share-list">
                  {duplicateList.slice(0, 90).map((sticker) => {
                    const quantity = getQuantity(state, sticker.id, owner);
                    return (
                      <span key={sticker.id}>
                        {sticker.label} +{quantity - 1}
                      </span>
                    );
                  })}
                </div>
                <footer>Trocas abertas ⚽ Panini World Cup 2026</footer>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="accordion card">
        {renderPanelHeader("backup", "Backup e segurança")}

        {openPanel === "backup" && (
          <div className="accordion-content">
            <section className="backup-panel">
              <div>
                <h2>Sincronização cloud</h2>
                <p>
                  Atualiza a app com os dados da cloud ou envia dados locais para o Supabase.
                </p>
              </div>

              <div className="backup-actions">
                <button onClick={refreshFromCloud} disabled={isCloudLoading || isMigrating}>
                  Atualizar da cloud
                </button>
                <button onClick={migrateLocalToCloud} disabled={isCloudLoading || isMigrating}>
                  {isMigrating ? "A migrar..." : "Migrar dados locais para Supabase"}
                </button>
              </div>
            </section>

            <section className="backup-panel secondary">
              <div>
                <h2>Backup local</h2>
                <p>Exporta uma cópia JSON ou importa um backup antigo.</p>
              </div>

              <div className="backup-actions">
                <button onClick={exportBackup}>Exportar backup</button>

                <label className="import-button">
                  Importar backup
                  <input
                    type="file"
                    accept="application/json"
                    onChange={(event) => importBackup(event.target.files?.[0] ?? null)}
                  />
                </label>

                <button className="danger" onClick={resetLocalOnly}>
                  Apagar dados locais
                </button>
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

function App() {
  const isPublicTradesView =
    new URLSearchParams(window.location.search).get("view") === "trocas";

  if (isPublicTradesView) {
    return <PublicTradesPage />;
  }

  return <PrivateApp />;
}

export default App;