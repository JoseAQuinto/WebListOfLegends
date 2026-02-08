// ====== CONFIG ======
const SUPABASE_URL = "https://ywqxxpmsgcrzmgythvif.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3cXh4cG1zZ2Nyem1neXRodmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzA5NzQsImV4cCI6MjA4NDkwNjk3NH0.YBICeBd8S90UEGWtKjf08UWCY584TnGd3pqwzRXjX_w";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// UI (top)
const weekTitleH1 = document.getElementById("weekTitleH1");
const weekSubtitle = document.getElementById("weekSubtitle");
const weekTagToday = document.getElementById("weekTagToday");
const btnRefreshDetail = document.getElementById("btnRefreshDetail");
const detailMsg = document.getElementById("detailMsg");

// Calendar
const timelineWrap = document.getElementById("timelineWrap");

// Create slot modal + form
const btnOpenCreateSlot = document.getElementById("btnOpenCreateSlot");
const createSlotModal = document.getElementById("createSlotModal");
const createSlotBackdrop = document.getElementById("createSlotBackdrop");
const btnCloseCreateSlot = document.getElementById("btnCloseCreateSlot");
const btnCancelCreateSlot = document.getElementById("btnCancelCreateSlot");
const detailMsgInline = document.getElementById("detailMsgInline");

const slotForm = document.getElementById("slotForm");
const slotDay = document.getElementById("slotDay");
const slotFrom = document.getElementById("slotFrom");
const slotTo = document.getElementById("slotTo");
const slotNote = document.getElementById("slotNote");

// Join modal + form
const joinModal = document.getElementById("joinModal");
const joinBackdrop = document.getElementById("joinBackdrop");
const btnJoinCloseX = document.getElementById("btnJoinCloseX");

const joinForm = document.getElementById("joinForm");
const joinSlotId = document.getElementById("joinSlotId");
const joinName = document.getElementById("joinName");
const joinNote = document.getElementById("joinNote");
const joinMsg = document.getElementById("joinMsg");
const btnJoinCancel = document.getElementById("btnJoinCancel");

// Helpers
function show(el) {
  el?.classList.remove("hidden");
}
function hide(el) {
  el?.classList.add("hidden");
}

function setMsg(el, text, ms = 2500) {
  if (!el) return;
  el.textContent = text || "";
  if (text && ms) setTimeout(() => (el.textContent = ""), ms);
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

function dateFromYmd(ymdStr) {
  return new Date(ymdStr + "T00:00:00");
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
    return date.toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return String(date);
  }
}

function fmtDow(date) {
  try {
    return date.toLocaleDateString("es-ES", { weekday: "short" });
  } catch {
    return "";
  }
}

function fmtTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso || "";
  }
}

// Crea ISO usando la hora local del usuario
function isoAtLocal(ymdStr, hhmm) {
  const d = new Date(`${ymdStr}T${hhmm}:00`);
  return d.toISOString();
}

function initials(name) {
  const s = (name || "").trim();
  if (!s) return "??";
  const parts = s.split(/\s+/).slice(0, 2);
  return (
    parts
      .map((p) => p[0]?.toUpperCase() || "")
      .join("")
      .slice(0, 2) || "??"
  );
}

function modeLabel(mode) {
  switch (mode) {
    case "ranked_solo":
      return "Ranked Solo/Duo";
    case "ranked_flex":
      return "Ranked Flex";
    case "aram":
      return "ARAM";
    case "normal":
      return "Normal";
    case "custom":
      return "Custom";
    default:
      return "Sesión";
  }
}

function modeBadgeClasses(mode) {
  // tonos suaves gamer
  switch (mode) {
    case "ranked_solo":
      return "bg-purple-500/10 text-purple-300";
    case "ranked_flex":
      return "bg-primary/10 text-primary";
    case "aram":
      return "bg-green-500/10 text-green-300";
    case "normal":
      return "bg-slate-500/10 text-slate-200";
    case "custom":
      return "bg-orange-500/10 text-orange-300";
    default:
      return "bg-primary/10 text-primary";
  }
}

// State
let currentWeek = null;
let slots = [];
let signups = [];

