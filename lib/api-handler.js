import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

loadEnvFile(new URL("../.env.local", import.meta.url));

const DATA_URL = new URL("../src/data/mockData.ts", import.meta.url);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const FIRST_FTC_USERNAME = process.env.FIRST_FTC_USERNAME;
const FIRST_FTC_AUTH_TOKEN = process.env.FIRST_FTC_AUTH_TOKEN;
const epaCache = new Map();
const readCache = new Map();

const json = (res, status, body) => {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify(body));
};

export default async function handler(req, res) {
  try {
    if (!req.url) return json(res, 404, { error: "Not found" });
    const url = new URL(req.url, `http://${req.headers.host}`);
    const rewrittenPath = url.pathname === "/api" && url.searchParams.has("path") ? `/api/${url.searchParams.get("path")}` : url.pathname;

    if (rewrittenPath === "/api/health") {
      return json(res, 200, {
        ok: true,
        source: isSupabaseConfigured() ? "supabase" : "mock",
        supabaseConfigured: isSupabaseConfigured(),
        supabaseWriteConfigured: Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY),
        firstApiConfigured: Boolean(FIRST_FTC_USERNAME && FIRST_FTC_AUTH_TOKEN),
      });
    }

  if (rewrittenPath === "/api/seasons") {
    const data = isSupabaseConfigured() ? await readSupabaseSeasons() : await readMockData();
    return json(res, 200, data.seasons ?? data);
  }
  if (rewrittenPath === "/api/epa/teams") {
    const year = Number(url.searchParams.get("year")) || new Date().getFullYear();
    const limit = url.searchParams.has("limit") ? parseLimit(url.searchParams.get("limit"), 500) : undefined;
    const ratings = isSupabaseConfigured() ? await readSupabaseEpa(year, { includeInactive: !limit }) : [];
    return json(res, 200, limit ? ratings.slice(0, limit) : ratings);
  }
  if (rewrittenPath === "/api/events") {
    const year = Number(url.searchParams.get("year"));
    if (isSupabaseConfigured()) return json(res, 200, await readSupabaseEvents(Number.isFinite(year) ? year : undefined));
    const data = await readMockData();
    return json(res, 200, Number.isFinite(year) ? data.events.filter((event) => event.year === year) : data.events);
  }
  if (rewrittenPath.startsWith("/api/events/")) {
    const [, , resource, code, child] = rewrittenPath.split("/");
    if (resource !== "events" || !code) return json(res, 404, { error: "Event not found" });
    const data = isSupabaseConfigured() ? { events: [await readSupabaseEvent(code)].filter(Boolean), matches: [], rankings: [], advancement: [] } : await readMockData();
    const event = data.events.find((item) => item.code === code);
    if (!event) return json(res, 404, { error: "Event not found" });
    if (child === "summary") return json(res, 200, isSupabaseConfigured() ? await readSupabaseEventSummary(code) : readMockEventSummary(data, code));
    if (child === "matches") return json(res, 200, isSupabaseConfigured() ? await readSupabaseMatches(code) : data.matches.filter((match) => match.eventCode === code));
    if (child === "rankings") return json(res, 200, isSupabaseConfigured() ? await readSupabaseRankings(code) : data.rankings.filter((ranking) => ranking.eventCode === code));
    if (child === "advancement") return json(res, 200, isSupabaseConfigured() ? await readSupabaseAdvancement(code) : data.advancement.filter((slot) => slot.eventCode === code));
    return json(res, 200, event);
  }
  if (rewrittenPath.startsWith("/api/teams/")) {
    const [, , , rawNumber, child] = rewrittenPath.split("/");
    const number = Number(rawNumber);
    if (child === "events") return json(res, 200, isSupabaseConfigured() ? await readSupabaseTeamEvents(number) : []);
    if (child === "matches") return json(res, 200, isSupabaseConfigured() ? await readSupabaseTeamMatches(number) : []);
    const data = isSupabaseConfigured() ? { teams: [await readSupabaseTeam(number)].filter(Boolean) } : await readMockData();
    const team = data.teams.find((item) => item.number === number);
    return team ? json(res, 200, team) : json(res, 404, { error: "Team not found" });
  }
  if (rewrittenPath === "/api/teams") {
    const query = url.searchParams.get("q")?.trim() ?? "";
    const limit = url.searchParams.has("limit") ? parseLimit(url.searchParams.get("limit"), query ? 20 : 500) : query ? 20 : undefined;
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
    if (isSupabaseConfigured()) return json(res, 200, await readSupabaseTeams({ query, limit, offset }));
    const data = await readMockData();
    const filtered = filterTeams(data.teams, query);
    const page = limit ? filtered.slice(offset, offset + limit) : filtered.slice(offset);
    return json(res, 200, page);
  }

    return json(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: error instanceof Error ? error.message : "Internal server error" });
  }
}

