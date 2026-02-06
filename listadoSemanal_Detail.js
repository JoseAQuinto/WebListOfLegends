// ====== CONFIG ======
const SUPABASE_URL = "https://ywqxxpmsgcrzmgythvif.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3cXh4cG1zZ2Nyem1neXRodmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzA5NzQsImV4cCI6MjA4NDkwNjk3NH0.YBICeBd8S90UEGWtKjf08UWCY584TnGd3pqwzRXjX_w";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// UI
const weekTitleH1 = document.getElementById("weekTitleH1");
const weekSubtitle = document.getElementById("weekSubtitle");
const btnRefreshDetail = document.getElementById("btnRefreshDetail");

const slotForm = document.getElementById("slotForm");
const slotDay = document.getElementById("slotDay");
const slotFrom = document.getElementById("slotFrom");
const slotTo = document.getElementById("slotTo");
const slotNote = document.getElementById("slotNote");
const detailMsg = document.getElementById("detailMsg");

const timelineWrap = document.getElementById("timelineWrap");

const joinForm = document.getElementById("joinForm");
const joinSlotId = document.getElementById("joinSlotId");
const joinName = document.getElementById("joinName");
const joinNote = document.getElementById("joinNote");
const joinMsg = document.getElementById("joinMsg");
const btnJoinCancel = document.getElementById("btnJoinCancel");

function show(el) { el?.classList.remove("hidden"); }
function hide(el) { el?.classList.add("hidden"); }

function setMsg(el, text) {
  if (!el) return;
  el.textContent = text || "";
  if (text) setTimeout(() => (el.textContent = ""), 2500);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseParams() {
  const p = new URLSearchParams(location.search);
  return { slug: (p.get("week") || "").trim() };
}

function dateFromYmd(ymd) {
  // ymd: YYYY-MM-DD
  return new Date(ymd + "T00:00:00");
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function fmtDateLong(date) {
  try {
    return date.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(date);
  }
}

function isoAtLocal(ymdStr, hhmm) {
  // Construye Date en local y la convierte a ISO UTC (timestamptz)
  const d = new Date(`${ymdStr}T${hhmm}:00`);
  return d.toISOString();
}

let currentWeek = null;
let slots = [];
let signups = [];

function buildDayOptions(weekStartYmd) {
  if (!slotDay) return;

  const start = dateFromYmd(weekStartYmd);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  slotDay.innerHTML = days
    .map((d) => {
      const value = ymd(d);
      return `<option value="${value}">${escapeHtml(fmtDateLong(d))}</option>`;
    })
    .join("");
}

async function loadWeekBySlug(slug) {
  setMsg(detailMsg, "Cargando…");

  const { data, error } = await supabaseClient
    .from("lol_play_weeks")
    .select("id, week_start, title, description, slug, timezone")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();

  if (error) {
    setMsg(detailMsg, "Error: " + error.message);
    return null;
  }
  if (!data) {
    setMsg(detailMsg, "No existe esa semana.");
    return null;
  }
  return data;
}

async function loadSlotsAndSignups(weekId) {
  // 1) slots de la semana
  const { data: slotsData, error: slotsErr } = await supabaseClient
    .from("lol_play_slots")
    .select("id, week_id, starts_at, ends_at, note, created_at")
    .eq("week_id", weekId)
    .order("starts_at", { ascending: true });

  if (slotsErr) {
    setMsg(detailMsg, "Error slots: " + slotsErr.message);
    return;
  }

  slots = slotsData || [];

  // 2) signups para esos slots
  const slotIds = slots.map((s) => s.id);
  if (!slotIds.length) {
    signups = [];
    renderTimeline();
    setMsg(detailMsg, "");
    return;
  }

  const { data: suData, error: suErr } = await supabaseClient
    .from("lol_play_slot_signups")
    .select("id, slot_id, display_name, note, created_at")
    .in("slot_id", slotIds)
    .order("created_at", { ascending: true });

  if (suErr) {
    setMsg(detailMsg, "Error signups: " + suErr.message);
    return;
  }

  signups = suData || [];
  renderTimeline();
  setMsg(detailMsg, "");
}

function groupByDay(slotsArr, weekStartYmd) {
  const start = dateFromYmd(weekStartYmd);
  const map = {};
  for (let i = 0; i < 7; i++) {
    map[ymd(addDays(start, i))] = [];
  }
  for (const s of slotsArr) {
    const d = new Date(s.starts_at);
    const key = ymd(d);
    if (!map[key]) map[key] = [];
    map[key].push(s);
  }
  return map;
}

function fmtTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso || "";
  }
}