// ---------- Data loading ----------
function buildDayOptions(weekStartYmd) {
  if (!slotDay) return;
  const start = dateFromYmd(weekStartYmd);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  slotDay.innerHTML = days
    .map(
      (d) => `<option value="${ymd(d)}">${escapeHtml(fmtDateLong(d))}</option>`
    )
    .join("");
}

async function loadWeekBySlug(slug) {
  setMsg(detailMsg, "Cargando…", 0);

  // Pedimos estas porque en tu app existen (y son típicas)
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
  setMsg(detailMsg, "Cargando…", 0);

  // ✅ select("*") para que nunca rompa si faltan columnas
  const { data: slotsData, error: slotsErr } = await supabaseClient
    .from("lol_play_slots")
    .select("*")
    .eq("week_id", weekId)
    .order("starts_at", { ascending: true });

  if (slotsErr) {
    setMsg(detailMsg, "Error slots: " + slotsErr.message);
    return;
  }

  slots = slotsData || [];

  const slotIds = slots.map((s) => s.id);
  if (!slotIds.length) {
    signups = [];
    renderTimeline();
    setMsg(detailMsg, "");
    return;
  }

  const { data: suData, error: suErr } = await supabaseClient
    .from("lol_play_slot_signups")
    .select("*")
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

// ---------- Grouping / date helpers ----------
function groupByDay(slotsArr, weekStartYmd) {
  const start = dateFromYmd(weekStartYmd);
  const map = {};
  for (let i = 0; i < 7; i++) map[ymd(addDays(start, i))] = [];
  for (const s of slotsArr) {
    const d = new Date(s.starts_at);
    const key = ymd(d);
    (map[key] ||= []).push(s);
  }
  return map;
}

function isTodayInWeek(weekStartYmd) {
  const start = dateFromYmd(weekStartYmd);
  const end = addDays(start, 6);
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return t0 >= start.getTime() && t0 <= end.getTime();
}

function dayIsToday(dayDate) {
  const now = new Date();
  return (
    dayDate.getFullYear() === now.getFullYear() &&
    dayDate.getMonth() === now.getMonth() &&
    dayDate.getDate() === now.getDate()
  );
}

// ---------- Render ----------
function renderTimeline() {
  if (!timelineWrap || !currentWeek) return;

  const byDay = groupByDay(slots, currentWeek.week_start);
  const start = dateFromYmd(currentWeek.week_start);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  timelineWrap.innerHTML = days
    .map((d) => {
      const dayKey = ymd(d);
      const daySlots = (byDay[dayKey] || [])
        .slice()
        .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
      const today = dayIsToday(d);

      return `
        <div class="${today
          ? "bg-primary/5 border-primary/30"
          : "bg-white dark:bg-slate-950/20 border-slate-200 dark:border-slate-800"
        } border rounded-2xl p-4 neon-hover">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="flex items-baseline gap-2">
                <span class="text-xs font-bold uppercase tracking-widest ${today ? "text-primary" : "text-slate-500 dark:text-slate-400"
        }">${escapeHtml(fmtDow(d))}</span>
                <span class="text-2xl font-black ${today ? "text-primary" : ""}">${escapeHtml(
          d.getDate()
        )}</span>
              </div>
              <div class="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">${escapeHtml(
          d.toLocaleDateString()
        )}</div>
            </div>

            <button type="button"
              class="shrink-0 p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
              data-action="quick-create" data-day="${escapeHtml(
          dayKey
        )}" aria-label="Crear tramo">
              <span class="material-symbols-outlined text-[20px]">add</span>
            </button>
          </div>

          <div class="mt-4 space-y-3">
            ${!daySlots.length
          ? `<div class="border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center text-sm text-slate-500 dark:text-slate-400">Sin tramos</div>`
          : daySlots
            .map((s) => {
              const sSignups = signups.filter((x) => x.slot_id === s.id);

              const capacity = 5;
              const taken = sSignups.length;
              const left = Math.max(0, capacity - taken);

              const mode = "ranked_flex";
              const badgeClass = modeBadgeClasses(mode);


              const avatars = sSignups
                .slice(0, 4)
                .map((p) => {
                  const ini = initials(p.display_name);
                  return `
                            <div class="size-7 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-[10px] font-black">
                              ${escapeHtml(ini)}
                            </div>
                          `;
                })
                .join("");

              const moreCount = sSignups.length - 4;

              const playersRow = !sSignups.length
                ? `<div class="text-xs text-slate-500 dark:text-slate-400">Nadie apuntado todavía.</div>`
                : `
                          <div class="flex items-center justify-between gap-2">
                            <div class="flex -space-x-2">
                              ${avatars}
                              ${moreCount > 0
                  ? `
                                <div class="size-7 rounded-full bg-slate-200/70 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-[10px] font-black text-slate-700 dark:text-slate-200">
                                  +${moreCount}
                                </div>`
                  : ""
                }
                            </div>
                            <div class="text-[11px] text-slate-500 dark:text-slate-400">
                              ${left} plaza${left === 1 ? "" : "s"} libre${left === 1 ? "" : "s"
                }
                            </div>
                          </div>
                        `;

              const time = `${escapeHtml(fmtTime(s.starts_at))}–${escapeHtml(
                fmtTime(s.ends_at)
              )}`;
              const title = s.note ? escapeHtml(s.note) : "Sesión";

              return `
                        <article class="bg-white dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-primary/50 transition-all shadow-sm neon-hover" data-slot-id="${s.id
                }">
                          <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                              <div class="flex items-center gap-2">
                                <span class="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${badgeClass} badge-glow">
                                  ${escapeHtml(modeLabel(mode))}
                                </span>
                                <span class="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                  ${escapeHtml(time)}
                                </span>
                              </div>
                              <div class="mt-2 text-sm font-black truncate">${title}</div>
                            </div>

                            <button type="button"
                              class="shrink-0 px-3 py-2 text-xs font-bold rounded-lg bg-primary text-background-dark hover:bg-primary/90 transition-colors"
                              data-action="join" ${left <= 0 ? "disabled" : ""}>
                              ${left <= 0 ? "Lleno" : "Unirme"}
                            </button>
                          </div>

                          <div class="mt-3">
                            ${playersRow}
                          </div>

                          ${sSignups.length
                  ? `<div class="mt-3 space-y-1">
                                  ${sSignups
                    .slice(0, 3)
                    .map((p) => {
                      const note = p.note
                        ? ` · ${escapeHtml(p.note)}`
                        : "";
                      return `<div class="text-xs text-slate-700 dark:text-slate-200 truncate"><span class="font-bold">${escapeHtml(
                        p.display_name
                      )}</span><span class="text-slate-500 dark:text-slate-400">${note}</span></div>`;
                    })
                    .join("")}
                                  ${sSignups.length > 3
                    ? `<div class="text-xs text-slate-500 dark:text-slate-400">y ${sSignups.length - 3
                    } más…</div>`
                    : ""
                  }
                                </div>`
                  : ""
                }
                        </article>
                      `;
            })
            .join("")
        }
          </div>
        </div>
      `;
    })
    .join("");
}

