import type { AdvancementSlot, EpaRating, Event, Match, Ranking, Season, Team } from "../types";

export type RemoteAppData = {
  seasons: Season[];
  teams: Team[];
  events: Event[];
  matches: Match[];
  rankings: Ranking[];
  advancement: AdvancementSlot[];
  epaRatings: EpaRating[];
};

const jsonCache = new Map<string, Promise<unknown>>();

export async function fetchAppData(year: number, eventCode: string): Promise<RemoteAppData> {
  const [seasons, teams, yearEvents, epaRatings] = await Promise.all([
    getJson<Season[]>("/api/seasons"),
    getJson<Team[]>("/api/teams"),
    getJson<Event[]>(`/api/events?year=${year}`),
    getJson<EpaRating[]>(`/api/epa/teams?year=${year}`).catch(() => []),
  ]);

  const selectedEventCode = yearEvents.some((event) => event.code === eventCode) ? eventCode : yearEvents[0]?.code;
  const [event, matches, rankings, advancement] = selectedEventCode
    ? await Promise.all([
        getJson<Event>(`/api/events/${selectedEventCode}`).catch(() => undefined),
        getJson<Match[]>(`/api/events/${selectedEventCode}/matches`).catch(() => []),
        getJson<Ranking[]>(`/api/events/${selectedEventCode}/rankings`).catch(() => []),
        getJson<AdvancementSlot[]>(`/api/events/${selectedEventCode}/advancement`).catch(() => []),
      ])
    : [undefined, [], [], []];

  const mergedEvents = event && !yearEvents.some((item) => item.code === event.code) ? [event, ...yearEvents] : yearEvents;

  return {
    seasons,
    teams,
    events: mergedEvents,
    matches,
    rankings,
    advancement,
    epaRatings,
  };
}

export async function fetchBootstrapData(year: number): Promise<Partial<RemoteAppData>> {
  const [seasons, events] = await Promise.all([
    getJson<Season[]>("/api/seasons"),
    getJson<Event[]>(`/api/events?year=${year}`),
  ]);

  return { seasons, events };
}

export async function fetchSeasonEpa(year: number, limit?: number): Promise<EpaRating[]> {
  const suffix = limit ? `&limit=${limit}` : "";
  return getJson<EpaRating[]>(`/api/epa/teams?year=${year}${suffix}`).catch(() => []);
}

export async function fetchEventData(eventCode: string): Promise<Partial<RemoteAppData>> {
  const fallback = async () => {
    const [event, matches, rankings, advancement] = await Promise.all([
      getJson<Event>(`/api/events/${eventCode}`).catch(() => undefined),
      getJson<Match[]>(`/api/events/${eventCode}/matches`).catch(() => []),
      getJson<Ranking[]>(`/api/events/${eventCode}/rankings`).catch(() => []),
      getJson<AdvancementSlot[]>(`/api/events/${eventCode}/advancement`).catch(() => []),
    ]);
    return {
      events: event ? [event] : undefined,
      matches,
      rankings,
      advancement,
    };
  };

  return getJson<Partial<RemoteAppData>>(`/api/events/${eventCode}/summary`)
    .then((data) => {
      if (!Array.isArray(data.matches) || !Array.isArray(data.rankings) || !Array.isArray(data.advancement)) return fallback();
      return data;
    })
    .catch(fallback);
}

export function teamsFromEpaRatings(ratings: EpaRating[]): Team[] {
  return ratings
    .filter((rating) => rating.name)
    .map((rating) => ({
      number: rating.team,
      name: rating.name ?? `Team ${rating.team}`,
      city: rating.city ?? "",
      state: rating.state ?? "",
      rookieYear: rating.rookieYear ?? 0,
    }));
}

export async function fetchTeams(options: { query?: string; limit?: number; offset?: number } = {}): Promise<Team[]> {
  const params = new URLSearchParams();
  if (options.query) params.set("q", options.query);
  if (options.limit) params.set("limit", String(options.limit));
  if (options.offset) params.set("offset", String(options.offset));
  const suffix = params.toString() ? `?${params}` : "";
  return getJson<Team[]>(`/api/teams${suffix}`);
}

export async function fetchTeamEvents(teamNumber: number): Promise<Event[]> {
  return getJson<Event[]>(`/api/teams/${teamNumber}/events`);
}

export async function fetchTeamMatches(teamNumber: number): Promise<Match[]> {
  return getJson<Match[]>(`/api/teams/${teamNumber}/matches`);
}

async function getJson<T>(path: string): Promise<T> {
  const cached = jsonCache.get(path) as Promise<T> | undefined;
  if (cached) return cached;

  const request = fetchJson<T>(path).catch((error) => {
    jsonCache.delete(path);
    throw error;
  });
  jsonCache.set(path, request);
  return request;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} failed with ${response.status}`);
  return response.json();
}
