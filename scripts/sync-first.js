import { existsSync, readFileSync } from "node:fs";

loadEnvFile(new URL("../.env.local", import.meta.url));

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SECRET_KEY = requireEnv("SUPABASE_SECRET_KEY");
const FIRST_FTC_USERNAME = requireEnv("FIRST_FTC_USERNAME");
const FIRST_FTC_AUTH_TOKEN = requireEnv("FIRST_FTC_AUTH_TOKEN");
const FIRST_BASE_URL = "https://ftc-api.firstinspires.org/v2.0";

const args = parseArgs(process.argv.slice(2));
const years = args.years.length > 0 ? args.years : [new Date().getFullYear() - 1, new Date().getFullYear()];
const includeMatches = args.matches;
const eventLimit = args.eventLimit;

console.log(`Syncing FTC years ${years.join(", ")}${includeMatches ? " with matches/rankings" : " events/teams only"}...`);

for (const year of years) {
  await upsert("seasons", [{ year, name: args.seasonName ?? String(year) }], "year");

  const [eventsResponse, teamsResponse] = await Promise.all([firstGet(year, "events"), firstGetPaged(year, "teams", "teams")]);
  const firstEvents = eventsResponse.events ?? [];
  const firstTeams = teamsResponse.teams ?? [];

  await upsert("teams", firstTeams.map(mapTeam), "number");
  await upsert("events", firstEvents.map((event) => mapEvent(event, year)), "code");

  const eventTeamRows = [];
  const syncEvents = eventLimit ? firstEvents.slice(0, eventLimit) : firstEvents;

  for (const event of syncEvents) {
    const eventCode = event.code;
    const eventTeams = await firstGetPaged(year, `teams?eventCode=${encodeURIComponent(eventCode)}`, "teams").catch(() => ({ teams: [] }));
    await upsert("teams", (eventTeams.teams ?? []).map(mapTeam), "number");
    eventTeamRows.push(...(eventTeams.teams ?? []).map((team) => ({ event_code: eventCode, team_number: team.teamNumber })));

    if (!includeMatches) continue;

    console.log(`  ${year} ${eventCode}: matches/rankings`);
    const [matchesResponse, rankingsResponse] = await Promise.all([
      firstGetPaged(year, `matches/${encodeURIComponent(eventCode)}`, "matches").catch(() => ({ matches: [] })),
      firstGetPaged(year, `rankings/${encodeURIComponent(eventCode)}`, "rankings").catch(() => ({ rankings: [] })),
    ]);

    const matchRows = (matchesResponse.matches ?? []).map((match) => mapMatch(match, eventCode, year)).filter(Boolean);
    await upsert("matches", matchRows, "id");
    await upsert("team_matches", matchRows.flatMap(mapTeamMatches), "match_id,team_number");
    await upsert("rankings", (rankingsResponse.rankings ?? []).map((ranking) => mapRanking(ranking, eventCode)), "event_code,team_number");
  }

  await upsert("event_teams", eventTeamRows, "event_code,team_number");
  console.log(`Year ${year}: ${firstEvents.length} events, ${firstTeams.length} teams${includeMatches ? `, ${syncEvents.length} event match sets` : ""}`);
}

console.log("FIRST sync complete.");

function mapTeam(team) {
  return {
    number: team.teamNumber,
    name: team.nameShort || team.nameFull || `Team ${team.teamNumber}`,
    city: team.city ?? null,
    state: team.stateProv ?? null,
    country: team.country ?? null,
    rookie_year: team.rookieYear ?? null,
  };
}

function mapEvent(event, year) {
  return {
    code: event.code,
    year,
    name: event.name,
    city: event.city ?? null,
    state: event.stateprov ?? event.stateProv ?? null,
    country: event.country ?? null,
    type: normalizeEventType(event.type ?? event.eventType ?? event.eventTypeName ?? event.name),
    start_date: event.dateStart ?? event.startDate ?? null,
    end_date: event.dateEnd ?? event.endDate ?? null,
    venue: event.venue ?? null,
  };
}

function mapMatch(match, eventCode, year) {
  const redTeams = match.teams?.filter((team) => String(team.station).toLowerCase().startsWith("red")).map((team) => team.teamNumber).sort((a, b) => a - b) ?? [];
  const blueTeams = match.teams?.filter((team) => String(team.station).toLowerCase().startsWith("blue")).map((team) => team.teamNumber).sort((a, b) => a - b) ?? [];
  const compLevel = normalizeLevel(match.tournamentLevel);
  if (!compLevel || redTeams.length === 0 || blueTeams.length === 0) return undefined;

  const id = `${year}${eventCode}_${compLevel}${match.series || 1}m${match.matchNumber}`;
  const redScore = numberOrNull(match.scoreRedFinal);
  const blueScore = numberOrNull(match.scoreBlueFinal);

  return {
    id,
    event_code: eventCode,
    year,
    comp_level: compLevel,
    set_number: match.series || 1,
    match_number: match.matchNumber,
    red_teams: redTeams,
    blue_teams: blueTeams,
    red_score: redScore,
    blue_score: blueScore,
    red_foul: numberOrZero(match.scoreRedFoul),
    blue_foul: numberOrZero(match.scoreBlueFoul),
    played: redScore !== null && blueScore !== null && Boolean(match.postResultTime || match.actualStartTime),
    scheduled_at: match.startTime ?? null,
    actual_start_at: match.actualStartTime ?? null,
    raw: match,
  };
}

