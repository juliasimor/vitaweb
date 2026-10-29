/* =====================================================================
   script.js · Router
   -----------------------------------------------------------------
   Ponto de entrada único, carregado por TODAS as páginas HTML.
   Responsabilidade: olhar para o DOM da página atual, decidir "onde
   estamos" e chamar o controller certo. Nenhuma lógica de negócio
   mora aqui — ela vive em AuthService.js, DashboardController.js e
   DevController.js.
   ===================================================================== */

import { initUserLoginForm, initForgotPasswordForm, bindLogoutButtons } from "./AuthService.js";
import { initDashboard, initProfilePage } from "./DashboardController.js";
import { initDevLoginForm, initDevDashboard } from "./DevController.js";

document.addEventListener("DOMContentLoaded", () => {
  // Fluxo de autenticação
  if (document.getElementById("login-form")) {
    initUserLoginForm();
  }
  if (document.getElementById("forgot-form")) {
    initForgotPasswordForm();
  }

  // Painel do usuário
  if (document.getElementById("stat-grid")) {
    initDashboard();
  }
  if (document.getElementById("profile-page")) {
    initProfilePage();
  }

  // Painel do desenvolvedor
  if (document.getElementById("dev-login-form")) {
    initDevLoginForm();
  }
  if (document.getElementById("dev-page")) {
    initDevDashboard();
  }

  // Disponível em qualquer página que tenha um botão/link "Sair"
  bindLogoutButtons();
});
