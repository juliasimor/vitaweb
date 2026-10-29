/* =====================================================================
   DevController.js
   -----------------------------------------------------------------
   Responsável pela "Gestão do Painel Dev":
     - dev.html       (login do desenvolvedor)
     - iniciodev.html (métricas por usuário & logs do sistema)

   Dados no Firestore:
     devs/{uid}                       → quem tem acesso dev (campo livre, ex: role)
     users/{uid}                      → name, email
     users/{uid}/dashboard/summary    → stats, weeklyCalories (mesmo doc do dashboard)
     logs/{logId}                     → createdAt, method, endpoint, status, payload

   Como o painel exibe dados escritos pelos próprios usuários (nome,
   stats), todo texto é inserido com textContent — nunca innerHTML.
   ===================================================================== */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, loginDev, requireDev } from "./AuthService.js";
import { baseBarOptions, charts } from "./DashboardController.js";

/* =====================================================================
   PÁGINA: LOGIN DEV (dev.html)
   ===================================================================== */
function friendlyLoginError(err) {
  switch (err?.code) {
    case "vita/not-dev":
      return err.message;
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde um pouco e tente novamente.";
    case "permission-denied":
      return "Sem permissão para verificar o acesso dev. Confira as regras do Firestore.";
    default:
      return "E-mail ou senha inválidos. Tente novamente.";
  }
}

export function initDevLoginForm() {
  const form = document.getElementById("dev-login-form");
  if (!form) return;

  const errorEl = document.getElementById("login-error");
  const toggleBtn = document.getElementById("toggle-password");
  const passwordInput = document.getElementById("dev-password");

  toggleBtn?.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    toggleBtn.textContent = isPassword ? "🙈" : "👁";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.style.display = "none";

    const submitBtn = form.querySelector("button[type='submit']");
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Entrando...";

    try {
      await loginDev(
        document.getElementById("dev-email").value,
        passwordInput.value
      );
      window.location.href = "iniciodev.html";
    } catch (err) {
      console.error("Falha no login dev:", err);
      errorEl.textContent = friendlyLoginError(err);
      errorEl.style.display = "block";
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
}

/* =====================================================================
   PÁGINA: PAINEL DEV (iniciodev.html)
   ===================================================================== */
const CHART_COLORS = ["#38bdf8", "#22c55e", "#f59e0b", "#f97316"];
const EVENTS_LIMIT = 20;

/* ---------------------------------------------------------------------
   DADOS
--------------------------------------------------------------------- */
async function fetchDevUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs
    .map((d) => {
      const data = d.data();
      return { id: d.id, name: data.name || data.email || d.id };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

async function fetchUserSummary(userId) {
  const snap = await getDoc(doc(db, "users", userId, "dashboard", "summary"));
  if (!snap.exists()) return null;

  const data = snap.data();
  const weekly = data.weeklyCalories ?? {};
  const labels = weekly.labels ?? [];

  return {
    stats: (data.stats ?? []).map((s) => ({ label: s.label, value: s.value })),
    weeklyCalories: {
      labels,
      values: weekly.consumidas ?? [],
      colors: labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
    },
  };
}

function formatEventTime(createdAt) {
  const d = createdAt?.toDate ? createdAt.toDate() : createdAt ? new Date(createdAt) : null;
  if (!d || Number.isNaN(d.getTime())) return "--:--:--";
  return d.toLocaleTimeString("pt-BR", { hour12: false });
}

async function fetchRecentEvents() {
  const q = query(collection(db, "logs"), orderBy("createdAt", "desc"), limit(EVENTS_LIMIT));
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      time: formatEventTime(data.createdAt),
      method: data.method ?? "",
      endpoint: data.endpoint ?? "",
      status: Number(data.status) || 0,
      payload: data.payload ?? null,
    };
  });
}

/* ---------------------------------------------------------------------
   RENDER
--------------------------------------------------------------------- */
function renderDevUserSelect(users, selectedId) {
  const select = document.getElementById("user-select");
  select.replaceChildren();

  users.forEach((u) => {
    const option = document.createElement("option");
    option.value = u.id;
    option.textContent = u.name;
    option.selected = u.id === selectedId;
    select.appendChild(option);
  });
}

