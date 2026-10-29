/* =====================================================================
   DashboardController.js
   -----------------------------------------------------------------
   Responsável pela "Manipulação do DOM / Gráficos" das páginas:
     - iniciouser.html (Resumo Diário & Gráficos)
     - perfil.html (Informações Pessoais / Metas)

   Lê os dados do usuário logado em:
     users/{uid}/dashboard/summary   (dashboard)
     users/{uid}/dashboard/profile   (perfil)
   ===================================================================== */

import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, requireAuth } from "./AuthService.js";

/* ---------------------------------------------------------------------
   DADOS: DASHBOARD
--------------------------------------------------------------------- */
export async function fetchDashboardData() {
  const user = await requireAuth();
  if (!user) throw new Error("Usuário não autenticado.");

  const summaryRef = doc(db, "users", user.uid, "dashboard", "summary");
  const snap = await getDoc(summaryRef);

  if (!snap.exists()) {
    throw new Error("Ainda não há dados de dashboard para este usuário no Firestore.");
  }

  const data = snap.data();
  return {
    user: { name: data.user?.name ?? user.email, avatarUrl: data.user?.avatarUrl ?? null },
    date: formatToday(),
    stats: data.stats ?? [],
    favoriteFoods: data.favoriteFoods ?? [],
    weeklyCalories: data.weeklyCalories ?? { labels: [], consumidas: [], queimadas: [] },
    weightProgress: data.weightProgress ?? { labels: [], values: [], comparison: {} },
    hydrationActivity: data.hydrationActivity ?? { labels: [], hidratacao: [], atividade: [], totals: {} },
    mealsByType: data.mealsByType ?? { labels: [], values: [], colors: [] },
  };
}

function formatToday() {
  const d = new Date();
  const dias = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]}`;
}

/* ---------------------------------------------------------------------
   RENDER: cabeçalho / usuário
--------------------------------------------------------------------- */
function renderUser(user, date) {
  document.getElementById("user-name").textContent = user.name;
  document.getElementById("today-date").textContent = date;

  const avatar = document.getElementById("user-avatar");
  if (user.avatarUrl) {
    avatar.style.backgroundImage = `url(${user.avatarUrl})`;
    avatar.style.backgroundSize = "cover";
  }
}

/* ---------------------------------------------------------------------
   RENDER: cards de estatística do dia
--------------------------------------------------------------------- */
function renderStats(stats) {
  const grid = document.getElementById("stat-grid");
  grid.innerHTML = "";

  stats.forEach((s) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `
      <div class="stat-icon" style="background:${s.color}22; color:${s.color}">${s.icon}</div>
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.label}</div>
      <div class="stat-delta ${s.trend}">${s.delta}</div>
    `;
    grid.appendChild(card);
  });
}

/* ---------------------------------------------------------------------
   RENDER: tabela de alimentos favoritos
--------------------------------------------------------------------- */
function renderFavoriteFoods(foods) {
  const body = document.getElementById("fav-table-body");
  body.innerHTML = "";

  const maxPopularity = Math.max(...foods.map((f) => f.popularity));

  foods.forEach((f) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${f.rank}</td>
      <td>${f.name}</td>
      <td>
        <div class="fav-bar-track">
          <div class="fav-bar-fill" style="width:${(f.popularity / maxPopularity) * 100}%; background:${f.color}"></div>
        </div>
      </td>
      <td><span class="fav-count">${f.count}</span></td>
    `;
    body.appendChild(row);
  });
}

/* ---------------------------------------------------------------------
   GRÁFICOS (Chart.js)
   -----------------------------------------------------------------
   `charts`, `baseBarOptions` e `renderSimpleLegend` são exportados
   porque o DevController.js reaproveita essas mesmas utilidades para
   desenhar o gráfico do painel do desenvolvedor.
--------------------------------------------------------------------- */
export const charts = {};

// Guard: só configura o Chart.js se a biblioteca estiver carregada nesta
// página (páginas sem gráficos, como o perfil, não precisam incluí-la).
if (typeof Chart !== "undefined") {
  Chart.defaults.color = "#8a91b3";
  Chart.defaults.font.family = "'Segoe UI', system-ui, sans-serif";
  Chart.defaults.font.size = 11;
}

const gridStyle = { color: "rgba(255,255,255,0.05)" };