async function readMockData() {
  const source = await readFile(DATA_URL, "utf8");
  return {
    seasons: extractArray(source, "seasons"),
    teams: extractArray(source, "teams"),
    events: extractArray(source, "events"),
    matches: extractArray(source, "matches"),
    rankings: extractArray(source, "rankings"),
    advancement: extractArray(source, "advancement"),
  };
}

function readMockEventSummary(data, code) {
  const eventMatches = data.matches.filter((match) => match.eventCode === code);
  const teamNumbers = new Set(eventMatches.flatMap((match) => [...match.redTeams, ...match.blueTeams]));
  data.rankings.filter((ranking) => ranking.eventCode === code || !ranking.eventCode).forEach((ranking) => teamNumbers.add(ranking.team));
  data.advancement.filter((slot) => slot.eventCode === code || !slot.eventCode).forEach((slot) => teamNumbers.add(slot.team));
  return {
    events: data.events.filter((event) => event.code === code),
    teams: data.teams.filter((team) => teamNumbers.has(team.number)),
    matches: eventMatches,
    rankings: data.rankings.filter((ranking) => ranking.eventCode === code || !ranking.eventCode),
    advancement: data.advancement.filter((slot) => slot.eventCode === code || !slot.eventCode),
  };
}

function filterTeams(teams, query) {
  if (!query) return teams;
  const normalized = query.toLowerCase();
  return teams.filter((team) => `${team.number} ${team.name} ${team.city} ${team.state}`.toLowerCase().includes(normalized));
}

function parseLimit(value, fallback) {
  const limit = Number(value);
  if (!Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(1000, Math.floor(limit)));
}

async function cachedRead(key, read, ttlMs) {
  const cached = readCache.get(key);
  if (cached && Date.now() - cached.createdAt < ttlMs) return cached.value;
  const value = await read();
  readCache.set(key, { createdAt: Date.now(), value });
  return value;
}

async function readSupabaseData() {
  const [seasons, teams, events] = await Promise.all([
    supabaseSelect("seasons", "year,name,first_event_date,last_event_date", "year.desc"),
    supabaseSelect("teams", "number,name,city,state,country,rookie_year", "number.asc"),
    supabaseSelect("events", "code,year,name,city,state,country,type,start_date,end_date,venue", "start_date.desc"),
  ]);

  return {
    seasons: seasons.map((season) => ({ year: season.year, name: season.name })),
    teams: teams.map((team) => ({
      number: team.number,
      name: team.name,
      city: team.city ?? "",
      state: team.state ?? "",
      rookieYear: team.rookie_year ?? 0,
    })),
    events: events.map((event) => ({
      code: event.code,
      year: event.year,
      name: event.name,
      city: event.city ?? "",
      state: event.state ?? "",
      startDate: event.start_date,
      endDate: event.end_date,
      type: event.type,
    })),
    matches: [],
    rankings: [],
    advancement: [],
  };
}

