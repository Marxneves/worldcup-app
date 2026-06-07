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
  userId: string
  name: string
  totalPoints: number
  exactScores: number
  correctResults: number
  lockedCount: number
}
