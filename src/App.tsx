import { useEffect, useMemo, useState, type FormEvent } from "react";
import "./index.css";
import { ALL_STICKERS, type Sticker } from "./data/stickers";
import {
  canViewAdmin,
  getV2CurrentProfile,
  v2SignIn,
  v2SignOut,
  type V2Profile,
  type V2Role,
} from "./lib/v2Auth";
import {
  createV2User,
  fetchV2Users,
  updateV2UserActiveStatus,
  updateV2UserRole,
  type V2UserRow,
} from "./lib/v2Admin";
import {
  fetchV2Album,
  incrementV2StickerQuantity,
  upsertV2StickerQuantity,
  type V2AlbumState,
} from "./lib/v2Album";
import {
  fetchV2PerfectTradesForProfile,
  fetchV2SuggestionsForProfile,
  type V2PerfectTradeSuggestion,
  type V2Suggestion,
} from "./lib/v2Suggestions";
import {
  createV2TradeRequest,
  fetchV2TradeRequestsForProfile,
  updateV2TradeRequestStatus,
  type V2TradeRequest,
  type V2TradeStatus,
} from "./lib/v2Trades";
import {
  fetchV2CollectorsStats,
  type V2CollectorStats,
} from "./lib/v2Collectors";

type V2Section =
  | "home"
  | "album"
  | "suggestions"
  | "trade-requests"
  | "collectors"
  | "admin-users"
  | "admin-groups"
  | "admin-albums"
  | "stock";

type V2AlbumFilter = "all" | "owned" | "missing" | "duplicates";

function getRoleLabel(role: V2Role) {
  if (role === "super_admin") return "Super Admin";
  if (role === "group_admin") return "Admin do Grupo";
  if (role === "collector") return "Colecionador";
  return "Visualizador";
}

function getStickerQuantity(album: V2AlbumState, stickerId: string) {
  return album[stickerId] ?? 0;
}

function getStickerById(stickerId: string) {
  return ALL_STICKERS.find((sticker) => sticker.id === stickerId);
}

function getTradeStatusLabel(status: V2TradeStatus) {
  if (status === "pending") return "Pendente";
  if (status === "reserved") return "Reservada";
  if (status === "accepted") return "Aceite";
  if (status === "completed") return "Concluída";
  return "Cancelada";
}