function renderDevUserId(userId) {
  document.getElementById("user-id-label").textContent = `ID: ${userId ?? "--"}`;
}

function renderDevStats(stats) {
  const grid = document.getElementById("dev-stat-grid");
  grid.replaceChildren();

  if (!stats) {
    const msg = document.createElement("p");
    msg.className = "dev-subtitle";
    msg.textContent = "Este usuário ainda não tem dados de dashboard.";
    grid.appendChild(msg);
    return;
  }

  stats.forEach((s) => {
    const card = document.createElement("div");
    card.className = "dev-stat-card";

    const label = document.createElement("div");
    label.className = "dev-stat-label";
    label.textContent = s.label;

    const value = document.createElement("div");
    value.className = "dev-stat-value";
    value.textContent = s.value;

    card.append(label, value);
    grid.appendChild(card);
  });
}

function renderDevChart(data) {
  const ctx = document.getElementById("chart-dev-calorias");
  if (charts.devCalorias) charts.devCalorias.destroy();

  const weekly = data ?? { labels: [], values: [], colors: [] };

  charts.devCalorias = new Chart(ctx, {
    type: "bar",
    data: {
      labels: weekly.labels,
      datasets: [{ data: weekly.values, backgroundColor: weekly.colors, borderRadius: 6, barThickness: 34 }],
    },
    options: baseBarOptions(false),
  });
}

function renderDevEvents(events) {
  const body = document.getElementById("events-table-body");
  body.replaceChildren();

  if (!events.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "Nenhum evento registrado ainda.";
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  events.forEach((e) => {
    const row = document.createElement("tr");

    const cells = [e.time, e.method, e.endpoint, String(e.status)].map((text) => {
      const td = document.createElement("td");
      td.textContent = text;
      return td;
    });
    cells[2].className = "endpoint";
    cells[3].className = e.status >= 200 && e.status < 300 ? "status-ok" : "status-error";

    const actionCell = document.createElement("td");
    const btn = document.createElement("button");
    btn.className = "ver-json-btn";
    btn.textContent = "Ver JSON";
    btn.addEventListener("click", () => {
      alert(JSON.stringify(e.payload ?? { id: e.id, method: e.method, endpoint: e.endpoint, status: e.status }, null, 2));
    });
    actionCell.appendChild(btn);

    row.append(...cells, actionCell);
    body.appendChild(row);
  });
}

function showDevError(message) {
  const page = document.getElementById("dev-page");
  const msg = document.createElement("p");
  msg.className = "data-error";
  msg.textContent = message;
  page.prepend(msg);
}

/* ---------------------------------------------------------------------
   BOOTSTRAP
--------------------------------------------------------------------- */
async function loadDevUser(userId) {
  renderDevUserId(userId);

  try {
    const summary = await fetchUserSummary(userId);
    renderDevStats(summary ? summary.stats : null);
    renderDevChart(summary ? summary.weeklyCalories : null);
  } catch (err) {
    console.error("Erro ao carregar dados do usuário:", err);
    showDevError("Não foi possível carregar os dados deste usuário.");
  }
}

export async function initDevDashboard() {
  const user = await requireDev();
  if (!user) return;

  try {
    const [users, events] = await Promise.all([fetchDevUsers(), fetchRecentEvents()]);

    renderDevEvents(events);

    if (!users.length) {
      renderDevUserSelect([], null);
      renderDevUserId(null);
      renderDevStats(null);
      renderDevChart(null);
      return;
    }

    renderDevUserSelect(users, users[0].id);
    await loadDevUser(users[0].id);

    document.getElementById("user-select").addEventListener("change", (e) => {
      loadDevUser(e.target.value);
    });
  } catch (err) {
    console.error("Erro ao carregar o painel dev:", err);
    showDevError("Não foi possível carregar os dados. Tente novamente mais tarde.");
  }
}