function renderTimeline() {
  if (!timelineWrap || !currentWeek) return;

  const byDay = groupByDay(slots, currentWeek.week_start);

  const start = dateFromYmd(currentWeek.week_start);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  timelineWrap.innerHTML = days
    .map((d) => {
      const dayKey = ymd(d);
      const daySlots = byDay[dayKey] || [];

      const slotsHtml = !daySlots.length
        ? `<div class="muted">Sin tramos.</div>`
        : daySlots
            .map((s) => {
              const sSignups = signups.filter((x) => x.slot_id === s.id);
              const peopleHtml = !sSignups.length
                ? `<div class="muted">Nadie apuntado.</div>`
                : `<ul class="play-people">
                    ${sSignups
                      .map(
                        (p) => `
                        <li>
                          <strong>${escapeHtml(p.display_name)}</strong>
                          ${p.note ? `<span class="muted"> · ${escapeHtml(p.note)}</span>` : ""}
                        </li>`
                      )
                      .join("")}
                  </ul>`;

              return `
                <div class="play-slot" data-slot-id="${s.id}">
                  <div class="play-slot-head">
                    <div>
                      <strong>${escapeHtml(fmtTime(s.starts_at))}–${escapeHtml(fmtTime(s.ends_at))}</strong>
                      ${s.note ? `<div class="muted">${escapeHtml(s.note)}</div>` : ""}
                    </div>
                    <button class="btn btn-secondary" data-action="join">Unirme</button>
                  </div>
                  ${peopleHtml}
                </div>
              `;
            })
            .join("");

      return `
        <div class="play-day">
          <div class="play-day-title">
            <strong>${escapeHtml(d.toLocaleDateString(undefined, { weekday: "long" }))}</strong>
            <span class="muted">· ${escapeHtml(d.toLocaleDateString())}</span>
          </div>
          <div class="play-day-body">
            ${slotsHtml}
          </div>
        </div>
      `;
    })
    .join("");
}

slotForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentWeek) return;

  const day = slotDay?.value;
  const from = slotFrom?.value;
  const to = slotTo?.value;
  const note = slotNote?.value?.trim() || null;

  if (!day) return setMsg(detailMsg, "Elige un día.");
  if (!from || !to) return setMsg(detailMsg, "Indica hora inicio/fin.");

  // Validación rápida (hh:mm)
  if (to <= from) return setMsg(detailMsg, "La hora fin debe ser mayor.");

  const payload = {
    week_id: currentWeek.id,
    starts_at: isoAtLocal(day, from),
    ends_at: isoAtLocal(day, to),
    note,
  };

  const { error } = await supabaseClient.from("lol_play_slots").insert([payload]);
  if (error) return setMsg(detailMsg, "Error al crear tramo: " + error.message);

  setMsg(detailMsg, "Tramo creado ✅");
  slotForm.reset();
  await loadSlotsAndSignups(currentWeek.id);
});

timelineWrap?.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const action = btn.dataset.action;
  if (action !== "join") return;

  const slotEl = btn.closest("[data-slot-id]");
  const slotId = slotEl?.dataset?.slotId;
  if (!slotId) return;

  if (joinSlotId) joinSlotId.value = slotId;
  if (joinName) joinName.value = "";
  if (joinNote) joinNote.value = "";
  setMsg(joinMsg, "");
  show(joinForm);
  joinName?.focus();
});

btnJoinCancel?.addEventListener("click", () => {
  hide(joinForm);
  setMsg(joinMsg, "");
});

joinForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const slotId = joinSlotId?.value;
  const name = joinName?.value?.trim();
  const note = joinNote?.value?.trim() || null;

  if (!slotId) return setMsg(joinMsg, "Falta slot.");
  if (!name) return setMsg(joinMsg, "Tu nombre es requerido.");

  const payload = {
    slot_id: slotId,
    display_name: name,
    note,
  };

  const { error } = await supabaseClient.from("lol_play_slot_signups").insert([payload]);
  if (error) return setMsg(joinMsg, "Error al unirme: " + error.message);

  setMsg(joinMsg, "Apuntado ✅");
  hide(joinForm);
  await loadSlotsAndSignups(currentWeek.id);
});

btnRefreshDetail?.addEventListener("click", async () => {
  if (!currentWeek) return;
  await loadSlotsAndSignups(currentWeek.id);
});

// Init
(async function init() {
  const { slug } = parseParams();
  if (!slug) {
    if (weekTitleH1) weekTitleH1.textContent = "Timeline semanal";
    if (weekSubtitle) weekSubtitle.textContent = "Falta el parámetro ?week=slug";
    return;
  }

  const w = await loadWeekBySlug(slug);
  if (!w) return;

  currentWeek = w;

  if (weekTitleH1) weekTitleH1.textContent = w.title;
  if (weekSubtitle) {
    const start = dateFromYmd(w.week_start);
    const end = addDays(start, 6);
    weekSubtitle.textContent = `${start.toLocaleDateString()} – ${end.toLocaleDateString()} · ${w.timezone}`;
  }

  buildDayOptions(w.week_start);
  await loadSlotsAndSignups(w.id);
})();
