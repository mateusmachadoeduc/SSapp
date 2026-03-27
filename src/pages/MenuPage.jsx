import { useEffect, useMemo, useState } from "react";
import {
  addMenuItem,
  deactivateMenuItem,
  getConfig,
  listMenus,
  updateMenuItem,
} from "../services/api";
import "./MenuPage.css";

const initialMenuForm = {
  ID_Item: "",
  Nome_Item: "",
  Tipo_Menu: "",
  Categoria: "",
  Preco: "",
  Custo: "",
  Disponivel: "Sim",
  Observacoes: "",
};

function normalizeText(value) {
  return String(value ?? "").trim();
}

function MenuPage() {
  const [viewMode, setViewMode] = useState("form");
  const [items, setItems] = useState([]);
  const [config, setConfig] = useState({
    Tipo_Menu: [],
    Categoria_Menu: [],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(initialMenuForm);
  const [editingId, setEditingId] = useState("");

  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  async function loadPageData() {
    try {
      setLoading(true);
      setMessage("");

      const [menusResponse, configResponse] = await Promise.all([
        listMenus(),
        getConfig(),
      ]);

      setItems(menusResponse.data || []);
      setConfig({
        Tipo_Menu: configResponse.data?.Tipo_Menu || [],
        Categoria_Menu: configResponse.data?.Categoria_Menu || [],
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

  const totalItens = items.length;

  const totalDisponiveis = useMemo(() => {
    return items.filter((item) => normalizeText(item.Disponivel).toLowerCase() === "sim").length;
  }, [items]);

  const totalFixos = useMemo(() => {
    return items.filter((item) => normalizeText(item.Tipo_Menu) === "Fixo").length;
  }, [items]);

  const totalRotativos = useMemo(() => {
    return items.filter((item) => normalizeText(item.Tipo_Menu) === "Rotativo").length;
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const nome = normalizeText(item.Nome_Item).toLowerCase();
      const tipo = normalizeText(item.Tipo_Menu);
      const categoria = normalizeText(item.Categoria);
      const termo = search.toLowerCase();

      const matchesSearch =
        nome.includes(termo) || categoria.toLowerCase().includes(termo);

      const matchesTipo = tipoFilter ? tipo === tipoFilter : true;
      const matchesCategoria = categoriaFilter ? categoria === categoriaFilter : true;

      return matchesSearch && matchesTipo && matchesCategoria;
    });
  }, [items, search, tipoFilter, categoriaFilter]);

  function buildNewId() {
    return `MENU-${Date.now()}`;
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function clearForm() {
    setForm(initialMenuForm);
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
      ID_Item: item.ID_Item || "",
      Nome_Item: item.Nome_Item || "",
      Tipo_Menu: item.Tipo_Menu || "",
      Categoria: item.Categoria || "",
      Preco: String(item.Preco ?? ""),
      Custo: String(item.Custo ?? ""),
      Disponivel: item.Disponivel || "Sim",
      Observacoes: item.Observacoes || "",
    });

    setEditingId(item.ID_Item || "");
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

    if (!normalizeText(form.Tipo_Menu)) {
      setMessage("Selecione o tipo de menu.");
      setMessageType("error");
      return;
    }

    if (!normalizeText(form.Categoria)) {
      setMessage("Selecione a categoria.");
      setMessageType("error");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const payload = {
        ...form,
        ID_Item: normalizeText(form.ID_Item) || buildNewId(),
        Nome_Item: normalizeText(form.Nome_Item),
        Tipo_Menu: normalizeText(form.Tipo_Menu),
        Categoria: normalizeText(form.Categoria),
        Preco: normalizeText(form.Preco),
        Custo: normalizeText(form.Custo),
        Disponivel: normalizeText(form.Disponivel) || "Sim",
        Observacoes: normalizeText(form.Observacoes),
      };

      if (editingId) {
        await updateMenuItem(payload);
        setMessage("Item de menu atualizado com sucesso.");
      } else {
        await addMenuItem(payload);
        setMessage("Item de menu cadastrado com sucesso.");
      }

      setMessageType("success");
      clearForm();
      await loadPageData();
      setViewMode("list");
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id) {
    const confirmed = window.confirm("Deseja inativar este item do menu?");
    if (!confirmed) return;

    try {
      await deactivateMenuItem(id);
      setMessage("Item inativado com sucesso.");
      setMessageType("success");
      await loadPageData();
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    }
  }

  function formatMoney(value) {
    const number = Number(String(value || 0).replace(",", "."));

    if (Number.isNaN(number)) return "—";

    return number.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  return (
    <div className="menu-page">
      <div className="page-header">
        <h1>Menu / Cardápios</h1>
        <p>
          Gerencie os itens fixos e rotativos da cozinha, agora integrados ao backend.
        </p>
      </div>

      <div className="summary-grid">
        <article className="summary-card">
          <span className="summary-label">Total de itens</span>
          <strong className="summary-value">{totalItens}</strong>
        </article>

        <article className="summary-card">
          <span className="summary-label">Disponíveis</span>
          <strong className="summary-value">{totalDisponiveis}</strong>
        </article>

        <article className="summary-card">
          <span className="summary-label">Menu fixo</span>
          <strong className="summary-value">{totalFixos}</strong>
        </article>

        <article className="summary-card">
          <span className="summary-label">Menu rotativo</span>
          <strong className="summary-value">{totalRotativos}</strong>
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
          Lista de itens
        </button>
      </div>

      {viewMode === "form" ? (
        <section className="panel">
          <h2>{editingId ? "Editar item de menu" : "Novo item de menu"}</h2>
          <p>Cadastre pratos, lanches, bebidas, porções e combos.</p>

          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="Nome_Item">Nome do item</label>
              <input
                id="Nome_Item"
                name="Nome_Item"
                value={form.Nome_Item}
                onChange={handleChange}
                placeholder="Ex.: X-Salada"
              />
            </div>

            <div className="field">
              <label htmlFor="Tipo_Menu">Tipo de menu</label>
              <select
                id="Tipo_Menu"
                name="Tipo_Menu"
                value={form.Tipo_Menu}
                onChange={handleChange}
              >
                <option value="">Selecione</option>
                {config.Tipo_Menu.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
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
                {config.Categoria_Menu.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {categoria}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="Preco">Preço</label>
              <input
                id="Preco"
                name="Preco"
                value={form.Preco}
                onChange={handleChange}
                placeholder="Ex.: 18.00"
              />
            </div>

            <div className="field">
              <label htmlFor="Custo">Custo</label>
              <input
                id="Custo"
                name="Custo"
                value={form.Custo}
                onChange={handleChange}
                placeholder="Ex.: 9.50"
              />
            </div>

            <div className="field">
              <label htmlFor="Disponivel">Disponível</label>
              <select
                id="Disponivel"
                name="Disponivel"
                value={form.Disponivel}
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
              <button type="submit" className="primary-button" disabled={saving}>
                {saving
                  ? "Salvando..."
                  : editingId
                  ? "Atualizar item"
                  : "Salvar item"}
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={clearForm}
                disabled={saving}
              >
                Limpar
              </button>

              {editingId ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={startNewItem}
                  disabled={saving}
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
            <h2>Itens cadastrados</h2>
            <span className="list-meta">
              Total: {items.length} | Disponíveis: {totalDisponiveis}
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
                value={tipoFilter}
                onChange={(e) => setTipoFilter(e.target.value)}
              >
                <option value="">Todos os tipos</option>
                {config.Tipo_Menu.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-box">
              <select
                value={categoriaFilter}
                onChange={(e) => setCategoriaFilter(e.target.value)}
              >
                <option value="">Todas as categorias</option>
                {config.Categoria_Menu.map((categoria) => (
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
            <p className="loading-text">Carregando itens...</p>
          ) : filteredItems.length === 0 ? (
            <div className="empty-state">Nenhum item encontrado.</div>
          ) : (
            <div className="card-list">
              {filteredItems.map((item, index) => (
                <article
                  className="menu-card"
                  key={item.ID_Item || `${item.Nome_Item}-${index}`}
                >
                  <div className="menu-card-header">
                    <div>
                      <h3 className="menu-name">{item.Nome_Item || "Sem nome"}</h3>
                      <div className="badge-row">
                        <span className="menu-badge">{item.Disponivel || "—"}</span>
                        <span className="menu-badge outline-badge">
                          {item.Tipo_Menu || "—"}
                        </span>
                        <span className="menu-badge outline-badge">
                          {item.Categoria || "—"}
                        </span>
                      </div>
                    </div>

                    <div className="card-actions">
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
                        onClick={() => handleDeactivate(item.ID_Item)}
                      >
                        Inativar
                      </button>
                    </div>
                  </div>

                  <div className="menu-details">
                    <div>
                      <strong>ID:</strong> {item.ID_Item || "—"}
                    </div>
                    <div>
                      <strong>Preço:</strong> {formatMoney(item.Preco)}
                    </div>
                    <div>
                      <strong>Custo:</strong> {formatMoney(item.Custo)}
                    </div>
                    <div>
                      <strong>Observações:</strong> {item.Observacoes || "—"}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default MenuPage;