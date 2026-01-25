// ====== CONFIG ======
const SUPABASE_URL = "https://ywqxxpmsgcrzmgythvif.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3cXh4cG1zZ2Nyem1neXRodmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzA5NzQsImV4cCI6MjA4NDkwNjk3NH0.YBICeBd8S90UEGWtKjf08UWCY584TnGd3pqwzRXjX_w";

// ====================
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// UI refs
const authCard = document.getElementById("authCard");
const appCard = document.getElementById("appCard");

const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const btnSignUp = document.getElementById("btnSignUp");
const authMsg = document.getElementById("authMsg");

const userEmail = document.getElementById("userEmail");
const btnLogout = document.getElementById("btnLogout");

const accountForm = document.getElementById("accountForm");
const editId = document.getElementById("editId");
const summonerName = document.getElementById("summonerName");
const tagLine = document.getElementById("tagLine");
const region = document.getElementById("region");
const note = document.getElementById("note");
const btnCancelEdit = document.getElementById("btnCancelEdit");
const btnRefresh = document.getElementById("btnRefresh");
const appMsg = document.getElementById("appMsg");

const tbody = document.getElementById("tbody");

// Friends
const friendCodeInput = document.getElementById("friendCodeInput");
const btnLoadFriend = document.getElementById("btnLoadFriend");
const btnBackToMine = document.getElementById("btnBackToMine");

// Share
const myCodeInput = document.getElementById("myCodeInput");
const btnSaveMyCode = document.getElementById("btnSaveMyCode");
const btnCopyLink = document.getElementById("btnCopyLink");

// State
let viewingFriend = false;

// Helpers
function show(el) {
  el?.classList.remove("hidden");
}
function hide(el) {
  el?.classList.add("hidden");
}

function setMsg(el, text) {
  if (!el) return;
  if (!text) {
    hide(el);
    el.textContent = "";
    return;
  }
  el.textContent = text;
  show(el);
}

function setAppMsg(text) {
  if (!appMsg) return;
  appMsg.textContent = text || "";
  if (text) setTimeout(() => (appMsg.textContent = ""), 2500);
}

function resetForm() {
  if (editId) editId.value = "";
  if (summonerName) summonerName.value = "";
  if (tagLine) tagLine.value = "";
  if (region) region.value = "EUW";
  if (note) note.value = "";
  hide(btnCancelEdit);
}

function fillForm(row) {
  if (!row) return;
  if (editId) editId.value = row.id;
  if (summonerName) summonerName.value = row.summoner_name ?? "";
  if (tagLine) tagLine.value = row.tag_line ?? "";
  if (region) region.value = row.region ?? "EUW";
  if (note) note.value = row.note ?? "";
  show(btnCancelEdit);
  summonerName?.focus();
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeSlug(s) {
  return (s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

function isLoggedInSession(session) {
  return !!session?.user?.id;
}

// Session/UI
async function refreshSessionUI() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    show(authCard);
    hide(appCard);
    hide(btnLogout);
    if (userEmail) userEmail.textContent = "";
    return;
  }

  hide(authCard);
  show(appCard);
  show(btnLogout);
  if (userEmail) userEmail.textContent = session.user.email || "";

  await loadAccounts();
}

// Data
async function loadAccounts() {
  viewingFriend = false;
  hide(btnBackToMine);

  setAppMsg("Cargando…");

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!isLoggedInSession(session)) return;

  const { data, error } = await supabaseClient
    .from("lol_accounts")
    .select(
      "id, summoner_name, tag_line, region, note, created_at, owner_slug, is_public, user_id"
    )
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    setAppMsg("Error al cargar: " + error.message);
    return;
  }

  // Autorellenar mi código si existe
  const currentSlug = data?.find((x) => x.owner_slug)?.owner_slug || "";
  if (myCodeInput && currentSlug && !myCodeInput.value) {
    myCodeInput.value = currentSlug;
  }

  renderRows(data || []);
  setAppMsg("");
}

async function loadFriendAccounts(ownerSlug) {
  const slug = normalizeSlug(ownerSlug);
  if (!slug) return;

  viewingFriend = true;

  setAppMsg("Cargando cuentas del amigo…");

  const { data, error } = await supabaseClient
    .from("lol_accounts")
    .select("id, summoner_name, tag_line, region, note, created_at, is_public")
    .eq("owner_slug", slug)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  if (error) {
    setAppMsg("Error al cargar amigo: " + error.message);
    return;
  }

  renderRows(data || []);
  show(btnBackToMine);
  setAppMsg("");
}

function renderRows(rows) {
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="muted">No hay cuentas aún.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows
    .map((r) => {
      const actionsHtml = viewingFriend
        ? `<span class="muted">Solo lectura</span>`
        : `
          <button class="pill" data-action="edit">Editar</button>
          <button class="pill-danger" data-action="delete">Borrar</button>
        `;

      const publicHtml = viewingFriend
        ? `<span class="muted">${r.is_public ? "Sí" : "No"}</span>`
        : `<input type="checkbox" data-action="toggle-public" ${
            r.is_public ? "checked" : ""
          } />`;

      return `
        <tr data-id="${r.id}">
          <td><strong>${escapeHtml(r.summoner_name)}</strong></td>
          <td>${escapeHtml(r.tag_line || "")}</td>
          <td>${escapeHtml(r.region || "")}</td>
          <td>${escapeHtml(r.note || "")}</td>
          <td>${publicHtml}</td>
          <td class="right">${actionsHtml}</td>
        </tr>
      `;
    })
    .join("");
}

