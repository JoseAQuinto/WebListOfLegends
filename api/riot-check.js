// api/riot-check.js

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  // opcional: cache corto para no fundir rate limit
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
  res.end(JSON.stringify(body, null, 2));
}

function getRiotKey() {
  return process.env.RIOT_API_KEY;
}

function mapRouting(region) {
  const r = String(region || "EUW").toUpperCase();

  const platformByRegion = {
    EUW: "euw1",
    EUNE: "eun1",
    NA: "na1",
    KR: "kr",
    BR: "br1",
    LAN: "la1",
    LAS: "la2",
    OCE: "oc1",
    TR: "tr1",
    RU: "ru",
    JP: "jp1",
    PH: "ph2",
    SG: "sg2",
    TH: "th2",
    TW: "tw2",
    VN: "vn2",
  };

  const regionalByRegion = {
    EUW: "europe",
    EUNE: "europe",
    TR: "europe",
    RU: "europe",

    NA: "americas",
    BR: "americas",
    LAN: "americas",
    LAS: "americas",

    KR: "asia",
    JP: "asia",

    // SEA shards: si alguna vez te falla, cambia "sea" -> "asia"
    OCE: "sea",
    PH: "sea",
    SG: "sea",
    TH: "sea",
    TW: "sea",
    VN: "sea",
  };

  return {
    platform: platformByRegion[r] || "euw1",
    regional: regionalByRegion[r] || "europe",
    region: r,
  };
}

async function riotFetch(url, apiKey) {
  const resp = await fetch(url, { headers: { "X-Riot-Token": apiKey } });
  const text = await resp.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  return { ok: resp.ok, status: resp.status, data };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return json(res, 405, { error: "Method not allowed" });
    }

    const apiKey = getRiotKey();
    if (!apiKey) return json(res, 500, { error: "Missing RIOT_API_KEY env var" });

    const { gameName, tagLine, region = "EUW", full = "0", matches = "0" } = req.query || {};
    const gn = String(gameName || "").trim();
    const tl = String(tagLine || "").trim();

    if (!gn || !tl) {
      return json(res, 400, {
        error: "Missing params",
        required: ["gameName", "tagLine"],
        example: "/api/riot-check?gameName=Pepe&tagLine=EUW&region=EUW&full=1",
      });
    }

    const { platform, regional, region: regionNorm } = mapRouting(region);

    // 1) Account-V1 (RiotID -> puuid)
    const accUrl =
      `https://${regional}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/` +
      `${encodeURIComponent(gn)}/${encodeURIComponent(tl)}`;

    const acc = await riotFetch(accUrl, apiKey);

    if (!acc.ok) {
      if (acc.status === 404) {
        return json(res, 200, {
          exists: false,
          region: regionNorm,
          routing: { platform, regional },
          input: { gameName: gn, tagLine: tl },
        });
      }
      return json(res, acc.status, {
        error: "Riot API error (account-v1)",
        status: acc.status,
        details: acc.data,
      });
    }

    const account = acc.data;
    const puuid = account?.puuid;

    if (String(full) !== "1") {
      return json(res, 200, {
        exists: true,
        region: regionNorm,
        routing: { platform, regional },
        account,
      });
    }

    // 2) Summoner-V4 (by puuid)
    const summUrl =
      `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/` +
      `${encodeURIComponent(puuid)}`;

    const summ = await riotFetch(summUrl, apiKey);
    if (!summ.ok) {
      return json(res, summ.status, {
        error: "Riot API error (summoner-v4)",
        status: summ.status,
        details: summ.data,
      });
    }

    const summoner = summ.data;
    const encSummonerId = summoner?.id;

    // 3) League + Mastery (platform routing)
    const leagueUrl =
      `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-summoner/` +
      `${encodeURIComponent(encSummonerId)}`;

    const masteryUrl =
      `https://${platform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-summoner/` +
      `${encodeURIComponent(encSummonerId)}`;

    // matches
    const matchCount = Math.max(0, Math.min(5, parseInt(matches, 10) || 0));
    const wantMatchList = matchCount > 0 || String(matches) === "0"; 
    // si quieres SIEMPRE devolver matchIds, deja wantMatchList=true
    // si quieres ahorrar llamadas cuando matches=0, pon: const wantMatchList = matchCount > 0;

    const matchListUrl =
      `https://${regional}.api.riotgames.com/lol/match/v5/matches/by-puuid/` +
      `${encodeURIComponent(puuid)}/ids?start=0&count=10`;

    const promises = [
      riotFetch(leagueUrl, apiKey),
      riotFetch(masteryUrl, apiKey),
      wantMatchList ? riotFetch(matchListUrl, apiKey) : Promise.resolve({ ok: true, status: 200, data: [] }),
    ];

    const [league, mastery, matchIdsResp] = await Promise.all(promises);

    // ✅ siempre arrays para frontend
    const ranked = league.ok && Array.isArray(league.data) ? league.data : [];
    const masteryArr = mastery.ok && Array.isArray(mastery.data) ? mastery.data : [];
    const masteryTop = masteryArr.slice(0, 10);

    const matchIds = matchIdsResp.ok && Array.isArray(matchIdsResp.data) ? matchIdsResp.data : [];

    // detalles de N matches (si matchCount>0)
    let recentMatches = [];
    if (matchCount > 0 && matchIds.length) {
      const ids = matchIds.slice(0, matchCount);
      const detailUrls = ids.map(
        (id) => `https://${regional}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(id)}`
      );

      const details = await Promise.all(detailUrls.map((u) => riotFetch(u, apiKey)));
      recentMatches = details.map((m, i) => ({
        matchId: ids[i],
        ok: m.ok,
        status: m.status,
        data: m.ok ? m.data : m.data,
      }));
    }

    // opcional: errores para debug sin romper el frontend
    const errors = {};
    if (!league.ok) errors.ranked = { status: league.status, details: league.data };
    if (!mastery.ok) errors.mastery = { status: mastery.status, details: mastery.data };
    if (!matchIdsResp.ok) errors.matches = { status: matchIdsResp.status, details: matchIdsResp.data };

    return json(res, 200, {
      exists: true,
      region: regionNorm,
      routing: { platform, regional },
      input: { gameName: gn, tagLine: tl },
      account,
      summoner,
      ranked,
      masteryTop,
      matchIds,
      recentMatches,
      errors, // puedes quitarlo si no lo quieres
    });
  } catch (e) {
    return json(res, 500, { error: "Server error", message: e?.message || String(e) });
  }
}
