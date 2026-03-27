import { useEffect, useMemo, useState } from "react";
import {
  addJogador,
  addTime,
  deactivateJogador,
  deactivateTime,
  getConfig,
  listJogadores,
  listTimes,
  updateJogador,
  updateTime,
} from "../services/api";
import "./CadastrosPage.css";

const initialTimeForm = {
  ID_Time: "",
  Nome_Time: "",
  Categoria: "",
  Responsavel: "",
  Telefone: "",
  Ativo: "Sim",
  Observacoes: "",
};

const initialPlayerForm = {
  ID_Jogador: "",
  Nome_Jogador: "",
  ID_Time: "",
  Nome_Time: "",
  Posicao: "",
  Telefone: "",
  Ativo: "Sim",
  Observacoes: "",
};

function normalizeText(value) {
  return String(value ?? "").trim();
}

function CadastrosPage() {
  const [activeTab, setActiveTab] = useState("times");

  const [timesView, setTimesView] = useState("form");
  const [times, setTimes] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loadingTimes, setLoadingTimes] = useState(true);
  const [savingTime, setSavingTime] = useState(false);
  const [timeMessage, setTimeMessage] = useState("");
  const [timeMessageType, setTimeMessageType] = useState("");
  const [timeForm, setTimeForm] = useState(initialTimeForm);
  const [editingTimeId, setEditingTimeId] = useState("");
  const [searchTime, setSearchTime] = useState("");

  const [playersView, setPlayersView] = useState("form");
  const [players, setPlayers] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [playerForm, setPlayerForm] = useState(initialPlayerForm);
  const [editingPlayerId, setEditingPlayerId] = useState("");
  const [playerMessage, setPlayerMessage] = useState("");
  const [playerMessageType, setPlayerMessageType] = useState("");
  const [searchPlayer, setSearchPlayer] = useState("");

  async function loadTimesAndConfig() {
    const [timesResponse, configResponse] = await Promise.all([
      listTimes(),
      getConfig(),
    ]);

    setTimes(timesResponse.data || []);
    setCategorias(configResponse.data?.Categoria_Time || []);
  }

  async function loadPlayers() {
    const jogadoresResponse = await listJogadores();
    setPlayers(jogadoresResponse.data || []);
  }

  async function loadPageData() {
    try {
      setLoadingTimes(true);
      setLoadingPlayers(true);
      setTimeMessage("");
      setPlayerMessage("");

      await Promise.all([loadTimesAndConfig(), loadPlayers()]);
    } catch (error) {
      setTimeMessage(error.message);
      setTimeMessageType("error");
      setPlayerMessage(error.message);
      setPlayerMessageType("error");
    } finally {
      setLoadingTimes(false);
      setLoadingPlayers(false);
    }
  }

  useEffect(() => {
    loadPageData();
  }, []);

  const activeTimes = useMemo(() => {
    return times.filter((item) => normalizeText(item.Ativo).toLowerCase() === "sim");
  }, [times]);

  const totalTimesAtivos = useMemo(() => {
    return activeTimes.length;
  }, [activeTimes]);

  const filteredTimes = useMemo(() => {
    return times.filter((time) => {
      const nome = normalizeText(time.Nome_Time).toLowerCase();
      const categoria = normalizeText(time.Categoria).toLowerCase();
      const termo = searchTime.toLowerCase();

      return nome.includes(termo) || categoria.includes(termo);
    });
  }, [times, searchTime]);

  const totalPlayersAtivos = useMemo(() => {
    return players.filter((item) => normalizeText(item.Ativo).toLowerCase() === "sim").length;
  }, [players]);

  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      const nome = normalizeText(player.Nome_Jogador).toLowerCase();
      const time = normalizeText(player.Nome_Time).toLowerCase();
      const posicao = normalizeText(player.Posicao).toLowerCase();
      const termo = searchPlayer.toLowerCase();

      return (
        nome.includes(termo) ||
        time.includes(termo) ||
        posicao.includes(termo)
      );
    });
  }, [players, searchPlayer]);

  function handleTimeChange(event) {
    const { name, value } = event.target;
    setTimeForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handlePlayerChange(event) {
    const { name, value } = event.target;

    if (name === "ID_Time") {
      const selectedTime = times.find(
        (item) => String(item.ID_Time) === String(value)
      );

      setPlayerForm((current) => ({
        ...current,
        ID_Time: value,
        Nome_Time: selectedTime?.Nome_Time || "",
      }));
      return;
    }

    setPlayerForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function buildNewTimeId() {
    return `TIME-${Date.now()}`;
  }

  function buildNewPlayerId() {
    return `JOG-${Date.now()}`;
  }

  function clearTimeForm() {
    setTimeForm(initialTimeForm);
    setEditingTimeId("");
  }

  function clearPlayerForm() {
    setPlayerForm(initialPlayerForm);
    setEditingPlayerId("");
  }

  function startEditTime(time) {
    setTimeForm({
      ID_Time: time.ID_Time || "",
      Nome_Time: time.Nome_Time || "",
      Categoria: time.Categoria || "",
      Responsavel: time.Responsavel || "",
      Telefone: time.Telefone || "",
      Ativo: time.Ativo || "Sim",
      Observacoes: time.Observacoes || "",
    });

    setEditingTimeId(time.ID_Time || "");
    setTimesView("form");
    setTimeMessage("");
    setTimeMessageType("");
  }

  function cancelTimeEdit() {
    clearTimeForm();
    setTimeMessage("");
    setTimeMessageType("");
  }

  async function handleTimeSubmit(event) {
    event.preventDefault();

    if (!normalizeText(timeForm.Nome_Time)) {
      setTimeMessage("Informe o nome do time.");
      setTimeMessageType("error");
      return;
    }

    try {
      setSavingTime(true);
      setTimeMessage("");

      const payload = {
        ...timeForm,
        ID_Time: normalizeText(timeForm.ID_Time) || buildNewTimeId(),
        Nome_Time: normalizeText(timeForm.Nome_Time),
        Categoria: normalizeText(timeForm.Categoria),
        Responsavel: normalizeText(timeForm.Responsavel),
        Telefone: normalizeText(timeForm.Telefone),
        Ativo: normalizeText(timeForm.Ativo) || "Sim",
        Observacoes: normalizeText(timeForm.Observacoes),
      };

      if (editingTimeId) {
        await updateTime(payload);
        setTimeMessage("Time atualizado com sucesso.");
      } else {
        await addTime(payload);
        setTimeMessage("Time cadastrado com sucesso.");
      }

      setTimeMessageType("success");
      clearTimeForm();
      await loadTimesAndConfig();
      setTimesView("list");
    } catch (error) {
      setTimeMessage(error.message);
      setTimeMessageType("error");
    } finally {
      setSavingTime(false);
    }
  }

  async function handleDeactivateTime(id) {
    const confirmed = window.confirm("Deseja inativar este time?");
    if (!confirmed) return;

    try {
      setTimeMessage("");
      await deactivateTime(id);
      setTimeMessage("Time inativado com sucesso.");
      setTimeMessageType("success");

      await Promise.all([loadTimesAndConfig(), loadPlayers()]);
    } catch (error) {
      setTimeMessage(error.message);
      setTimeMessageType("error");
    }
  }

  function startEditPlayer(player) {
    setPlayerForm({
      ID_Jogador: player.ID_Jogador || "",
      Nome_Jogador: player.Nome_Jogador || "",
      ID_Time: player.ID_Time || "",
      Nome_Time: player.Nome_Time || "",
      Posicao: player.Posicao || "",
      Telefone: player.Telefone || "",
      Ativo: player.Ativo || "Sim",
      Observacoes: player.Observacoes || "",
    });

    setEditingPlayerId(player.ID_Jogador || "");
    setPlayersView("form");
    setPlayerMessage("");
    setPlayerMessageType("");
  }

  function cancelPlayerEdit() {
    clearPlayerForm();
    setPlayerMessage("");
    setPlayerMessageType("");
  }

  async function handlePlayerSubmit(event) {
    event.preventDefault();

    if (!normalizeText(playerForm.Nome_Jogador)) {
      setPlayerMessage("Informe o nome do jogador.");
      setPlayerMessageType("error");
      return;
    }

    if (!normalizeText(playerForm.ID_Time)) {
      setPlayerMessage("Selecione um time.");
      setPlayerMessageType("error");
      return;
    }

    try {
      setSavingPlayer(true);
      setPlayerMessage("");

      const selectedTime = times.find(
        (item) => String(item.ID_Time) === String(playerForm.ID_Time)
      );

      const payload = {
        ...playerForm,
        ID_Jogador: normalizeText(playerForm.ID_Jogador) || buildNewPlayerId(),
        Nome_Jogador: normalizeText(playerForm.Nome_Jogador),
        ID_Time: normalizeText(playerForm.ID_Time),
        Nome_Time: selectedTime?.Nome_Time || normalizeText(playerForm.Nome_Time),
        Posicao: normalizeText(playerForm.Posicao),
        Telefone: normalizeText(playerForm.Telefone),
        Ativo: normalizeText(playerForm.Ativo) || "Sim",
        Observacoes: normalizeText(playerForm.Observacoes),
      };

      if (editingPlayerId) {
        await updateJogador(payload);
        setPlayerMessage("Jogador atualizado com sucesso.");
      } else {
        await addJogador(payload);
        setPlayerMessage("Jogador cadastrado com sucesso.");
      }

      setPlayerMessageType("success");
      clearPlayerForm();
      await loadPlayers();
      setPlayersView("list");
    } catch (error) {
      setPlayerMessage(error.message);
      setPlayerMessageType("error");
    } finally {
      setSavingPlayer(false);
    }
  }

  async function handleDeactivatePlayer(id) {
    const confirmed = window.confirm("Deseja inativar este jogador?");
    if (!confirmed) return;

    try {
      await deactivateJogador(id);
      setPlayerMessage("Jogador inativado com sucesso.");
      setPlayerMessageType("success");
      await loadPlayers();
    } catch (error) {
      setPlayerMessage(error.message);
      setPlayerMessageType("error");
    }
  }

  return (
    <div className="cadastros-page">
      <div className="page-header">
        <h1>Cadastros</h1>
        <p>
          Gerencie aqui os registros do campo. Times e jogadores estão ligados ao backend.
        </p>
      </div>

      <div className="tabs-row">
        <button
          type="button"
          className={`tab-button ${activeTab === "times" ? "active" : ""}`}
          onClick={() => setActiveTab("times")}
        >
          Times
        </button>

        <button
          type="button"
          className={`tab-button ${activeTab === "jogadores" ? "active" : ""}`}
          onClick={() => setActiveTab("jogadores")}
        >
          Jogadores
        </button>
      </div>

      {activeTab === "times" ? (
        <>
          <div className="subtabs-row">
            <button
              type="button"
              className={`tab-button ${timesView === "form" ? "active" : ""}`}
              onClick={() => setTimesView("form")}
            >
              {editingTimeId ? "Editar time" : "Novo time"}
            </button>

            <button
              type="button"
              className={`tab-button ${timesView === "list" ? "active" : ""}`}
              onClick={() => setTimesView("list")}
            >
              Lista de times
            </button>
          </div>

          {timesView === "form" ? (
            <section className="panel">
              <h2>{editingTimeId ? "Editar time" : "Novo time"}</h2>
              <p>
                {editingTimeId
                  ? "Altere os dados do time selecionado."
                  : "Preencha os dados para registrar um time na planilha."}
              </p>

              <form className="form-grid" onSubmit={handleTimeSubmit}>
                <div className="field">
                  <label htmlFor="Nome_Time">Nome do time</label>
                  <input
                    id="Nome_Time"
                    name="Nome_Time"
                    value={timeForm.Nome_Time}
                    onChange={handleTimeChange}
                    placeholder="Ex.: Amigos da Bola"
                  />
                </div>

                <div className="field">
                  <label htmlFor="Categoria">Categoria</label>
                  <select
                    id="Categoria"
                    name="Categoria"
                    value={timeForm.Categoria}
                    onChange={handleTimeChange}
                  >
                    <option value="">Selecione</option>
                    {categorias.map((categoria) => (
                      <option key={categoria} value={categoria}>
                        {categoria}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="Responsavel">Responsável</label>
                  <input
                    id="Responsavel"
                    name="Responsavel"
                    value={timeForm.Responsavel}
                    onChange={handleTimeChange}
                    placeholder="Nome do responsável"
                  />
                </div>

                <div className="field">
                  <label htmlFor="Telefone">Telefone</label>
                  <input
                    id="Telefone"
                    name="Telefone"
                    value={timeForm.Telefone}
                    onChange={handleTimeChange}
                    placeholder="(47) 99999-9999"
                  />
                </div>

                <div className="field">
                  <label htmlFor="Ativo_Time">Ativo</label>
                  <select
                    id="Ativo_Time"
                    name="Ativo"
                    value={timeForm.Ativo}
                    onChange={handleTimeChange}
                  >
                    <option value="Sim">Sim</option>
                    <option value="Nao">Não</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="Observacoes_Time">Observações</label>
                  <input
                    id="Observacoes_Time"
                    name="Observacoes"
                    value={timeForm.Observacoes}
                    onChange={handleTimeChange}
                    placeholder="Informações adicionais"
                  />
                </div>

                <div className="actions-row">
                  <button type="submit" className="primary-button" disabled={savingTime}>
                    {savingTime
                      ? "Salvando..."
                      : editingTimeId
                      ? "Atualizar time"
                      : "Salvar time"}
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={clearTimeForm}
                    disabled={savingTime}
                  >
                    Limpar
                  </button>

                  {editingTimeId ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={cancelTimeEdit}
                      disabled={savingTime}
                    >
                      Cancelar edição
                    </button>
                  ) : null}
                </div>
              </form>

              {timeMessage ? (
                <div className={`status-box ${timeMessageType}`}>{timeMessage}</div>
              ) : null}
            </section>
          ) : (
            <section className="panel">
              <div className="list-header">
                <h2>Times cadastrados</h2>
                <span className="list-meta">
                  Total: {times.length} | Ativos: {totalTimesAtivos}
                </span>
              </div>

              <div className="search-box">
                <input
                  type="text"
                  placeholder="Buscar time..."
                  value={searchTime}
                  onChange={(e) => setSearchTime(e.target.value)}
                />
              </div>

              {timeMessage ? (
                <div className={`status-box ${timeMessageType}`}>{timeMessage}</div>
              ) : null}

              {loadingTimes ? (
                <p className="loading-text">Carregando times...</p>
              ) : filteredTimes.length === 0 ? (
                <div className="empty-state">Nenhum time encontrado.</div>
              ) : (
                <div className="card-list">
                  {filteredTimes.map((time, index) => (
                    <article
                      className="team-card"
                      key={time.ID_Time || `${time.Nome_Time}-${index}`}
                    >
                      <div className="team-card-header">
                        <div>
                          <h3 className="team-name">{time.Nome_Time || "Sem nome"}</h3>
                          <div className="team-badge-row">
                            <span className="team-badge">{time.Ativo || "—"}</span>
                          </div>
                        </div>

                        <div className="card-actions">
                          <button
                            type="button"
                            className="secondary-button small-button"
                            onClick={() => startEditTime(time)}
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            className="secondary-button small-button danger-button"
                            onClick={() => handleDeactivateTime(time.ID_Time)}
                          >
                            Inativar
                          </button>
                        </div>
                      </div>

                      <div className="team-details">
                        <div>
                          <strong>ID:</strong> {time.ID_Time || "—"}
                        </div>
                        <div>
                          <strong>Categoria:</strong> {time.Categoria || "—"}
                        </div>
                        <div>
                          <strong>Responsável:</strong> {time.Responsavel || "—"}
                        </div>
                        <div>
                          <strong>Telefone:</strong> {time.Telefone || "—"}
                        </div>
                        <div>
                          <strong>Observações:</strong> {time.Observacoes || "—"}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      ) : (
        <>
          <div className="subtabs-row">
            <button
              type="button"
              className={`tab-button ${playersView === "form" ? "active" : ""}`}
              onClick={() => setPlayersView("form")}
            >
              {editingPlayerId ? "Editar jogador" : "Novo jogador"}
            </button>

            <button
              type="button"
              className={`tab-button ${playersView === "list" ? "active" : ""}`}
              onClick={() => setPlayersView("list")}
            >
              Lista de jogadores
            </button>
          </div>

          {playersView === "form" ? (
            <section className="panel">
              <h2>{editingPlayerId ? "Editar jogador" : "Novo jogador"}</h2>
              <p>Cadastre jogadores vinculados a um time existente.</p>

              <form className="form-grid" onSubmit={handlePlayerSubmit}>
                <div className="field">
                  <label htmlFor="Nome_Jogador">Nome do jogador</label>
                  <input
                    id="Nome_Jogador"
                    name="Nome_Jogador"
                    value={playerForm.Nome_Jogador}
                    onChange={handlePlayerChange}
                    placeholder="Ex.: João da Silva"
                  />
                </div>

                <div className="field">
                  <label htmlFor="ID_Time">Time</label>
                  <select
                    id="ID_Time"
                    name="ID_Time"
                    value={playerForm.ID_Time}
                    onChange={handlePlayerChange}
                    disabled={loadingTimes}
                  >
                    <option value="">
                      {loadingTimes ? "Carregando times..." : "Selecione"}
                    </option>
                    {activeTimes.map((time) => (
                      <option key={time.ID_Time} value={time.ID_Time}>
                        {time.Nome_Time}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="Posicao">Posição</label>
                  <select
                    id="Posicao"
                    name="Posicao"
                    value={playerForm.Posicao}
                    onChange={handlePlayerChange}
                  >
                    <option value="">Selecione</option>
                    <option value="Goleiro">Goleiro</option>
                    <option value="Defesa">Defesa</option>
                    <option value="Meio">Meio</option>
                    <option value="Ataque">Ataque</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="Telefone_Jogador">Telefone</label>
                  <input
                    id="Telefone_Jogador"
                    name="Telefone"
                    value={playerForm.Telefone}
                    onChange={handlePlayerChange}
                    placeholder="(47) 99999-9999"
                  />
                </div>

                <div className="field">
                  <label htmlFor="Ativo_Jogador">Ativo</label>
                  <select
                    id="Ativo_Jogador"
                    name="Ativo"
                    value={playerForm.Ativo}
                    onChange={handlePlayerChange}
                  >
                    <option value="Sim">Sim</option>
                    <option value="Nao">Não</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="Observacoes_Jogador">Observações</label>
                  <input
                    id="Observacoes_Jogador"
                    name="Observacoes"
                    value={playerForm.Observacoes}
                    onChange={handlePlayerChange}
                    placeholder="Informações adicionais"
                  />
                </div>

                <div className="actions-row">
                  <button type="submit" className="primary-button" disabled={savingPlayer}>
                    {savingPlayer
                      ? "Salvando..."
                      : editingPlayerId
                      ? "Atualizar jogador"
                      : "Salvar jogador"}
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={clearPlayerForm}
                    disabled={savingPlayer}
                  >
                    Limpar
                  </button>

                  {editingPlayerId ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={cancelPlayerEdit}
                      disabled={savingPlayer}
                    >
                      Cancelar edição
                    </button>
                  ) : null}
                </div>
              </form>

              {playerMessage ? (
                <div className={`status-box ${playerMessageType}`}>{playerMessage}</div>
              ) : null}
            </section>
          ) : (
            <section className="panel">
              <div className="list-header">
                <h2>Jogadores cadastrados</h2>
                <span className="list-meta">
                  Total: {players.length} | Ativos: {totalPlayersAtivos}
                </span>
              </div>

              <div className="search-box">
                <input
                  type="text"
                  placeholder="Buscar jogador, time ou posição..."
                  value={searchPlayer}
                  onChange={(e) => setSearchPlayer(e.target.value)}
                />
              </div>

              {playerMessage ? (
                <div className={`status-box ${playerMessageType}`}>{playerMessage}</div>
              ) : null}

              {loadingPlayers ? (
                <p className="loading-text">Carregando jogadores...</p>
              ) : filteredPlayers.length === 0 ? (
                <div className="empty-state">Nenhum jogador encontrado.</div>
              ) : (
                <div className="card-list">
                  {filteredPlayers.map((player, index) => (
                    <article
                      className="team-card"
                      key={player.ID_Jogador || `${player.Nome_Jogador}-${index}`}
                    >
                      <div className="team-card-header">
                        <div>
                          <h3 className="team-name">
                            {player.Nome_Jogador || "Sem nome"}
                          </h3>
                          <div className="team-badge-row multi-badges">
                            <span className="team-badge">{player.Ativo || "—"}</span>
                            <span className="team-badge outline-badge">
                              {player.Posicao || "Sem posição"}
                            </span>
                          </div>
                        </div>

                        <div className="card-actions">
                          <button
                            type="button"
                            className="secondary-button small-button"
                            onClick={() => startEditPlayer(player)}
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            className="secondary-button small-button danger-button"
                            onClick={() => handleDeactivatePlayer(player.ID_Jogador)}
                          >
                            Inativar
                          </button>
                        </div>
                      </div>

                      <div className="team-details">
                        <div>
                          <strong>ID:</strong> {player.ID_Jogador || "—"}
                        </div>
                        <div>
                          <strong>Time:</strong> {player.Nome_Time || "—"}
                        </div>
                        <div>
                          <strong>Posição:</strong> {player.Posicao || "—"}
                        </div>
                        <div>
                          <strong>Telefone:</strong> {player.Telefone || "—"}
                        </div>
                        <div>
                          <strong>Observações:</strong> {player.Observacoes || "—"}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default CadastrosPage;