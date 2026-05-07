export type AllianceColor = "red" | "blue";

export type Team = {
  number: number;
  name: string;
  city: string;
  state: string;
  rookieYear: number;
};

export type Season = {
  year: number;
  name: string;
};

export type Event = {
  code: string;
  year: number;
  name: string;
  city: string;
  state: string;
  startDate: string;
  endDate: string;
  type: "Qualifier" | "League Tournament" | "State Championship" | "World Championship";
};

export type Match = {
  id: string;
  eventCode: string;
  year: number;
  compLevel: "qm" | "sf" | "f";
  setNumber: number;
  matchNumber: number;
  redTeams: number[];
  blueTeams: number[];
  redScore: number;
  blueScore: number;
  redFoul: number;
  blueFoul: number;
  played: boolean;
};

export type Ranking = {
  team: number;
  rank: number;
  wins: number;
  losses: number;
  ties: number;
  rankingPoints: number;
  tieBreaker1: number;
  tieBreaker2: number;
};

export type AdvancementSlot = {
  team: number;
  source: "Winning Alliance" | "Finalist Alliance" | "Inspire Award" | "Think Award" | "Rank";
  status: "clinched" | "projected" | "bubble";
  explanation: string;
};

export type EloTeam = Team & {
  elo: number;
  epa?: number;
  normEpa?: number;
  record: string;
  trend: number;
};

export type EpaRating = {
  team: number;
  name?: string;
  city?: string;
  state?: string;
  rookieYear?: number;
  epa: number;
  normEpa: number;
  record: string;
  trend: number;
};

export type MatchPrediction = {
  redWinProbability: number;
  blueWinProbability: number;
  redExpectedScore: number;
  blueExpectedScore: number;
};
