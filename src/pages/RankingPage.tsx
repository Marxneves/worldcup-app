import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { RankingEntry, Game, Prediction, Pool } from '../types'
import FlagImage, { TEAM_ABBR } from '../components/FlagImage'

function getMedalEmoji(position: number): string {
  if (position === 1) return '🥇'
  if (position === 2) return '🥈'
  if (position === 3) return '🥉'
  return `${position}º`
}

interface GameCardProps {
  game: Game
  dateStr?: string
  prediction?: Prediction
}

function GameCard({ game, dateStr, prediction }: GameCardProps) {
  return (
    <div className="card p-3">
      {dateStr && (
        <p className="text-xs text-copa-gold font-bold text-center mb-2">
          Grupo {game.group} · {dateStr}
        </p>
      )}
      <div className="flex items-center justify-center gap-3">
        <div className="flex items-center gap-1.5">
          <FlagImage team={game.team1} size={22} className="shrink-0" />
          <span className="text-sm font-semibold text-white">{TEAM_ABBR[game.team1] ?? game.team1}</span>
        </div>
        <span className="text-sm font-bold text-white px-1">
          {game.score1 !== null ? `${game.score1} × ${game.score2}` : '-'}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-white">{TEAM_ABBR[game.team2] ?? game.team2}</span>
          <FlagImage team={game.team2} size={22} className="shrink-0" />
        </div>
      </div>
      {prediction && game.score1 !== null && (
        <div className={`mt-2 text-center text-xs py-1 rounded-lg font-medium ${
          prediction.points === 3
            ? 'bg-copa-green/15 text-copa-green'
            : prediction.points === 1
            ? 'bg-copa-gold/15 text-copa-gold'
            : 'bg-red-500/10 text-copa-red'
        }`}>
          Meu palpite: {prediction.score1} × {prediction.score2}
        </div>
      )}
      {prediction && game.score1 === null && (
        <p className="text-xs text-slate-500 text-center mt-2">
          Meu palpite: {prediction.score1} × {prediction.score2}
        </p>
      )}
    </div>
  )
}

export default function RankingPage() {
  const { poolCode } = useParams<{ poolCode: string }>()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<'ranking' | 'games'>('ranking')

  const { data: rankingData, isLoading: rankingLoading } = useQuery({
    queryKey: ['ranking', poolCode],
    queryFn: async () => {
      const { data } = await api.get(`/pools/${poolCode}/ranking`)
      return data as { poolName: string; rankings: RankingEntry[] }
    },
    refetchInterval: 60_000,
  })

  const { data: gamesData } = useQuery({
    queryKey: ['games'],
    queryFn: async () => {
      const { data } = await api.get('/games')
      return data.games as Game[]
    },
  })

  const { data: poolData } = useQuery({
    queryKey: ['pool', poolCode],
    queryFn: async () => {
      const { data } = await api.get(`/pools/${poolCode}`)
      return data.pool as Pool
    },
    enabled: !!poolCode,
  })

  const { data: predictionsData } = useQuery({
    queryKey: ['predictions', poolCode],
    queryFn: async () => {
      const { data } = await api.get('/predictions', { params: { poolId: poolData!.id } })
      return data.predictions as Prediction[]
    },
    enabled: !!poolData?.id,
  })

  const myPredictions = new Map(predictionsData?.map(p => [p.gameId, p]) ?? [])
  const isLocked = predictionsData?.some(p => p.isLocked) ?? false
  const filledCount = predictionsData?.length ?? 0
  const totalGames = gamesData?.length ?? 0

  const upcomingGames = gamesData?.filter(g => g.score1 === null).slice(0, 5) ?? []
  const finishedGames = gamesData?.filter(g => g.score1 !== null) ?? []

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 bg-copa-dark sticky top-0 z-10 border-b border-copa-border">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-lg font-extrabold text-white">
              {rankingData?.poolName ?? 'Bolão'}
            </h1>
            <p className="text-slate-400 text-xs">Código: <span className="font-mono text-copa-gold">{poolCode}</span></p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/predictions/${poolCode}`)}
              className="text-xs bg-copa-gold/10 text-copa-gold border border-copa-gold/30 px-3 py-1.5 rounded-full font-semibold"
            >
              {isLocked ? '🔒 Palpites' : filledCount === 0 ? '✏️ Preencher' : `✏️ ${filledCount}/${totalGames}`}
            </button>
            <button onClick={logout} className="text-slate-500 text-sm">Sair</button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === 'ranking' ? 'bg-copa-gold text-copa-dark' : 'text-slate-400'
            }`}
            onClick={() => setActiveTab('ranking')}
          >
            🏆 Ranking
          </button>
          <button
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === 'games' ? 'bg-copa-gold text-copa-dark' : 'text-slate-400'
            }`}
            onClick={() => setActiveTab('games')}
          >
            📅 Jogos
          </button>
        </div>
      </div>

      <div className="px-5 mt-5">
        {activeTab === 'ranking' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {rankingLoading ? (
              <div className="text-center text-slate-500 py-12">Carregando ranking...</div>
            ) : (
              <div className="space-y-3">
                {rankingData?.rankings.map((entry, index) => (
                  <motion.div
                    key={entry.userId}
                    className={`card p-4 ${entry.userId === user?.id ? 'border-copa-gold/40' : ''}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl w-10 text-center">{getMedalEmoji(index + 1)}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold truncate ${entry.userId === user?.id ? 'text-copa-gold' : 'text-white'}`}>
                          {entry.name} {entry.userId === user?.id ? '(você)' : ''}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {entry.exactScores} placar exato · {entry.correctResults} resultado certo
                          {entry.lockedCount < totalGames && (
                            <span className="text-slate-500"> · {entry.lockedCount}/{totalGames} palpites</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-extrabold text-white">{entry.totalPoints}</p>
                        <p className="text-xs text-slate-500">pts</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'games' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {upcomingGames.length > 0 && (
              <>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Próximos jogos</h3>
                <div className="space-y-2 mb-6">
                  {upcomingGames.map(game => {
                    const prediction = myPredictions.get(game.id)
                    const matchDate = new Date(game.matchDate)
                    const dateStr = matchDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', weekday: 'short' })
                    return (
                      <GameCard
                        key={game.id}
                        game={game}
                        dateStr={dateStr}
                        prediction={prediction}
                      />
                    )
                  })}
                </div>
              </>
            )}

            {finishedGames.length > 0 && (
              <>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Resultados</h3>
                <div className="space-y-2">
                  {finishedGames.map(game => {
                    const prediction = myPredictions.get(game.id)
                    return (
                      <GameCard
                        key={game.id}
                        game={game}
                        prediction={prediction}
                      />
                    )
                  })}
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
