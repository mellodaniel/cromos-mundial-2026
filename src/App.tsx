import { useEffect, useMemo, useState } from "react";
import "./index.css";
import { ALL_STICKERS, USERS, type AlbumOwner, type Sticker } from "./data/stickers";
import {
  fetchCloudCollection,
  importLocalCollectionToCloud,
  incrementStickerQuantity,
  upsertStickerQuantity,
} from "./lib/supabase";

type FilterType = "all" | "owned" | "missing" | "duplicates";

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

function getQuantity(state: CollectionState, stickerId: string, owner: AlbumOwner) {
  return state[stickerId]?.[owner] ?? 0;
}

function getStatus(quantity: number) {
  if (quantity === 0) return "Falta";
  if (quantity === 1) return "Tenho";
  return "Repetido";
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

function mergeStates(localState: CollectionState, cloudState: CollectionState): CollectionState {
  const merged: CollectionState = { ...cloudState };

  Object.entries(localState).forEach(([stickerId, quantities]) => {
    const cloudQuantities = merged[stickerId] ?? { diego: 0, arthur: 0 };

    merged[stickerId] = {
      diego: Math.max(cloudQuantities.diego ?? 0, quantities.diego ?? 0),
      arthur: Math.max(cloudQuantities.arthur ?? 0, quantities.arthur ?? 0),
    };
  });

  return merged;
}

function App() {
  const [owner, setOwner] = useState<AlbumOwner>("diego");
  const [state, setState] = useState<CollectionState>(() => loadInitialState());
  const [selectedSection, setSelectedSection] = useState<string>("Todas");
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [isCloudLoading, setIsCloudLoading] = useState(true);
  const [cloudStatus, setCloudStatus] = useState("A ligar ao Supabase...");
  const [isMigrating, setIsMigrating] = useState(false);

  useEffect(() => {
    async function loadCloudData() {
      try {
        setIsCloudLoading(true);
        setCloudStatus("A carregar dados da cloud...");

        const rows = await fetchCloudCollection();
        const cloudState = rowsToCollectionState(rows);
        const localState = loadInitialState();

        const mergedState = mergeStates(localState, cloudState);

        setState(mergedState);
        saveState(mergedState);

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
    return ["Todas", ...Array.from(new Set(ALL_STICKERS.map((s) => s.section)))];
  }, []);

  const refreshFromCloud = async () => {
    try {
      setIsCloudLoading(true);
      setCloudStatus("A atualizar dados da cloud...");

      const rows = await fetchCloudCollection();
      const cloudState = rowsToCollectionState(rows);

      setState(cloudState);
      saveState(cloudState);

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

  const missingList = useMemo(() => {
    return ALL_STICKERS.filter((sticker) => getQuantity(state, sticker.id, owner) === 0);
  }, [state, owner]);

  const duplicateList = useMemo(() => {
    return ALL_STICKERS.filter((sticker) => getQuantity(state, sticker.id, owner) > 1);
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

  const currentUserName = USERS.find((u) => u.id === owner)?.name ?? "Diego";

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Caderneta Panini</p>
          <h1>Cromos Mundial 2026</h1>
          <p className="subtitle">
            Controlo simples das cadernetas do Diego e do Arthur.
          </p>
          <p className={`cloud-status ${cloudStatus.includes("Erro") || cloudStatus.includes("local") ? "warning" : ""}`}>
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

      <section className="dashboard">
        <div className="card stat">
          <span>Total</span>
          <strong>{summary.total}</strong>
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

      <section className="controls card">
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
          <button className={filter === "duplicates" ? "active" : ""} onClick={() => setFilter("duplicates")}>
            Repetidos
          </button>
        </div>
      </section>

      <section className="cloud-panel card">
        <div>
          <h2>Sincronização cloud</h2>
          <p>
            Usa esta área para enviar os dados deste navegador para o Supabase ou atualizar a app com os dados da cloud.
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

      <section className="reports">
        <div className="card report">
          <h2>Faltam — {currentUserName}</h2>
          <p>{missingList.length} cromos em falta</p>
          <div className="mini-list">
            {missingList.slice(0, 80).map((sticker) => (
              <span key={sticker.id}>{sticker.label}</span>
            ))}
          </div>
          {missingList.length > 80 && <small>Mostrando os primeiros 80.</small>}
        </div>

        <div className="card report">
          <h2>Repetidos — {currentUserName}</h2>
          <p>{duplicateList.length} tipos de cromos repetidos</p>
          <div className="mini-list">
            {duplicateList.slice(0, 80).map((sticker) => {
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
            {exchangeSuggestions.diegoCanGiveToArthur.slice(0, 50).map((sticker) => (
              <span key={sticker.id}>{sticker.label}</span>
            ))}
          </div>
          {exchangeSuggestions.diegoCanGiveToArthur.length === 0 && (
            <small>Nenhuma sugestão por enquanto.</small>
          )}

          <h3>Arthur pode dar ao Diego</h3>
          <div className="mini-list">
            {exchangeSuggestions.arthurCanGiveToDiego.slice(0, 50).map((sticker) => (
              <span key={sticker.id}>{sticker.label}</span>
            ))}
          </div>
          {exchangeSuggestions.arthurCanGiveToDiego.length === 0 && (
            <small>Nenhuma sugestão por enquanto.</small>
          )}
        </div>
      </section>

      <section className="backup card">
        <div>
          <h2>Backup local</h2>
          <p>
            O Supabase será a fonte principal, mas o backup continua útil como cópia de segurança.
          </p>
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
    </main>
  );
}

export default App;