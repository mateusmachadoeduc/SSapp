import { useEffect, useMemo, useState } from "react";
import {
  addAgenda,
  deleteAgenda,
  listAgenda,
  listTimes,
  updateAgenda,
} from "../services/api";
import "./AgendaPage.css";

const initialGameForm = {
  ID_Jogo: "",
  Data_Jogo: "",
  Hora_Jogo: "",
  Tipo_Jogo: "Confronto",
  Titulo_Jogo: "",
  Time_Principal_ID: "",
  Time_Principal_Nome: "",
  Time_Secundario_ID: "",
  Time_Secundario_Nome: "",
  Status: "Agendado",
  Repetir_Semanal: "Nao",
  Repetir_Quantidade: "1",
  Observacoes: "",
};

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toDateInputValue(date) {
  const local = new Date(date);
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateValue(value) {
  if (!value) return "";

  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) {
      return isoMatch[1];
    }
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return toDateInputValue(parsed);
  }

  return String(value);
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function normalizeTimeValue(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value === "number" && !Number.isNaN(value)) {
    const totalMinutes = Math.round((value % 1) * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${pad2(hours)}:${pad2(minutes)}`;
  }

  if (typeof value === "string") {
    const stringValue = value.trim();

    if (/^\d{2}:\d{2}$/.test(stringValue)) {
      return stringValue;
    }

    const isoTimeMatch = stringValue.match(/T(\d{2}):(\d{2})/);
    if (isoTimeMatch) {
      return `${isoTimeMatch[1]}:${isoTimeMatch[2]}`;
    }

    const genericTimeMatch = stringValue.match(/(\d{1,2}):(\d{2})/);
    if (genericTimeMatch) {
      return `${pad2(genericTimeMatch[1])}:${genericTimeMatch[2]}`;
    }
  }

  if (Object.prototype.toString.call(value) === "[object Date]") {
    const dateObj = value;
    if (!Number.isNaN(dateObj.getTime())) {
      return `${pad2(dateObj.getHours())}:${pad2(dateObj.getMinutes())}`;
    }
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`;
  }

  return String(value);
}

function normalizeAgendaGame(game) {
  return {
    ...game,
    Data_Jogo: normalizeDateValue(game.Data_Jogo),
    Hora_Jogo: normalizeTimeValue(game.Hora_Jogo),
    Tipo_Jogo: game.Tipo_Jogo || "",
  };
}

function formatDateLabel(dateString) {
  if (!dateString) return "—";
  const [year, month, day] = dateString.split("-");
  return `${day}/${month}/${year}`;
}

function formatWeekday(dateString) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString("pt-BR", { weekday: "short" });
}

function buildNext7Days() {
  const today = new Date();
  return Array.from({ length: 8 }, (_, index) => {
    const date = addDays(today, index);
    return {
      value: toDateInputValue(date),
      label: date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
      weekday: date.toLocaleDateString("pt-BR", {
        weekday: "short",
      }),
      isToday: index === 0,
    };
  });
}

function buildTimeSlots(start = 18, end = 23) {
  const slots = [];
  for (let h = start; h <= end; h += 1) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
  }
  return slots;
}

function getGameStartDate(game) {
  if (!game?.Data_Jogo || !game?.Hora_Jogo) return null;

  const [year, month, day] = String(game.Data_Jogo).split("-").map(Number);
  const [hour, minute] = String(game.Hora_Jogo).split(":").map(Number);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    return null;
  }

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function getGameEndDate(game) {
  const start = getGameStartDate(game);
  if (!start) return null;

  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return end;
}

function shouldAutoComplete(game) {
  if (!game) return false;
  if (String(game.Status || "") !== "Agendado") return false;

  const end = getGameEndDate(game);
  if (!end) return false;

  return end.getTime() < Date.now();
}

