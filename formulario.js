// ====== CONFIG ======
const SUPABASE_URL = "https://ywqxxpmsgcrzmgythvif.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3cXh4cG1zZ2Nyem1neXRodmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzA5NzQsImV4cCI6MjA4NDkwNjk3NH0.YBICeBd8S90UEGWtKjf08UWCY584TnGd3pqwzRXjX_w";
// ====================

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// UI refs (form)
const suggestForm = document.getElementById("suggestForm");
const urgency = document.getElementById("urgency");
const title = document.getElementById("title");
const message = document.getElementById("message");
const contact = document.getElementById("contact");
const formMsg = document.getElementById("formMsg");

// UI refs (list)
const suggestTbody = document.getElementById("suggestTbody");
const btnRefreshList = document.getElementById("btnRefreshList");
const listMsg = document.getElementById("listMsg");

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setFormMsg(text) {
  if (!formMsg) return;
  formMsg.textContent = text || "";
  if (text) setTimeout(() => (formMsg.textContent = ""), 3000);
}

function setListMsg(text) {
  if (!listMsg) return;
  listMsg.textContent = text || "";
}

function fmtDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

function urgencyLabel(u) {
  if (u === "urgente") return "Urgente";
  if (u === "poco_importante") return "Poco importante";
  return "Normal";
}

function renderList(rows) {
  if (!suggestTbody) return;

  if (!rows?.length) {
    suggestTbody.innerHTML = `
      <tr>
        <td colspan="4" class="muted">No hay sugerencias todavía.</td>
      </tr>
    `;
    return;
  }

  suggestTbody.innerHTML = rows
    .map((r) => `
      <tr>
        <td>${escapeHtml(fmtDate(r.created_at))}</td>
        <td>${escapeHtml(urgencyLabel(r.urgency))}</td>
        <td>${escapeHtml(r.title || "")}</td>
        <td>${escapeHtml(r.message || "")}</td>
      </tr>
    `)
    .join("");
}

async function loadSuggestions() {
  setListMsg("Cargando…");

  const { data, error } = await supabaseClient
    .from("lol_suggestions_public")
    .select("id, urgency, title, message, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    setListMsg("Error al cargar lista: " + error.message);
    renderList([]);
    return;
  }

  setListMsg("");
  renderList(data || []);
}

// Insert
suggestForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setFormMsg("");

  const urg = (urgency?.value || "normal").trim();
  const ttl = (title?.value || "").trim();
  const msg = (message?.value || "").trim();
  const ctc = (contact?.value || "").trim();

  if (!msg) return setFormMsg("Escribe una sugerencia.");
  if (!["normal", "urgente", "poco_importante"].includes(urg)) return setFormMsg("Urgencia inválida.");

  if (msg.length > 2000) return setFormMsg("La sugerencia es demasiado larga (máx 2000).");
  if (ttl.length > 120) return setFormMsg("Título demasiado largo (máx 120).");
  if (ctc.length > 120) return setFormMsg("Contacto demasiado largo (máx 120).");

  const payload = {
    urgency: urg,
    title: ttl || null,
    message: msg,
    contact: ctc || null,
  };

  const { error } = await supabaseClient
    .from("lol_suggestions_public")
    .insert([payload]);

  if (error) return setFormMsg("Error al enviar: " + error.message);

  suggestForm.reset();
  setFormMsg("Enviado ✅ ¡Gracias!");

  // refresca lista arriba
  await loadSuggestions();
});

btnRefreshList?.addEventListener("click", () => {
  loadSuggestions();
});

// Init
loadSuggestions();
