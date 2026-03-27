import { useEffect, useMemo, useState } from "react";
import {
  addEstoqueItem,
  deactivateEstoqueItem,
  getConfig,
  listEstoque,
  listMovEstoque,
  registrarMovEstoque,
  updateEstoqueItem,
} from "../services/api";
import "./EstoquePage.css";

const initialStockForm = {
  ID_Item_Estoque: "",
  Nome_Item: "",
  Categoria: "",
  Unidade: "",
  Quantidade_Atual: "",
  Estoque_Ideal: "",
  Ativo: "Sim",
  Observacoes: "",
};

const initialMoveForm = {
  tipo: "entrada",
  quantidade: "",
  motivo: "",
};

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeNumber(value) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isNaN(number) ? 0 : number;
}

function EstoquePage() {
  const [viewMode, setViewMode] = useState("form");
  const [items, setItems] = useState([]);
  const [config, setConfig] = useState({
    Categoria_Estoque: [],
    Unidades: [],
  });

  const [loading, setLoading] = useState(true);
  const [savingItem, setSavingItem] = useState(false);

  const [form, setForm] = useState(initialStockForm);
  const [editingId, setEditingId] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const [movementOpen, setMovementOpen] = useState(false);
  const [movementTarget, setMovementTarget] = useState(null);
  const [moveForm, setMoveForm] = useState(initialMoveForm);
  const [savingMovement, setSavingMovement] = useState(false);

  async function loadPageData() {
    try {
      setLoading(true);
      setMessage("");

      const [estoqueResponse, configResponse] = await Promise.all([
        listEstoque(),
        getConfig(),
      ]);

      const estoqueItems = estoqueResponse.data || [];

      const itemsWithMovements = await Promise.all(
        estoqueItems.map(async (item) => {
          try {
            const movResponse = await listMovEstoque(item.ID_Item_Estoque);
            const movements = (movResponse.data || []).sort((a, b) => {
              return String(b.Data || "").localeCompare(String(a.Data || ""));
            });

            return {
              ...item,
              Movimentacoes: movements,
            };
          } catch {
            return {
              ...item,
              Movimentacoes: [],
            };
          }
        })
      );

      setItems(itemsWithMovements);
      setConfig({
        Categoria_Estoque: configResponse.data?.Categoria_Estoque || [],
        Unidades: configResponse.data?.Unidades || [],
      });
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPageData();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const nome = normalizeText(item.Nome_Item).toLowerCase();
      const categoria = normalizeText(item.Categoria).toLowerCase();
      const termo = search.toLowerCase();

      const matchesSearch = nome.includes(termo) || categoria.includes(termo);
      const matchesCategory = categoryFilter
        ? normalizeText(item.Categoria) === categoryFilter
        : true;

      return matchesSearch && matchesCategory;
    });
  }, [items, search, categoryFilter]);

  const totalItens = items.length;

  const totalAtivos = useMemo(() => {
    return items.filter((item) => normalizeText(item.Ativo).toLowerCase() === "sim").length;
  }, [items]);

  const totalAbaixoIdeal = useMemo(() => {
    return items.filter((item) => {
      const atual = normalizeNumber(item.Quantidade_Atual);
      const ideal = normalizeNumber(item.Estoque_Ideal);

      if (normalizeText(item.Ativo).toLowerCase() !== "sim") return false;
      return atual < ideal;
    }).length;
  }, [items]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleMoveChange(event) {
    const { name, value } = event.target;
    setMoveForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function buildNewId() {
    return `EST-${Date.now()}`;
  }

  function buildMovementId() {
    return `MOV-${Date.now()}`;
  }

  function clearForm() {
    setForm(initialStockForm);
    setEditingId("");
  }

  function startNewItem() {
    clearForm();
    setViewMode("form");
    setMessage("");
    setMessageType("");
  }

  function startEdit(item) {
    setForm({
      ID_Item_Estoque: item.ID_Item_Estoque || "",
      Nome_Item: item.Nome_Item || "",
      Categoria: item.Categoria || "",
      Unidade: item.Unidade || "",
      Quantidade_Atual: String(item.Quantidade_Atual ?? ""),
      Estoque_Ideal: String(item.Estoque_Ideal ?? ""),
      Ativo: item.Ativo || "Sim",
      Observacoes: item.Observacoes || "",
    });

    setEditingId(item.ID_Item_Estoque || "");
    setViewMode("form");
    setMessage("");
    setMessageType("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!normalizeText(form.Nome_Item)) {
      setMessage("Informe o nome do item.");
      setMessageType("error");
      return;
    }

    if (!normalizeText(form.Categoria)) {
      setMessage("Selecione a categoria.");
      setMessageType("error");
      return;
    }

    if (!normalizeText(form.Unidade)) {
      setMessage("Selecione a unidade.");
      setMessageType("error");
      return;
    }

    try {
      setSavingItem(true);
      setMessage("");

      const payload = {
        ...form,
        ID_Item_Estoque:
          normalizeText(form.ID_Item_Estoque) || buildNewId(),
        Nome_Item: normalizeText(form.Nome_Item),
        Categoria: normalizeText(form.Categoria),
        Unidade: normalizeText(form.Unidade),
        Quantidade_Atual: normalizeText(form.Quantidade_Atual),
        Estoque_Ideal: normalizeText(form.Estoque_Ideal),
        Ativo: normalizeText(form.Ativo) || "Sim",
        Observacoes: normalizeText(form.Observacoes),
      };

      if (editingId) {
        await updateEstoqueItem(payload);
        setMessage("Item de estoque atualizado com sucesso.");
      } else {
        await addEstoqueItem(payload);
        setMessage("Item de estoque cadastrado com sucesso.");
      }

      setMessageType("success");
      clearForm();
      setViewMode("list");
      await loadPageData();
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setSavingItem(false);
    }
  }

  async function handleDeactivate(id) {
    const confirmed = window.confirm("Deseja inativar este item de estoque?");
    if (!confirmed) return;

    try {
      await deactivateEstoqueItem(id);
      setMessage("Item inativado com sucesso.");
      setMessageType("success");
      await loadPageData();
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    }
  }

  function getStatus(item) {
    const atual = normalizeNumber(item.Quantidade_Atual);
    const ideal = normalizeNumber(item.Estoque_Ideal);

    if (normalizeText(item.Ativo).toLowerCase() !== "sim") {
      return {
        label: "Inativo",
        className: "badge-inactive",
      };
    }

    if (atual < ideal) {
      return {
        label: "Abaixo do ideal",
        className: "badge-alert",
      };
    }

    return {
      label: "OK",
      className: "badge-ok",
    };
  }

  function formatQuantity(value, unidade) {
    if (value === "" || value === null || value === undefined) return "—";
    return `${value} ${unidade || ""}`.trim();
  }

  function openMovement(item, tipo) {
    setMovementTarget(item);
    setMoveForm({
      tipo,
      quantidade: "",
      motivo: "",
    });
    setMovementOpen(true);
    setMessage("");
    setMessageType("");
  }

  function closeMovement() {
    setMovementOpen(false);
    setMovementTarget(null);
    setMoveForm(initialMoveForm);
  }

  async function handleMovementSubmit(event) {
    event.preventDefault();

    if (!movementTarget) return;

    const quantidadeNumero = normalizeNumber(moveForm.quantidade);

    if (!(quantidadeNumero > 0)) {
      setMessage("Informe uma quantidade válida para a movimentação.");
      setMessageType("error");
      return;
    }

    try {
      setSavingMovement(true);
      setMessage("");

      const payload = {
        ID_Mov: buildMovementId(),
        ID_Item_Estoque: movementTarget.ID_Item_Estoque,
        Tipo: moveForm.tipo,
        Quantidade: quantidadeNumero,
        Motivo: normalizeText(moveForm.motivo),
        Data: new Date().toISOString(),
      };

      await registrarMovEstoque(payload);

      setMessage(
        moveForm.tipo === "entrada"
          ? "Entrada registrada com sucesso."
          : "Saída registrada com sucesso."
      );
      setMessageType("success");

      closeMovement();
      await loadPageData();
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setSavingMovement(false);
    }
  }

  return (
    <div className="estoque-page">
      <div className="page-header">
        <h1>Estoque</h1>
        <p>
          Controle itens, níveis mínimos e movimentações, agora integrados ao backend.
        </p>
      </div>

      <div className="summary-grid">
        <article className="summary-card">
          <span className="summary-label">Total de itens</span>
          <strong className="summary-value">{totalItens}</strong>
        </article>

        <article className="summary-card">
          <span className="summary-label">Itens ativos</span>
          <strong className="summary-value">{totalAtivos}</strong>
        </article>

        <article className="summary-card alert-summary">
          <span className="summary-label">Abaixo do ideal</span>
          <strong className="summary-value">{totalAbaixoIdeal}</strong>
        </article>
      </div>

      <div className="subtabs-row">
        <button
          type="button"
          className={`tab-button ${viewMode === "form" ? "active" : ""}`}
          onClick={() => setViewMode("form")}
        >
          {editingId ? "Editar item" : "Novo item"}
        </button>

        <button
          type="button"
          className={`tab-button ${viewMode === "list" ? "active" : ""}`}
          onClick={() => setViewMode("list")}
        >
          Lista de estoque
        </button>
      </div>

      {viewMode === "form" ? (
        <section className="panel">
          <h2>{editingId ? "Editar item de estoque" : "Novo item de estoque"}</h2>
          <p>
            Cadastre itens usados na cozinha e acompanhe estoque atual e estoque ideal.
          </p>

          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="Nome_Item">Nome do item</label>
              <input
                id="Nome_Item"
                name="Nome_Item"
                value={form.Nome_Item}
                onChange={handleChange}
                placeholder="Ex.: Pão de hambúrguer"
              />
            </div>

            <div className="field">
              <label htmlFor="Categoria">Categoria</label>
              <select
                id="Categoria"
                name="Categoria"
                value={form.Categoria}
                onChange={handleChange}
              >
                <option value="">Selecione</option>
                {config.Categoria_Estoque.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {categoria}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="Unidade">Unidade</label>
              <select
                id="Unidade"
                name="Unidade"
                value={form.Unidade}
                onChange={handleChange}
              >
                <option value="">Selecione</option>
                {config.Unidades.map((unidade) => (
                  <option key={unidade} value={unidade}>
                    {unidade}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="Quantidade_Atual">Quantidade atual</label>
              <input
                id="Quantidade_Atual"
                name="Quantidade_Atual"
                value={form.Quantidade_Atual}
                onChange={handleChange}
                placeholder="Ex.: 20"
              />
            </div>

            <div className="field">
              <label htmlFor="Estoque_Ideal">Estoque ideal</label>
              <input
                id="Estoque_Ideal"
                name="Estoque_Ideal"
                value={form.Estoque_Ideal}
                onChange={handleChange}
                placeholder="Ex.: 30"
              />
            </div>

            <div className="field">
              <label htmlFor="Ativo">Ativo</label>
              <select
                id="Ativo"
                name="Ativo"
                value={form.Ativo}
                onChange={handleChange}
              >
                <option value="Sim">Sim</option>
                <option value="Nao">Não</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="Observacoes">Observações</label>
              <input
                id="Observacoes"
                name="Observacoes"
                value={form.Observacoes}
                onChange={handleChange}
                placeholder="Informações adicionais"
              />
            </div>

            <div className="actions-row">
              <button type="submit" className="primary-button" disabled={savingItem}>
                {savingItem
                  ? "Salvando..."
                  : editingId
                  ? "Atualizar item"
                  : "Salvar item"}
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={clearForm}
                disabled={savingItem}
              >
                Limpar
              </button>

              {editingId ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={startNewItem}
                  disabled={savingItem}
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
      ) : (
        <section className="panel">
          <div className="list-header">
            <h2>Itens de estoque</h2>
            <span className="list-meta">
              Total: {totalItens} | Abaixo do ideal: {totalAbaixoIdeal}
            </span>
          </div>

          <div className="filters-grid">
            <div className="search-box">
              <input
                type="text"
                placeholder="Buscar item ou categoria..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="filter-box">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">Todas as categorias</option>
                {config.Categoria_Estoque.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {categoria}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {message ? (
            <div className={`status-box ${messageType}`}>{message}</div>
          ) : null}

          {loading ? (
            <p className="loading-text">Carregando estoque...</p>
          ) : filteredItems.length === 0 ? (
            <div className="empty-state">
              Nenhum item de estoque encontrado.
            </div>
          ) : (
            <div className="card-list">
              {filteredItems.map((item, index) => {
                const status = getStatus(item);

                return (
                  <article
                    className="stock-card"
                    key={item.ID_Item_Estoque || `${item.Nome_Item}-${index}`}
                  >
                    <div className="stock-card-header">
                      <div>
                        <h3 className="stock-name">{item.Nome_Item || "Sem nome"}</h3>

                        <div className="badge-row">
                          <span className={`stock-badge ${status.className}`}>
                            {status.label}
                          </span>
                          <span className="stock-badge outline-badge">
                            {item.Categoria || "Sem categoria"}
                          </span>
                        </div>
                      </div>

                      <div className="card-actions">
                        <button
                          type="button"
                          className="secondary-button small-button"
                          onClick={() => openMovement(item, "entrada")}
                        >
                          Entrada
                        </button>

                        <button
                          type="button"
                          className="secondary-button small-button"
                          onClick={() => openMovement(item, "saida")}
                        >
                          Saída
                        </button>

                        <button
                          type="button"
                          className="secondary-button small-button"
                          onClick={() => startEdit(item)}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          className="secondary-button small-button danger-button"
                          onClick={() => handleDeactivate(item.ID_Item_Estoque)}
                        >
                          Inativar
                        </button>
                      </div>
                    </div>

                    <div className="stock-details">
                      <div>
                        <strong>ID:</strong> {item.ID_Item_Estoque || "—"}
                      </div>
                      <div>
                        <strong>Unidade:</strong> {item.Unidade || "—"}
                      </div>
                      <div>
                        <strong>Atual:</strong>{" "}
                        {formatQuantity(item.Quantidade_Atual, item.Unidade)}
                      </div>
                      <div>
                        <strong>Ideal:</strong>{" "}
                        {formatQuantity(item.Estoque_Ideal, item.Unidade)}
                      </div>
                      <div>
                        <strong>Ativo:</strong> {item.Ativo || "—"}
                      </div>
                      <div>
                        <strong>Observações:</strong> {item.Observacoes || "—"}
                      </div>
                    </div>

                    <div className="movement-history">
                      <h4>Últimas movimentações</h4>

                      {item.Movimentacoes && item.Movimentacoes.length > 0 ? (
                        <div className="movement-list">
                          {item.Movimentacoes.slice(0, 3).map((mov) => (
                            <div className="movement-item" key={mov.ID_Mov || `${mov.Tipo}-${mov.Data}`}>
                              <span className={`movement-type ${mov.Tipo}`}>
                                {mov.Tipo === "entrada" ? "Entrada" : "Saída"}
                              </span>
                              <span>
                                {mov.Quantidade} {item.Unidade}
                              </span>
                              <span>{mov.Data || "—"}</span>
                              <span>{mov.Motivo || "Sem motivo"}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="movement-empty">Nenhuma movimentação registrada.</p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {movementOpen && movementTarget ? (
        <div className="movement-overlay" onClick={closeMovement}>
          <div
            className="movement-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>
              {moveForm.tipo === "entrada" ? "Registrar entrada" : "Registrar saída"}
            </h3>

            <p className="movement-target-name">{movementTarget.Nome_Item}</p>

            <form className="form-grid" onSubmit={handleMovementSubmit}>
              <div className="field">
                <label htmlFor="mov-quantidade">Quantidade</label>
                <input
                  id="mov-quantidade"
                  name="quantidade"
                  value={moveForm.quantidade}
                  onChange={handleMoveChange}
                  placeholder={`Ex.: 5 ${movementTarget.Unidade || ""}`}
                />
              </div>

              <div className="field">
                <label htmlFor="mov-motivo">Motivo</label>
                <input
                  id="mov-motivo"
                  name="motivo"
                  value={moveForm.motivo}
                  onChange={handleMoveChange}
                  placeholder="Ex.: compra, reposição, uso na cozinha"
                />
              </div>

              <div className="actions-row">
                <button type="submit" className="primary-button" disabled={savingMovement}>
                  {savingMovement ? "Confirmando..." : "Confirmar"}
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeMovement}
                  disabled={savingMovement}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default EstoquePage;