// ---------- Modals open/close ----------
function openCreateSlotModal(dayYmd = null) {
  if (dayYmd && slotDay) slotDay.value = dayYmd;
  setMsg(detailMsgInline, "", 0);
  show(createSlotModal);
  slotFrom?.focus();
}
function closeCreateSlotModal() {
  hide(createSlotModal);
  setMsg(detailMsgInline, "", 0);
}
function openJoinModal(slotId) {
  if (joinSlotId) joinSlotId.value = slotId;
  if (joinName) joinName.value = "";
  if (joinNote) joinNote.value = "";
  setMsg(joinMsg, "", 0);
  show(joinModal);
  joinName?.focus();
}
function closeJoinModal() {
  hide(joinModal);
  setMsg(joinMsg, "", 0);
}

// ---------- Buttons wiring ----------
btnOpenCreateSlot?.addEventListener("click", () => openCreateSlotModal(null));

btnRefreshDetail?.addEventListener("click", async () => {
  if (!currentWeek) return;
  await loadSlotsAndSignups(currentWeek.id);
});

// Modal close wiring
createSlotBackdrop?.addEventListener("click", closeCreateSlotModal);
btnCloseCreateSlot?.addEventListener("click", closeCreateSlotModal);
btnCancelCreateSlot?.addEventListener("click", closeCreateSlotModal);

