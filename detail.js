// detail.js

// ====== CONFIG ======
const SUPABASE_URL = "https://ywqxxpmsgcrzmgythvif.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3cXh4cG1zZ2Nyem1neXRodmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzA5NzQsImV4cCI6MjA4NDkwNjk3NH0.YBICeBd8S90UEGWtKjf08UWCY584TnGd3pqwzRXjX_w";
// ====================

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// UI
const btnLogout = document.getElementById("btnLogout");
const btnRefreshDetail = document.getElementById("btnRefreshDetail");

const titleLine = document.getElementById("titleLine");
const subLine = document.getElementById("subLine");

const iconWrap = document.getElementById("iconWrap");
const summonerLevel = document.getElementById("summonerLevel");
const statusPill = document.getElementById("statusPill");

const rankedWrap = document.getElementById("rankedWrap");
const masteryTbody = document.getElementById("masteryTbody");
const matchesTbody = document.getElementById("matchesTbody");

const msg = document.getElementById("msg");

// Helpers
function show(el) { el?.classList.remove("hidden"); }
function hide(el) { el?.classList.add("hidden"); }

function setMsg(text) {
  if (!msg) return;
  if (!text) { hide(msg); msg.textContent = ""; return; }
  msg.textContent = text;
  show(msg);
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function pill(text) {
  return `<span class="pill">${escapeHtml(text)}</span>`;
}
function pillDanger(text) {
  return `<span class="pill-danger">${escapeHtml(text)}</span>`;
}

// URL param
const params = new URLSearchParams(location.search);
const rowId = params.get("id");

// State
let currentRow = null;

// Auth UI
async function refreshAuthUI(){
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    hide(btnLogout);
    return;
  }
  show(btnLogout);
}

btnLogout?.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  location.href = "./public.html";
});

btnRefreshDetail?.addEventListener("click", async () => {
  await loadAll();
});

async function loadRowFromSupabase(id){
  // Solo funciona para TUS cuentas (RLS). Para cuentas de amigos haremos otro detail público luego.
  const { data, error } = await supabaseClient
    .from("lol_accounts")
    .select("id, summoner_name, tag_line, region, note, created_at")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

function renderBase(row){
  const tag = row.tag_line ? `#${row.tag_line}` : "";
  titleLine.textContent = `${row.summoner_name}${tag}`;
  subLine.textContent = `${row.region || "—"} · ${row.note || "sin nota"}`;

  summonerLevel.textContent = "—";
  iconWrap.innerHTML = `<span class="muted">—</span>`;
  statusPill.innerHTML = pill("Cargando Riot…");

  rankedWrap.innerHTML = `<div class="muted">Cargando…</div>`;
  masteryTbody.innerHTML = `
    <tr><td colspan="4" class="muted">Cargando…</td></tr>
  `;
  matchesTbody.innerHTML = `
    <tr><td colspan="2" class="muted">Cargando…</td></tr>
  `;
}

function profileIconUrl(profileIconId){
  // CDN de Data Dragon (version “latest” simplificada; si quieres, lo hacemos dinámico)
  return `https://ddragon.leagueoflegends.com/cdn/14.16.1/img/profileicon/${profileIconId}.png`;
}

function renderRanked(entries){
  // Si viene error desde backend:
  if (entries && !Array.isArray(entries) && entries.error) {
    rankedWrap.innerHTML = `<div class="muted">Ranked no disponible (${entries.status || "?"})</div>`;
    return;
  }

  const arr = Array.isArray(entries) ? entries : [];
  if (!arr.length) {
    rankedWrap.innerHTML = `<div class="muted">Sin datos ranked.</div>`;
    return;
  }

  const byQueue = {};
  for (const e of arr) byQueue[e.queueType] = e;

  const solo = byQueue["RANKED_SOLO_5x5"];
  const flex = byQueue["RANKED_FLEX_SR"];

  rankedWrap.innerHTML = `
    <div>
      <div class="muted">SoloQ</div>
      <div style="margin-top:8px">
        ${solo ? `
          <div><strong>${escapeHtml(solo.tier)} ${escapeHtml(solo.rank)}</strong></div>
          <div class="muted">${solo.leaguePoints} LP · ${solo.wins}W ${solo.losses}L</div>
        ` : `<div class="muted">—</div>`}
      </div>
    </div>
    <div>
      <div class="muted">Flex</div>
      <div style="margin-top:8px">
        ${flex ? `
          <div><strong>${escapeHtml(flex.tier)} ${escapeHtml(flex.rank)}</strong></div>
          <div class="muted">${flex.leaguePoints} LP · ${flex.wins}W ${flex.losses}L</div>
        ` : `<div class="muted">—</div>`}
      </div>
    </div>
  `;
}


function renderMastery(top){
  if (top && !Array.isArray(top) && top.error) {
    masteryTbody.innerHTML = `
      <tr><td colspan="4" class="muted">Maestrías no disponibles (${top.status || "?"})</td></tr>
    `;
    return;
  }

  if (!Array.isArray(top) || !top.length) {
    masteryTbody.innerHTML = `
      <tr><td colspan="4" class="muted">Sin datos.</td></tr>
    `;
    return;
  }

  masteryTbody.innerHTML = top.map(m => `
    <tr>
      <td>${escapeHtml(m.championId)}</td>
      <td>${escapeHtml(m.championLevel)}</td>
      <td>${escapeHtml(m.championPoints)}</td>
      <td class="right">${m.lastPlayTime ? new Date(m.lastPlayTime).toLocaleString() : "—"}</td>
    </tr>
  `).join("");
}


function renderMatches(matchIds){
  if (matchIds && !Array.isArray(matchIds) && matchIds.error) {
    matchesTbody.innerHTML = `
      <tr><td colspan="2" class="muted">Partidas no disponibles (${matchIds.status || "?"})</td></tr>
    `;
    return;
  }

  if (!Array.isArray(matchIds) || !matchIds.length) {
    matchesTbody.innerHTML = `
      <tr><td colspan="2" class="muted">Sin partidas recientes.</td></tr>
    `;
    return;
  }

  const top = matchIds.slice(0, 10);
  matchesTbody.innerHTML = top.map(id => `
    <tr>
      <td style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">
        ${escapeHtml(id)}
      </td>
      <td class="right">
        <button class="pill" data-action="copy" data-id="${escapeHtml(id)}">Copiar</button>
      </td>
    </tr>
  `).join("");
}


matchesTbody?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const action = btn.dataset.action;
  if (action !== "copy") return;
  const id = btn.dataset.id;
  if (!id) return;

  await navigator.clipboard.writeText(id);
  setMsg("Match ID copiado ✅");
  setTimeout(() => setMsg(""), 1600);
});

