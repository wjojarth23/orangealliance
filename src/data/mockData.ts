import type { AdvancementSlot, EpaRating, Event, Match, Ranking, Season, Team } from "../types";

export const seasons: Season[] = [
  { year: 2025, name: "DECODE" },
  { year: 2024, name: "INTO THE DEEP" },
  { year: 2023, name: "CENTERSTAGE" },
  { year: 2022, name: "POWERPLAY" },
];

export const teams: Team[] = [
  { number: 7244, name: "Out of the Box Robotics", city: "Austin", state: "TX", rookieYear: 2013 },
  { number: 18368, name: "Roaring Robotics", city: "Houston", state: "TX", rookieYear: 2020 },
  { number: 11212, name: "Clutch Robotics", city: "Plano", state: "TX", rookieYear: 2016 },
  { number: 14361, name: "Circuit Breakers", city: "Dallas", state: "TX", rookieYear: 2018 },
  { number: 12928, name: "LightSPEED", city: "San Antonio", state: "TX", rookieYear: 2017 },
  { number: 16072, name: "Quantum Turtles", city: "Round Rock", state: "TX", rookieYear: 2019 },
  { number: 5155, name: "Robot Uprising", city: "The Woodlands", state: "TX", rookieYear: 2011 },
  { number: 14840, name: "The Java Bots", city: "Frisco", state: "TX", rookieYear: 2018 },
  { number: 19589, name: "Static Surge", city: "Waco", state: "TX", rookieYear: 2021 },
  { number: 1002, name: "CircuitRunners", city: "Atlanta", state: "GA", rookieYear: 2008 },
  { number: 9794, name: "Wizards.exe", city: "Denver", state: "CO", rookieYear: 2015 },
  { number: 21447, name: "Voltage Vortex", city: "Phoenix", state: "AZ", rookieYear: 2022 },
];

export const events: Event[] = [
  {
    code: "TXAUS",
    year: 2025,
    name: "Austin Metro Qualifier",
    city: "Austin",
    state: "TX",
    startDate: "2025-12-06",
    endDate: "2025-12-07",
    type: "Qualifier",
  },
  {
    code: "TXCMP",
    year: 2025,
    name: "Texas FTC Championship",
    city: "Houston",
    state: "TX",
    startDate: "2026-02-20",
    endDate: "2026-02-22",
    type: "State Championship",
  },
  {
    code: "COQ01",
    year: 2024,
    name: "Front Range Qualifier",
    city: "Denver",
    state: "CO",
    startDate: "2024-11-16",
    endDate: "2024-11-16",
    type: "Qualifier",
  },
];

export const matches: Match[] = [
  { id: "2025TXAUS_qm1", eventCode: "TXAUS", year: 2025, compLevel: "qm", setNumber: 1, matchNumber: 1, redTeams: [7244, 18368], blueTeams: [11212, 14361], redScore: 186, blueScore: 151, redFoul: 10, blueFoul: 5, played: true },
  { id: "2025TXAUS_qm2", eventCode: "TXAUS", year: 2025, compLevel: "qm", setNumber: 1, matchNumber: 2, redTeams: [12928, 16072], blueTeams: [5155, 14840], redScore: 138, blueScore: 171, redFoul: 0, blueFoul: 15, played: true },
  { id: "2025TXAUS_qm3", eventCode: "TXAUS", year: 2025, compLevel: "qm", setNumber: 1, matchNumber: 3, redTeams: [19589, 1002], blueTeams: [9794, 21447], redScore: 162, blueScore: 158, redFoul: 5, blueFoul: 5, played: true },
  { id: "2025TXAUS_qm4", eventCode: "TXAUS", year: 2025, compLevel: "qm", setNumber: 1, matchNumber: 4, redTeams: [7244, 11212], blueTeams: [5155, 12928], redScore: 205, blueScore: 188, redFoul: 20, blueFoul: 0, played: true },
  { id: "2025TXAUS_qm5", eventCode: "TXAUS", year: 2025, compLevel: "qm", setNumber: 1, matchNumber: 5, redTeams: [18368, 14361], blueTeams: [16072, 14840], redScore: 147, blueScore: 169, redFoul: 0, blueFoul: 10, played: true },
  { id: "2025TXAUS_qm6", eventCode: "TXAUS", year: 2025, compLevel: "qm", setNumber: 1, matchNumber: 6, redTeams: [7244, 5155], blueTeams: [18368, 11212], redScore: 0, blueScore: 0, redFoul: 0, blueFoul: 0, played: false },
  { id: "2025TXAUS_sf1m1", eventCode: "TXAUS", year: 2025, compLevel: "sf", setNumber: 1, matchNumber: 1, redTeams: [7244, 14840], blueTeams: [5155, 11212], redScore: 212, blueScore: 197, redFoul: 5, blueFoul: 15, played: true },
  { id: "2025TXAUS_sf2m1", eventCode: "TXAUS", year: 2025, compLevel: "sf", setNumber: 2, matchNumber: 1, redTeams: [18368, 12928], blueTeams: [16072, 14361], redScore: 165, blueScore: 174, redFoul: 10, blueFoul: 0, played: true },
  { id: "2025TXAUS_f1m1", eventCode: "TXAUS", year: 2025, compLevel: "f", setNumber: 1, matchNumber: 1, redTeams: [7244, 14840], blueTeams: [16072, 14361], redScore: 221, blueScore: 193, redFoul: 0, blueFoul: 10, played: true },
];

