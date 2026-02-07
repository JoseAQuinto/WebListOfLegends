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
      <div class="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
        Todavía no hay semanas creadas.
      </div>
    `;
    return;
  }

  weeksTbody.innerHTML = rows
    .map((w) => {
      const url = `listadoSemanal_Detail.html?week=${encodeURIComponent(w.slug)}`;

      return `
        <article class="bg-white dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-primary/50 transition-all shadow-sm">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Semana ${escapeHtml(fmtWeekStart(w.week_start))}
              </div>
              <h3 class="mt-1 text-lg font-black truncate">
                ${escapeHtml(w.title)}
              </h3>
              <div class="mt-2 flex flex-wrap gap-2">
                <span class="text-[11px] font-semibold px-2 py-1 rounded-lg bg-primary/10 text-primary">
                  ${escapeHtml(w.timezone || "Europe/Madrid")}
                </span>
                <span class="text-[11px] font-semibold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200">
                  ${escapeHtml(w.slug)}
                </span>
              </div>
            </div>

            <a
              href="${url}"
              class="shrink-0 px-4 py-2 text-sm font-bold rounded-lg bg-primary text-background-dark hover:bg-primary/90 transition-colors"
            >
              Abrir
            </a>
          </div>

          <div class="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Entrar para ver la timeline</span>
            <span class="inline-flex items-center gap-1">
              <span class="material-symbols-outlined text-[16px]">calendar_today</span>
              ${escapeHtml(fmtWeekStart(w.week_start))}
            </span>
          </div>
        </article>
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