async function readSupabaseSeasons() {
  const seasons = await supabaseSelect("seasons", "year,name,first_event_date,last_event_date", "year.desc");
  return seasons.map((season) => ({ year: season.year, name: season.name }));
}

async function readSupabaseTeams({ query = "", limit, offset = 0 } = {}) {
  const cleanQuery = query.replace(/[,*()]/g, " ").trim();
  const number = Number(cleanQuery);
  const orFilter = cleanQuery
    ? [
        Number.isFinite(number) ? `number.eq.${number}` : "",
        `name.ilike.*${cleanQuery}*`,
        `city.ilike.*${cleanQuery}*`,
        `state.ilike.*${cleanQuery}*`,
      ]
        .filter(Boolean)
        .join(",")
    : undefined;
  const teams = await cachedRead(
    `teams:${cleanQuery}:${limit ?? "all"}:${offset}`,
    () => supabaseSelect("teams", "number,name,city,state,country,rookie_year", "number.asc", {}, { limit, offset, orFilter }),
    5 * 60 * 1000,
  );
  return teams.map(mapTeamRow);
}

async function readSupabaseTeam(number) {
  const rows = await supabaseSelect("teams", "number,name,city,state,country,rookie_year", undefined, { number });
  return rows[0] ? mapTeamRow(rows[0]) : undefined;
}

async function readSupabaseEvents(year) {
  const rows = await cachedRead(
    `events:${year ?? "all"}`,
    () => supabaseSelect("events", "code,year,name,city,state,country,type,start_date,end_date,venue", "start_date.desc", year ? { year } : {}),
    5 * 60 * 1000,
  );
  return rows.map(mapEventRow);
}

async function readSupabaseEvent(code) {
  const rows = await supabaseSelect("events", "code,year,name,city,state,country,type,start_date,end_date,venue", undefined, { code });
  return rows[0] ? mapEventRow(rows[0]) : undefined;
}

function mapTeamRow(team) {
  return {
    number: team.number,
    name: team.name,
    city: team.city ?? "",
    state: team.state ?? "",
    rookieYear: team.rookie_year ?? 0,
  };
}

function mapEventRow(event) {
  return {
    code: event.code,
    year: event.year,
    name: event.name,
    city: event.city ?? "",
    state: event.state ?? "",
    startDate: event.start_date,
    endDate: event.end_date,
    type: normalizeEventType(event.type === "Qualifier" ? event.name : event.type),
  };
}

async function readSupabaseEpa(year, { includeInactive = true } = {}) {
  const cacheKey = `${year}:${includeInactive ? "all" : "active"}`;
  const cached = epaCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < 10 * 60 * 1000) return cached.value;
  const valuePromise = readSupabaseYearMatches(year).then(async (matches) => {
    const teamNumbers = includeInactive ? undefined : Array.from(new Set(matches.flatMap((match) => [...match.redTeams, ...match.blueTeams])));
    const teams = teamNumbers ? await readSupabaseTeamsByNumbers(teamNumbers) : await readSupabaseTeams();
    return calculateSeasonEpa(teams, matches);
  });
  epaCache.set(cacheKey, { createdAt: Date.now(), value: valuePromise });
  try {
    const value = await valuePromise;
    epaCache.set(cacheKey, { createdAt: Date.now(), value });
    return value;
  } catch (error) {
    epaCache.delete(cacheKey);
    throw error;
  }
}

async function readSupabaseEventSummary(eventCode) {
  const [event, matches, rankings, advancement, teams] = await Promise.all([
    readSupabaseEvent(eventCode),
    readSupabaseMatches(eventCode),
    readSupabaseRankings(eventCode),
    readSupabaseAdvancement(eventCode),
    readSupabaseEventTeams(eventCode),
  ]);
  return {
    events: event ? [event] : [],
    teams,
    matches,
    rankings,
    advancement,
  };
}

