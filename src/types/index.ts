export interface User {
  id: string
  name: string
  phone: string
  isAdmin?: boolean
}

export interface Pool {
  id: string
  name: string
  code: string
  memberCount?: number
  isOwner?: boolean
}

export interface Game {
  id: string
  number: number
  group: string
  matchDate: string
  team1: string
  team2: string
  score1: number | null
  score2: number | null
  penalty1: number | null
  penalty2: number | null
}

export interface Prediction {
  id: string
  gameId: string
  score1: number
  score2: number
  points: number | null
  isLocked: boolean
  game: Game
}

export interface RankingEntry {
  position: number
  userId: string
  name: string
  totalPoints: number
  exactScores: number
  correctResults: number
  lockedCount: number
  isHidden: boolean
}

export interface DailySummaryPrediction {
  userId: string
  name: string
  score1: number | null
  score2: number | null
  points: number
}

export interface DailySummaryGame {
  number: number
  team1: string
  team2: string
  score1: number
  score2: number
  matchDate: string
  predictions: DailySummaryPrediction[]
}

export interface DailySummaryRankingEntry {
  position: number
  previousPosition: number
  movement: number
  userId: string
  name: string
  totalPoints: number
  todayPoints: number
  exactScores: number
}

export interface DailySummary {
  date: string
  poolName: string
  games: DailySummaryGame[]
  ranking: DailySummaryRankingEntry[]
}

export interface RankingStatsOpponent {
  userId: string
  name: string
  currentRank: number
  gap: number
  maxGain: number
  canOvertake: boolean
  canReach: boolean
}

export interface PodiumOdds {
  first: number
  second: number
  third: number
  top3: number
}

export interface RankingStatsMember {
  userId: string
  name: string
  currentPoints: number
  exactScores: number
  position: number
  maxAdditionalPoints: number
  bestPossibleRank: number
  opponents: RankingStatsOpponent[]
  podiumOdds: PodiumOdds | null
}

export interface RankingStats {
  phase: 'grupos' | 'knockout'
  remainingGamesCount: number
  hasOdds: boolean
  members: RankingStatsMember[]
}