export function baseBarOptions(showLegendAxis = true) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#8a91b3" } },
      y: { display: showLegendAxis, grid: gridStyle, ticks: { color: "#8a91b3" } },
    },
  };
}

export function renderSimpleLegend(elementId, items) {
  document.getElementById(elementId).innerHTML = items
    .map((i) => `<span><span class="dot" style="background:${i.color}"></span>${i.label}</span>`)
    .join("");
}

function renderWeeklyCaloriesChart(data) {
  const ctx = document.getElementById("chart-calorias");
  if (charts.calorias) charts.calorias.destroy();

  charts.calorias = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [
        { label: "Consumidas", data: data.consumidas, backgroundColor: "#f97316", borderRadius: 6, barThickness: 18 },
        { label: "Queimadas", data: data.queimadas, backgroundColor: "#38bdf8", borderRadius: 6, barThickness: 18 },
      ],
    },
    options: baseBarOptions(),
  });

  renderSimpleLegend("legend-calorias", [
    { label: "Consumidas", color: "#f97316" },
    { label: "Queimadas", color: "#38bdf8" },
  ]);
}

function renderWeightProgressChart(data) {
  const ctx = document.getElementById("chart-peso");
  if (charts.peso) charts.peso.destroy();

  charts.peso = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: "Peso (kg)",
          data: data.values,
          backgroundColor: (c) => {
            const palette = ["#38bdf8", "#22c55e", "#f59e0b", "#ef4444"];
            return palette[c.dataIndex % palette.length];
          },
          borderRadius: 6,
          barThickness: 26,
        },
      ],
    },
    options: baseBarOptions(false),
  });

  document.getElementById("legend-peso").innerHTML = `
    <div class="legend-item"><span>Mês passado</span><strong>${data.comparison.lastMonth}</strong></div>
    <div class="legend-item"><span>Este mês</span><strong>${data.comparison.thisMonth}</strong></div>
  `;
}

function renderHydrationActivityChart(data) {
  const ctx = document.getElementById("chart-hidratacao");
  if (charts.hidratacao) charts.hidratacao.destroy();

  charts.hidratacao = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [
        { label: "Hidratação", data: data.hidratacao, backgroundColor: "#22c55e", borderRadius: 6, barThickness: 18 },
        { label: "Atividade", data: data.atividade, backgroundColor: "#f97316", borderRadius: 6, barThickness: 18 },
      ],
    },
    options: baseBarOptions(),
  });

  document.getElementById("legend-hidratacao").innerHTML = `
    <div class="legend-item"><span><span class="dot" style="background:#22c55e"></span>Volume</span><strong>${data.totals.volume}</strong></div>
    <div class="legend-item"><span><span class="dot" style="background:#f97316"></span>Atividade</span><strong>${data.totals.atividade}</strong></div>
  `;
}

function renderMealsPieChart(data) {
  const ctx = document.getElementById("chart-refeicoes");
  if (charts.refeicoes) charts.refeicoes.destroy();

  const total = data.values.reduce((a, b) => a + b, 0);
  document.getElementById("pie-total-num").textContent = total;

  charts.refeicoes = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: data.labels,
      datasets: [{ data: data.values, backgroundColor: data.colors, borderWidth: 0, cutout: "68%" }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
    },
  });

  const legend = document.getElementById("legend-refeicoes");
  legend.innerHTML = data.labels
    .map((l, i) => `<span><span class="dot" style="background:${data.colors[i]}"></span>${l}</span>`)
    .join("");
}

/* ---------------------------------------------------------------------
   BOOTSTRAP: DASHBOARD
--------------------------------------------------------------------- */
export async function initDashboard() {
  try {
    const data = await fetchDashboardData();

    renderUser(data.user, data.date);
    renderStats(data.stats);
    renderFavoriteFoods(data.favoriteFoods);
    renderWeeklyCaloriesChart(data.weeklyCalories);
    renderWeightProgressChart(data.weightProgress);
    renderHydrationActivityChart(data.hydrationActivity);
    renderMealsPieChart(data.mealsByType);
  } catch (err) {
    console.error("Erro ao carregar o dashboard:", err);
    const content = document.querySelector(".content");
    const msg = document.createElement("p");
    msg.className = "data-error";
    msg.textContent = "Não foi possível carregar os dados. Tente novamente mais tarde.";
    content.prepend(msg);
  }

  document.getElementById("btn-export")?.addEventListener("click", () => {
    // Placeholder: quando houver backend, gerar/baixar um relatório real aqui
    alert("Exportação ainda não conectada ao banco de dados.");
  });
}