joinBackdrop?.addEventListener("click", closeJoinModal);
btnJoinCloseX?.addEventListener("click", closeJoinModal);
btnJoinCancel?.addEventListener("click", closeJoinModal);

// ESC closes
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (createSlotModal && !createSlotModal.classList.contains("hidden"))
    closeCreateSlotModal();
  if (joinModal && !joinModal.classList.contains("hidden")) closeJoinModal();
});


slotForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentWeek) return;

  const day = slotDay?.value;
  const from = slotFrom?.value;
  const to = slotTo?.value;
  const note = slotNote?.value?.trim() || null;


  if (!day) return setMsg(detailMsgInline, "Elige un día.");
  if (!from || !to) return setMsg(detailMsgInline, "Indica hora inicio/fin.");
  if (to <= from) return setMsg(detailMsgInline, "La hora fin debe ser mayor.");

  const payloadBase = {
    week_id: currentWeek.id,
    starts_at: isoAtLocal(day, from),
    ends_at: isoAtLocal(day, to),
    note,
  };

  const { error } = await supabaseClient.from("lol_play_slots").insert([payloadBase]);

  if (error) return setMsg(detailMsgInline, "Error al crear tramo: " + error.message);

  setMsg(detailMsg, "Tramo creado ✅");
  slotForm.reset();
  closeCreateSlotModal();
  await loadSlotsAndSignups(currentWeek.id);
});

// ---------- Calendar click actions ----------
timelineWrap?.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const action = btn.dataset.action;

  if (action === "join") {
    if (btn.disabled) return;
    const slotEl = btn.closest("[data-slot-id]");
    const slotId = slotEl?.dataset?.slotId;
    if (!slotId) return;
    openJoinModal(slotId);
    return;
  }

  if (action === "quick-create") {
    const day = btn.dataset.day;
    if (!day) return;
    openCreateSlotModal(day);
  }
});

// ---------- Join submit ----------
joinForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const slotId = joinSlotId?.value;
  const name = joinName?.value?.trim();
  const note = joinNote?.value?.trim() || null;

  if (!slotId) return setMsg(joinMsg, "Falta slot.");
  if (!name) return setMsg(joinMsg, "Tu nombre es requerido.");

  // anti-duplicados simple (frontend): mismo nombre en el mismo slot
  const already = signups.some(
    (s) =>
      s.slot_id === slotId &&
      (s.display_name || "").trim().toLowerCase() === name.toLowerCase()
  );
  if (already) return setMsg(joinMsg, "Ya estás apuntado en este tramo.");

  const payload = { slot_id: slotId, display_name: name, note };
  const { error } = await supabaseClient
    .from("lol_play_slot_signups")
    .insert([payload]);

  if (error) return setMsg(joinMsg, "Error al unirme: " + error.message);

  setMsg(detailMsg, "Apuntado ✅");
  closeJoinModal();
  await loadSlotsAndSignups(currentWeek.id);
});

// ---------- Init ----------
(async function init() {
  const { slug } = parseParams();
  if (!slug) {
    if (weekTitleH1) weekTitleH1.textContent = "Timeline semanal";
    if (weekSubtitle)
      weekSubtitle.textContent = "Falta el parámetro ?week=slug";
    return;
  }

  const w = await loadWeekBySlug(slug);
  if (!w) return;
  currentWeek = w;

  if (weekTitleH1) weekTitleH1.textContent = w.title;

  const start = dateFromYmd(w.week_start);
  const end = addDays(start, 6);
  const tz = w.timezone || "Europe/Madrid";
  if (weekSubtitle)
    weekSubtitle.textContent = `${start.toLocaleDateString()} – ${end.toLocaleDateString()} · ${tz}`;

  if (weekTagToday) {
    if (isTodayInWeek(w.week_start)) weekTagToday.classList.remove("hidden");
    else weekTagToday.classList.add("hidden");
  }

  buildDayOptions(w.week_start);
  await loadSlotsAndSignups(w.id);
})();