function mapTeamMatches(match) {
  const redWon = match.played ? match.red_score > match.blue_score : null;
  const blueWon = match.played ? match.blue_score > match.red_score : null;
  return [
    ...match.red_teams.map((team) => ({
      match_id: match.id,
      team_number: team,
      event_code: match.event_code,
      alliance: "red",
      alliance_score: match.red_score,
      opponent_score: match.blue_score,
      won: redWon,
    })),
    ...match.blue_teams.map((team) => ({
      match_id: match.id,
      team_number: team,
      event_code: match.event_code,
      alliance: "blue",
      alliance_score: match.blue_score,
      opponent_score: match.red_score,
      won: blueWon,
    })),
  ];
}

function mapRanking(ranking, eventCode) {
  return {
    event_code: eventCode,
    team_number: ranking.teamNumber,
    rank: ranking.rank,
    wins: numberOrZero(ranking.wins ?? ranking.matchesWon),
    losses: numberOrZero(ranking.losses ?? ranking.matchesLost),
    ties: numberOrZero(ranking.ties ?? ranking.matchesTied),
    ranking_points: numberOrZero(ranking.sortOrder1),
    tie_breaker_1: numberOrZero(ranking.sortOrder2),
    tie_breaker_2: numberOrZero(ranking.sortOrder3),
    raw: ranking,
  };
}

async function firstGet(year, path) {
  const auth = Buffer.from(`${FIRST_FTC_USERNAME}:${FIRST_FTC_AUTH_TOKEN}`).toString("base64");
  const response = await fetch(`${FIRST_BASE_URL}/${year}/${path}`, {
    headers: {
      authorization: `Basic ${auth}`,
      accept: "application/json",
    },
  });
  if (!response.ok) throw new Error(`FIRST ${year}/${path} failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function firstGetPaged(year, path, key) {
  const firstPage = await firstGet(year, path);
  const totalPages = Number(firstPage.pageTotal ?? 1);
  if (totalPages <= 1) return firstPage;

  const separator = path.includes("?") ? "&" : "?";
  const pages = [firstPage];
  for (let page = 2; page <= totalPages; page += 1) {
    pages.push(await firstGet(year, `${path}${separator}page=${page}`));
  }

  return {
    ...firstPage,
    [key]: pages.flatMap((page) => page[key] ?? []),
  };
}

async function upsert(table, rows, onConflict) {
  const cleanRows = rows.filter(Boolean);
  if (cleanRows.length === 0) return;

  for (let index = 0; index < cleanRows.length; index += 500) {
    const chunk = cleanRows.slice(index, index + 500);
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    url.searchParams.set("on_conflict", onConflict);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(chunk),
    });
    if (!response.ok) throw new Error(`Supabase upsert ${table} failed: ${response.status} ${await response.text()}`);
  }
}

function parseArgs(rawArgs) {
  const parsed = { years: [], matches: true, eventLimit: undefined, seasonName: undefined };
  rawArgs.forEach((arg, index) => {
    if (arg === "--no-matches") parsed.matches = false;
    if (arg === "--year") parsed.years.push(Number(rawArgs[index + 1]));
    if (arg.startsWith("--year=")) parsed.years.push(Number(arg.split("=")[1]));
    if (arg === "--event-limit") parsed.eventLimit = Number(rawArgs[index + 1]);
    if (arg.startsWith("--event-limit=")) parsed.eventLimit = Number(arg.split("=")[1]);
    if (arg === "--season-name") parsed.seasonName = rawArgs[index + 1];
    if (arg.startsWith("--season-name=")) parsed.seasonName = arg.split("=")[1];
  });
  parsed.years = parsed.years.filter(Number.isFinite);
  if (!Number.isFinite(parsed.eventLimit)) parsed.eventLimit = undefined;
  return parsed;
}

function normalizeLevel(level) {
  const value = String(level ?? "").toUpperCase();
  if (value.includes("QUAL")) return "qm";
  if (value.includes("SEMI")) return "sf";
  if (value.includes("FINAL")) return "f";
  return undefined;
}

function normalizeEventType(value) {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("championship") || text.includes("cmp")) return "State Championship";
  if (text.includes("league")) return "League Tournament";
  if (text.includes("world")) return "World Championship";
  return "Qualifier";
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function requireEnv(name) {
  if (!process.env[name]) throw new Error(`${name} is required`);
  return process.env[name];
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