/* =====================================================================
   PÁGINA: PERFIL (perfil.html)
   ===================================================================== */
export async function fetchProfileData() {
  const user = await requireAuth();
  if (!user) throw new Error("Usuário não autenticado.");

  const profileRef = doc(db, "users", user.uid, "dashboard", "profile");
  const snap = await getDoc(profileRef);

  if (!snap.exists()) {
    throw new Error("Ainda não há dados de perfil para este usuário no Firestore.");
  }

  const data = snap.data();
  return {
    identity: {
      name: data.identity?.name ?? user.email,
      handle: data.identity?.handle ?? "",
      avatarUrl: data.identity?.avatarUrl ?? null,
    },
    stats: data.stats ?? [],
    personalInfo: data.personalInfo ?? [],
    achievements: data.achievements ?? { unlocked: 0, total: 0, items: [] },
  };
}

function renderProfileIdentity(identity) {
  document.getElementById("profile-name").textContent = identity.name;
  document.getElementById("profile-handle").textContent = identity.handle;

  const avatar = document.getElementById("profile-avatar");
  if (identity.avatarUrl) {
    avatar.style.backgroundImage = `url(${identity.avatarUrl})`;
    avatar.style.backgroundSize = "cover";
  }
}

function renderProfileStats(stats) {
  const wrap = document.getElementById("profile-stats");
  wrap.innerHTML = "";

  stats.forEach((s) => {
    const card = document.createElement("div");
    card.className = "profile-stat-card";
    card.innerHTML = `
      <div class="stat-icon-label"><span class="icon">${s.icon}</span>${s.label}</div>
      <div class="stat-value">${s.value}</div>
      <div class="stat-unit">${s.unit}</div>
    `;
    wrap.appendChild(card);
  });
}

function renderPersonalInfo(items) {
  const grid = document.getElementById("info-grid");
  grid.innerHTML = "";

  items.forEach((i) => {
    const item = document.createElement("div");
    item.className = "info-item";
    item.innerHTML = `
      <div class="info-label">${i.label}</div>
      <div class="info-value ${i.highlight ? "highlight" : ""}">${i.value}</div>
    `;
    grid.appendChild(item);
  });
}

function renderAchievements(data) {
  document.getElementById("achievements-sub").textContent =
    `${data.unlocked} de ${data.total} desbloqueadas`;

  const grid = document.getElementById("achievements-grid");
  grid.innerHTML = "";

  data.items.forEach((a) => {
    const card = document.createElement("div");
    card.className = "achievement-card";
    card.innerHTML = `
      <div class="achievement-icon" style="background:${a.color}22; color:${a.color}">${a.icon}</div>
      <div>
        <div class="achievement-title">${a.title}</div>
        <div class="achievement-subtitle">${a.subtitle}</div>
      </div>
    `;
    grid.appendChild(card);
  });
}

/* ---------------------------------------------------------------------
   BOOTSTRAP: PERFIL
--------------------------------------------------------------------- */
export async function initProfilePage() {
  try {
    const data = await fetchProfileData();

    renderProfileIdentity(data.identity);
    renderProfileStats(data.stats);
    renderPersonalInfo(data.personalInfo);
    renderAchievements(data.achievements);
  } catch (err) {
    console.error("Erro ao carregar o perfil:", err);
    const page = document.getElementById("profile-page");
    const msg = document.createElement("p");
    msg.className = "data-error";
    msg.textContent = "Não foi possível carregar os dados do perfil. Tente novamente mais tarde.";
    page.prepend(msg);
  }

  document.getElementById("profile-back")?.addEventListener("click", () => {
    window.location.href = "iniciouser.html";
  });

  document.getElementById("btn-atualizar")?.addEventListener("click", () => {
    alert("Edição de informações pessoais ainda não conectada ao banco de dados.");
  });

  document.getElementById("btn-ver-todas")?.addEventListener("click", () => {
    alert("Lista completa de conquistas ainda não conectada ao banco de dados.");
  });
}
