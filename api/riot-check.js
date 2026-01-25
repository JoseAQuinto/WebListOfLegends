// api/riot-check.js
// Vercel Serverless Function (Node)
// Endpoint: /api/riot-check?gameName=...&tagLine=...&region=EUW&full=1&matches=2

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body, null, 2));
}

function getRiotKey() {
  return process.env.RIOT_API_KEY;
}

// Region UI -> platform routing (LoL platform) + regional routing (Account/Match)
function mapRouting(region) {
  const r = String(region || "EUW").toUpperCase();

  // LoL platform routing (Summoner/League/Mastery)
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

  // Regional routing (Account-V1: americas/asia/europe) :contentReference[oaicite:2]{index=2}
  // Match-V5 también usa regional routing (incluye SEA en muchos ejemplos; si no lo usas, puedes omitir SEA).
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

    // SEA shards (para Match-V5 suelen ir a "sea"; Account-V1 oficial indica americas/asia/europe,
    // pero en práctica muchas integraciones usan sea para estos shards en endpoints regionales.
    // Si te diera problemas, cambia SEA -> asia.
    OCE: "sea",
    PH: "sea",
    SG: "sea",
    TH: "sea",
    TW: "sea",
    VN: "sea",
  };

  const platform = platformByRegion[r] || "euw1";
  const regional = regionalByRegion[r] || "europe";
  return { platform, regional, region: r };
}

async function riotFetch(url, apiKey) {
  const resp = await fetch(url, {
    headers: { "X-Riot-Token": apiKey },
  });

  const text = await resp.text();
  let data;
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

    // 1) Account-V1 (Riot ID -> puuid) :contentReference[oaicite:3]{index=3}
    // account routing: https://{regional}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}
    const accUrl =
      `https://${regional}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/` +
      `${encodeURIComponent(gn)}/${encodeURIComponent(tl)}`;

    const acc = await riotFetch(accUrl, apiKey);

    if (!acc.ok) {
      // 404 => no existe
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

    const account = acc.data; // { puuid, gameName, tagLine }
    const puuid = account?.puuid;

    // Respuesta mínima (solo “existe”)
    if (String(full) !== "1") {
      return json(res, 200, {
        exists: true,
        region: regionNorm,
        routing: { platform, regional },
        account,
      });
    }

    // 2) Summoner-V4 by PUUID (platform routing) :contentReference[oaicite:4]{index=4}
    const summUrl =
      `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/` +
      `${encodeURIComponent(puuid)}`;

    // 3) League-V4 by summonerId (ranked)
    // https://{platform}.api.riotgames.com/lol/league/v4/entries/by-summoner/{encryptedSummonerId}
    // (summonerId viene del summoner-v4)
    const summ = await riotFetch(summUrl, apiKey);
    if (!summ.ok) {
      return json(res, summ.status, {
        error: "Riot API error (summoner-v4)",
        status: summ.status,
        details: summ.data,
      });
    }

    const summoner = summ.data; // includes id (encryptedSummonerId), accountId, puuid, name, profileIconId, summonerLevel, ...
    const encSummonerId = summoner?.id;

    const leagueUrl =
      `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-summoner/` +
      `${encodeURIComponent(encSummonerId)}`;

    const masteryUrl =
      `https://${platform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-summoner/` +
      `${encodeURIComponent(encSummonerId)}`;

    // 4) Match-V5 list by puuid (regional routing)
    const matchListUrl =
      `https://${regional}.api.riotgames.com/lol/match/v5/matches/by-puuid/` +
      `${encodeURIComponent(puuid)}/ids?start=0&count=10`;

    const [league, mastery, matchIdsResp] = await Promise.all([
      riotFetch(leagueUrl, apiKey),
      riotFetch(masteryUrl, apiKey),
      riotFetch(matchListUrl, apiKey),
    ]);

    const ranked = league.ok ? league.data : { error: league.data, status: league.status };
    const masteryAll = mastery.ok ? mastery.data : { error: mastery.data, status: mastery.status };
    const masteryTop = Array.isArray(masteryAll) ? masteryAll.slice(0, 10) : masteryAll;

    const matchIds = matchIdsResp.ok ? matchIdsResp.data : [];

    // opcional: traer detalles de N matches
    const matchCount = Math.max(0, Math.min(5, parseInt(matches, 10) || 0));
    let recentMatches = [];
    if (matchCount > 0 && Array.isArray(matchIds) && matchIds.length) {
      const ids = matchIds.slice(0, matchCount);
      const matchDetailUrls = ids.map(
        (id) => `https://${regional}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(id)}`
      );
      const matchDetails = await Promise.all(matchDetailUrls.map((u) => riotFetch(u, apiKey)));
      recentMatches = matchDetails.map((m, i) => ({
        matchId: ids[i],
        ok: m.ok,
        status: m.status,
        data: m.ok ? m.data : m.data,
      }));
    }

    return json(res, 200, {
      exists: true,
      region: regionNorm,
      routing: { platform, regional },
      input: { gameName: gn, tagLine: tl },
      account,   // puuid + riotId
      summoner,  // summonerId, icon, level...
      ranked,    // ranks
      masteryTop,
      matchIds,
      recentMatches,
    });
  } catch (e) {
    return json(res, 500, { error: "Server error", message: e?.message || String(e) });
  }
}
