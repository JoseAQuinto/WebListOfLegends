// ====== CONFIG ======
const SUPABASE_URL = "https://ywqxxpmsgcrzmgythvif.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3cXh4cG1zZ2Nyem1neXRodmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzA5NzQsImV4cCI6MjA4NDkwNjk3NH0.YBICeBd8S90UEGWtKjf08UWCY584TnGd3pqwzRXjX_w";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// UI
const weekForm = document.getElementById("weekForm");
const weekStart = document.getElementById("weekStart");
const weekTitle = document.getElementById("weekTitle");
const weekSlug = document.getElementById("weekSlug");
const weekDesc = document.getElementById("weekDesc");
const weeksMsg = document.getElementById("weeksMsg");
const weeksTbody = document.getElementById("weeksTbody");
const btnRefreshWeeks = document.getElementById("btnRefreshWeeks");

function setMsg(text) {
  if (!weeksMsg) return;
  weeksMsg.textContent = text || "";
  if (text) setTimeout(() => (weeksMsg.textContent = ""), 2500);
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
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function mondayOfDate(dateStr) {
  // dateStr: YYYY-MM-DD (local)
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1) - day; // move to Monday
  d.setDate(d.getDate() + diff);
  // back to YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function fmtWeekStart(yyyyMmDd) {
  try {
    const d = new Date(yyyyMmDd + "T00:00:00");
    return d.toLocaleDateString();
  } catch {
    return yyyyMmDd || "";
  }
}

async function loadWeeks() {
  setMsg("Cargando…");

  const { data, error } = await supabaseClient
    .from("lol_play_weeks")
    .select("id, week_start, title, slug, timezone, created_at")
    .order("week_start", { ascending: false })
    .limit(100);

  if (error) return setMsg("Error: " + error.message);

  renderWeeks(data || []);
  setMsg("");
}

function renderWeeks(rows) {
  if (!weeksTbody) return;

  if (!rows.length) {
    weeksTbody.innerHTML = `
      <tr><td colspan="5" class="muted">Todavía no hay semanas creadas.</td></tr>
    `;
    return;
  }

  weeksTbody.innerHTML = rows
    .map((w) => {
      const url = `listadoSemanal_Detail.html?week=${encodeURIComponent(w.slug)}`;
      return `
        <tr>
          <td><strong>${escapeHtml(fmtWeekStart(w.week_start))}</strong></td>
          <td>${escapeHtml(w.title)}</td>
          <td class="muted">${escapeHtml(w.slug)}</td>
          <td class="muted">${escapeHtml(w.timezone || "")}</td>
          <td class="right">
            <a class="btn btn-ghost" href="${url}">Abrir</a>
          </td>
        </tr>
      `;
    })
    .join("");
}

weekTitle?.addEventListener("input", () => {
  if (!weekSlug) return;
  if (weekSlug.dataset.locked === "1") return;
  weekSlug.value = normalizeSlug(weekTitle.value);
});

weekSlug?.addEventListener("input", () => {
  if (!weekSlug) return;
  weekSlug.dataset.locked = "1";
  weekSlug.value = normalizeSlug(weekSlug.value);
});

weekStart?.addEventListener("change", () => {
  if (!weekStart || !weekSlug) return;
  const monday = mondayOfDate(weekStart.value);
  // si no está bloqueado, autocompletamos slug con fecha
  if (weekSlug.dataset.locked === "1") return;
  const base = normalizeSlug(weekTitle?.value || "semana");
  weekSlug.value = normalizeSlug(`${base}-${monday}`);
});

weekForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const ws = weekStart?.value;
  const title = weekTitle?.value?.trim();
  const slug = normalizeSlug(weekSlug?.value);
  const desc = weekDesc?.value?.trim() || null;

  if (!ws) return setMsg("Selecciona una fecha.");
  const monday = mondayOfDate(ws);
  if (!title) return setMsg("Nombre requerido.");
  if (!slug) return setMsg("Slug requerido.");

  const payload = {
    week_start: monday,
    title,
    slug,
    description: desc,
    timezone: "Europe/Madrid",
  };

  const { error } = await supabaseClient.from("lol_play_weeks").insert([payload]);
  if (error) return setMsg("Error al crear: " + error.message);

  setMsg("Semana creada ✅");
  weekForm.reset();
  if (weekSlug) weekSlug.dataset.locked = "";
  await loadWeeks();
});

btnRefreshWeeks?.addEventListener("click", loadWeeks);

// Init
loadWeeks();