// Share (owner_slug)
async function saveMyCode(slug) {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!isLoggedInSession(session)) return;

  const clean = normalizeSlug(slug);
  if (!clean) return setAppMsg("Código inválido");

  // actualiza todas tus filas (las existentes)
  const { error } = await supabaseClient
    .from("lol_accounts")
    .update({ owner_slug: clean })
    .eq("user_id", session.user.id);

  if (error) return setAppMsg("Error guardando código: " + error.message);

  if (myCodeInput) myCodeInput.value = clean;
  setAppMsg("Código guardado ✅");
}

// Auth
authForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg(authMsg, "");

  const email = authEmail?.value.trim();
  const password = authPassword?.value;

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return setMsg(authMsg, "Error al entrar: " + error.message);

  if (authPassword) authPassword.value = "";
  await refreshSessionUI();
});

btnSignUp?.addEventListener("click", async () => {
  setMsg(authMsg, "");

  const email = authEmail?.value.trim();
  const password = authPassword?.value;

  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) return setMsg(authMsg, "Error al crear cuenta: " + error.message);

  setMsg(
    authMsg,
    "Cuenta creada. Si tienes confirmación por email activada, revisa tu correo."
  );
});

btnLogout?.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  resetForm();
  if (tbody) tbody.innerHTML = "";
  await refreshSessionUI();
});

// Create/Update
accountForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (viewingFriend) return;

  const sn = summonerName?.value.trim();
  if (!sn) return;

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!isLoggedInSession(session)) return setAppMsg("No hay sesión activa.");

  const payload = {
    summoner_name: sn,
    tag_line: tagLine?.value.trim() || null,
    region: region?.value,
    note: note?.value.trim() || null,
  };

  // si ya tienes código, lo aplicamos a nuevas filas también
  const mySlug = normalizeSlug(myCodeInput?.value || "");
  if (mySlug) payload.owner_slug = mySlug;

  const id = editId?.value;

  if (!id) {
    const { error } = await supabaseClient
      .from("lol_accounts")
      .insert([{ ...payload, user_id: session.user.id }]);

    if (error) return setAppMsg("Error al guardar: " + error.message);

    resetForm();
    await loadAccounts();
    setAppMsg("Guardado ✅");
    return;
  }

  const { error } = await supabaseClient
    .from("lol_accounts")
    .update(payload)
    .eq("id", id)
    .eq("user_id", session.user.id);

  if (error) return setAppMsg("Error al actualizar: " + error.message);

  resetForm();
  await loadAccounts();
  setAppMsg("Actualizado ✅");
});

btnCancelEdit?.addEventListener("click", () => {
  resetForm();
  setAppMsg("Edición cancelada");
});

btnRefresh?.addEventListener("click", () => {
  if (!viewingFriend) loadAccounts();
});

// Row actions (toggle/edit/delete)
tbody?.addEventListener("click", async (e) => {
  const el = e.target;
  const tr = el.closest("tr");
  if (!tr) return;

  const id = tr.dataset.id;
  if (!id) return;

  const action = el.dataset?.action;
  if (!action) return;

  if (viewingFriend) return;

  // toggle public
  if (action === "toggle-public") {
    const checked = !!el.checked;

    const { error } = await supabaseClient
      .from("lol_accounts")
      .update({ is_public: checked })
      .eq("id", id);

    if (error) return setAppMsg("Error: " + error.message);

    setAppMsg(checked ? "Ahora es pública ✅" : "Ahora es privada ✅");
    return;
  }

  if (action === "edit") {
    const tds = tr.querySelectorAll("td");
    fillForm({
      id,
      summoner_name: tds[0]?.innerText?.trim(),
      tag_line: tds[1]?.innerText?.trim(),
      region: tds[2]?.innerText?.trim(),
      note: tds[3]?.innerText?.trim(),
    });
    return;
  }

  if (action === "delete") {
    const ok = confirm("¿Borrar esta cuenta?");
    if (!ok) return;

    const { error } = await supabaseClient
      .from("lol_accounts")
      .delete()
      .eq("id", id);

    if (error) return setAppMsg("Error al borrar: " + error.message);

    resetForm();
    await loadAccounts();
    setAppMsg("Borrado ✅");
  }
});

// Friend UI
if (btnLoadFriend && btnBackToMine && friendCodeInput) {
  btnLoadFriend.addEventListener("click", async () => {
    const code = friendCodeInput.value.trim();
    if (!code) return setAppMsg("Introduce un código");
    await loadFriendAccounts(code);
  });

  btnBackToMine.addEventListener("click", async () => {
    hide(btnBackToMine);
    friendCodeInput.value = "";
    await loadAccounts();
  });
}

// Share UI
if (btnSaveMyCode && myCodeInput) {
  btnSaveMyCode.addEventListener("click", async () => {
    await saveMyCode(myCodeInput.value);
    await loadAccounts();
  });
}

if (btnCopyLink && myCodeInput) {
  btnCopyLink.addEventListener("click", async () => {
    const code = normalizeSlug(myCodeInput.value);
    if (!code) return setAppMsg("Primero guarda un código");

    const url = `${location.origin}${location.pathname}?friend=${encodeURIComponent(
      code
    )}`;
    await navigator.clipboard.writeText(url);
    setAppMsg("Enlace copiado ✅");
  });
}

// Preload friend from URL
(function preloadFriendFromUrl() {
  const params = new URLSearchParams(location.search);
  const friend = params.get("friend");
  if (friend && friendCodeInput) {
    friendCodeInput.value = friend;
  }
})();

// Reactividad a cambios de sesión
supabaseClient.auth.onAuthStateChange(() => {
  refreshSessionUI();
});

// Init
refreshSessionUI();
