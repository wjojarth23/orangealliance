import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Medal,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { advancement, events, matches, mergeData, rankings, replaceData, seasons, teams } from "./data/mockData";
import { fetchBootstrapData, fetchEventData, fetchSeasonEpa, fetchTeamEvents, fetchTeamMatches, fetchTeams, teamsFromEpaRatings } from "./data/api";
import {
  calculateEloMap,
  getAllianceLeaderboard,
  getBotworthyMatches,
  getEloLeaderboard,
  getPredictedSeeds,
  getTeam,
  labelMatch,
  predictMatch,
} from "./lib/analytics";
import type { Event, Match, Team } from "./types";
import "./styles.css";

type View = "home" | "events" | "event" | "teams" | "team" | "epa" | "records" | "api";

const defaultEvent = events[0];

function App() {
  const [view, setView] = useState<View>("home");
  const [query, setQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState(seasons[0].year);
  const [selectedEventCode, setSelectedEventCode] = useState(defaultEvent.code);
  const [selectedTeam, setSelectedTeam] = useState(teams[0].number);
  const [dataStatus, setDataStatus] = useState<"loading" | "live" | "error">("loading");
  const [bootstrapped, setBootstrapped] = useState(false);
  const [dataRevision, setDataRevision] = useState(0);
  const [eventLoading, setEventLoading] = useState(false);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const selectedEvent = events.find((event) => event.code === selectedEventCode);

  useEffect(() => {
    let cancelled = false;
    setDataStatus("loading");
    fetchBootstrapData(selectedYear)
      .then((data) => {
        if (cancelled) return;
        replaceData(data);
        if (data.events && data.events.length > 0 && !data.events.some((event) => event.code === selectedEventCode)) {
          setSelectedEventCode(data.events[0].code);
        }
        if (data.seasons && data.seasons.length > 0 && !data.seasons.some((season) => season.year === selectedYear)) {
          setSelectedYear(data.seasons[0].year);
        }
        setDataStatus("live");
        setBootstrapped(true);
        setDataRevision((revision) => revision + 1);
      })
      .catch(() => {
        if (!cancelled) setDataStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedYear]);

  useEffect(() => {
    if (!bootstrapped) return;
    let cancelled = false;
    fetchSeasonEpa(selectedYear, view === "epa" ? undefined : 250)
      .then((epaRatings) => {
        if (cancelled) return;
        mergeData({ teams: teamsFromEpaRatings(epaRatings) });
        replaceData({ epaRatings });
        setDataRevision((revision) => revision + 1);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [bootstrapped, selectedYear, view]);

  useEffect(() => {
    if (!bootstrapped || !selectedEventCode) return;
    let cancelled = false;
    setEventLoading(true);
    replaceData({ matches: [], rankings: [], advancement: [] });
    setDataRevision((revision) => revision + 1);
    fetchEventData(selectedEventCode)
      .then((data) => {
        if (cancelled) return;
        mergeData({ events: data.events, teams: data.teams });
        replaceData({ matches: data.matches, rankings: data.rankings, advancement: data.advancement });
        setDataRevision((revision) => revision + 1);
      })
      .finally(() => {
        if (!cancelled) setEventLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bootstrapped, selectedEventCode]);

  useEffect(() => {
    if (!bootstrapped || view !== "teams") return;
    let cancelled = false;
    setTeamsLoading(true);
    fetchTeams()
      .then((loadedTeams) => {
        if (cancelled) return;
        mergeData({ teams: loadedTeams });
        if (loadedTeams.length > 0 && !loadedTeams.some((team) => team.number === selectedTeam)) {
          setSelectedTeam(loadedTeams[0].number);
        }
        setDataRevision((revision) => revision + 1);
      })
      .finally(() => {
        if (!cancelled) setTeamsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bootstrapped, view, selectedTeam]);

  function openEvent(event: Event) {
    setSelectedEventCode(event.code);
    setSelectedYear(event.year);
    setView("event");
  }

  function openTeam(team: Team) {
    setSelectedTeam(team.number);
    setView("team");
  }

  return (
    <div className="app-shell">
      <header className="sidebar">
        <button className="brand" onClick={() => setView("home")}>
          <span className="brand-mark">OA</span>
          <span>
            <strong>Orange Alliance</strong>
            <small>FTC data + EPA</small>
          </span>
        </button>
        <nav className="nav-list" aria-label="Primary">
          <NavButton active={view === "events" || view === "event"} icon={<CalendarDays />} label="Events" onClick={() => setView("events")} />
          <NavButton active={view === "teams" || view === "team"} icon={<Users />} label="Teams" onClick={() => setView("teams")} />
          <NavButton active={view === "epa"} icon={<BarChart3 />} label="EPA" onClick={() => setView("epa")} />
          <NavButton active={view === "records"} icon={<Sparkles />} label="Botworthy" onClick={() => setView("records")} />
          <NavButton active={view === "api"} icon={<ShieldCheck />} label="API" onClick={() => setView("api")} />
        </nav>
        <div className="sidebar-panel">
          <span className="eyebrow">Season</span>
          <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>
            {seasons.map((season) => (
              <option key={season.year} value={season.year}>
                {season.year} {season.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="main">
        <SearchBar query={query} setQuery={setQuery} onEvent={openEvent} onTeam={openTeam} dataStatus={dataStatus} dataRevision={dataRevision} />
        {!bootstrapped && dataStatus === "loading" && <EmptyState title="Loading live FIRST data" detail="Fetching the season shell from Supabase." />}
        {!bootstrapped && dataStatus === "error" && <EmptyState title="Live data failed to load" detail="Check the backend logs and Supabase environment variables." />}
        {bootstrapped && (
          <>
        {view === "home" && <Home selectedYear={selectedYear} onEvent={openEvent} onTeam={openTeam} />}
        {view === "events" && <EventsView year={selectedYear} onEvent={openEvent} />}
        {view === "event" && (selectedEvent ? <EventView event={selectedEvent} onTeam={openTeam} loading={eventLoading} /> : <EmptyState title="No event selected" detail="Sync FIRST data, then choose an event from the events page." />)}
        {view === "teams" && <TeamsView onTeam={openTeam} loading={teamsLoading} />}
        {view === "team" && <TeamView teamNumber={selectedTeam} onEvent={openEvent} />}
        {view === "epa" && <EpaView onTeam={openTeam} />}
        {view === "records" && <RecordsView onTeam={openTeam} onEvent={openEvent} />}
        {view === "api" && <ApiView />}
          </>
        )}
      </main>
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button className={active ? "nav-button active" : "nav-button"} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function SearchBar({
  query,
  setQuery,
  onEvent,
  onTeam,
  dataStatus,
  dataRevision,
}: {
  query: string;
  setQuery: (query: string) => void;
  onEvent: (event: Event) => void;
  onTeam: (team: Team) => void;
  dataStatus: "loading" | "live" | "error";
  dataRevision: number;
}) {
  const [remoteResults, setRemoteResults] = useState<{ kind: "team"; label: string; meta: string; item: Team }[]>([]);
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    const teamResults = teams
      .filter((team) => `${team.number} ${team.name} ${team.city} ${team.state}`.toLowerCase().includes(normalized))
      .slice(0, 4)
      .map((team) => ({ kind: "team" as const, label: `${team.number} ${team.name}`, meta: `${team.city}, ${team.state}`, item: team }));
    const eventResults = events
      .filter((event) => `${event.year} ${event.code} ${event.name} ${event.city} ${event.state}`.toLowerCase().includes(normalized))
      .slice(0, 4)
      .map((event) => ({ kind: "event" as const, label: `${event.year} ${event.name}`, meta: `${event.city}, ${event.state}`, item: event }));
    return [...eventResults, ...teamResults, ...remoteResults].slice(0, 7);
  }, [query, remoteResults, dataRevision]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setRemoteResults([]);
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      fetchTeams({ query: normalized, limit: 8 })
        .then((loadedTeams) => {
          if (cancelled) return;
          mergeData({ teams: loadedTeams });
          const known = new Set(teams.map((team) => team.number));
          setRemoteResults(
            loadedTeams
              .filter((team) => known.has(team.number))
              .map((team) => ({ kind: "team" as const, label: `${team.number} ${team.name}`, meta: `${team.city}, ${team.state}`, item: team })),
          );
        })
        .catch(() => {});
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [query]);

  return (
    <div className="topbar">
      <div className="search-wrap">
        <Search size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search teams, events, years, cities" />
        {results.length > 0 && (
          <div className="search-results">
            {results.map((result) => (
              <button
                key={`${result.kind}-${result.label}`}
                onClick={() => {
                  setQuery("");
                  result.kind === "event" ? onEvent(result.item) : onTeam(result.item);
                }}
              >
                <span>{result.label}</span>
                <small>{result.meta}</small>
              </button>
            ))}
          </div>
        )}
      </div>
      <span className={`data-pill ${dataStatus}`}>{dataStatus === "live" ? "Live data" : dataStatus === "loading" ? "Loading data" : "Data error"}</span>
    </div>
  );
}

function Home({ selectedYear, onEvent, onTeam }: { selectedYear: number; onEvent: (event: Event) => void; onTeam: (team: Team) => void }) {
  const yearEvents = events.filter((event) => event.year === selectedYear);
  const leaderboard = getEloLeaderboard().slice(0, 5);
  const seeds = getPredictedSeeds().slice(0, 5);
  const botworthy = getBotworthyMatches().highestCombined[0];
  const trackedTeams = Math.max(teams.length, getEloLeaderboard().length);

  return (
    <div className="page-stack">
      <section className="hero-band">
        <div>
          <span className="eyebrow">FTC scouting workspace</span>
          <h1>Event results, match predictions, advancement paths, and EPA ratings in one place.</h1>
          <p>
            A React clone of the core Blue Alliance experience for FTC, built around FIRST API data and a Statbotics-style
            point-unit EPA model.
          </p>
        </div>
        <div className="score-tile">
          <span>Top predicted seed</span>
          <strong>{seeds[0]?.team}</strong>
          <small>{getTeam(seeds[0]?.team ?? 0).name}</small>
        </div>
      </section>

      <section className="stats-grid">
        <Metric label="Tracked teams" value={trackedTeams.toString()} />
        <Metric label="Events" value={events.length.toString()} />
        <Metric label="Matches" value={matches.length.toString()} />
        <Metric label="Highest combined" value={botworthy ? `${botworthy.redScore + botworthy.blueScore}` : "-"} />
      </section>

      <div className="two-column">
        <Panel title={`${selectedYear} events`} icon={<CalendarDays />}>
          <div className="list">
            {yearEvents.map((event) => (
              <button className="list-row" key={event.code} onClick={() => onEvent(event)}>
                <span>
                  <strong>{event.name}</strong>
                  <small>{event.city}, {event.state} - {event.type}</small>
                </span>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="EPA leaderboard" icon={<BarChart3 />}>
          <CompactTeamTable teams={leaderboard} onTeam={onTeam} />
        </Panel>
      </div>
    </div>
  );
}

function EventsView({ year, onEvent }: { year: number; onEvent: (event: Event) => void }) {
  const yearEvents = events.filter((event) => event.year === year);
  return (
    <section className="page-stack">
      <PageHeader eyebrow="Events" title={`${year} FTC events`} subtitle="Search across years, locations, event codes, and competition levels." />
      <div className="table-card">
        <table>
          <thead>
            <tr><th>Event</th><th>Code</th><th>Type</th><th>Date</th><th>Location</th></tr>
          </thead>
          <tbody>
            {yearEvents.map((event) => (
              <tr key={event.code} onClick={() => onEvent(event)}>
                <td><strong>{event.name}</strong></td>
                <td>{event.code}</td>
                <td>{event.type}</td>
                <td>{event.startDate}</td>
                <td>{event.city}, {event.state}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {yearEvents.length === 0 && <EmptyState title="No events in this season" detail="Run the FIRST sync job for this year to populate Supabase." />}
      </div>
    </section>
  );
}

function EventView({ event, onTeam, loading }: { event: Event; onTeam: (team: Team) => void; loading: boolean }) {
  const eventMatches = matches.filter((match) => match.eventCode === event.code);
  const quals = eventMatches.filter((match) => match.compLevel === "qm");
  const playoffs = eventMatches.filter((match) => match.compLevel !== "qm");

  return (
    <section className="page-stack">
      <PageHeader eyebrow={`${event.year} - ${event.code}`} title={event.name} subtitle={`${event.city}, ${event.state} - ${event.type} - ${event.startDate}`} />
      <div className="tabs-grid">
        <Panel title="Qualification rankings" icon={<Trophy />}>
          {loading && rankings.length === 0 && <EmptyState title="Loading rankings" detail="Fetching this event's rankings." />}
          {!loading && rankings.length === 0 && <EmptyState title="No synced rankings" detail="This event has no ranking rows in Supabase yet." />}
          <RankingsTable onTeam={onTeam} />
        </Panel>
        <Panel title="Predicted seeds + qualification odds" icon={<Activity />}>
          {loading && rankings.length === 0 && <EmptyState title="Loading projections" detail="Fetching this event's match context." />}
          {!loading && rankings.length === 0 && <EmptyState title="No projections available" detail="Rankings and matches need to be synced before projections can run." />}
          <PredictedSeedsTable onTeam={onTeam} />
        </Panel>
      </div>
      <Panel title="Matches with predictions" icon={<BarChart3 />}>
        {loading && eventMatches.length === 0 && <EmptyState title="Loading matches" detail="Fetching this event's schedule and scores." />}
        {!loading && eventMatches.length === 0 && <EmptyState title="No synced matches" detail="This event has no match rows in Supabase yet." />}
        <MatchTable matches={quals} onTeam={onTeam} />
      </Panel>
      <div className="tabs-grid">
        <Panel title="Playoff bracket" icon={<Medal />}>
          <Bracket matches={playoffs} onTeam={onTeam} />
        </Panel>
        <Panel title="Advancement" icon={<ShieldCheck />}>
          <Advancement onTeam={onTeam} />
        </Panel>
      </div>
    </section>
  );
}

function TeamsView({ onTeam, loading }: { onTeam: (team: Team) => void; loading: boolean }) {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="Teams" title="FTC teams" subtitle="Team list with location, rookie year, EPA, normalized EPA, and records." />
      <div className="table-card">
        {loading && <EmptyState title="Loading team directory" detail="Fetching teams from Supabase." />}
        <CompactTeamTable teams={getEloLeaderboard()} onTeam={onTeam} expanded />
      </div>
    </section>
  );
}

function TeamView({ teamNumber, onEvent }: { teamNumber: number; onEvent: (event: Event) => void }) {
  const team = getTeam(teamNumber);
  const epaTeam = getEloLeaderboard().find((entry) => entry.number === teamNumber);
  const [teamEvents, setTeamEvents] = useState<Event[]>([]);
  const [teamMatches, setTeamMatches] = useState<Match[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setTeamLoading(true);
    Promise.all([fetchTeamEvents(teamNumber), fetchTeamMatches(teamNumber)])
      .then(([events, matches]) => {
        if (cancelled) return;
        setTeamEvents(events);
        setTeamMatches(matches);
        setTeamLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setTeamEvents([]);
        setTeamMatches([]);
        setTeamLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamNumber]);

  return (
    <section className="page-stack">
      <PageHeader eyebrow={`Team ${team.number}`} title={team.name} subtitle={`${team.city}, ${team.state} - Rookie year ${team.rookieYear}`} />
      <section className="stats-grid">
        <Metric label="EPA" value={`${epaTeam?.epa ?? "-"}`} />
        <Metric label="Norm EPA" value={`${epaTeam?.normEpa ?? "-"}`} />
        <Metric label="Record" value={epaTeam?.record ?? "0-0-0"} />
        <Metric label="Trend" value={`${epaTeam?.trend ?? 0}`} />
      </section>
      <div className="two-column">
        <Panel title="Events" icon={<CalendarDays />}>
          <div className="list">
            {teamLoading && <EmptyState title="Loading team events" detail="Fetching event history from Supabase." />}
            {!teamLoading && teamEvents.length === 0 && <EmptyState title="No synced events" detail="This team has no event rows in the current Supabase sync." />}
            {teamEvents.map((event) => (
              <button className="list-row" key={event.code} onClick={() => onEvent(event)}>
                <span><strong>{event.name}</strong><small>{event.year} - {event.city}, {event.state}</small></span>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="Matches" icon={<Activity />}>
          {teamLoading && <EmptyState title="Loading team matches" detail="Fetching match history from Supabase." />}
          {!teamLoading && teamMatches.length === 0 && <EmptyState title="No synced matches" detail="This team has no match rows in the current Supabase sync." />}
          <MatchTable matches={teamMatches} highlightTeam={teamNumber} />
        </Panel>
      </div>
    </section>
  );
}

function EpaView({ onTeam }: { onTeam: (team: Team) => void }) {
  const alliances = getAllianceLeaderboard();
  return (
    <section className="page-stack">
      <PageHeader eyebrow="EPA" title="Statbotics-style FTC analytics" subtitle="Raw EPA is in points. Normalized EPA maps that point rating onto an Elo-like 1500 scale." />
      <div className="tabs-grid">
        <Panel title="Team leaderboard" icon={<BarChart3 />}>
          <CompactTeamTable teams={getEloLeaderboard()} onTeam={onTeam} expanded />
        </Panel>
        <Panel title="Alliance sum EPA" icon={<Users />}>
          <div className="table-card flat">
            <table>
              <thead><tr><th>Alliance</th><th>EPA sum</th><th>Avg score</th><th>Win rate</th></tr></thead>
              <tbody>
                {alliances.map((alliance) => (
                  <tr key={alliance.teams.join("-")}>
                    <td>{alliance.teams.map((team) => <TeamButton key={team} number={team} onTeam={onTeam} />)}</td>
                    <td>{alliance.elo}</td>
                    <td>{alliance.averageScore}</td>
                    <td>{percent(alliance.winRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      <Panel title="Prediction notes" icon={<ShieldCheck />}>
        <div className="note-grid">
          <p>Each team starts at one half of the early-season average alliance score because FTC uses two-team alliances.</p>
          <p>After played matches, team EPA updates from score residuals. Stronger-than-expected scoring raises EPA even if the alliance loses.</p>
          <p>Qualification odds here are a lightweight front-end simulation proxy. Production should run Monte Carlo event simulations on the backend.</p>
        </div>
      </Panel>
    </section>
  );
}

function RecordsView({ onTeam, onEvent }: { onTeam: (team: Team) => void; onEvent: (event: Event) => void }) {
  const records = getBotworthyMatches();
  return (
    <section className="page-stack">
      <PageHeader eyebrow="Botworthy" title="Record book" subtitle="High combined scores, highest clean alliance scores, and highest scores including foul points." />
      <div className="tabs-grid">
        <RecordPanel title="Highest combined score" rows={records.highestCombined.map((match) => ({ match, label: `${match.redScore + match.blueScore} combined`, teams: [...match.redTeams, ...match.blueTeams] }))} onTeam={onTeam} onEvent={onEvent} />
        <RecordPanel title="Highest alliance score clean" rows={records.highestCleanAlliance.map((row) => ({ match: row.match, label: `${row.cleanScore} clean`, teams: row.teams }))} onTeam={onTeam} onEvent={onEvent} />
        <RecordPanel title="Highest alliance score with fouls" rows={records.highestWithFouls.map((row) => ({ match: row.match, label: `${row.score} with fouls`, teams: row.teams }))} onTeam={onTeam} onEvent={onEvent} />
      </div>
    </section>
  );
}

function ApiView() {
  return (
    <section className="page-stack">
      <PageHeader eyebrow="Integration" title="FIRST FTC API backend plan" subtitle="The browser app should never contain your FIRST API key." />
      <div className="two-column">
        <Panel title="Backend required for production" icon={<ShieldCheck />}>
          <div className="copy-block">
            <p>Yes, this app should use a small backend plus database for real data.</p>
            <p>The backend stores the FIRST API key, syncs seasons/events/teams/matches/rankings, computes EPA after every sync, and serves clean JSON to React.</p>
            <p>A practical database schema needs teams, seasons, events, event teams, matches, team matches, rankings, advancement, and EPA snapshots.</p>
          </div>
        </Panel>
        <Panel title="Local API contract" icon={<Activity />}>
          <div className="endpoint-list">
            <code>GET /api/seasons</code>
            <code>GET /api/events?year=2025</code>
            <code>GET /api/events/:code</code>
            <code>GET /api/events/:code/matches</code>
            <code>GET /api/events/:code/rankings</code>
            <code>GET /api/teams/:number</code>
            <code>GET /api/epa/teams</code>
            <code>GET /api/records</code>
          </div>
        </Panel>
      </div>
    </section>
  );
}

function PageHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <header className="page-header">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel">
      <header className="panel-header">
        <span>{icon}</span>
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CompactTeamTable({ teams: rows, onTeam, expanded = false }: { teams: ReturnType<typeof getEloLeaderboard>; onTeam: (team: Team) => void; expanded?: boolean }) {
  const visibleRows = expanded ? rows.slice(0, 500) : rows;
  return (
    <div className="table-card flat">
      <table>
        <thead>
          <tr><th>Team</th>{expanded && <th>Location</th>}<th>EPA</th><th>Norm</th><th>Record</th></tr>
        </thead>
        <tbody>
          {visibleRows.map((team) => (
            <tr key={team.number} onClick={() => onTeam(team)}>
              <td><strong>{team.number}</strong> {team.name}</td>
              {expanded && <td>{team.city}, {team.state}</td>}
              <td>{team.epa}</td>
              <td>{team.normEpa}</td>
              <td>{team.record}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {visibleRows.length < rows.length && <div className="table-note">Showing top {visibleRows.length.toLocaleString()} of {rows.length.toLocaleString()} teams.</div>}
    </div>
  );
}

function RankingsTable({ onTeam }: { onTeam: (team: Team) => void }) {
  return (
    <div className="table-card flat">
      <table>
        <thead><tr><th>Rank</th><th>Team</th><th>W-L-T</th><th>RP</th><th>TB1</th><th>TB2</th></tr></thead>
        <tbody>
          {rankings.map((ranking) => (
            <tr key={ranking.team} onClick={() => onTeam(getTeam(ranking.team))}>
              <td>{ranking.rank}</td>
              <td><strong>{ranking.team}</strong> {getTeam(ranking.team).name}</td>
              <td>{ranking.wins}-{ranking.losses}-{ranking.ties}</td>
              <td>{ranking.rankingPoints}</td>
              <td>{ranking.tieBreaker1}</td>
              <td>{ranking.tieBreaker2}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PredictedSeedsTable({ onTeam }: { onTeam: (team: Team) => void }) {
  return (
    <div className="table-card flat">
      <table>
        <thead><tr><th>Seed</th><th>Team</th><th>Current</th><th>Projected score</th><th>Qual odds</th></tr></thead>
        <tbody>
          {getPredictedSeeds().map((seed) => (
            <tr key={seed.team} onClick={() => onTeam(getTeam(seed.team))}>
              <td>{seed.predictedSeed}</td>
              <td><strong>{seed.team}</strong> {getTeam(seed.team).name}</td>
              <td>{seed.currentRank}</td>
              <td>{seed.projectedRankScore.toFixed(1)}</td>
              <td>{percent(seed.qualificationOdds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchTable({ matches: rows, onTeam, highlightTeam }: { matches: Match[]; onTeam?: (team: Team) => void; highlightTeam?: number }) {
  const epa = calculateEloMap();
  return (
    <div className="match-list">
      {rows.map((match) => {
        const prediction = predictMatch(match, epa);
        return (
          <article className="match-card" key={match.id}>
            <div className="match-head">
              <strong>{labelMatch(match)}</strong>
              <span>{match.played ? "Final" : "Prediction"}</span>
            </div>
            <AllianceLine color="red" teams={match.redTeams} score={match.redScore} expected={prediction.redExpectedScore} probability={prediction.redWinProbability} onTeam={onTeam} highlightTeam={highlightTeam} played={match.played} />
            <AllianceLine color="blue" teams={match.blueTeams} score={match.blueScore} expected={prediction.blueExpectedScore} probability={prediction.blueWinProbability} onTeam={onTeam} highlightTeam={highlightTeam} played={match.played} />
          </article>
        );
      })}
    </div>
  );
}

function AllianceLine({
  color,
  teams: teamNumbers,
  score,
  expected,
  probability,
  onTeam,
  highlightTeam,
  played,
}: {
  color: "red" | "blue";
  teams: number[];
  score: number;
  expected: number;
  probability: number;
  onTeam?: (team: Team) => void;
  highlightTeam?: number;
  played: boolean;
}) {
  return (
    <div className={`alliance-line ${color}`}>
      <div className="alliance-teams">
        {teamNumbers.map((team) => (
          <button key={team} className={highlightTeam === team ? "team-chip highlighted" : "team-chip"} onClick={() => onTeam?.(getTeam(team))}>
            {team}
          </button>
        ))}
      </div>
      <div className="prediction-bar" title={`${percent(probability)} win probability`}>
        <span style={{ width: `${Math.round(probability * 100)}%` }} />
      </div>
      <strong>{played ? score : expected}</strong>
      <small>{played ? `Exp ${expected}` : percent(probability)}</small>
    </div>
  );
}

function Bracket({ matches: rows, onTeam }: { matches: Match[]; onTeam: (team: Team) => void }) {
  const semis = rows.filter((match) => match.compLevel === "sf");
  const finals = rows.filter((match) => match.compLevel === "f");
  return (
    <div className="bracket">
      <div>
        <span className="bracket-label">Semifinals</span>
        {semis.map((match) => <BracketMatch key={match.id} match={match} onTeam={onTeam} />)}
      </div>
      <div>
        <span className="bracket-label">Finals</span>
        {finals.map((match) => <BracketMatch key={match.id} match={match} onTeam={onTeam} />)}
      </div>
    </div>
  );
}

function BracketMatch({ match, onTeam }: { match: Match; onTeam: (team: Team) => void }) {
  return (
    <div className="bracket-match">
      <AllianceLine color="red" teams={match.redTeams} score={match.redScore} expected={predictMatch(match).redExpectedScore} probability={predictMatch(match).redWinProbability} onTeam={onTeam} played={match.played} />
      <AllianceLine color="blue" teams={match.blueTeams} score={match.blueScore} expected={predictMatch(match).blueExpectedScore} probability={predictMatch(match).blueWinProbability} onTeam={onTeam} played={match.played} />
    </div>
  );
}

function Advancement({ onTeam }: { onTeam: (team: Team) => void }) {
  return (
    <div className="advancement-list">
      {advancement.map((slot) => (
        <button className={`advancement-row ${slot.status}`} key={`${slot.team}-${slot.source}`} onClick={() => onTeam(getTeam(slot.team))}>
          <span><strong>{slot.team}</strong> {getTeam(slot.team).name}</span>
          <small>{slot.source} - {slot.status}</small>
          <p>{slot.explanation}</p>
        </button>
      ))}
    </div>
  );
}

function RecordPanel({
  title,
  rows,
  onTeam,
  onEvent,
}: {
  title: string;
  rows: { match: Match; label: string; teams: number[] }[];
  onTeam: (team: Team) => void;
  onEvent: (event: Event) => void;
}) {
  return (
    <Panel title={title} icon={<Sparkles />}>
      <div className="list">
        {rows.map((row) => {
          const event = events.find((item) => item.code === row.match.eventCode);
          return (
            <div className="record-row" key={`${title}-${row.match.id}-${row.teams.join("-")}`}>
              <button className="record-title" onClick={() => event && onEvent(event)}>
                <strong>{row.label}</strong>
                <small>{event ? event.name : row.match.eventCode} - {labelMatch(row.match)}</small>
              </button>
              <div>{row.teams.map((team) => <TeamButton key={team} number={team} onTeam={onTeam} />)}</div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function TeamButton({ number, onTeam }: { number: number; onTeam: (team: Team) => void }) {
  return <button className="team-link" onClick={() => onTeam(getTeam(number))}>{number}</button>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
