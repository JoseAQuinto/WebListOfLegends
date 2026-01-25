// ====== CONFIG (misma que tu app.js) ======
const SUPABASE_URL = "https://ywqxxpmsgcrzmgythvif.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3cXh4cG1zZ2Nyem1neXRodmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzA5NzQsImV4cCI6MjA4NDkwNjk3NH0.YBICeBd8S90UEGWtKjf08UWCY584TnGd3pqwzRXjX_w";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// UI
const publicForm = document.getElementById("publicForm");
const publicSummoner = document.getElementById("publicSummoner");
const publicTag = document.getElementById("publicTag");
const publicRegion = document.getElementById("publicRegion");
const publicNote = document.getElementById("publicNote");
const publicMsg = document.getElementById("publicMsg");
const publicTbody = document.getElementById("publicTbody");
const btnRefreshPublic = document.getElementById("btnRefreshPublic");
const hpField = document.getElementById("hpField");

// anti-spam simple: cooldown
let lastSubmitAt = 0;

function setMsg(text) {
  publicMsg.textContent = text || "";
  if (text) setTimeout(() => (publicMsg.textContent = ""), 2500);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso || "";
  }
}

async function loadPublic() {
  setMsg("Cargando…");

  const { data, error } = await supabaseClient
    .from("lol_public_submissions")
    .select("id, summoner_name, tag_line, region, note, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    setMsg("Error: " + error.message);
    return;
  }

  renderPublic(data || []);
  setMsg("");
}

function renderPublic(rows) {
  if (!publicTbody) return;

  if (!rows.length) {
    publicTbody.innerHTML = `
      <tr><td colspan="5" class="muted">Todavía no hay cuentas compartidas.</td></tr>
    `;
    return;
  }

  publicTbody.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td><strong>${escapeHtml(r.summoner_name)}</strong></td>
        <td>${escapeHtml(r.tag_line || "")}</td>
        <td>${escapeHtml(r.region || "")}</td>
        <td>${escapeHtml(r.note || "")}</td>
        <td>${escapeHtml(formatDate(r.created_at))}</td>
      </tr>
    `
    )
    .join("");
}

publicForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  // honeypot: si está relleno, ignoramos
  if (hpField?.value) return;

  // cooldown 5s
  const now = Date.now();
  if (now - lastSubmitAt < 5000) return setMsg("Espera 5 segundos y vuelve a intentar.");

  const sn = publicSummoner.value.trim();
  if (!sn) return;

  const payload = {
    summoner_name: sn,
    tag_line: publicTag.value.trim() || null,
    region: publicRegion.value,
    note: publicNote.value.trim() || null,
  };

  const { error } = await supabaseClient
    .from("lol_public_submissions")
    .insert([payload]);

  if (error) return setMsg("Error al enviar: " + error.message);

  lastSubmitAt = now;
  publicSummoner.value = "";
  publicTag.value = "";
  publicRegion.value = "EUW";
  publicNote.value = "";
  setMsg("Enviado ✅");

  await loadPublic();
});

btnRefreshPublic?.addEventListener("click", loadPublic);





// init
loadPublic();

