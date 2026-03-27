import { useEffect, useMemo, useState } from "react";
import {
  listComandasFechadas,
  listComandaItens,
  listMenus,
  listPagamentos,
} from "../services/api";
import "./RelatoriosPage.css";

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
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return String(value);
}

function formatDateLabel(dateString) {
  if (!dateString) return "—";

  const [year, month, day] = dateString.split("-");
  if (!year || !month || !day) return dateString;

  return `${day}/${month}/${year}`;
}

function getDayKey(dateString) {
  return normalizeDateValue(dateString);
}

function getMonthKey(dateString) {
  const normalized = normalizeDateValue(dateString);
  if (!normalized) return "";

  const [year, month] = normalized.split("-");
  return `${year}-${month}`;
}

function getYearKey(dateString) {
  const normalized = normalizeDateValue(dateString);
  if (!normalized) return "";

  const [year] = normalized.split("-");
  return year;
}

function formatPeriodLabel(periodType, value) {
  if (!value) return "Todos";

  if (periodType === "dia") {
    return formatDateLabel(value);
  }

  if (periodType === "mes") {
    const [year, month] = value.split("-");
    return `${month}/${year}`;
  }

  return value;
}

function RelatoriosPage() {
  const [closedComandas, setClosedComandas] = useState([]);
  const [menuCostMap, setMenuCostMap] = useState({});
  const [loading, setLoading] = useState(true);

  const [periodType, setPeriodType] = useState("dia");
  const [selectedPeriod, setSelectedPeriod] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  async function loadPageData() {
    try {
      setLoading(true);
      setMessage("");

      const [comandasResponse, menusResponse] = await Promise.all([
        listComandasFechadas(),
        listMenus(),
      ]);

      const rawComandas = comandasResponse.data || [];
      const rawMenus = menusResponse.data || [];

      const costMap = {};
      rawMenus.forEach((item) => {
        const key = normalizeText(item.Nome_Item).toLowerCase();
        if (key) {
          costMap[key] = normalizeNumber(item.Custo);
        }
      });
      setMenuCostMap(costMap);

      const hydrated = await Promise.all(
        rawComandas.map(async (comanda) => {
          try {
            const [itensResponse, pagamentosResponse] = await Promise.all([
              listComandaItens(comanda.ID_Comanda),
              listPagamentos(comanda.ID_Comanda),
            ]);

            return {
              ...comanda,
              Data_Abertura: normalizeDateValue(comanda.Data_Abertura),
              Data_Fechamento: normalizeDateValue(comanda.Data_Fechamento),
              Itens: itensResponse.data || [],
              Pagamentos: pagamentosResponse.data || [],
            };
          } catch {
            return {
              ...comanda,
              Data_Abertura: normalizeDateValue(comanda.Data_Abertura),
              Data_Fechamento: normalizeDateValue(comanda.Data_Fechamento),
              Itens: [],
              Pagamentos: [],
            };
          }
        })
      );

      setClosedComandas(hydrated);
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

  const periodOptions = useMemo(() => {
    const map = new Map();

    closedComandas.forEach((sale) => {
      const refDate = sale.Data_Fechamento || sale.Data_Abertura || "";
      if (!refDate) return;

      if (periodType === "dia") {
        const key = getDayKey(refDate);
        if (key) map.set(key, key);
      }

      if (periodType === "mes") {
        const key = getMonthKey(refDate);
        if (key) map.set(key, key);
      }

      if (periodType === "ano") {
        const key = getYearKey(refDate);
        if (key) map.set(key, key);
      }
    });

    return Array.from(map.keys()).sort().reverse();
  }, [closedComandas, periodType]);

  const filteredSales = useMemo(() => {
    return closedComandas.filter((sale) => {
      if (!selectedPeriod) return true;

      const refDate = sale.Data_Fechamento || sale.Data_Abertura || "";

      if (periodType === "dia") return getDayKey(refDate) === selectedPeriod;
      if (periodType === "mes") return getMonthKey(refDate) === selectedPeriod;
      if (periodType === "ano") return getYearKey(refDate) === selectedPeriod;

      return true;
    });
  }, [closedComandas, selectedPeriod, periodType]);

  const salesWithCost = useMemo(() => {
    return filteredSales.map((sale) => {
      const custoTotal = (sale.Itens || []).reduce((acc, item) => {
        const nome = normalizeText(item.Nome_Item).toLowerCase();
        const custoUnitario = normalizeNumber(menuCostMap[nome] || 0);
        const quantidade = normalizeNumber(item.Quantidade);
        return acc + custoUnitario * quantidade;
      }, 0);

      const faturado = normalizeNumber(sale.Total);
      const lucro = faturado - custoTotal;

      return {
        ...sale,
        Custo_Total: custoTotal,
        Lucro_Total: lucro,
      };
    });
  }, [filteredSales, menuCostMap]);

  const totalFechadas = salesWithCost.length;

  const totalFaturado = useMemo(() => {
    return salesWithCost.reduce((acc, sale) => acc + normalizeNumber(sale.Total), 0);
  }, [salesWithCost]);

  const totalCusto = useMemo(() => {
    return salesWithCost.reduce((acc, sale) => acc + normalizeNumber(sale.Custo_Total), 0);
  }, [salesWithCost]);

  const totalLucro = useMemo(() => {
    return salesWithCost.reduce((acc, sale) => acc + normalizeNumber(sale.Lucro_Total), 0);
  }, [salesWithCost]);

  const salesByPayment = useMemo(() => {
    const group = {};

    salesWithCost.forEach((sale) => {
      const payment =
        normalizeText((sale.Pagamentos || [])[0]?.Forma_Pagamento) ||
        normalizeText(sale.Forma_Pagamento) ||
        "Não informado";

      group[payment] = (group[payment] || 0) + normalizeNumber(sale.Total);
    });

    return Object.entries(group)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [salesWithCost]);

  return (
    <div className="relatorios-page">
      <div className="page-header">
        <h1>Relatórios</h1>
        <p>
          Acompanhe comandas fechadas, faturamento, custo e lucro por período.
        </p>
      </div>

      <section className="panel">
        <div className="filters-grid">
          <div className="field">
            <label htmlFor="periodType">Período</label>
            <select
              id="periodType"
              value={periodType}
              onChange={(e) => {
                setPeriodType(e.target.value);
                setSelectedPeriod("");
              }}
            >
              <option value="dia">Dia</option>
              <option value="mes">Mês</option>
              <option value="ano">Ano</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="selectedPeriod">Filtro</label>
            <select
              id="selectedPeriod"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
            >
              <option value="">Todos</option>
              {periodOptions.map((option) => (
                <option key={option} value={option}>
                  {formatPeriodLabel(periodType, option)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {message ? (
          <div className={`status-box ${messageType}`}>{message}</div>
        ) : null}
      </section>

      <div className="summary-grid">
        <article className="summary-card">
          <span className="summary-label">Comandas fechadas</span>
          <strong className="summary-value">{totalFechadas}</strong>
        </article>

        <article className="summary-card">
          <span className="summary-label">Faturado</span>
          <strong className="summary-value">{formatMoney(totalFaturado)}</strong>
        </article>

        <article className="summary-card">
          <span className="summary-label">Custo</span>
          <strong className="summary-value">{formatMoney(totalCusto)}</strong>
        </article>

        <article className="summary-card alert-summary">
          <span className="summary-label">Lucro</span>
          <strong className="summary-value">{formatMoney(totalLucro)}</strong>
        </article>
      </div>

      <section className="panel">
        <h2>Resumo por forma de pagamento</h2>

        {loading ? (
          <p className="loading-text">Carregando relatórios...</p>
        ) : salesByPayment.length === 0 ? (
          <div className="empty-state">Nenhum dado disponível.</div>
        ) : (
          <div className="payment-list">
            {salesByPayment.map((item) => (
              <div className="payment-row" key={item.label}>
                <span>{item.label}</span>
                <strong>{formatMoney(item.value)}</strong>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="list-header">
          <h2>Comandas fechadas</h2>
          <span className="list-meta">Total: {totalFechadas}</span>
        </div>

        {loading ? (
          <p className="loading-text">Carregando comandas fechadas...</p>
        ) : salesWithCost.length === 0 ? (
          <div className="empty-state">
            Nenhuma comanda fechada encontrada neste filtro.
          </div>
        ) : (
          <div className="card-list">
            {salesWithCost.map((sale) => {
              const pagamentoPrincipal = (sale.Pagamentos || [])[0];

              return (
                <article className="report-card" key={sale.ID_Comanda}>
                  <div className="report-card-header">
                    <div>
                      <h3 className="report-name">
                        {sale.Nome_Cliente || "Sem identificação"}
                      </h3>

                      <div className="badge-row">
                        <span className="status-badge badge-closed">Fechada</span>
                        <span className="status-badge outline-badge">
                          {pagamentoPrincipal?.Forma_Pagamento ||
                            sale.Forma_Pagamento ||
                            "Sem pagamento"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="report-details">
                    <div>
                      <strong>ID:</strong> {sale.ID_Comanda}
                    </div>
                    <div>
                      <strong>Fechamento:</strong>{" "}
                      {sale.Data_Fechamento
                        ? formatDateLabel(sale.Data_Fechamento)
                        : "—"}
                    </div>
                    <div>
                      <strong>Faturado:</strong> {formatMoney(sale.Total)}
                    </div>
                    <div>
                      <strong>Custo:</strong> {formatMoney(sale.Custo_Total)}
                    </div>
                    <div>
                      <strong>Lucro:</strong> {formatMoney(sale.Lucro_Total)}
                    </div>
                    <div>
                      <strong>Itens:</strong> {sale.Itens?.length || 0}
                    </div>
                    <div>
                      <strong>Observações:</strong> {sale.Observacoes || "—"}
                    </div>
                  </div>

                  <div className="report-items-preview">
                    <h4>Itens da comanda</h4>

                    {sale.Itens?.length ? (
                      <div className="preview-list">
                        {sale.Itens.map((item) => {
                          const nome = normalizeText(item.Nome_Item).toLowerCase();
                          const custoUnitario = normalizeNumber(menuCostMap[nome] || 0);
                          const quantidade = normalizeNumber(item.Quantidade);
                          const custoItem = custoUnitario * quantidade;
                          const faturadoItem =
                            normalizeNumber(item.Preco) * quantidade;
                          const lucroItem = faturadoItem - custoItem;

                          return (
                            <div
                              className="preview-item preview-item-column"
                              key={item.ID_Item_Comanda}
                            >
                              <div className="preview-item-top">
                                <span>{item.Nome_Item}</span>
                                <span>x{quantidade}</span>
                              </div>
                              <div className="preview-item-bottom">
                                <span>Venda: {formatMoney(faturadoItem)}</span>
                                <span>Custo: {formatMoney(custoItem)}</span>
                                <span>Lucro: {formatMoney(lucroItem)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="preview-empty">Sem itens.</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default RelatoriosPage;