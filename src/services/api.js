const GAS_URL = import.meta.env.VITE_GAS_URL;

function ensureUrl() {
  if (!GAS_URL) {
    throw new Error("VITE_GAS_URL não foi definida no arquivo .env");
  }
}

async function normalizeResponse(response) {
  if (!response.ok) {
    throw new Error(`Erro HTTP: ${response.status}`);
  }

  const data = await response.json();

  if (data?.ok === false) {
    throw new Error(data.error || "Erro retornado pela API");
  }

  return data;
}

export async function apiGet(action, params = {}) {
  ensureUrl();

  const url = new URL(GAS_URL);
  url.searchParams.set("action", action);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    method: "GET",
    redirect: "follow",
  });

  return normalizeResponse(response);
}

export async function apiPost(action, payload = {}) {
  ensureUrl();

  const response = await fetch(GAS_URL, {
    method: "POST",
    redirect: "follow",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      action,
      payload,
    }),
  });

  return normalizeResponse(response);
}

export async function testHealth() {
  return apiGet("health");
}

export async function getConfig() {
  return apiGet("config");
}

/* Times */
export async function listTimes() {
  return apiGet("listTimes");
}
export async function addTime(payload) {
  return apiPost("addTime", payload);
}
export async function updateTime(payload) {
  return apiPost("updateTime", payload);
}
export async function deactivateTime(id) {
  return apiPost("deactivateTime", { ID_Time: id });
}

/* Jogadores */
export async function listJogadores() {
  return apiGet("listJogadores");
}
export async function addJogador(payload) {
  return apiPost("addJogador", payload);
}
export async function updateJogador(payload) {
  return apiPost("updateJogador", payload);
}
export async function deactivateJogador(id) {
  return apiPost("deactivateJogador", { ID_Jogador: id });
}

/* Agenda */
export async function listAgenda() {
  return apiGet("listAgenda");
}
export async function addAgenda(payload) {
  return apiPost("addAgenda", payload);
}
export async function updateAgenda(payload) {
  return apiPost("updateAgenda", payload);
}
export async function deleteAgenda(id) {
  return apiPost("deleteAgenda", { ID_Jogo: id });
}

/* Menus */
export async function listMenus() {
  return apiGet("listMenus");
}
export async function addMenuItem(payload) {
  return apiPost("addMenuItem", payload);
}
export async function updateMenuItem(payload) {
  return apiPost("updateMenuItem", payload);
}
export async function deactivateMenuItem(id) {
  return apiPost("deactivateMenuItem", { ID_Item: id });
}

/* Estoque */
export async function listEstoque() {
  return apiGet("listEstoque");
}
export async function addEstoqueItem(payload) {
  return apiPost("addEstoqueItem", payload);
}
export async function updateEstoqueItem(payload) {
  return apiPost("updateEstoqueItem", payload);
}
export async function deactivateEstoqueItem(id) {
  return apiPost("deactivateEstoqueItem", { ID_Item_Estoque: id });
}
export async function listMovEstoque(idItemEstoque = "") {
  return apiGet("listMovEstoque", { ID_Item_Estoque: idItemEstoque });
}
export async function registrarMovEstoque(payload) {
  return apiPost("registrarMovEstoque", payload);
}

/* Comandas */
export async function listComandasAbertas() {
  return apiGet("listComandasAbertas");
}
export async function listComandasFechadas() {
  return apiGet("listComandasFechadas");
}
export async function addComanda(payload) {
  return apiPost("addComanda", payload);
}
export async function updateComanda(payload) {
  return apiPost("updateComanda", payload);
}
export async function fecharComanda(payload) {
  return apiPost("fecharComanda", payload);
}
export async function listComandaItens(idComanda = "") {
  return apiGet("listComandaItens", { ID_Comanda: idComanda });
}
export async function listPagamentos(idComanda = "") {
  return apiGet("listPagamentos", { ID_Comanda: idComanda });
}