function AgendaPage() {
  const [viewMode, setViewMode] = useState("calendar");
  const [games, setGames] = useState([]);
  const [times, setTimes] = useState([]);
  const [loadingTimes, setLoadingTimes] = useState(true);
  const [loadingGames, setLoadingGames] = useState(true);
  const [savingGame, setSavingGame] = useState(false);

  const [form, setForm] = useState({
    ...initialGameForm,
    Data_Jogo: toDateInputValue(new Date()),
  });
  const [editingId, setEditingId] = useState("");

  const [selectedDate, setSelectedDate] = useState(toDateInputValue(new Date()));
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const next7Days = useMemo(() => buildNext7Days(), []);
  const timeSlots = useMemo(() => buildTimeSlots(), []);

  async function loadPageData() {
    try {
      setLoadingTimes(true);
      setLoadingGames(true);
      setMessage("");

      const [timesResponse, agendaResponse] = await Promise.all([
        listTimes(),
        listAgenda(),
      ]);

      const activeTimes = (timesResponse.data || []).filter(
        (item) => String(item.Ativo).toLowerCase() === "sim"
      );

      let agendaData = (agendaResponse.data || []).map(normalizeAgendaGame);

      const staleGames = agendaData.filter((game) => shouldAutoComplete(game));

      if (staleGames.length > 0) {
        for (const game of staleGames) {
          await updateAgenda({
            ...game,
            Status: "Concluído",
          });
        }

        const refreshedAgenda = await listAgenda();
        agendaData = (refreshedAgenda.data || []).map(normalizeAgendaGame);
      }

      setTimes(activeTimes);
      setGames(agendaData);
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setLoadingTimes(false);
      setLoadingGames(false);
    }
  }

  useEffect(() => {
    loadPageData();
  }, []);

  const filteredGames = useMemo(() => {
    return games
      .filter((game) => {
        const searchText = search.toLowerCase();

        const title = String(game.Titulo_Jogo || "").toLowerCase();
        const principal = String(game.Time_Principal_Nome || "").toLowerCase();
        const secundario = String(game.Time_Secundario_Nome || "").toLowerCase();
        const code = String(game.ID_Jogo || "").toLowerCase();

        const matchesSearch =
          title.includes(searchText) ||
          principal.includes(searchText) ||
          secundario.includes(searchText) ||
          code.includes(searchText);

        const matchesDate = selectedDate ? game.Data_Jogo === selectedDate : true;
        const matchesStatus = statusFilter ? game.Status === statusFilter : true;

        return matchesSearch && matchesDate && matchesStatus;
      })
      .sort((a, b) => {
        const aDate = `${a.Data_Jogo || ""} ${a.Hora_Jogo || ""}`;
        const bDate = `${b.Data_Jogo || ""} ${b.Hora_Jogo || ""}`;
        return aDate.localeCompare(bDate);
      });
  }, [games, search, selectedDate, statusFilter]);

  const groupedGames = useMemo(() => {
    const map = new Map();

    filteredGames.forEach((game) => {
      const key = game.Data_Jogo || "sem-data";
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(game);
    });

    return Array.from(map.entries()).map(([date, items]) => ({
      date,
      items,
    }));
  }, [filteredGames]);

  const calendarPreview = useMemo(() => {
    return next7Days.map((day) => {
      const dayGames = games
        .filter((game) => game.Data_Jogo === day.value)
        .sort((a, b) => String(a.Hora_Jogo || "").localeCompare(String(b.Hora_Jogo || "")));

      return {
        ...day,
        games: dayGames,
      };
    });
  }, [games, next7Days]);

  const gamesByHour = useMemo(() => {
    const map = {};

    filteredGames.forEach((game) => {
      const hour = `${String(game.Hora_Jogo || "").slice(0, 2)}:00`;
      if (!map[hour]) {
        map[hour] = [];
      }
      map[hour].push(game);
    });

    return map;
  }, [filteredGames]);

  const totalJogos = games.length;

  const totalAgendados = useMemo(() => {
    return games.filter((item) => item.Status === "Agendado").length;
  }, [games]);

  const totalConcluidos = useMemo(() => {
    return games.filter((item) => item.Status === "Concluído").length;
  }, [games]);

  const totalCancelados = useMemo(() => {
    return games.filter((item) => item.Status === "Cancelado").length;
  }, [games]);

  function buildNewId(prefix = "JOGO") {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  function handleChange(event) {
    const { name, value } = event.target;

    if (name === "Time_Principal_ID") {
      const selected = times.find((item) => String(item.ID_Time) === String(value));
      setForm((current) => ({
        ...current,
        Time_Principal_ID: value,
        Time_Principal_Nome: selected?.Nome_Time || "",
      }));
      return;
    }

    if (name === "Time_Secundario_ID") {
      const selected = times.find((item) => String(item.ID_Time) === String(value));
      setForm((current) => ({
        ...current,
        Time_Secundario_ID: value,
        Time_Secundario_Nome: selected?.Nome_Time || "",
      }));
      return;
    }

    if (name === "Tipo_Jogo") {
      setForm((current) => ({
        ...current,
        Tipo_Jogo: value,
        ...(value !== "Confronto"
          ? {
              Time_Secundario_ID: "",
              Time_Secundario_Nome: "",
            }
          : {}),
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function setQuickDate(dateValue) {
    setForm((current) => ({
      ...current,
      Data_Jogo: dateValue,
    }));
  }

  function clearForm() {
    setForm({
      ...initialGameForm,
      Data_Jogo: toDateInputValue(new Date()),
    });
    setEditingId("");
  }

  function startNewGame() {
    clearForm();
    setViewMode("form");
    setMessage("");
    setMessageType("");
  }

  function startEdit(game) {
    setForm({
      ID_Jogo: game.ID_Jogo || "",
      Data_Jogo: game.Data_Jogo || "",
      Hora_Jogo: game.Hora_Jogo || "",
      Tipo_Jogo: game.Tipo_Jogo || "Confronto",
      Titulo_Jogo: game.Titulo_Jogo || "",
      Time_Principal_ID: game.Time_Principal_ID || "",
      Time_Principal_Nome: game.Time_Principal_Nome || "",
      Time_Secundario_ID: game.Time_Secundario_ID || "",
      Time_Secundario_Nome: game.Time_Secundario_Nome || "",
      Status: game.Status || "Agendado",
      Repetir_Semanal: game.Repetir_Semanal || "Nao",
      Repetir_Quantidade: game.Repetir_Quantidade || "1",
      Observacoes: game.Observacoes || "",
    });

    setEditingId(game.ID_Jogo || "");
    setViewMode("form");
    setMessage("");
    setMessageType("");
  }

  function createRecurringGames(basePayload) {
    const repeatEnabled = basePayload.Repetir_Semanal === "Sim";
    const repeatCount = Number(basePayload.Repetir_Quantidade || 1);

    if (!repeatEnabled || repeatCount <= 1) {
      return [basePayload];
    }

    const created = [];

    for (let i = 0; i < repeatCount; i += 1) {
      const baseDate = new Date(`${basePayload.Data_Jogo}T12:00:00`);
      const repeatedDate = addDays(baseDate, i * 7);

      created.push({
        ...basePayload,
        ID_Jogo: i === 0 ? basePayload.ID_Jogo : buildNewId("JOGO"),
        Data_Jogo: toDateInputValue(repeatedDate),
      });
    }

    return created;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (savingGame) return;

    if (!form.Data_Jogo) {
      setMessage("Informe a data do jogo.");
      setMessageType("error");
      return;
    }

    if (!form.Hora_Jogo) {
      setMessage("Informe o horário do jogo.");
      setMessageType("error");
      return;
    }

    const allowedDates = next7Days.map((item) => item.value);
    if (!editingId && !allowedDates.includes(form.Data_Jogo)) {
      setMessage("Escolha uma data entre hoje e os próximos 7 dias.");
      setMessageType("error");
      return;
    }

    if (!form.Titulo_Jogo.trim() && !form.Time_Principal_ID) {
      setMessage("Informe um título ou selecione o time principal.");
      setMessageType("error");
      return;
    }

    if (form.Tipo_Jogo === "Confronto" && !form.Time_Principal_ID) {
      setMessage("Selecione o time principal.");
      setMessageType("error");
      return;
    }

    if (
      form.Tipo_Jogo === "Confronto" &&
      form.Time_Principal_ID &&
      form.Time_Secundario_ID &&
      form.Time_Principal_ID === form.Time_Secundario_ID
    ) {
      setMessage("Os times não podem ser iguais.");
      setMessageType("error");
      return;
    }

    try {
      setSavingGame(true);
      setMessage("");

      const payload = {
        ...form,
        ID_Jogo: form.ID_Jogo.trim() || buildNewId(),
      };

      if (editingId) {
        await updateAgenda(payload);
        setSelectedDate(payload.Data_Jogo);
        setMessage("Jogo atualizado com sucesso.");
        setMessageType("success");
        clearForm();
        setViewMode("calendar");
        await loadPageData();
        return;
      }

      const generatedGames = createRecurringGames(payload);

      for (const game of generatedGames) {
        await addAgenda(game);
      }

      setSelectedDate(payload.Data_Jogo);
      setMessage(
        generatedGames.length > 1
          ? `${generatedGames.length} jogos criados com repetição semanal.`
          : "Jogo agendado com sucesso."
      );
      setMessageType("success");
      clearForm();
      setViewMode("calendar");
      await loadPageData();
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setSavingGame(false);
    }
  }

  async function handleDelete(id) {
    const confirmed = window.confirm("Deseja remover este jogo da agenda?");
    if (!confirmed) return;

    try {
      await deleteAgenda(id);
      setMessage("Jogo removido da agenda.");
      setMessageType("success");
      await loadPageData();
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    }
  }

  function getStatusClass(status) {
    if (status === "Agendado") return "badge-scheduled";
    if (status === "Concluído") return "badge-finished";
    if (status === "Cancelado") return "badge-cancelled";
    return "badge-neutral";
  }

  function buildDisplayTitle(game) {
    if (game.Titulo_Jogo?.trim()) {
      return game.Titulo_Jogo;
    }

    if (game.Tipo_Jogo === "Confronto") {
      const principal = game.Time_Principal_Nome || "Time principal";
      const secundario = game.Time_Secundario_Nome || "Adversário";
      return `${principal} x ${secundario}`;
    }

    if (game.Time_Principal_Nome) {
      return `${game.Tipo_Jogo} - ${game.Time_Principal_Nome}`;
    }

    return game.Tipo_Jogo || "Jogo";
  }

  return (
    <div className="agenda-page">
      <div className="page-header">
        <h1>Agenda</h1>
        <p>
          Organize os próximos jogos e horários do campo, com seleção rápida de
          datas, repetição semanal e conclusão automática após 1 hora.
        </p>
      </div>

      <div className="summary-grid">
        <article className="summary-card">
          <span className="summary-label">Total de jogos</span>
          <strong className="summary-value">{totalJogos}</strong>
        </article>

        <article className="summary-card">
          <span className="summary-label">Agendados</span>
          <strong className="summary-value">{totalAgendados}</strong>
        </article>

        <article className="summary-card">
          <span className="summary-label">Concluídos</span>
          <strong className="summary-value">{totalConcluidos}</strong>
        </article>

        <article className="summary-card alert-summary">
          <span className="summary-label">Cancelados</span>
          <strong className="summary-value">{totalCancelados}</strong>
        </article>
      </div>

      <div className="subtabs-row">
        <button
          type="button"
          className={`tab-button ${viewMode === "calendar" ? "active" : ""}`}
          onClick={() => setViewMode("calendar")}
        >
          Calendário
        </button>

        <button
          type="button"
          className={`tab-button ${viewMode === "grid" ? "active" : ""}`}
          onClick={() => setViewMode("grid")}
        >
          Grade
        </button>

        <button
          type="button"
          className={`tab-button ${viewMode === "form" ? "active" : ""}`}
          onClick={() => setViewMode("form")}
        >
          {editingId ? "Editar jogo" : "Novo jogo"}
        </button>
      </div>

      {viewMode === "form" ? (
        <section className="panel">
          <h2>{editingId ? "Editar jogo" : "Novo jogo"}</h2>
          <p>Cadastre data, horário, formato da partida e repetição semanal.</p>

          <div className="date-picker-card">
            <span className="date-picker-label">Datas rápidas</span>
            <div className="date-chips">
              {next7Days.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  className={`date-chip ${form.Data_Jogo === day.value ? "active" : ""}`}
                  onClick={() => setQuickDate(day.value)}
                >
                  <span>{day.weekday}</span>
                  <strong>{day.label}</strong>
                  {day.isToday ? <small>Hoje</small> : null}
                </button>
              ))}
            </div>
          </div>

          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="Data_Jogo">Data</label>
              <input
                id="Data_Jogo"
                name="Data_Jogo"
                type="date"
                value={form.Data_Jogo}
                onChange={handleChange}
              />
            </div>

            <div className="field">
              <label htmlFor="Hora_Jogo">Horário</label>
              <input
                id="Hora_Jogo"
                name="Hora_Jogo"
                type="time"
                value={form.Hora_Jogo}
                onChange={handleChange}
              />
            </div>

            <div className="field">
              <label htmlFor="Tipo_Jogo">Tipo</label>
              <select
                id="Tipo_Jogo"
                name="Tipo_Jogo"
                value={form.Tipo_Jogo}
                onChange={handleChange}
              >
                <option value="Confronto">Confronto</option>
                <option value="Treino / Racha">Treino / Racha</option>
                <option value="Horário reservado">Horário reservado</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="Titulo_Jogo">Título do evento</label>
              <input
                id="Titulo_Jogo"
                name="Titulo_Jogo"
                value={form.Titulo_Jogo}
                onChange={handleChange}
                placeholder="Ex.: Racha da noite / Treino Time Azul"
              />
            </div>

            <div className="field">
              <label htmlFor="Time_Principal_ID">Time principal</label>
              <select
                id="Time_Principal_ID"
                name="Time_Principal_ID"
                value={form.Time_Principal_ID}
                onChange={handleChange}
                disabled={loadingTimes}
              >
                <option value="">
                  {loadingTimes ? "Carregando times..." : "Selecione"}
                </option>
                {times.map((time) => (
                  <option key={time.ID_Time} value={time.ID_Time}>
                    {time.Nome_Time}
                  </option>
                ))}
              </select>
            </div>

            {form.Tipo_Jogo === "Confronto" ? (
              <div className="field">
                <label htmlFor="Time_Secundario_ID">Time adversário</label>
                <select
                  id="Time_Secundario_ID"
                  name="Time_Secundario_ID"
                  value={form.Time_Secundario_ID}
                  onChange={handleChange}
                  disabled={loadingTimes}
                >
                  <option value="">
                    {loadingTimes ? "Carregando times..." : "Opcional"}
                  </option>
                  {times.map((time) => (
                    <option key={time.ID_Time} value={time.ID_Time}>
                      {time.Nome_Time}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="field">
              <label htmlFor="Status">Status</label>
              <select
                id="Status"
                name="Status"
                value={form.Status}
                onChange={handleChange}
              >
                <option value="Agendado">Agendado</option>
                <option value="Concluído">Concluído</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="Repetir_Semanal">Repetir semanalmente</label>
              <select
                id="Repetir_Semanal"
                name="Repetir_Semanal"
                value={form.Repetir_Semanal}
                onChange={handleChange}
              >
                <option value="Nao">Não</option>
                <option value="Sim">Sim</option>
              </select>
            </div>

            {form.Repetir_Semanal === "Sim" ? (
              <div className="field">
                <label htmlFor="Repetir_Quantidade">Quantidade de semanas</label>
                <select
                  id="Repetir_Quantidade"
                  name="Repetir_Quantidade"
                  value={form.Repetir_Quantidade}
                  onChange={handleChange}
                >
                  <option value="1">1 semana</option>
                  <option value="2">2 semanas</option>
                  <option value="3">3 semanas</option>
                  <option value="4">4 semanas</option>
                  <option value="5">5 semanas</option>
                  <option value="6">6 semanas</option>
                </select>
              </div>
            ) : null}

            <div className="field field-full">
              <label htmlFor="Observacoes">Observações</label>
              <input
                id="Observacoes"
                name="Observacoes"
                value={form.Observacoes}
                onChange={handleChange}
                placeholder="Ex.: amistoso, reserva fixa, campeonato interno..."
              />
            </div>

            <div className="actions-row field-full">
              <button type="submit" className="primary-button" disabled={savingGame}>
                {savingGame
                  ? "Salvando..."
                  : editingId
                  ? "Atualizar jogo"
                  : "Salvar jogo"}
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={clearForm}
                disabled={savingGame}
              >
                Limpar
              </button>

              {editingId ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={startNewGame}
                  disabled={savingGame}
                >
                  Cancelar edição
                </button>
              ) : null}
            </div>
          </form>

          {message ? (
            <div className={`status-box ${messageType}`}>{message}</div>
          ) : null}
        </section>
      ) : viewMode === "grid" ? (
        <section className="panel">
          <h2>Grade do dia</h2>
          <p>Visualização por horários da data selecionada.</p>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {timeSlots.map((slot) => {
              const slotGames = gamesByHour[slot] || [];

              return (
                <div
                  key={slot}
                  style={{
                    border: "1px solid #333",
                    borderRadius: "10px",
                    padding: "12px",
                    background: slotGames.length ? "#111" : "#0a0a0a",
                  }}
                >
                  <strong style={{ color: "#d4af37" }}>{slot}</strong>

                  {slotGames.length === 0 ? (
                    <div style={{ color: "#777", marginTop: "6px" }}>Livre</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                      {slotGames.map((game) => (
                        <div
                          key={game.ID_Jogo}
                          style={{
                            background: "#151515",
                            border: "1px solid rgba(212,175,55,0.15)",
                            borderRadius: "8px",
                            padding: "10px",
                          }}
                        >
                          <div style={{ fontWeight: 700, color: "#fff" }}>
                            {buildDisplayTitle(game)}
                          </div>
                          <div style={{ color: "#d1d5db", fontSize: "13px", marginTop: "4px" }}>
                            {game.Hora_Jogo || "--:--"} até{" "}
                            {(() => {
                              const end = getGameEndDate(game);
                              if (!end) return "--:--";
                              return end.toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              });
                            })()}
                          </div>
                          <div style={{ color: "#9ca3af", fontSize: "12px", marginTop: "4px" }}>
                            Status: {game.Status}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {message ? (
            <div className={`status-box ${messageType}`} style={{ marginTop: "12px" }}>
              {message}
            </div>
          ) : null}
        </section>
      ) : (
        <>
          <section className="panel">
            <div className="calendar-topbar">
              <div className="calendar-title-block">
                <h2>Calendário</h2>
                <p>Visualize os próximos jogos com filtros rápidos.</p>
              </div>

              <button
                type="button"
                className="primary-button"
                onClick={startNewGame}
              >
                Novo jogo
              </button>
            </div>

            <div className="calendar-strip">
              {calendarPreview.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  className={`calendar-day-card ${
                    selectedDate === day.value ? "active" : ""
                  }`}
                  onClick={() => setSelectedDate(day.value)}
                >
                  <span>{day.weekday}</span>
                  <strong>{day.label}</strong>
                  {day.isToday ? <small>Hoje</small> : null}

                  <div style={{ marginTop: "6px", fontSize: "12px", lineHeight: 1.4 }}>
                    {day.games.length > 0 ? (
                      <>
                        <div>{day.games.length} jogo(s)</div>
                        {day.games.slice(0, 3).map((game) => (
                          <div key={game.ID_Jogo}>
                            {game.Hora_Jogo || "--:--"} •{" "}
                            {game.Titulo_Jogo?.trim()
                              ? game.Titulo_Jogo
                              : game.Time_Principal_Nome || game.Tipo_Jogo || "Jogo"}
                          </div>
                        ))}
                        {day.games.length > 3 ? <div>+ mais...</div> : null}
                      </>
                    ) : (
                      <div style={{ color: "#9ca3af" }}>Sem jogos</div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="filters-grid">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Buscar por título, time ou código..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="filter-box">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">Todos os status</option>
                  <option value="Agendado">Agendado</option>
                  <option value="Concluído">Concluído</option>
                  <option value="Cancelado">Cancelado</option>
                </select>
              </div>
            </div>

            {message ? (
              <div className={`status-box ${messageType}`}>{message}</div>
            ) : null}
          </section>

          {loadingGames ? (
            <section className="panel">
              <p>Carregando agenda...</p>
            </section>
          ) : groupedGames.length === 0 ? (
            <section className="panel">
              <div className="empty-state">
                Nenhum jogo encontrado para este período.
              </div>
            </section>
          ) : (
            groupedGames.map((group) => (
              <section className="panel" key={group.date}>
                <div className="day-section-header">
                  <div>
                    <h3>{formatDateLabel(group.date)}</h3>
                    <p>{formatWeekday(group.date)}</p>
                  </div>
                  <span className="day-count">{group.items.length} jogo(s)</span>
                </div>

                <div className="card-list">
                  {group.items.map((game) => (
                    <article className="game-card elegant-card" key={game.ID_Jogo}>
                      <div className="game-card-header">
                        <div>
                          <h3 className="game-name">{buildDisplayTitle(game)}</h3>

                          <div className="badge-row">
                            <span className={`status-badge ${getStatusClass(game.Status)}`}>
                              {game.Status}
                            </span>
                            <span className="status-badge outline-badge">
                              {game.Hora_Jogo || "—"}
                            </span>
                            <span className="status-badge outline-badge">
                              {game.Tipo_Jogo || "—"}
                            </span>
                          </div>
                        </div>

                        <div className="card-actions">
                          <button
                            type="button"
                            className="secondary-button small-button"
                            onClick={() => startEdit(game)}
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            className="secondary-button small-button danger-button"
                            onClick={() => handleDelete(game.ID_Jogo)}
                          >
                            Remover
                          </button>
                        </div>
                      </div>

                      <div className="game-details">
                        <div>
                          <strong>ID:</strong> {game.ID_Jogo}
                        </div>
                        <div>
                          <strong>Principal:</strong> {game.Time_Principal_Nome || "—"}
                        </div>
                        <div>
                          <strong>Adversário:</strong> {game.Time_Secundario_Nome || "—"}
                        </div>
                        <div>
                          <strong>Repetição:</strong>{" "}
                          {game.Repetir_Semanal === "Sim"
                            ? `Semanal (${game.Repetir_Quantidade} semana(s))`
                            : "Não"}
                        </div>
                        <div className="game-details-full">
                          <strong>Observações:</strong> {game.Observacoes || "—"}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}

export default AgendaPage;