import { epaRatings, matches, rankings, teams } from "../data/mockData";
import type { AllianceColor, EloTeam, Match, MatchPrediction, Team } from "../types";

const BASE_NORM_EPA = 1500;
const FTC_ALLIANCE_SIZE = 2;
const DEFAULT_WEEK_ONE_STD_DEV = 42;

export function getTeam(number: number): Team {
  return teams.find((team) => team.number === number) ?? {
    number,
    name: `Team ${number}`,
    city: "Unknown",
    state: "",
    rookieYear: 0,
  };
}

export function labelMatch(match: Match): string {
  const level = match.compLevel === "qm" ? "Qual" : match.compLevel === "sf" ? `Semi ${match.setNumber}` : "Final";
  return `${level} Match ${match.matchNumber}`;
}

export function allianceElo(teamNumbers: number[], epa: Map<number, number>): number {
  return Math.round(teamNumbers.reduce((sum, team) => sum + (epa.get(team) ?? initialTeamEpa()), 0));
}

export function predictMatch(match: Match, epa = calculateEloMap()): MatchPrediction {
  const redExpectedScore = allianceElo(match.redTeams, epa);
  const blueExpectedScore = allianceElo(match.blueTeams, epa);
  const predictedMargin = redExpectedScore - blueExpectedScore;
  const unitlessMargin = (250 * predictedMargin) / weekOneScoreStdDev();
  const redWinProbability = 1 / (1 + Math.pow(10, -unitlessMargin / 400));

  return {
    redWinProbability,
    blueWinProbability: 1 - redWinProbability,
    redExpectedScore,
    blueExpectedScore,
  };
}

export function calculateEloMap(): Map<number, number> {
  const epa = new Map<number, number>();
  const qualCounts = new Map<number, number>();
  teams.forEach((team) => {
    epa.set(team.number, initialTeamEpa());
    qualCounts.set(team.number, 0);
  });

  playedMatches().forEach((match) => {
    const redEpa = allianceElo(match.redTeams, epa);
    const blueEpa = allianceElo(match.blueTeams, epa);

    updateAllianceEpa(epa, qualCounts, match.redTeams, match.redScore, redEpa, match.blueScore, blueEpa, match.compLevel);
    updateAllianceEpa(epa, qualCounts, match.blueTeams, match.blueScore, blueEpa, match.redScore, redEpa, match.compLevel);
  });

  return epa;
}

export function getEloLeaderboard(): EloTeam[] {
  if (epaRatings.length > 0) {
    const ratingsByTeam = new Map(epaRatings.map((rating) => [rating.team, rating]));
    const teamsByNumber = new Map(teams.map((team) => [team.number, team]));
    const ratedTeams = epaRatings.map((rating) => rating.team);
    const teamNumbers = Array.from(new Set([...teams.map((team) => team.number), ...ratedTeams]));

    return teamNumbers
      .map((teamNumber) => {
        const team = teamsByNumber.get(teamNumber) ?? getTeam(teamNumber);
        const rating = ratingsByTeam.get(teamNumber);
        return {
          ...team,
          name: rating?.name ?? team.name,
          city: rating?.city ?? team.city,
          state: rating?.state ?? team.state,
          rookieYear: rating?.rookieYear ?? team.rookieYear,
          epa: rating?.epa ?? 0,
          elo: rating?.normEpa ?? BASE_NORM_EPA,
          normEpa: rating?.normEpa ?? BASE_NORM_EPA,
          trend: rating?.trend ?? 0,
          record: rating?.record ?? "0-0-0",
        };
      })
      .sort((a, b) => b.elo - a.elo);
  }

  const epa = calculateEloMap();
  const records = buildRecords();

  return teams
    .map((team) => ({
      ...team,
      epa: roundOne(epa.get(team.number) ?? initialTeamEpa()),
      elo: Math.round(normalizeEpa(epa.get(team.number) ?? initialTeamEpa())),
      normEpa: Math.round(normalizeEpa(epa.get(team.number) ?? initialTeamEpa())),
      trend: roundOne((epa.get(team.number) ?? initialTeamEpa()) - initialTeamEpa()),
      record: records.get(team.number) ?? "0-0-0",
    }))
    .sort((a, b) => b.elo - a.elo);
}

export function getAllianceLeaderboard() {
  const epa = calculateEloMap();
  const pairings = new Map<string, { teams: number[]; matches: number; elo: number; averageScore: number; wins: number }>();

  playedMatches().forEach((match) => {
    recordAlliance(pairings, match.redTeams, match.redScore > match.blueScore, match.redScore, epa);
    recordAlliance(pairings, match.blueTeams, match.blueScore > match.redScore, match.blueScore, epa);
  });

  return Array.from(pairings.values())
    .map((entry) => ({
      ...entry,
      averageScore: Math.round(entry.averageScore / entry.matches),
      winRate: entry.wins / entry.matches,
    }))
    .sort((a, b) => b.elo - a.elo);
}

export function getPredictedSeeds() {
  const epa = calculateEloMap();
  return rankings
    .map((ranking) => {
      const teamEpa = epa.get(ranking.team) ?? initialTeamEpa();
      const remaining = matches.filter((match) => !match.played && [...match.redTeams, ...match.blueTeams].includes(ranking.team));
      const expectedWins = remaining.reduce((sum, match) => {
        const prediction = predictMatch(match, epa);
        const isRed = match.redTeams.includes(ranking.team);
        return sum + (isRed ? prediction.redWinProbability : prediction.blueWinProbability);
      }, 0);

      return {
        team: ranking.team,
        currentRank: ranking.rank,
        projectedRankScore: ranking.rankingPoints + expectedWins * 2 + (teamEpa - initialTeamEpa()) / 9,
        qualificationOdds: qualificationOdds(teamEpa, ranking.rank),
      };
    })
    .sort((a, b) => b.projectedRankScore - a.projectedRankScore)
    .map((seed, index) => ({ ...seed, predictedSeed: index + 1 }));
}