export const rankings: Ranking[] = [
  { team: 7244, rank: 1, wins: 3, losses: 0, ties: 0, rankingPoints: 8, tieBreaker1: 198, tieBreaker2: 41 },
  { team: 14840, rank: 2, wins: 2, losses: 1, ties: 0, rankingPoints: 6, tieBreaker1: 174, tieBreaker2: 37 },
  { team: 5155, rank: 3, wins: 2, losses: 1, ties: 0, rankingPoints: 6, tieBreaker1: 171, tieBreaker2: 31 },
  { team: 11212, rank: 4, wins: 1, losses: 2, ties: 0, rankingPoints: 4, tieBreaker1: 179, tieBreaker2: 28 },
  { team: 16072, rank: 5, wins: 1, losses: 2, ties: 0, rankingPoints: 4, tieBreaker1: 166, tieBreaker2: 25 },
  { team: 18368, rank: 6, wins: 1, losses: 2, ties: 0, rankingPoints: 4, tieBreaker1: 164, tieBreaker2: 21 },
  { team: 14361, rank: 7, wins: 1, losses: 2, ties: 0, rankingPoints: 3, tieBreaker1: 159, tieBreaker2: 19 },
  { team: 12928, rank: 8, wins: 0, losses: 3, ties: 0, rankingPoints: 2, tieBreaker1: 151, tieBreaker2: 18 },
];

export const advancement: AdvancementSlot[] = [
  { team: 7244, source: "Winning Alliance", status: "clinched", explanation: "Captain of the event winning alliance; advances first by robot performance." },
  { team: 14840, source: "Winning Alliance", status: "clinched", explanation: "First pick on the winning alliance; advances with the alliance." },
  { team: 16072, source: "Finalist Alliance", status: "projected", explanation: "Projected to advance if this event receives finalist advancement slots." },
  { team: 11212, source: "Inspire Award", status: "clinched", explanation: "Inspire Award advancement takes priority over judged award tiebreakers." },
  { team: 5155, source: "Rank", status: "bubble", explanation: "Currently next by rank after removing teams already advancing from higher-priority paths." },
];

export const epaRatings: EpaRating[] = [];

export type AppData = {
  seasons?: Season[];
  teams?: Team[];
  events?: Event[];
  matches?: Match[];
  rankings?: Ranking[];
  advancement?: AdvancementSlot[];
  epaRatings?: EpaRating[];
};

export function replaceData(data: AppData) {
  replaceArray(seasons, data.seasons);
  replaceArray(teams, data.teams);
  replaceArray(events, data.events);
  replaceArray(matches, data.matches);
  replaceArray(rankings, data.rankings);
  replaceArray(advancement, data.advancement);
  replaceArray(epaRatings, data.epaRatings);
}

export function mergeData(data: AppData) {
  mergeArray(seasons, data.seasons, (season) => season.year);
  mergeArray(teams, data.teams, (team) => team.number);
  mergeArray(events, data.events, (event) => event.code);
  mergeArray(matches, data.matches, (match) => match.id);
  mergeArray(rankings, data.rankings, (ranking) => ranking.team);
  mergeArray(advancement, data.advancement, (slot) => `${slot.team}-${slot.source}`);
  mergeArray(epaRatings, data.epaRatings, (rating) => rating.team);
}

function replaceArray<T>(target: T[], source?: T[]) {
  if (!source) return;
  target.splice(0, target.length, ...source);
}

function mergeArray<T>(target: T[], source: T[] | undefined, getKey: (item: T) => string | number) {
  if (!source) return;
  const positions = new Map(target.map((item, index) => [getKey(item), index]));
  source.forEach((item) => {
    const key = getKey(item);
    const position = positions.get(key);
    if (position === undefined) {
      positions.set(key, target.length);
      target.push(item);
    } else {
      target[position] = item;
    }
  });
}