async function readSupabaseEventTeams(eventCode) {
  const eventTeams = await supabaseSelect("event_teams", "team_number", undefined, { event_code: eventCode });
  if (eventTeams.length === 0) return [];
  const teamNumbers = eventTeams.map((row) => row.team_number);
  const rows = await supabaseIn("teams", "number,name,city,state,country,rookie_year", "number.asc", "number", teamNumbers);
  return rows.map(mapTeamRow);
}

async function readSupabaseTeamsByNumbers(teamNumbers) {
  if (teamNumbers.length === 0) return [];
  const rows = await supabaseIn("teams", "number,name,city,state,country,rookie_year", "number.asc", "number", teamNumbers);
  return rows.map(mapTeamRow);
}

async function readSupabaseYearMatches(year) {
  const rows = await supabaseSelect(
    "matches",
    "id,event_code,year,comp_level,set_number,match_number,red_teams,blue_teams,red_score,blue_score,red_foul,blue_foul,played,scheduled_at,actual_start_at",
    "actual_start_at.asc,match_number.asc",
    { year },
  );
  return rows.map((match) => ({
    id: match.id,
    eventCode: match.event_code,
    year: match.year,
    compLevel: match.comp_level,
    setNumber: match.set_number,
    matchNumber: match.match_number,
    redTeams: match.red_teams,
    blueTeams: match.blue_teams,
    redScore: match.red_score ?? 0,
    blueScore: match.blue_score ?? 0,
    redFoul: match.red_foul ?? 0,
    blueFoul: match.blue_foul ?? 0,
    played: match.played,
  }));
}

async function readSupabaseTeamEvents(teamNumber) {
  const eventTeams = await supabaseSelect("event_teams", "event_code", undefined, { team_number: teamNumber });
  if (eventTeams.length === 0) return [];
  const eventCodes = eventTeams.map((row) => row.event_code);
  const rows = await supabaseIn("events", "code,year,name,city,state,country,type,start_date,end_date,venue", "start_date.desc", "code", eventCodes);
  return rows.map(mapEventRow);
}

async function readSupabaseTeamMatches(teamNumber) {
  const teamMatches = await supabaseSelect("team_matches", "match_id", undefined, { team_number: teamNumber });
  if (teamMatches.length === 0) return [];
  const matchIds = teamMatches.map((row) => row.match_id);
  const rows = await supabaseIn(
    "matches",
    "id,event_code,year,comp_level,set_number,match_number,red_teams,blue_teams,red_score,blue_score,red_foul,blue_foul,played,scheduled_at,actual_start_at",
    "year.desc,actual_start_at.desc,match_number.asc",
    "id",
    matchIds,
  );
  return rows.map((match) => ({
    id: match.id,
    eventCode: match.event_code,
    year: match.year,
    compLevel: match.comp_level,
    setNumber: match.set_number,
    matchNumber: match.match_number,
    redTeams: match.red_teams,
    blueTeams: match.blue_teams,
    redScore: match.red_score ?? 0,
    blueScore: match.blue_score ?? 0,
    redFoul: match.red_foul ?? 0,
    blueFoul: match.blue_foul ?? 0,
    played: match.played,
  }));
}

async function readSupabaseMatches(eventCode) {
  const matches = await supabaseSelect(
    "matches",
    "id,event_code,year,comp_level,set_number,match_number,red_teams,blue_teams,red_score,blue_score,red_foul,blue_foul,played,scheduled_at,actual_start_at",
    "comp_level.asc,set_number.asc,match_number.asc",
    { event_code: eventCode },
  );
  return matches.map((match) => ({
    id: match.id,
    eventCode: match.event_code,
    year: match.year,
    compLevel: match.comp_level,
    setNumber: match.set_number,
    matchNumber: match.match_number,
    redTeams: match.red_teams,
    blueTeams: match.blue_teams,
    redScore: match.red_score ?? 0,
    blueScore: match.blue_score ?? 0,
    redFoul: match.red_foul ?? 0,
    blueFoul: match.blue_foul ?? 0,
    played: match.played,
  }));
}

