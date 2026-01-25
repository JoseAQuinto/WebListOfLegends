// ====== CONFIG ======
const SUPABASE_URL = "https://ywqxxpmsgcrzmgythvif.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3cXh4cG1zZ2Nyem1neXRodmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzA5NzQsImV4cCI6MjA4NDkwNjk3NH0.YBICeBd8S90UEGWtKjf08UWCY584TnGd3pqwzRXjX_w";

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

// Helpers
function show(el){ el.classList.remove("hidden"); }
function hide(el){ el.classList.add("hidden"); }

function setMsg(el, text){
  if (!text) { hide(el); el.textContent = ""; return; }
  el.textContent = text;
  show(el);
}

function setAppMsg(text){
  appMsg.textContent = text || "";
  if (text) setTimeout(() => (appMsg.textContent = ""), 2500);
}

function resetForm(){
  editId.value = "";
  summonerName.value = "";
  tagLine.value = "";
  region.value = "EUW";
  note.value = "";
  hide(btnCancelEdit);
}

function fillForm(row){
  editId.value = row.id;
  summonerName.value = row.summoner_name ?? "";
  tagLine.value = row.tag_line ?? "";
  region.value = row.region ?? "EUW";
  note.value = row.note ?? "";
  show(btnCancelEdit);
  summonerName.focus();
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// Session/UI
async function refreshSessionUI(){
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session){
    show(authCard);
    hide(appCard);
    hide(btnLogout);
    userEmail.textContent = "";
    return;
  }

  hide(authCard);
  show(appCard);
  show(btnLogout);
  userEmail.textContent = session.user.email || "";

  await loadAccounts();
}

// Auth
authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg(authMsg, "");

  const email = authEmail.value.trim();
  const password = authPassword.value;

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) return setMsg(authMsg, "Error al entrar: " + error.message);

  authPassword.value = "";
  await refreshSessionUI();
});

btnSignUp.addEventListener("click", async () => {
  setMsg(authMsg, "");

  const email = authEmail.value.trim();
  const password = authPassword.value;

  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) return setMsg(authMsg, "Error al crear cuenta: " + error.message);

  setMsg(authMsg, "Cuenta creada. Si tienes confirmación por email activada, revisa tu correo.");
});

btnLogout.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  resetForm();
  tbody.innerHTML = "";
  await refreshSessionUI();
});

// Data
async function loadAccounts(){
  setAppMsg("Cargando…");

  const { data, error } = await supabaseClient
    .from("lol_accounts")
    .select("id, summoner_name, tag_line, region, note, created_at")
    .order("created_at", { ascending: false });

  if (error){
    setAppMsg("Error al cargar: " + error.message);
    return;
  }

  renderRows(data || []);
  setAppMsg("");
}

function renderRows(rows){
  if (!rows.length){
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="muted">No hay cuentas aún. Añade la primera 👇</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr data-id="${r.id}">
      <td><strong>${escapeHtml(r.summoner_name)}</strong></td>
      <td>${escapeHtml(r.tag_line || "")}</td>
      <td>${escapeHtml(r.region || "")}</td>
      <td>${escapeHtml(r.note || "")}</td>
      <td class="right">
        <button class="pill" data-action="edit">Editar</button>
        <button class="pill-danger" data-action="delete">Borrar</button>
      </td>
    </tr>
  `).join("");
}

// Create/Update
accountForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const sn = summonerName.value.trim();
  if (!sn) return;

  // session para user_id
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return setAppMsg("No hay sesión activa.");

  const payload = {
    summoner_name: sn,
    tag_line: tagLine.value.trim() || null,
    region: region.value,
    note: note.value.trim() || null,
  };

  const id = editId.value;

  if (!id){
    // Insert
    const { error } = await supabaseClient
      .from("lol_accounts")
      .insert([{ ...payload, user_id: session.user.id }]);

    if (error) return setAppMsg("Error al guardar: " + error.message);

    resetForm();
    await loadAccounts();
    setAppMsg("Guardado ✅");
    return;
  }

  // Update
  const { error } = await supabaseClient
    .from("lol_accounts")
    .update(payload)
    .eq("id", id);

  if (error) return setAppMsg("Error al actualizar: " + error.message);

  resetForm();
  await loadAccounts();
  setAppMsg("Actualizado ✅");
});

btnCancelEdit.addEventListener("click", () => {
  resetForm();
  setAppMsg("Edición cancelada");
});

btnRefresh.addEventListener("click", loadAccounts);

// Row actions (edit/delete)
tbody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const tr = btn.closest("tr");
  const id = tr?.dataset?.id;
  const action = btn.dataset.action;

  if (!id) return;

  if (action === "edit"){
    // sacamos datos desde el DOM para no pedir de nuevo
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

  if (action === "delete"){
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

// Reactividad a cambios de sesión
supabaseClient.auth.onAuthStateChange(() => {
  refreshSessionUI();
});

// Init
refreshSessionUI();