function calculateV2AlbumSummary(album: V2AlbumState) {
  const total = ALL_STICKERS.length;
  let owned = 0;
  let missing = 0;
  let duplicates = 0;

  ALL_STICKERS.forEach((sticker) => {
    const quantity = getStickerQuantity(album, sticker.id);

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

function getStickerStatus(quantity: number) {
  if (quantity === 0) return "Falta";
  if (quantity === 1) return "Tenho";
  return "Repetido";
}

function V2CollectorsPage({ currentProfile }: { currentProfile: V2Profile }) {
  const [collectors, setCollectors] = useState<V2CollectorStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState("A carregar colecionadores...");
  const [search, setSearch] = useState("");

  const loadCollectors = async () => {
    try {
      setIsLoading(true);
      setStatus("A carregar colecionadores...");

      const rows = await fetchV2CollectorsStats(ALL_STICKERS.length);

      setCollectors(rows);
      setStatus(`${rows.length} colecionador(es) ativo(s).`);
    } catch (error) {
      console.error(error);
      setStatus("Não foi possível carregar os colecionadores.");
      alert("Não foi possível carregar os colecionadores.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCollectors();
  }, []);

  const filteredCollectors = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) return collectors;

    return collectors.filter((item) => {
      return (
        item.profile.display_name.toLowerCase().includes(normalizedSearch) ||
        item.profile.username.toLowerCase().includes(normalizedSearch) ||
        item.profile.role.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [collectors, search]);

  const topCollector = collectors[0];
  const totalDuplicates = collectors.reduce((total, item) => total + item.duplicates, 0);
  const totalOwned = collectors.reduce((total, item) => total + item.owned, 0);

  return (
    <section className="card v2-content-card">
      <div className="v2-section-header">
        <div>
          <p className="eyebrow dark">Plataforma</p>
          <h2>Colecionadores</h2>
          <p>{status}</p>
        </div>

        <button onClick={loadCollectors} disabled={isLoading}>
          {isLoading ? "A carregar..." : "Atualizar"}
        </button>
      </div>

      <section className="v2-collectors-summary">
        <div>
          <span>Colecionadores ativos</span>
          <strong>{collectors.length}</strong>
        </div>

        <div>
          <span>Total de cromos registados</span>
          <strong>{totalOwned}</strong>
        </div>

        <div>
          <span>Total de repetidos</span>
          <strong>{totalDuplicates}</strong>
        </div>

        <div className="highlight">
          <span>Mais completo</span>
          <strong>{topCollector ? `${topCollector.percentage}%` : "—"}</strong>
        </div>
      </section>

      <div className="v2-collectors-search">
        <label>
          Pesquisar colecionador
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ex: Arthur, Diego, colecionador..."
          />
        </label>
      </div>

      <section className="v2-collectors-list">
        {filteredCollectors.map((item, index) => {
          const isCurrentUser = item.profile.id === currentProfile.id;

          return (
            <article
              className={`v2-collector-card ${isCurrentUser ? "current" : ""}`}
              key={item.profile.id}
            >
              <div className="v2-collector-rank">
                <span>#{index + 1}</span>
              </div>

              <div className="v2-collector-info">
                <div className="v2-collector-header">
                  <div>
                    <h3>
                      {item.profile.display_name}
                      {isCurrentUser ? " · Tu" : ""}
                    </h3>
                    <p>@{item.profile.username} · {getRoleLabel(item.profile.role)}</p>
                  </div>

                  <strong>{item.percentage}%</strong>
                </div>

                <div className="v2-collector-progress">
                  <div style={{ width: `${item.percentage}%` }} />
                </div>

                <div className="v2-collector-stats">
                  <span>{item.owned} tem</span>
                  <span>{item.missing} faltam</span>
                  <span>{item.duplicates} repetidos</span>
                </div>
              </div>
            </article>
          );
        })}

        {filteredCollectors.length === 0 && !isLoading && (
          <p className="empty-message">Nenhum colecionador encontrado.</p>
        )}
      </section>
    </section>
  );
}

function V2TradeRequestsPage({ profile }: { profile: V2Profile }) {
  const [requests, setRequests] = useState<V2TradeRequest[]>([]);
  const [users, setUsers] = useState<V2UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState("A carregar propostas...");

  const loadTradeRequests = async () => {
    try {
      setIsLoading(true);
      setStatus("A carregar propostas...");

      const [tradeRows, userRows] = await Promise.all([
        fetchV2TradeRequestsForProfile(profile.id),
        fetchV2Users(),
      ]);

      setRequests(tradeRows);
      setUsers(userRows);
      setStatus(`${tradeRows.length} proposta(s) encontrada(s).`);
    } catch (error) {
      console.error(error);
      setStatus("Não foi possível carregar as propostas.");
      alert("Não foi possível carregar as propostas de troca.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTradeRequests();
  }, [profile.id]);

  const getUserName = (profileId: string) => {
    return users.find((user) => user.id === profileId)?.display_name ?? "Utilizador";
  };

  const sentRequests = requests.filter((request) => request.from_profile_id === profile.id);
  const receivedRequests = requests.filter((request) => request.to_profile_id === profile.id);

  const handleStatusUpdate = async (
    requestId: string,
    nextStatus: V2TradeStatus
  ) => {
    try {
      await updateV2TradeRequestStatus(requestId, nextStatus);
      await loadTradeRequests();
    } catch (error) {
      console.error(error);
      alert("Não foi possível atualizar a proposta.");
    }
  };

  const renderRequestCard = (request: V2TradeRequest, type: "sent" | "received") => {
    const wantedSticker = getStickerById(request.wanted_sticker_id);
    const offeredSticker = request.offered_sticker_id
      ? getStickerById(request.offered_sticker_id)
      : null;

    const otherPersonName =
      type === "sent"
        ? getUserName(request.to_profile_id)
        : getUserName(request.from_profile_id);

    return (
      <article className="v2-trade-request-card" key={request.id}>
        <div className="v2-trade-request-main">
          <span className={`v2-trade-status ${request.status}`}>
            {getTradeStatusLabel(request.status)}
          </span>

          <h3>
            {type === "sent"
              ? `Proposta enviada para ${otherPersonName}`
              : `Proposta recebida de ${otherPersonName}`}
          </h3>

          <div className="v2-trade-request-flow">
            <div>
              <span>{type === "sent" ? "Queres receber" : "Pedem-te"}</span>
              <strong>{wantedSticker?.label ?? request.wanted_sticker_id}</strong>
              <p>{wantedSticker?.name ?? "Cromo"}</p>
            </div>

            <div className="v2-trade-arrow">⇄</div>

            <div>
              <span>{type === "sent" ? "Ofereces" : "Oferecem-te"}</span>
              <strong>
                {offeredSticker?.label ?? request.offered_sticker_id ?? "—"}
              </strong>
              <p>{offeredSticker?.name ?? "Sem cromo indicado"}</p>
            </div>
          </div>

          {request.message && <p className="v2-trade-message">{request.message}</p>}
        </div>

        <div className="v2-trade-request-actions">
          {type === "received" && request.status === "pending" && (
            <button onClick={() => handleStatusUpdate(request.id, "accepted")}>
              Aceitar
            </button>
          )}

          {request.status !== "completed" && request.status !== "cancelled" && (
            <>
              <button onClick={() => handleStatusUpdate(request.id, "completed")}>
                Concluir
              </button>

              <button
                className="danger"
                onClick={() => handleStatusUpdate(request.id, "cancelled")}
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </article>
    );
  };

  return (
    <section className="card v2-content-card">
      <div className="v2-section-header">
        <div>
          <p className="eyebrow dark">Trocas</p>
          <h2>Propostas de troca</h2>
          <p>{status}</p>
        </div>

        <button onClick={loadTradeRequests} disabled={isLoading}>
          {isLoading ? "A carregar..." : "Atualizar"}
        </button>
      </div>

      <section className="v2-suggestions-summary">
        <div>
          <span>Recebidas</span>
          <strong>{receivedRequests.length}</strong>
        </div>

        <div>
          <span>Enviadas</span>
          <strong>{sentRequests.length}</strong>
        </div>
      </section>

      <section className="v2-trade-requests-section">
        <div className="v2-subsection-title">
          <div>
            <p className="eyebrow dark">Para ti</p>
            <h3>Propostas recebidas</h3>
          </div>
          <span>{receivedRequests.length}</span>
        </div>

        <div className="v2-trade-requests-list">
          {receivedRequests.map((request) => renderRequestCard(request, "received"))}

          {receivedRequests.length === 0 && !isLoading && (
            <p className="empty-message">Ainda não recebeste propostas de troca.</p>
          )}
        </div>
      </section>

      <section className="v2-trade-requests-section">
        <div className="v2-subsection-title">
          <div>
            <p className="eyebrow dark">Criadas por ti</p>
            <h3>Propostas enviadas</h3>
          </div>
          <span>{sentRequests.length}</span>
        </div>

        <div className="v2-trade-requests-list">
          {sentRequests.map((request) => renderRequestCard(request, "sent"))}

          {sentRequests.length === 0 && !isLoading && (
            <p className="empty-message">Ainda não enviaste propostas de troca.</p>
          )}
        </div>
      </section>
    </section>
  );
}

function V2SuggestionsPage({ profile }: { profile: V2Profile }) {
  const [suggestions, setSuggestions] = useState<V2Suggestion[]>([]);
  const [perfectTrades, setPerfectTrades] = useState<V2PerfectTradeSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingTrade, setIsCreatingTrade] = useState(false);
  const [status, setStatus] = useState("A carregar sugestões...");
  const [search, setSearch] = useState("");

  const loadSuggestions = async () => {
    try {
      setIsLoading(true);
      setStatus("A carregar sugestões...");

      const [simpleRows, perfectRows] = await Promise.all([
        fetchV2SuggestionsForProfile(profile),
        fetchV2PerfectTradesForProfile(profile),
      ]);

      setSuggestions(simpleRows);
      setPerfectTrades(perfectRows);

      setStatus(
        `${perfectRows.length} troca(s) perfeita(s) e ${simpleRows.length} sugestão(ões) simples.`
      );
    } catch (error) {
      console.error(error);
      setStatus("Não foi possível carregar as sugestões.");
      alert("Não foi possível carregar as sugestões de troca.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, [profile.id]);

  const handleCreatePerfectTrade = async (trade: V2PerfectTradeSuggestion) => {
    if (!profile.group_id) {
      // Mantemos compatibilidade com a tabela atual. Depois podemos remover group_id totalmente.
      alert("Este utilizador não tem grupo associado.");
      return;
    }

    const confirmed = window.confirm(
      `Queres propor esta troca a ${trade.other_name}?`
    );

    if (!confirmed) return;

    try {
      setIsCreatingTrade(true);
      setStatus("A criar proposta de troca...");

      await createV2TradeRequest({
        group_id: profile.group_id,
        from_profile_id: profile.id,
        to_profile_id: trade.other_profile_id,
        wanted_sticker_id: trade.sticker_i_need_id,
        offered_sticker_id: trade.sticker_they_need_id,
        message: "Proposta criada a partir de uma troca perfeita sugerida pela app.",
      });

      setStatus("Proposta de troca criada.");
      alert("Proposta de troca criada com sucesso.");
    } catch (error) {
      console.error(error);
      setStatus("Não foi possível criar a proposta.");
      alert("Não foi possível criar a proposta de troca.");
    } finally {
      setIsCreatingTrade(false);
    }
  };

  const filteredSuggestions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return suggestions;
    }

    return suggestions.filter((suggestion) => {
      const sticker = getStickerById(suggestion.sticker_id);

      return (
        suggestion.offered_by_name.toLowerCase().includes(normalizedSearch) ||
        suggestion.offered_by_username.toLowerCase().includes(normalizedSearch) ||
        sticker?.label.toLowerCase().includes(normalizedSearch) ||
        sticker?.name.toLowerCase().includes(normalizedSearch) ||
        sticker?.section.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [suggestions, search]);

  const filteredPerfectTrades = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return perfectTrades;
    }

    return perfectTrades.filter((trade) => {
      const stickerINeed = getStickerById(trade.sticker_i_need_id);
      const stickerTheyNeed = getStickerById(trade.sticker_they_need_id);

      return (
        trade.other_name.toLowerCase().includes(normalizedSearch) ||
        trade.other_username.toLowerCase().includes(normalizedSearch) ||
        stickerINeed?.label.toLowerCase().includes(normalizedSearch) ||
        stickerINeed?.name.toLowerCase().includes(normalizedSearch) ||
        stickerINeed?.section.toLowerCase().includes(normalizedSearch) ||
        stickerTheyNeed?.label.toLowerCase().includes(normalizedSearch) ||
        stickerTheyNeed?.name.toLowerCase().includes(normalizedSearch) ||
        stickerTheyNeed?.section.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [perfectTrades, search]);

  const suggestionsByUser = useMemo(() => {
    const grouped = new Map<string, V2Suggestion[]>();

    filteredSuggestions.forEach((suggestion) => {
      const key = suggestion.offered_by_profile_id;
      const current = grouped.get(key) ?? [];
      current.push(suggestion);
      grouped.set(key, current);
    });

    return Array.from(grouped.entries()).map(([profileId, rows]) => ({
      profileId,
      name: rows[0]?.offered_by_name ?? "Utilizador",
      username: rows[0]?.offered_by_username ?? "",
      rows,
    }));
  }, [filteredSuggestions]);

  return (
    <section className="card v2-content-card">
      <div className="v2-section-header">
        <div>
          <p className="eyebrow dark">Trocas</p>
          <h2>Sugestões de troca</h2>
          <p>
            {profile.display_name} · {status}
          </p>
        </div>

        <button onClick={loadSuggestions} disabled={isLoading || isCreatingTrade}>
          {isLoading ? "A carregar..." : "Atualizar"}
        </button>
      </div>

      <section className="v2-suggestions-summary">
        <div>
          <span>Trocas perfeitas</span>
          <strong>{perfectTrades.length}</strong>
        </div>

        <div>
          <span>Sugestões simples</span>
          <strong>{suggestions.length}</strong>
        </div>

        <div>
          <span>Pessoas que podem ajudar</span>
          <strong>{suggestionsByUser.length}</strong>
        </div>
      </section>

      <div className="v2-suggestions-search">
        <label>
          Pesquisar sugestão
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ex: Arthur, ARG 10, Brasil..."
          />
        </label>
      </div>

      <section className="v2-perfect-trades-section">
        <div className="v2-subsection-title">
          <div>
            <p className="eyebrow dark">Melhores oportunidades</p>
            <h3>Trocas perfeitas</h3>
          </div>
          <span>{filteredPerfectTrades.length}</span>
        </div>

        <div className="v2-perfect-trades-list">
          {filteredPerfectTrades.map((trade) => {
            const stickerINeed = getStickerById(trade.sticker_i_need_id);
            const stickerTheyNeed = getStickerById(trade.sticker_they_need_id);

            return (
              <article
                className="v2-perfect-trade-card"
                key={`${trade.other_profile_id}-${trade.sticker_i_need_id}-${trade.sticker_they_need_id}`}
              >
                <div className="v2-perfect-trade-person">
                  <span>Troca com</span>
                  <h4>{trade.other_name}</h4>
                  <p>@{trade.other_username}</p>
                </div>

                <div className="v2-perfect-trade-flow">
                  <div>
                    <span>Tu recebes</span>
                    <strong>{stickerINeed?.label ?? trade.sticker_i_need_id}</strong>
                    <p>{stickerINeed?.name ?? "Cromo"}</p>
                    <small>
                      {trade.other_available_duplicates} disponível
                      {trade.other_available_duplicates > 1 ? "is" : ""}
                    </small>
                  </div>

                  <div className="v2-trade-arrow">⇄</div>

                  <div>
                    <span>{trade.other_name} recebe</span>
                    <strong>
                      {stickerTheyNeed?.label ?? trade.sticker_they_need_id}
                    </strong>
                    <p>{stickerTheyNeed?.name ?? "Cromo"}</p>
                    <small>
                      {trade.my_available_duplicates} disponível
                      {trade.my_available_duplicates > 1 ? "is" : ""}
                    </small>
                  </div>
                </div>

                <button
                  className="v2-propose-trade-button"
                  onClick={() => handleCreatePerfectTrade(trade)}
                  disabled={isCreatingTrade}
                >
                  {isCreatingTrade ? "A criar..." : "Propor esta troca"}
                </button>
              </article>
            );
          })}

          {filteredPerfectTrades.length === 0 && !isLoading && (
            <p className="empty-message">
              Ainda não há trocas perfeitas para a tua caderneta.
            </p>
          )}
        </div>
      </section>

      <section className="v2-simple-suggestions-section">
        <div className="v2-subsection-title">
          <div>
            <p className="eyebrow dark">Ajuda possível</p>
            <h3>Sugestões simples</h3>
          </div>
          <span>{filteredSuggestions.length}</span>
        </div>

        <section className="v2-suggestions-list">
          {suggestionsByUser.map((group) => (
            <article className="v2-suggestion-group" key={group.profileId}>
              <div className="v2-suggestion-group-header">
                <div>
                  <span>Pode ajudar</span>
                  <h3>{group.name}</h3>
                  <p>@{group.username}</p>
                </div>

                <strong>{group.rows.length} cromo(s)</strong>
              </div>

              <div className="v2-suggestion-stickers">
                {group.rows.map((suggestion) => {
                  const sticker = getStickerById(suggestion.sticker_id);

                  return (
                    <div
                      className="v2-suggestion-card"
                      key={`${suggestion.offered_by_profile_id}-${suggestion.sticker_id}`}
                    >
                      <span>{sticker?.label ?? suggestion.sticker_id}</span>

                      <div>
                        <strong>{sticker?.name ?? "Cromo"}</strong>
                        <p>{sticker?.section ?? "Secção desconhecida"}</p>
                      </div>

                      <small>
                        {suggestion.available_duplicates} disponível
                        {suggestion.available_duplicates > 1 ? "is" : ""}
                      </small>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}

          {filteredSuggestions.length === 0 && !isLoading && (
            <p className="empty-message">
              Ainda não há sugestões simples para a tua caderneta.
            </p>
          )}
        </section>
      </section>
    </section>
  );
}

function V2AlbumPage({ profile }: { profile: V2Profile }) {
  const [album, setAlbum] = useState<V2AlbumState>({});
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState("A carregar caderneta...");
  const [selectedSection, setSelectedSection] = useState("Todas");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<V2AlbumFilter>("all");

  const loadAlbum = async () => {
    try {
      setIsLoading(true);
      setStatus("A carregar caderneta...");

      const state = await fetchV2Album(profile.id);

      setAlbum(state);
      setStatus("Caderneta sincronizada.");
    } catch (error) {
      console.error(error);
      setStatus("Não foi possível carregar a caderneta.");
      alert("Não foi possível carregar a caderneta.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAlbum();
  }, [profile.id]);

  const summary = useMemo(() => calculateV2AlbumSummary(album), [album]);

  const sections = useMemo(() => {
    const uniqueSections = Array.from(
      new Set(ALL_STICKERS.map((sticker) => sticker.section))
    );

    return [
      "Todas",
      ...uniqueSections.sort((a, b) =>
        a.localeCompare(b, "pt", { sensitivity: "base" })
      ),
    ];
  }, []);

  const filteredStickers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return ALL_STICKERS.filter((sticker) => {
      const quantity = getStickerQuantity(album, sticker.id);

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
  }, [album, selectedSection, search, filter]);

  const updateQuantity = async (sticker: Sticker, change: number) => {
    const currentQuantity = getStickerQuantity(album, sticker.id);
    const nextQuantity = Math.max(0, currentQuantity + change);

    if (nextQuantity === currentQuantity) return;

    const previousAlbum = album;

    setAlbum({
      ...album,
      [sticker.id]: nextQuantity,
    });

    try {
      setStatus("A guardar alteração...");

      await incrementV2StickerQuantity(
        profile.id,
        sticker.id,
        currentQuantity,
        change
      );

      setStatus("Caderneta sincronizada.");
    } catch (error) {
      console.error(error);
      setAlbum(previousAlbum);
      setStatus("Erro ao guardar alteração.");
      alert("Não foi possível guardar esta alteração.");
    }
  };

  const setDirectQuantity = async (sticker: Sticker, quantityText: string) => {
    const nextQuantity = Math.max(0, Number(quantityText) || 0);
    const previousAlbum = album;

    setAlbum({
      ...album,
      [sticker.id]: nextQuantity,
    });

    try {
      setStatus("A guardar alteração...");

      await upsertV2StickerQuantity(profile.id, sticker.id, nextQuantity);

      setStatus("Caderneta sincronizada.");
    } catch (error) {
      console.error(error);
      setAlbum(previousAlbum);
      setStatus("Erro ao guardar alteração.");
      alert("Não foi possível guardar esta alteração.");
    }
  };

  return (
    <section className="v2-album-page">
      <section className="card v2-content-card">
        <div className="v2-section-header">
          <div>
            <p className="eyebrow dark">Caderneta</p>
            <h2>A minha caderneta</h2>
            <p>
              {profile.display_name} · {status}
            </p>
          </div>

          <button onClick={loadAlbum} disabled={isLoading}>
            {isLoading ? "A carregar..." : "Atualizar"}
          </button>
        </div>

        <section className="v2-album-summary">
          <div>
            <span>Total</span>
            <strong>{summary.total}</strong>
          </div>

          <div>
            <span>Já tenho</span>
            <strong>{summary.owned}</strong>
          </div>

          <div>
            <span>Faltam</span>
            <strong>{summary.missing}</strong>
          </div>

          <div>
            <span>Repetidos</span>
            <strong>{summary.duplicates}</strong>
          </div>

          <div className="highlight">
            <span>Completo</span>
            <strong>{summary.percentage}%</strong>
          </div>
        </section>

        <div className="v2-progress-bar">
          <div style={{ width: `${summary.percentage}%` }} />
        </div>
      </section>

      <section className="card v2-content-card">
        <div className="v2-album-controls">
          <label>
            Secção / País
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
          </label>

          <label>
            Pesquisar
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ex: ARG 17, Messi, Brasil, FWC..."
            />
          </label>

          <div className="v2-filter-buttons">
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
        </div>

        <section className="v2-stickers-list">
          {filteredStickers.map((sticker) => {
            const quantity = getStickerQuantity(album, sticker.id);
            const statusLabel = getStickerStatus(quantity);
            const duplicates = quantity > 1 ? quantity - 1 : 0;

            return (
              <article className="card v2-sticker-card" key={sticker.id}>
                <div>
                  <span className="v2-sticker-label">{sticker.label}</span>
                  <h3>{sticker.name}</h3>
                  <p>{sticker.section}</p>
                </div>

                <div className="v2-sticker-actions">
                  <span
                    className={`v2-sticker-status ${statusLabel.toLowerCase()}`}
                  >
                    {statusLabel}
                  </span>

                  {duplicates > 0 && (
                    <small>
                      {duplicates} repetido{duplicates > 1 ? "s" : ""}
                    </small>
                  )}

                  <div className="v2-quantity-controls">
                    <button onClick={() => updateQuantity(sticker, -1)}>-</button>

                    <input
                      value={quantity}
                      inputMode="numeric"
                      onChange={(event) =>
                        setDirectQuantity(sticker, event.target.value)
                      }
                    />

                    <button onClick={() => updateQuantity(sticker, 1)}>+</button>
                  </div>
                </div>
              </article>
            );
          })}

          {filteredStickers.length === 0 && (
            <p className="empty-message">
              Nenhum cromo encontrado com estes filtros.
            </p>
          )}
        </section>
      </section>
    </section>
  );
}

function V2AdminUsers({ currentProfile }: { currentProfile: V2Profile }) {
  const [users, setUsers] = useState<V2UserRow[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [status, setStatus] = useState("A carregar utilizadores...");

  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<V2Role>("collector");

  const loadUsers = async () => {
    try {
      setIsLoadingUsers(true);
      setStatus("A carregar utilizadores...");

      const rows = await fetchV2Users();

      setUsers(rows);
      setStatus(`${rows.length} utilizador(es) encontrado(s).`);
    } catch (error) {
      console.error(error);
      setStatus("Não foi possível carregar os utilizadores.");
      alert("Não foi possível carregar os utilizadores.");
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (event: FormEvent) => {
    event.preventDefault();

    if (!newUsername.trim() || !newDisplayName.trim() || !newPassword.trim()) {
      alert("Preenche username, nome e senha.");
      return;
    }

    if (newPassword.trim().length < 6) {
      alert("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    try {
      setIsCreatingUser(true);
      setStatus("A criar utilizador...");

      await createV2User({
        username: newUsername,
        display_name: newDisplayName,
        password: newPassword,
        role: newRole,
        group_slug: "familia-mello",
      });

      setNewUsername("");
      setNewDisplayName("");
      setNewPassword("");
      setNewRole("collector");

      await loadUsers();

      alert("Utilizador criado com sucesso.");
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível criar o utilizador.";
      setStatus(message);
      alert(message);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleRoleChange = async (profileId: string, role: V2Role) => {
    try {
      await updateV2UserRole(profileId, role);
      await loadUsers();
    } catch (error) {
      console.error(error);
      alert("Não foi possível alterar a role.");
    }
  };

  const handleActiveChange = async (profileId: string, isActive: boolean) => {
    try {
      await updateV2UserActiveStatus(profileId, isActive);
      await loadUsers();
    } catch (error) {
      console.error(error);
      alert("Não foi possível alterar o estado do utilizador.");
    }
  };

  return (
    <section className="card v2-content-card">
      <div className="v2-section-header">
        <div>
          <p className="eyebrow dark">Administração</p>
          <h2>Gerir utilizadores</h2>
          <p>{status}</p>
        </div>

        <button onClick={loadUsers} disabled={isLoadingUsers || isCreatingUser}>
          {isLoadingUsers ? "A carregar..." : "Atualizar"}
        </button>
      </div>

      <form className="v2-create-user-form" onSubmit={handleCreateUser}>
        <div>
          <h3>Criar novo utilizador</h3>
          <p>
            O utilizador entra com username e senha. O email técnico é criado
            automaticamente.
          </p>
        </div>

        <div className="v2-create-user-grid">
          <label>
            Username
            <input
              value={newUsername}
              onChange={(event) => setNewUsername(event.target.value)}
              placeholder="Ex: joao"
              autoCapitalize="none"
            />
          </label>

          <label>
            Nome
            <input
              value={newDisplayName}
              onChange={(event) => setNewDisplayName(event.target.value)}
              placeholder="Ex: João"
            />
          </label>

          <label>
            Senha inicial
            <input
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Mínimo 6 caracteres"
              type="password"
            />
          </label>

          <label>
            Role
            <select
              value={newRole}
              onChange={(event) => setNewRole(event.target.value as V2Role)}
            >
              <option value="collector">Colecionador</option>
              <option value="viewer">Visualizador</option>
              <option value="group_admin">Admin do Grupo</option>
              {currentProfile.role === "super_admin" && (
                <option value="super_admin">Super Admin</option>
              )}
            </select>
          </label>
        </div>

        <button type="submit" disabled={isCreatingUser}>
          {isCreatingUser ? "A criar..." : "Criar utilizador"}
        </button>
      </form>

      <div className="v2-users-list">
        {users.map((user) => {
          const isCurrentUser = user.id === currentProfile.id;

          return (
            <article className="v2-user-row" key={user.id}>
              <div className="v2-user-main">
                <span
                  className={`v2-user-status ${
                    user.is_active ? "active" : "inactive"
                  }`}
                >
                  {user.is_active ? "Ativo" : "Inativo"}
                </span>

                <h3>{user.display_name}</h3>

                <p>
                  Username: <strong>{user.username}</strong>
                </p>

                {isCurrentUser && (
                  <p className="v2-self-warning">
                    Não podes alterar a tua própria role nem desativar o teu
                    acesso.
                  </p>
                )}
              </div>

              <div className="v2-user-actions">
                <label>
                  Role
                  <select
                    value={user.role}
                    disabled={isCurrentUser}
                    onChange={(event) =>
                      handleRoleChange(user.id, event.target.value as V2Role)
                    }
                  >
                    <option value="super_admin">Super Admin</option>
                    <option value="group_admin">Admin do Grupo</option>
                    <option value="collector">Colecionador</option>
                    <option value="viewer">Visualizador</option>
                  </select>
                </label>

                <button
                  className={user.is_active ? "danger" : ""}
                  disabled={isCurrentUser}
                  onClick={() => handleActiveChange(user.id, !user.is_active)}
                >
                  {isCurrentUser
                    ? "O teu acesso"
                    : user.is_active
                      ? "Desativar"
                      : "Ativar"}
                </button>
              </div>
            </article>
          );
        })}

        {users.length === 0 && !isLoadingUsers && (
          <p className="empty-message">Ainda não existem utilizadores V2.</p>
        )}
      </div>
    </section>
  );
}

function V2Dashboard({
  profile,
  onSignOut,
}: {
  profile: V2Profile;
  onSignOut: () => void;
}) {
  const [section, setSection] = useState<V2Section>("home");
  const showAdmin = canViewAdmin(profile);

  const renderContent = () => {
    if (section === "album") {
      return <V2AlbumPage profile={profile} />;
    }

    if (section === "suggestions") {
      return <V2SuggestionsPage profile={profile} />;
    }

    if (section === "trade-requests") {
      return <V2TradeRequestsPage profile={profile} />;
    }

    if (section === "collectors") {
      return <V2CollectorsPage currentProfile={profile} />;
    }

    if (section === "admin-users") {
      return <V2AdminUsers currentProfile={profile} />;
    }

    if (section === "admin-groups") {
      return (
        <section className="card v2-content-card">
          <p className="eyebrow dark">Administração</p>
          <h2>Gerir grupos</h2>
          <p>
            Este módulo pode ficar reservado para uma fase futura, caso queiras
            criar comunidades ou ligas privadas.
          </p>
        </section>
      );
    }

    if (section === "admin-albums") {
      return (
        <section className="card v2-content-card">
          <p className="eyebrow dark">Administração</p>
          <h2>Ver cadernetas</h2>
          <p>
            Aqui o admin poderá consultar cadernetas de outros utilizadores.
          </p>
        </section>
      );
    }

    if (section === "stock") {
      return (
        <section className="card v2-content-card">
          <p className="eyebrow dark">Stock</p>
          <h2>Stock de saquetas</h2>
          <p>
            Aqui vamos ligar o módulo já existente de disponibilidade online das
            saquetas.
          </p>
        </section>
      );
    }

    return (
      <section className="v2-dashboard-grid">
        <button className="card v2-menu-card" onClick={() => setSection("album")}>
          <span>01</span>
          <h2>A minha caderneta</h2>
          <p>Adicionar, remover e consultar os meus cromos.</p>
        </button>

        <button
          className="card v2-menu-card"
          onClick={() => setSection("suggestions")}
        >
          <span>02</span>
          <h2>Sugestões de troca</h2>
          <p>Ver quem tem cromos repetidos que me faltam.</p>
        </button>

        <button
          className="card v2-menu-card"
          onClick={() => setSection("trade-requests")}
        >
          <span>03</span>
          <h2>Propostas de troca</h2>
          <p>Acompanhar propostas enviadas e recebidas.</p>
        </button>

        <button className="card v2-menu-card" onClick={() => setSection("collectors")}>
          <span>04</span>
          <h2>Colecionadores</h2>
          <p>Ver ranking geral, progresso e repetidos da plataforma.</p>
        </button>

        <button className="card v2-menu-card" onClick={() => setSection("stock")}>
          <span>05</span>
          <h2>Stock de saquetas</h2>
          <p>Consultar disponibilidade online das saquetas.</p>
        </button>

        {showAdmin && (
          <>
            <button
              className="card v2-menu-card admin"
              onClick={() => setSection("admin-users")}
            >
              <span>A1</span>
              <h2>Gerir utilizadores</h2>
              <p>Criar utilizadores, definir roles e ativar/desativar acessos.</p>
            </button>

            <button
              className="card v2-menu-card admin"
              onClick={() => setSection("admin-albums")}
            >
              <span>A2</span>
              <h2>Ver cadernetas</h2>
              <p>Consultar cadernetas de outros utilizadores.</p>
            </button>
          </>
        )}
      </section>
    );
  };

  return (
    <main className="app v2-app">
      <header className="hero public-hero">
        <div>
          <p className="eyebrow">Cromos Mundial 2026</p>
          <h1>V2 Plataforma Aberta</h1>
          <p className="subtitle">
            Colecionadores, cadernetas individuais e trocas automáticas entre todos.
          </p>
          <p className="cloud-status">
            🔐 Sessão ativa · {getRoleLabel(profile.role)}
          </p>
        </div>

        <button className="v2-logout-button" onClick={onSignOut}>
          Sair
        </button>
      </header>

      <section className="card v2-user-card">
        <div>
          <span>Olá</span>
          <h2>{profile.display_name}</h2>
          <p>
            Username: <strong>{profile.username}</strong>
          </p>
        </div>

        <div>
          <span>Role</span>
          <h2>{getRoleLabel(profile.role)}</h2>
          <p>
            Estado: <strong>{profile.is_active ? "Ativo" : "Inativo"}</strong>
          </p>
        </div>
      </section>

      {section !== "home" && (
        <button className="v2-back-button" onClick={() => setSection("home")}>
          ← Voltar ao dashboard
        </button>
      )}

      {renderContent()}
    </main>
  );
}

function V2LoginPage() {
  const [profile, setProfile] = useState<V2Profile | null>(null);
  const [username, setUsername] = useState("daniel");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("A verificar sessão...");
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const loadProfile = async () => {
    try {
      setIsLoading(true);

      const currentProfile = await getV2CurrentProfile();

      setProfile(currentProfile);
      setStatus(
        currentProfile
          ? "Sessão ativa"
          : "Introduz o utilizador e senha para entrar."
      );
    } catch (error) {
      console.error(error);
      setProfile(null);
      setStatus("Não foi possível carregar a sessão.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault();

    if (!username.trim() || !password.trim()) {
      alert("Preenche o utilizador e a senha.");
      return;
    }

    try {
      setIsSigningIn(true);
      setStatus("A iniciar sessão...");

      await v2SignIn(username, password);
      await loadProfile();
    } catch (error) {
      console.error(error);
      setStatus("Utilizador ou senha inválidos.");
      alert("Utilizador ou senha inválidos.");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await v2SignOut();
      setProfile(null);
      setPassword("");
      setStatus("Sessão terminada.");
    } catch (error) {
      console.error(error);
      alert("Não foi possível terminar sessão.");
    }
  };

  if (isLoading) {
    return (
      <main className="app">
        <header className="hero public-hero">
          <div>
            <p className="eyebrow">Cromos Mundial 2026</p>
            <h1>V2</h1>
            <p className="subtitle">A carregar a nova área multiutilizador...</p>
            <p className="cloud-status">⏳ {status}</p>
          </div>
        </header>
      </main>
    );
  }

  if (profile) {
    return <V2Dashboard profile={profile} onSignOut={handleSignOut} />;
  }

  return (
    <main className="app v2-app">
      <header className="hero public-hero">
        <div>
          <p className="eyebrow">Cromos Mundial 2026</p>
          <h1>V2 Plataforma Aberta</h1>
          <p className="subtitle">
            Cria a tua conta, controla a tua caderneta e encontra trocas com outros colecionadores.
          </p>
          <p className="cloud-status">🔐 {status}</p>
        </div>
      </header>

      <section className="card v2-login-card">
        <h2>Entrar na V2</h2>
        <p>Usa apenas o utilizador e a senha. Não é necessário email para entrar.</p>

        <form className="v2-login-form" onSubmit={handleSignIn}>
          <label>
            Utilizador
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Ex: daniel"
              autoCapitalize="none"
              autoComplete="username"
            />
          </label>

          <label>
            Senha
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Senha"
              type="password"
              autoComplete="current-password"
            />
          </label>

          <button type="submit" disabled={isSigningIn}>
            {isSigningIn ? "A entrar..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}

function App() {
  return <V2LoginPage />;
}

export default App;