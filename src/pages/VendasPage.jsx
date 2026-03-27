import { useEffect, useMemo, useState } from "react";
import {
  addComanda,
  fecharComanda,
  getConfig,
  listComandasAbertas,
  listComandaItens,
  listMenus,
  listPagamentos,
  updateComanda,
} from "../services/api";
import "./VendasPage.css";

const initialComandaForm = {
  ID_Comanda: "",
  Nome_Cliente: "",
  Status: "Aberta",
  Forma_Pagamento: "",
  Valor_Pago: "",
  Observacoes: "",
  Data_Abertura: "",
  Data_Fechamento: "",
};

const initialItemForm = {
  Nome_Item: "",
  Categoria: "",
  Preco: "",
  Quantidade: 1,
};

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeNumber(value) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isNaN(number) ? 0 : number;
}

function formatMoney(value) {
  const number = normalizeNumber(value);

  return number.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function buildComandaId() {
  return `COM-${Date.now()}`;
}

function buildComandaItemId() {
  return `CIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function buildPaymentId() {
  return `PAG-${Date.now()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function VendasPage() {
  const [viewMode, setViewMode] = useState("list");
  const [comandas, setComandas] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [paymentOptions, setPaymentOptions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [savingComanda, setSavingComanda] = useState(false);
  const [savingClose, setSavingClose] = useState(false);

  const [form, setForm] = useState(initialComandaForm);
  const [itemForm, setItemForm] = useState(initialItemForm);
  const [itensComanda, setItensComanda] = useState([]);
  const [editingId, setEditingId] = useState("");

  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  async function loadOpenComandas() {
    const comandasResponse = await listComandasAbertas();
    const rawComandas = comandasResponse.data || [];

    const hydrated = await Promise.all(
      rawComandas.map(async (comanda) => {
        try {
          const [itensResponse, pagamentosResponse] = await Promise.all([
            listComandaItens(comanda.ID_Comanda),
            listPagamentos(comanda.ID_Comanda),
          ]);

          return {
            ...comanda,
            Itens: itensResponse.data || [],
            Pagamentos: pagamentosResponse.data || [],
          };
        } catch {
          return {
            ...comanda,
            Itens: [],
            Pagamentos: [],
          };
        }
      })
    );

    setComandas(hydrated);
  }

  async function loadPageData() {
    try {
      setLoading(true);
      setMessage("");

      const [menusResponse, configResponse] = await Promise.all([
        listMenus(),
        getConfig(),
      ]);

      const availableMenuItems = (menusResponse.data || []).filter(
        (item) => normalizeText(item.Disponivel).toLowerCase() === "sim"
      );

      setMenuItems(availableMenuItems);
      setPaymentOptions(configResponse.data?.Formas_Pagamento || []);

      await loadOpenComandas();
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

  const filteredComandas = useMemo(() => {
    return comandas.filter((comanda) => {
      const nome = normalizeText(comanda.Nome_Cliente).toLowerCase();
      const id = normalizeText(comanda.ID_Comanda).toLowerCase();
      const termo = search.toLowerCase();

      return nome.includes(termo) || id.includes(termo);
    });
  }, [comandas, search]);

  const totalAbertas = comandas.length;

  const volumeAberto = useMemo(() => {
    return comandas.reduce((acc, item) => acc + normalizeNumber(item.Total), 0);
  }, [comandas]);

  const subtotalAtual = useMemo(() => {
    return itensComanda.reduce((acc, item) => {
      return acc + normalizeNumber(item.Preco) * normalizeNumber(item.Quantidade);
    }, 0);
  }, [itensComanda]);

  const valorPagoAtual = useMemo(() => {
    return normalizeNumber(form.Valor_Pago);
  }, [form.Valor_Pago]);

  const saldoAtual = useMemo(() => {
    return subtotalAtual - valorPagoAtual;
  }, [subtotalAtual, valorPagoAtual]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleItemChange(event) {
    const { name, value } = event.target;

    if (name === "Nome_Item") {
      const selected = menuItems.find(
        (item) => normalizeText(item.Nome_Item) === normalizeText(value)
      );

      setItemForm((current) => ({
        ...current,
        Nome_Item: value,
        Categoria: selected?.Categoria || "",
        Preco: selected?.Preco ?? "",
      }));
      return;
    }

    setItemForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function clearForm() {
    setForm(initialComandaForm);
    setItemForm(initialItemForm);
    setItensComanda([]);
    setEditingId("");
  }

  function startNewComanda() {
    clearForm();
    setForm((current) => ({
      ...current,
      Status: "Aberta",
      Data_Abertura: nowIso(),
    }));
    setViewMode("form");
    setMessage("");
    setMessageType("");
  }

  function startEdit(comanda) {
    const pagamentoPrincipal = (comanda.Pagamentos || [])[0];

    setForm({
      ID_Comanda: comanda.ID_Comanda || "",
      Nome_Cliente: comanda.Nome_Cliente || "",
      Status: comanda.Status || "Aberta",
      Forma_Pagamento: pagamentoPrincipal?.Forma_Pagamento || comanda.Forma_Pagamento || "",
      Valor_Pago: String(
        pagamentoPrincipal?.Valor_Pago ?? comanda.Valor_Pago ?? ""
      ),
      Observacoes: comanda.Observacoes || "",
      Data_Abertura: comanda.Data_Abertura || "",
      Data_Fechamento: comanda.Data_Fechamento || "",
    });

    setItensComanda(
      (comanda.Itens || []).map((item) => ({
        ID_Item_Comanda: item.ID_Item_Comanda || buildComandaItemId(),
        Nome_Item: item.Nome_Item || "",
        Categoria: item.Categoria || "",
        Preco: item.Preco ?? "",
        Quantidade: item.Quantidade ?? 1,
      }))
    );

    setEditingId(comanda.ID_Comanda || "");
    setViewMode("form");
    setMessage("");
    setMessageType("");
  }

  function addItemToComanda() {
    if (!normalizeText(itemForm.Nome_Item)) {
      setMessage("Selecione um item para adicionar.");
      setMessageType("error");
      return;
    }

    const quantidade = normalizeNumber(itemForm.Quantidade);
    const preco = normalizeNumber(itemForm.Preco);

    if (!(quantidade > 0)) {
      setMessage("Informe uma quantidade válida.");
      setMessageType("error");
      return;
    }

    if (!(preco > 0)) {
      setMessage("Informe um preço válido.");
      setMessageType("error");
      return;
    }

    const newItem = {
      ID_Item_Comanda: buildComandaItemId(),
      Nome_Item: normalizeText(itemForm.Nome_Item),
      Categoria: normalizeText(itemForm.Categoria),
      Preco: preco,
      Quantidade: quantidade,
    };

    setItensComanda((current) => [...current, newItem]);
    setItemForm(initialItemForm);
    setMessage("");
    setMessageType("");
  }

  function removeItem(id) {
    setItensComanda((current) =>
      current.filter((item) => item.ID_Item_Comanda !== id)
    );
  }

  function changeItemQuantity(id, direction) {
    setItensComanda((current) =>
      current
        .map((item) => {
          if (item.ID_Item_Comanda !== id) return item;

          const currentQty = normalizeNumber(item.Quantidade);
          const nextQty = direction === "plus" ? currentQty + 1 : currentQty - 1;

          return {
            ...item,
            Quantidade: nextQty,
          };
        })
        .filter((item) => normalizeNumber(item.Quantidade) > 0)
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!normalizeText(form.Nome_Cliente)) {
      setMessage("Informe o nome da comanda ou do cliente.");
      setMessageType("error");
      return;
    }

    if (itensComanda.length === 0) {
      setMessage("Adicione pelo menos um item à comanda.");
      setMessageType("error");
      return;
    }

    try {
      setSavingComanda(true);
      setMessage("");

      const payload = {
        ID_Comanda: normalizeText(form.ID_Comanda) || buildComandaId(),
        Nome_Cliente: normalizeText(form.Nome_Cliente),
        Status: "Aberta",
        Forma_Pagamento: normalizeText(form.Forma_Pagamento),
        Valor_Pago: valorPagoAtual,
        Subtotal: subtotalAtual,
        Total: subtotalAtual,
        Saldo: saldoAtual,
        Observacoes: normalizeText(form.Observacoes),
        Data_Abertura: form.Data_Abertura || nowIso(),
        Data_Fechamento: "",
        ID_Pagamento: valorPagoAtual > 0 ? buildPaymentId() : "",
        Data_Pagamento: valorPagoAtual > 0 ? nowIso() : "",
        Itens: itensComanda.map((item) => ({
          ID_Item_Comanda: item.ID_Item_Comanda || buildComandaItemId(),
          Nome_Item: normalizeText(item.Nome_Item),
          Categoria: normalizeText(item.Categoria),
          Preco: normalizeNumber(item.Preco),
          Quantidade: normalizeNumber(item.Quantidade),
        })),
      };

      if (editingId) {
        await updateComanda(payload);
        setMessage("Comanda atualizada com sucesso.");
      } else {
        await addComanda(payload);
        setMessage("Comanda aberta com sucesso.");
      }

      setMessageType("success");
      clearForm();
      setViewMode("list");
      await loadOpenComandas();
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setSavingComanda(false);
    }
  }

  async function handleCloseComanda(comanda) {
    const confirmed = window.confirm("Deseja fechar esta comanda?");
    if (!confirmed) return;

    try {
      setSavingClose(true);
      setMessage("");

      const pagamentoPrincipal = (comanda.Pagamentos || [])[0];
      const valorPago = normalizeNumber(
        pagamentoPrincipal?.Valor_Pago ?? comanda.Valor_Pago
      );
      const total = normalizeNumber(comanda.Total);
      const subtotal = normalizeNumber(comanda.Subtotal || comanda.Total);
      const saldo = total - valorPago;

      const payload = {
        ID_Comanda: comanda.ID_Comanda,
        Nome_Cliente: comanda.Nome_Cliente,
        Status: "Fechada",
        Forma_Pagamento:
          pagamentoPrincipal?.Forma_Pagamento || comanda.Forma_Pagamento || "",
        Valor_Pago: valorPago,
        Subtotal: subtotal,
        Total: total,
        Saldo: saldo,
        Observacoes: comanda.Observacoes || "",
        Data_Abertura: comanda.Data_Abertura || nowIso(),
        Data_Fechamento: nowIso(),
        ID_Pagamento: valorPago > 0 ? buildPaymentId() : "",
        Data_Pagamento: valorPago > 0 ? nowIso() : "",
        Itens: (comanda.Itens || []).map((item) => ({
          ID_Item_Comanda: item.ID_Item_Comanda || buildComandaItemId(),
          Nome_Item: item.Nome_Item || "",
          Categoria: item.Categoria || "",
          Preco: normalizeNumber(item.Preco),
          Quantidade: normalizeNumber(item.Quantidade),
        })),
      };

      await fecharComanda(payload);
      setMessage("Comanda fechada com sucesso.");
      setMessageType("success");
      await loadOpenComandas();
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setSavingClose(false);
    }
  }

  return (
    <div className="vendas-page">
      <div className="page-header">
        <h1>Vendas</h1>
        <p>
          Abra comandas avulsas, adicione itens por comanda e feche com facilidade.
        </p>
      </div>

      <div className="summary-grid">
        <article className="summary-card">
          <span className="summary-label">Comandas abertas</span>
          <strong className="summary-value">{totalAbertas}</strong>
        </article>

        <article className="summary-card">
          <span className="summary-label">Volume em aberto</span>
          <strong className="summary-value">{formatMoney(volumeAberto)}</strong>
        </article>
      </div>

      <div className="subtabs-row">
        <button
          type="button"
          className={`tab-button ${viewMode === "list" ? "active" : ""}`}
          onClick={() => setViewMode("list")}
        >
          Comandas abertas
        </button>

        <button
          type="button"
          className={`tab-button ${viewMode === "form" ? "active" : ""}`}
          onClick={startNewComanda}
        >
          {editingId ? "Editar comanda" : "Nova comanda"}
        </button>
      </div>

      {viewMode === "form" ? (
        <div className="form-layout">
          <section className="panel">
            <h2>{editingId ? "Editar comanda" : "Nova comanda"}</h2>
            <p>Abra uma comanda para qualquer cliente e monte os itens consumidos.</p>

            <form className="form-grid" onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="Nome_Cliente">Nome da comanda / cliente</label>
                <input
                  id="Nome_Cliente"
                  name="Nome_Cliente"
                  value={form.Nome_Cliente}
                  onChange={handleChange}
                  placeholder="Ex.: Mesa 3 / João / Público geral"
                />
              </div>

              <div className="field">
                <label htmlFor="Forma_Pagamento">Forma de pagamento</label>
                <select
                  id="Forma_Pagamento"
                  name="Forma_Pagamento"
                  value={form.Forma_Pagamento}
                  onChange={handleChange}
                >
                  <option value="">Selecione</option>
                  {paymentOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="Valor_Pago">Valor pago</label>
                <input
                  id="Valor_Pago"
                  name="Valor_Pago"
                  value={form.Valor_Pago}
                  onChange={handleChange}
                  placeholder="Ex.: 20.00"
                />
              </div>

              <div className="field">
                <label htmlFor="Observacoes">Observações</label>
                <input
                  id="Observacoes"
                  name="Observacoes"
                  value={form.Observacoes}
                  onChange={handleChange}
                  placeholder="Observações da comanda"
                />
              </div>

              <div className="totals-box">
                <div>
                  <span>Subtotal</span>
                  <strong>{formatMoney(subtotalAtual)}</strong>
                </div>
                <div>
                  <span>Saldo</span>
                  <strong>{formatMoney(saldoAtual)}</strong>
                </div>
              </div>

              <div className="actions-row">
                <button type="submit" className="primary-button" disabled={savingComanda}>
                  {savingComanda
                    ? "Salvando..."
                    : editingId
                    ? "Atualizar comanda"
                    : "Abrir comanda"}
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={clearForm}
                  disabled={savingComanda}
                >
                  Limpar
                </button>

                {editingId ? (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={startNewComanda}
                    disabled={savingComanda}
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

          <section className="panel">
            <h2>Itens da comanda</h2>
            <p>Adicione e ajuste os itens da comanda atual.</p>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="Nome_Item">Item</label>
                <select
                  id="Nome_Item"
                  name="Nome_Item"
                  value={itemForm.Nome_Item}
                  onChange={handleItemChange}
                >
                  <option value="">Selecione</option>
                  {menuItems.map((item) => (
                    <option key={item.ID_Item} value={item.Nome_Item}>
                      {item.Nome_Item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="Preco">Preço</label>
                <input
                  id="Preco"
                  name="Preco"
                  value={itemForm.Preco}
                  onChange={handleItemChange}
                  placeholder="Preço"
                />
              </div>

              <div className="field">
                <label htmlFor="Quantidade">Quantidade</label>
                <input
                  id="Quantidade"
                  name="Quantidade"
                  value={itemForm.Quantidade}
                  onChange={handleItemChange}
                  placeholder="Quantidade"
                />
              </div>

              <div className="actions-row">
                <button
                  type="button"
                  className="primary-button"
                  onClick={addItemToComanda}
                >
                  Adicionar item
                </button>
              </div>
            </div>

            <div className="items-list">
              {itensComanda.length === 0 ? (
                <div className="empty-state">Nenhum item adicionado.</div>
              ) : (
                itensComanda.map((item) => (
                  <article className="item-card" key={item.ID_Item_Comanda}>
                    <div className="item-card-header">
                      <div>
                        <h3>{item.Nome_Item}</h3>
                        <p>{item.Categoria}</p>
                      </div>

                      <button
                        type="button"
                        className="secondary-button small-button danger-button"
                        onClick={() => removeItem(item.ID_Item_Comanda)}
                      >
                        Remover
                      </button>
                    </div>

                    <div className="item-card-details">
                      <div>
                        <strong>Preço:</strong> {formatMoney(item.Preco)}
                      </div>
                      <div>
                        <strong>Qtd:</strong> {item.Quantidade}
                      </div>
                      <div>
                        <strong>Subtotal:</strong>{" "}
                        {formatMoney(
                          normalizeNumber(item.Preco) * normalizeNumber(item.Quantidade)
                        )}
                      </div>
                    </div>

                    <div className="qty-actions">
                      <button
                        type="button"
                        className="secondary-button small-button"
                        onClick={() => changeItemQuantity(item.ID_Item_Comanda, "minus")}
                      >
                        -1
                      </button>

                      <button
                        type="button"
                        className="secondary-button small-button"
                        onClick={() => changeItemQuantity(item.ID_Item_Comanda, "plus")}
                      >
                        +1
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      ) : (
        <section className="panel">
          <div className="list-header">
            <h2>Comandas abertas</h2>
            <span className="list-meta">Total: {totalAbertas}</span>
          </div>

          <div className="filters-grid">
            <div className="search-box">
              <input
                type="text"
                placeholder="Buscar comanda ou cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {message ? (
            <div className={`status-box ${messageType}`}>{message}</div>
          ) : null}

          {loading ? (
            <p className="loading-text">Carregando comandas...</p>
          ) : filteredComandas.length === 0 ? (
            <div className="empty-state">Nenhuma comanda aberta.</div>
          ) : (
            <div className="card-list">
              {filteredComandas.map((comanda) => (
                <article className="comanda-card" key={comanda.ID_Comanda}>
                  <div className="comanda-card-header">
                    <div>
                      <h3 className="comanda-name">
                        {comanda.Nome_Cliente || "Sem identificação"}
                      </h3>

                      <div className="badge-row">
                        <span className="status-badge badge-open">Aberta</span>
                        <span className="status-badge outline-badge">
                          {comanda.Forma_Pagamento || "Sem pagamento"}
                        </span>
                      </div>
                    </div>

                    <div className="card-actions">
                      <button
                        type="button"
                        className="secondary-button small-button"
                        onClick={() => startEdit(comanda)}
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        className="secondary-button small-button"
                        onClick={() => handleCloseComanda(comanda)}
                        disabled={savingClose}
                      >
                        {savingClose ? "Fechando..." : "Fechar"}
                      </button>
                    </div>
                  </div>

                  <div className="comanda-details">
                    <div>
                      <strong>ID:</strong> {comanda.ID_Comanda}
                    </div>
                    <div>
                      <strong>Itens:</strong> {comanda.Itens?.length || 0}
                    </div>
                    <div>
                      <strong>Total:</strong> {formatMoney(comanda.Total)}
                    </div>
                    <div>
                      <strong>Pago:</strong> {formatMoney(comanda.Valor_Pago)}
                    </div>
                    <div>
                      <strong>Saldo:</strong> {formatMoney(comanda.Saldo)}
                    </div>
                    <div>
                      <strong>Observações:</strong> {comanda.Observacoes || "—"}
                    </div>
                  </div>

                  <div className="comanda-items-preview">
                    <h4>Itens da comanda</h4>

                    {comanda.Itens?.length ? (
                      <div className="preview-list">
                        {comanda.Itens.map((item) => (
                          <div className="preview-item" key={item.ID_Item_Comanda}>
                            <span>{item.Nome_Item}</span>
                            <span>x{item.Quantidade}</span>
                            <span>
                              {formatMoney(
                                normalizeNumber(item.Preco) *
                                  normalizeNumber(item.Quantidade)
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="preview-empty">Sem itens.</p>
                    )}
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

export default VendasPage;