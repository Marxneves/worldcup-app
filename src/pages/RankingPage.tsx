import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { RankingEntry, Game, Prediction, Pool } from '../types'
import FlagImage, { TEAM_ABBR } from '../components/FlagImage'
import CopyButton from '../components/CopyButton'

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
          <span className="text-sm font-semibold text-copa-dark">{TEAM_ABBR[game.team1] ?? game.team1}</span>
        </div>
        <span className="text-sm font-bold text-copa-dark px-1">
          {game.score1 !== null ? `${game.score1} × ${game.score2}` : '-'}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-copa-dark">{TEAM_ABBR[game.team2] ?? game.team2}</span>
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
        <p className="text-xs text-slate-600 text-center mt-2">
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
  const [selectedEntry, setSelectedEntry] = useState<RankingEntry | null>(null)
  const [upcomingExpanded, setUpcomingExpanded] = useState(true)
  const [resultsExpanded, setResultsExpanded] = useState(true)

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

  const { data: viewPredictions, isLoading: viewLoading } = useQuery({
    queryKey: ['predictions-user', selectedEntry?.userId, poolData?.id],
    queryFn: async () => {
      const { data } = await api.get(`/predictions/user/${selectedEntry!.userId}`, {
        params: { poolId: poolData!.id },
      })
      return data.predictions as Prediction[]
    },
    enabled: !!selectedEntry && !!poolData?.id,
  })

  const myPredictions = new Map(predictionsData?.map(p => [p.gameId, p]) ?? [])
  const totalGames = gamesData?.length ?? 0
  const filledCount = predictionsData?.length ?? 0
  const isAllLocked = filledCount >= totalGames && totalGames > 0 && (predictionsData?.every(p => p.isLocked) ?? false)

  const upcomingGames = gamesData?.filter(g => g.score1 === null) ?? []
  const finishedGames = gamesData?.filter(g => g.score1 !== null) ?? []

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 sticky top-0 z-10 border-b border-copa-border" style={{ backgroundColor: '#F5EDD0' }}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <button
              onClick={() => navigate('/pools')}
              className="text-xs text-slate-600 mb-1 flex items-center gap-1"
            >
              ← Meus bolões
            </button>
            <h1 className="text-lg font-extrabold text-copa-dark">
              {rankingData?.poolName ?? 'Bolão'}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-slate-600 text-xs">Código:</span>
              <span className="font-mono text-copa-gold text-xs">{poolCode}</span>
              <CopyButton text={poolCode ?? ''} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/predictions/${poolCode}`)}
              className="text-xs bg-copa-gold/10 text-copa-gold border border-copa-gold/30 px-3 py-1.5 rounded-full font-semibold"
            >
              {isAllLocked ? '🔒 Palpites' : filledCount === 0 ? '✏️ Preencher' : `✏️ ${filledCount}/${totalGames}`}
            </button>
            <button onClick={logout} className="text-slate-600 text-sm">Sair</button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === 'ranking' ? 'bg-copa-gold text-copa-dark' : 'text-slate-600'
            }`}
            onClick={() => setActiveTab('ranking')}
          >
            🏆 Ranking
          </button>
          <button
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === 'games' ? 'bg-copa-gold text-copa-dark' : 'text-slate-600'
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
            {!isAllLocked && (
              <div className="card p-6 text-center mb-4">
                <p className="text-3xl mb-3">🔒</p>
                <p className="text-copa-dark font-bold mb-1">Ranking bloqueado</p>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Finalize seus palpites para ver a classificação dos outros participantes.
                </p>
                <button
                  onClick={() => navigate(`/predictions/${poolCode}`)}
                  className="mt-4 text-sm bg-copa-gold/10 text-copa-gold border border-copa-gold/30 px-4 py-2 rounded-full font-semibold"
                >
                  ✏️ Ir para palpites
                </button>
              </div>
            )}
            {rankingLoading ? (
              <div className="text-center text-slate-600 py-12">Carregando ranking...</div>
            ) : !isAllLocked ? null : (
              <div className="space-y-3">
                {rankingData?.rankings.map((entry, index) => (
                  <motion.div
                    key={entry.userId}
                    className={`card p-4 cursor-pointer active:opacity-70 ${entry.userId === user?.id ? 'border-copa-gold/40' : ''}`}
                    onClick={() => setSelectedEntry(entry)}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl w-10 text-center">{getMedalEmoji(index + 1)}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold truncate ${entry.userId === user?.id ? 'text-copa-gold' : 'text-copa-dark'}`}>
                          {entry.name} {entry.userId === user?.id ? '(você)' : ''}
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {entry.exactScores} placar exato · {entry.correctResults} resultado certo
                          {entry.lockedCount < totalGames && (
                            <span className="text-slate-600"> · {entry.lockedCount}/{totalGames} palpites</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-extrabold text-copa-dark">{entry.totalPoints}</p>
                        <p className="text-xs text-slate-600">pts</p>
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
              <div className="mb-4">
                <button
                  className="flex items-center justify-between w-full text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 py-1"
                  onClick={() => setUpcomingExpanded(v => !v)}
                >
                  <span>Próximos jogos <span className="text-copa-gold">({upcomingGames.length})</span></span>
                  <span className="text-base leading-none">{upcomingExpanded ? '▾' : '▸'}</span>
                </button>
                {upcomingExpanded && (
                  <div className="space-y-2">
                    {upcomingGames.map(game => {
                      const prediction = myPredictions.get(game.id)
                      const matchDate = new Date(game.matchDate)
                      const dateStr = matchDate.toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
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
                )}
              </div>
            )}

            {finishedGames.length > 0 && (
              <div>
                <button
                  className="flex items-center justify-between w-full text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 py-1"
                  onClick={() => setResultsExpanded(v => !v)}
                >
                  <span>Resultados <span className="text-copa-gold">({finishedGames.length})</span></span>
                  <span className="text-base leading-none">{resultsExpanded ? '▾' : '▸'}</span>
                </button>
                {resultsExpanded && (
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
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {selectedEntry && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col justify-end"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedEntry(null)}
          >
            <motion.div
              className="rounded-t-3xl p-5 pb-10 max-h-[85vh] overflow-y-auto"
              style={{ backgroundColor: '#F5EDD0' }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 35 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-lg font-extrabold text-copa-dark">
                    {selectedEntry.name} {selectedEntry.userId === user?.id ? '(você)' : ''}
                  </p>
                  <p className="text-sm text-slate-600">
                    {selectedEntry.exactScores} placar exato · {selectedEntry.correctResults} resultado certo
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="text-right">
                    <p className="text-2xl font-extrabold text-copa-dark">{selectedEntry.totalPoints}</p>
                    <p className="text-xs text-slate-600">pts</p>
                  </div>
                  <button onClick={() => setSelectedEntry(null)} className="text-slate-600 text-xl leading-none pb-1">✕</button>
                </div>
              </div>

              {viewLoading ? (
                <div className="text-center text-slate-600 py-8">Carregando palpites...</div>
              ) : viewPredictions ? (
                <div className="space-y-4">
                  {(() => {
                    const byGroup: Record<string, Prediction[]> = {}
                    for (const pred of viewPredictions) {
                      const g = pred.game.group
                      if (!byGroup[g]) byGroup[g] = []
                      byGroup[g].push(pred)
                    }
                    return Object.keys(byGroup).sort().map(group => (
                      <div key={group}>
                        <p className="text-xs font-bold uppercase tracking-wider text-copa-gold mb-2">
                          Grupo {group}
                        </p>
                        <div className="card overflow-hidden">
                          {byGroup[group].map((pred, idx) => {
                            const pts = pred.game.score1 !== null ? pred.points : null
                            const ptsBg = pts === 3 ? 'rgba(0,254,168,0.15)' : pts === 1 ? 'rgba(255,209,0,0.15)' : 'rgba(230,57,70,0.1)'
                            const ptsColor = pts === 3 ? '#00FEA8' : pts === 1 ? '#FFD100' : '#e63946'
                            return (
                              <div key={pred.id}>
                                {idx > 0 && <div style={{ height: 1, backgroundColor: '#D9CBAD' }} />}
                                <div className="p-3 relative">
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="font-semibold text-copa-dark text-right flex-1">
                                      {TEAM_ABBR[pred.game.team1] ?? pred.game.team1}
                                    </span>
                                    <span className="font-extrabold text-copa-dark shrink-0 tabular-nums">
                                      {pred.score1} × {pred.score2}
                                    </span>
                                    <span className="font-semibold text-copa-dark flex-1">
                                      {TEAM_ABBR[pred.game.team2] ?? pred.game.team2}
                                    </span>
                                  </div>
                                  {pts !== null && pts !== undefined && (
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: ptsBg, color: ptsColor }}>
                                      +{pts}pts
                                    </span>
                                  )}
                                  {pred.game.score1 !== null && (
                                    <p className="text-xs text-center mt-1" style={{ color: '#295A71' }}>
                                      Resultado: {pred.game.score1} × {pred.game.score2}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
