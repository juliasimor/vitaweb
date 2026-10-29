/* =====================================================================
   AuthService.js
   -----------------------------------------------------------------
   Responsável por tudo relacionado a "Gestão de Sessão":
     - Inicialização do Firebase (App, Auth, Firestore)
     - Login / logout / recuperação de senha
     - Proteção de rotas (requireAuth)

   Outros módulos (DashboardController, DevController) importam
   `auth` e `db` daqui em vez de inicializar o Firebase de novo.
   ===================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Dados reais copiados de Firebase Console → Configurações do projeto → App da Web "Vita web"
const firebaseConfig = {
  apiKey: "AIzaSyD2b4AR1rCStQ9pajWhcs7f2LXLngBXXdo",
  authDomain: "vita-sendemail.firebaseapp.com",
  projectId: "vita-sendemail",
  storageBucket: "vita-sendemail.firebasestorage.app",
  messagingSenderId: "1066710561089",
  appId: "1:1066710561089:web:b9cb480c9c5bf9dfc9b1c0",
  measurementId: "G-GLDQSKJXGR",
};

const firebaseApp = initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

/* ---------------------------------------------------------------------
   SESSÃO
   -----------------------------------------------------------------
   getCurrentUser() espera o Firebase confirmar (ou não) que existe um
   usuário logado antes de continuar — evita "piscar" a tela com erro
   no primeiro instante em que a página carrega.
--------------------------------------------------------------------- */
export function getCurrentUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

// Protege páginas internas (dashboard, perfil): se não houver usuário
// logado, manda de volta para o login.
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = "login.html";
    return null;
  }
  return user;
}

/* ---------------------------------------------------------------------
   ACESSO DE DESENVOLVEDOR
   -----------------------------------------------------------------
   Um desenvolvedor é um usuário do Firebase Authentication que também
   tem um documento em `devs/{uid}` no Firestore. Quem concede o acesso
   é o Console (ou Admin SDK): as regras do Firestore impedem que o
   cliente crie ou altere documentos em `devs`.
--------------------------------------------------------------------- */
export async function isDev(uid) {
  const snap = await getDoc(doc(db, "devs", uid));
  return snap.exists();
}

// Protege o painel dev: exige sessão ativa E registro em `devs/{uid}`.
export async function requireDev() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = "dev.html";
    return null;
  }

  let allowed = false;
  try {
    allowed = await isDev(user.uid);
  } catch (err) {
    console.error("Não foi possível verificar o acesso dev:", err);
  }

  if (!allowed) {
    window.location.href = "dev.html";
    return null;
  }
  return user;
}

// Login do desenvolvedor: autentica e confere `devs/{uid}`. Se a conta
// existe mas não é dev, a sessão recém-aberta é encerrada.
export async function loginDev(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);

  let allowed = false;
  try {
    allowed = await isDev(cred.user.uid);
  } finally {
    if (!allowed) await signOut(auth);
  }

  if (!allowed) {
    const err = new Error("Esta conta não tem acesso de desenvolvedor.");
    err.code = "vita/not-dev";
    throw err;
  }
  return cred.user;
}

/* ---------------------------------------------------------------------
   AÇÕES DE AUTENTICAÇÃO
--------------------------------------------------------------------- */
export function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
  return signOut(auth);
}

export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

/* =====================================================================
   PÁGINA: LOGIN DE USUÁRIO (login.html)
   ===================================================================== */
export function initUserLoginForm() {
  const form = document.getElementById("login-form");
  if (!form) return;

  const errorEl = document.getElementById("login-error");
  const submitBtn = form.querySelector("button");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errorEl) errorEl.style.display = "none";

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Entrando...";

    try {
      await loginWithEmail(email, password);
      window.location.href = "iniciouser.html";
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = "E-mail ou senha inválidos. Tente novamente.";
        errorEl.style.display = "block";
      }
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
}

/* =====================================================================
   PÁGINA: ESQUECEU A SENHA (esqueceusenha.html)
   ===================================================================== */
export function initForgotPasswordForm() {
  const form = document.getElementById("forgot-form");
  if (!form) return;

  const errorEl = document.getElementById("forgot-error");
  const submitBtn = form.querySelector("button");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errorEl) errorEl.style.display = "none";

    const email = document.getElementById("forgot-email").value;
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando...";

    try {
      await resetPassword(email);
      window.location.href = "recuperarsenha.html";
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = "Não foi possível enviar o e-mail. Verifique o endereço digitado.";
        errorEl.style.display = "block";
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
}

/* ---------------------------------------------------------------------
   LOGOUT GLOBAL
   -----------------------------------------------------------------
   Qualquer link/botão "Sair" da aplicação (data-view="sair") desloga
   do Firebase Auth antes de redirecionar.
--------------------------------------------------------------------- */
export function bindLogoutButtons() {
  document.querySelectorAll('[data-view="sair"]').forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      await logout();
      window.location.href = "index.html";
    });
  });
}