async function readSupabaseRankings(eventCode) {
  const rankings = await supabaseSelect(
    "rankings",
    "event_code,team_number,rank,wins,losses,ties,ranking_points,tie_breaker_1,tie_breaker_2",
    "rank.asc",
    { event_code: eventCode },
  );
  return rankings.map((ranking) => ({
    eventCode: ranking.event_code,
    team: ranking.team_number,
    rank: ranking.rank,
    wins: ranking.wins,
    losses: ranking.losses,
    ties: ranking.ties,
    rankingPoints: Number(ranking.ranking_points),
    tieBreaker1: Number(ranking.tie_breaker_1),
    tieBreaker2: Number(ranking.tie_breaker_2),
  }));
}

async function readSupabaseAdvancement(eventCode) {
  const advancement = await supabaseSelect("advancement", "event_code,team_number,source,status,explanation,sort_order", "sort_order.asc", { event_code: eventCode });
  return advancement.map((slot) => ({
    eventCode: slot.event_code,
    team: slot.team_number,
    source: slot.source,
    status: slot.status,
    explanation: slot.explanation,
  }));
}

async function supabaseSelect(table, columns, order, filters = {}, options = {}) {
  const rows = [];
  const pageSize = options.limit ?? 1000;
  const startOffset = options.offset ?? 0;

  for (let from = startOffset; ; from += pageSize) {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    url.searchParams.set("select", columns);
    url.searchParams.set("limit", String(pageSize));
    url.searchParams.set("offset", String(from));
    if (order) url.searchParams.set("order", order);
    if (options.orFilter) url.searchParams.set("or", `(${options.orFilter})`);
    Object.entries(filters).forEach(([key, value]) => url.searchParams.set(key, `eq.${value}`));
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Supabase ${table} read failed: ${response.status} ${text}`);
    }

    const page = await response.json();
    rows.push(...page);
    if (options.limit) break;
    if (page.length < pageSize) break;
  }

  return rows;
}

async function supabaseIn(table, columns, order, column, values) {
  const rows = [];
  for (let index = 0; index < values.length; index += 150) {
    const chunk = values.slice(index, index + 150);
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    url.searchParams.set("select", columns);
    if (order) url.searchParams.set("order", order);
    url.searchParams.set(column, `in.(${chunk.join(",")})`);
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
    });
    if (!response.ok) throw new Error(`Supabase ${table} in read failed: ${response.status} ${await response.text()}`);
    rows.push(...(await response.json()));
  }
  return rows;
}

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}

function calculateSeasonEpa(teams, matches) {
  const played = matches.filter((match) => match.played && match.redTeams.length > 0 && match.blueTeams.length > 0);
  const averageAllianceScore = played.reduce((sum, match) => sum + match.redScore + match.blueScore, 0) / Math.max(1, played.length * 2);
  const scoreStdDev = Math.max(
    42,
    Math.sqrt(
      played
        .flatMap((match) => [match.redScore, match.blueScore])
        .reduce((sum, score, _, scores) => sum + Math.pow(score - averageAllianceScore, 2) / Math.max(1, scores.length), 0),
    ),
  );
  const initialEpa = roundOne(averageAllianceScore / 2);
  const epa = new Map(teams.map((team) => [team.number, initialEpa]));
  const qualCounts = new Map(teams.map((team) => [team.number, 0]));
  const records = new Map(teams.map((team) => [team.number, { wins: 0, losses: 0, ties: 0 }]));

  played.forEach((match) => {
    const redEpa = allianceEpa(match.redTeams, epa, initialEpa);
    const blueEpa = allianceEpa(match.blueTeams, epa, initialEpa);
    updateAllianceEpa(epa, qualCounts, match.redTeams, match.redScore, redEpa, match.blueScore, blueEpa, match.compLevel, initialEpa);
    updateAllianceEpa(epa, qualCounts, match.blueTeams, match.blueScore, blueEpa, match.redScore, redEpa, match.compLevel, initialEpa);
    updateRecords(records, match);
  });

  return teams
    .map((team) => {
      const teamEpa = epa.get(team.number) ?? initialEpa;
      const record = records.get(team.number) ?? { wins: 0, losses: 0, ties: 0 };
      return {
        team: team.number,
        name: team.name,
        city: team.city,
        state: team.state,
        rookieYear: team.rookieYear,
        epa: roundOne(teamEpa),
        normEpa: Math.round(1500 + (250 * (teamEpa - initialEpa)) / scoreStdDev),
        record: `${record.wins}-${record.losses}-${record.ties}`,
        trend: roundOne(teamEpa - initialEpa),
      };
    })
    .sort((a, b) => b.normEpa - a.normEpa);
}

function allianceEpa(teamNumbers, epa, initialEpa) {
  return teamNumbers.reduce((sum, team) => sum + (epa.get(team) ?? initialEpa), 0);
}

function updateAllianceEpa(epa, qualCounts, teamNumbers, allianceScore, allianceEpa, opponentScore, opponentEpa, compLevel, initialEpa) {
  teamNumbers.forEach((team) => {
    const qualMatches = qualCounts.get(team) ?? 0;
    const k = compLevel === "qm" ? epaK(qualMatches) : 0.12;
    const margin = marginWeight(qualMatches);
    const scoreResidual = allianceScore - allianceEpa;
    const opponentResidual = opponentScore - opponentEpa;
    const delta = (k / (1 + margin)) * (scoreResidual - margin * opponentResidual);
    epa.set(team, roundOne((epa.get(team) ?? initialEpa) + delta));
    if (compLevel === "qm") qualCounts.set(team, qualMatches + 1);
  });
}

function updateRecords(records, match) {
  const result = match.redScore === match.blueScore ? "tie" : match.redScore > match.blueScore ? "red" : "blue";
  match.redTeams.forEach((team) => {
    const record = records.get(team) ?? { wins: 0, losses: 0, ties: 0 };
    if (result === "tie") record.ties += 1;
    else if (result === "red") record.wins += 1;
    else record.losses += 1;
    records.set(team, record);
  });
  match.blueTeams.forEach((team) => {
    const record = records.get(team) ?? { wins: 0, losses: 0, ties: 0 };
    if (result === "tie") record.ties += 1;
    else if (result === "blue") record.wins += 1;
    else record.losses += 1;
    records.set(team, record);
  });
}

function epaK(qualMatches) {
  if (qualMatches <= 6) return 0.5;
  if (qualMatches <= 12) return 0.5 - (1 / 30) * (qualMatches - 6);
  return 0.3;
}

function marginWeight(qualMatches) {
  if (qualMatches <= 12) return 0;
  if (qualMatches <= 36) return (qualMatches - 12) / 24;
  return 1;
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

function normalizeEventType(value) {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("championship") || text.includes("cmp")) return "State Championship";
  if (text.includes("league")) return "League Tournament";
  if (text.includes("world")) return "World Championship";
  return "Qualifier";
}

function loadEnvFile(fileUrl) {
  if (!existsSync(fileUrl)) return;
  const lines = readFileSync(fileUrl, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex < 0) return;
    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  });
}

function extractArray(source, name) {
  const start = source.indexOf(`export const ${name}`);
  if (start < 0) return [];
  const assignment = source.indexOf("=", start);
  const arrayStart = source.indexOf("[", assignment);
  let depth = 0;
  for (let index = arrayStart; index < source.length; index += 1) {
    if (source[index] === "[") depth += 1;
    if (source[index] === "]") depth -= 1;
    if (depth === 0) {
      const literal = source.slice(arrayStart, index + 1);
      return Function(`"use strict"; return (${literal});`)();
    }
  }
  return [];
}
