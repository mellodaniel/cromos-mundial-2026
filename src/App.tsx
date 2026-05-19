import { useEffect, useState, type FormEvent } from "react";
import "./index.css";
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

type V2Section =
  | "home"
  | "album"
  | "suggestions"
  | "group"
  | "admin-users"
  | "admin-groups"
  | "admin-albums"
  | "stock";

function getRoleLabel(role: V2Role) {
  if (role === "super_admin") return "Super Admin";
  if (role === "group_admin") return "Admin do Grupo";
  if (role === "collector") return "Colecionador";
  return "Visualizador";
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

                <p>
                  Grupo:{" "}
                  <strong>
                    {user.group_name ?? user.group_slug ?? "Sem grupo"}
                  </strong>
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
      return (
        <section className="card v2-content-card">
          <p className="eyebrow dark">Caderneta</p>
          <h2>A minha caderneta</h2>
          <p>
            Aqui vamos colocar a gestão dos cromos do utilizador autenticado.
            Cada utilizador terá a sua própria caderneta privada.
          </p>
        </section>
      );
    }

    if (section === "suggestions") {
      return (
        <section className="card v2-content-card">
          <p className="eyebrow dark">Trocas</p>
          <h2>Sugestões de troca</h2>
          <p>
            Aqui a app vai comparar repetidos e faltas entre utilizadores do
            mesmo grupo e sugerir trocas automaticamente.
          </p>
        </section>
      );
    }

    if (section === "group") {
      return (
        <section className="card v2-content-card">
          <p className="eyebrow dark">Grupo</p>
          <h2>O meu grupo</h2>
          <p>
            Aqui vamos mostrar os membros do grupo, estatísticas e progresso das
            cadernetas.
          </p>
          <p>
            Grupo ID: <strong>{profile.group_id ?? "Sem grupo"}</strong>
          </p>
        </section>
      );
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
            Aqui vamos criar e gerir grupos, como Família Mello, equipa, escola
            ou amigos.
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
            Aqui o admin poderá consultar cadernetas dos utilizadores do grupo
            ou, no caso do super admin, de todos os grupos.
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

        <button className="card v2-menu-card" onClick={() => setSection("group")}>
          <span>03</span>
          <h2>O meu grupo</h2>
          <p>Ver membros, progresso e informação do grupo.</p>
        </button>

        <button className="card v2-menu-card" onClick={() => setSection("stock")}>
          <span>04</span>
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
              onClick={() => setSection("admin-groups")}
            >
              <span>A2</span>
              <h2>Gerir grupos</h2>
              <p>Criar grupos e organizar colecionadores.</p>
            </button>

            <button
              className="card v2-menu-card admin"
              onClick={() => setSection("admin-albums")}
            >
              <span>A3</span>
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
          <h1>V2 Multiutilizador</h1>
          <p className="subtitle">
            Utilizadores, grupos, permissões e sugestões automáticas de trocas.
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
          <h1>V2 Multiutilizador</h1>
          <p className="subtitle">
            Nova versão com utilizadores, grupos, permissões e cadernetas privadas.
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