export function getBotworthyMatches() {
  const played = playedMatches();
  const withCombined = [...played].sort((a, b) => b.redScore + b.blueScore - (a.redScore + a.blueScore));
  const withAlliance = [...played].flatMap((match) => [
    allianceRecord(match, "red"),
    allianceRecord(match, "blue"),
  ]);

  return {
    highestCombined: withCombined.slice(0, 5),
    highestCleanAlliance: [...withAlliance].sort((a, b) => b.cleanScore - a.cleanScore).slice(0, 5),
    highestWithFouls: [...withAlliance].sort((a, b) => b.score - a.score).slice(0, 5),
  };
}

function playedMatches(): Match[] {
  return matches.filter((match) => match.played);
}

function buildRecords(): Map<number, string> {
  const records = new Map<number, { wins: number; losses: number; ties: number }>();
  teams.forEach((team) => records.set(team.number, { wins: 0, losses: 0, ties: 0 }));

  playedMatches().forEach((match) => {
    const redResult = match.redScore === match.blueScore ? "tie" : match.redScore > match.blueScore ? "win" : "loss";
    match.redTeams.forEach((team) => applyRecord(records, team, redResult));
    match.blueTeams.forEach((team) => applyRecord(records, team, redResult === "win" ? "loss" : redResult === "loss" ? "win" : "tie"));
  });

  return new Map(Array.from(records).map(([team, record]) => [team, `${record.wins}-${record.losses}-${record.ties}`]));
}

function applyRecord(records: Map<number, { wins: number; losses: number; ties: number }>, team: number, result: "win" | "loss" | "tie") {
  const record = records.get(team) ?? { wins: 0, losses: 0, ties: 0 };
  if (result === "win") record.wins += 1;
  if (result === "loss") record.losses += 1;
  if (result === "tie") record.ties += 1;
  records.set(team, record);
}

function recordAlliance(
  pairings: Map<string, { teams: number[]; matches: number; elo: number; averageScore: number; wins: number }>,
  teamNumbers: number[],
  won: boolean,
  score: number,
  epa: Map<number, number>,
) {
  const key = [...teamNumbers].sort((a, b) => a - b).join("-");
  const current = pairings.get(key) ?? { teams: teamNumbers, matches: 0, elo: allianceElo(teamNumbers, epa), averageScore: 0, wins: 0 };
  current.matches += 1;
  current.averageScore += score;
  current.wins += won ? 1 : 0;
  pairings.set(key, current);
}

function qualificationOdds(epa: number, currentRank: number): number {
  const strength = 1 / (1 + Math.pow(10, (initialTeamEpa() - epa) / 18));
  const rankPressure = Math.max(0.18, 1 - (currentRank - 1) * 0.08);
  return Math.min(0.98, Math.max(0.03, strength * rankPressure + 0.18));
}

function updateAllianceEpa(
  epa: Map<number, number>,
  qualCounts: Map<number, number>,
  teamNumbers: number[],
  allianceScore: number,
  allianceEpa: number,
  opponentScore: number,
  opponentEpa: number,
  compLevel: Match["compLevel"],
) {
  teamNumbers.forEach((team) => {
    const qualMatches = qualCounts.get(team) ?? 0;
    const k = compLevel === "qm" ? epaK(qualMatches) : 0.12;
    const margin = marginWeight(qualMatches);
    const scoreResidual = allianceScore - allianceEpa;
    const opponentResidual = opponentScore - opponentEpa;
    const delta = (k / (1 + margin)) * (scoreResidual - margin * opponentResidual);
    epa.set(team, roundOne((epa.get(team) ?? initialTeamEpa()) + delta));
    if (compLevel === "qm") qualCounts.set(team, qualMatches + 1);
  });
}

function epaK(qualMatches: number): number {
  if (qualMatches <= 6) return 0.5;
  if (qualMatches <= 12) return 0.5 - (1 / 30) * (qualMatches - 6);
  return 0.3;
}

function marginWeight(qualMatches: number): number {
  if (qualMatches <= 12) return 0;
  if (qualMatches <= 36) return (qualMatches - 12) / 24;
  return 1;
}

function initialTeamEpa(): number {
  return roundOne(weekOneAverageScore() / FTC_ALLIANCE_SIZE);
}

function weekOneAverageScore(): number {
  const played = playedMatches();
  return played.reduce((sum, match) => sum + match.redScore + match.blueScore, 0) / Math.max(1, played.length * 2);
}

function weekOneScoreStdDev(): number {
  const scores = playedMatches().flatMap((match) => [match.redScore, match.blueScore]);
  const mean = scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length);
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / Math.max(1, scores.length);
  return Math.max(DEFAULT_WEEK_ONE_STD_DEV, Math.sqrt(variance));
}

function normalizeEpa(epa: number): number {
  return BASE_NORM_EPA + (250 * (epa - initialTeamEpa())) / weekOneScoreStdDev();
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function allianceRecord(match: Match, color: AllianceColor) {
  const score = color === "red" ? match.redScore : match.blueScore;
  const opponentFouls = color === "red" ? match.blueFoul : match.redFoul;
  const teams = color === "red" ? match.redTeams : match.blueTeams;

  return {
    match,
    color,
    teams,
    score,
    cleanScore: score - opponentFouls,
  };
}