async function loadRiotData(row){
  const gn = row.summoner_name;
  const tl = row.tag_line;
  const rg = row.region || "EUW";

  if (!gn || !tl) {
    statusPill.innerHTML = pillDanger("Falta tagLine");
    setMsg("Esta cuenta no tiene tag. Añade el tag para consultar Riot.");
    rankedWrap.innerHTML = `<div class="muted">—</div>`;
    masteryTbody.innerHTML = `<tr><td colspan="4" class="muted">—</td></tr>`;
    matchesTbody.innerHTML = `<tr><td colspan="2" class="muted">—</td></tr>`;
    return;
  }

  statusPill.innerHTML = pill("Consultando Riot…");

  const url =
    `/api/riot-check?gameName=${encodeURIComponent(gn)}` +
    `&tagLine=${encodeURIComponent(tl)}` +
    `&region=${encodeURIComponent(rg)}` +
    `&full=1&matches=5`;


  const res = await fetch(`${location.origin}${url}`);

const contentType = res.headers.get("content-type") || "";
let data;

if (contentType.includes("application/json")) {
  data = await res.json();
} else {
  const text = await res.text();
  throw new Error(`API no devolvió JSON (${res.status}). Primeros chars: ${text.slice(0, 80)}`);
}


  if (!res.ok) {
    statusPill.innerHTML = pillDanger("Error Riot");
    setMsg(data?.error ? `${data.error} (${data.status || res.status})` : "Error consultando Riot");
    return;
  }

  if (!data.exists) {
    statusPill.innerHTML = pillDanger("No existe");
    setMsg("Riot no encuentra esta cuenta con esos datos.");
    rankedWrap.innerHTML = `<div class="muted">—</div>`;
    masteryTbody.innerHTML = `<tr><td colspan="4" class="muted">—</td></tr>`;
    matchesTbody.innerHTML = `<tr><td colspan="2" class="muted">—</td></tr>`;
    return;
  }

  statusPill.innerHTML = pill("OK ✅");
  setMsg("");

  // Summoner info
  const summ = data.summoner;
  if (summ?.profileIconId != null) {
    iconWrap.innerHTML = `
      <img
        src="${profileIconUrl(summ.profileIconId)}"
        alt="icon"
        width="64"
        height="64"
        style="border-radius:14px;border:1px solid rgba(255,255,255,.15)"
      />
    `;
  } else {
    iconWrap.innerHTML = `<span class="muted">—</span>`;
  }

  summonerLevel.textContent = summ?.summonerLevel ?? "—";

  // Ranked
  renderRanked(data.ranked);

  // Mastery top
  renderMastery(data.masteryTop);

  // Matches
  renderMatches(data.matchIds);
}

async function loadAll(){
  try {
    await refreshAuthUI();

    if (!rowId) {
      setMsg("Falta el parámetro ?id=...");
      titleLine.textContent = "Cuenta no encontrada";
      subLine.textContent = "";
      return;
    }

    setMsg("");
    const row = await loadRowFromSupabase(rowId);
    currentRow = row;

    renderBase(row);
    await loadRiotData(row);
  } catch (e) {
    console.error(e);
    titleLine.textContent = "Error cargando detalle";
    subLine.textContent = "";
    setMsg(e?.message || String(e));
    statusPill.innerHTML = pillDanger("Error");
  }
}

supabaseClient.auth.onAuthStateChange(() => {
  refreshAuthUI();
});

loadAll();
