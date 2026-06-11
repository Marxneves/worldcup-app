import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import html2canvas from 'html2canvas'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { RankingEntry, Game, Prediction, Pool, DailySummary } from '../types'
import FlagImage, { TEAM_ABBR, FLAG_CODES } from '../components/FlagImage'
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
  isAdmin?: boolean
  onSaveResult?: (gameNumber: number, score1: number, score2: number) => Promise<void>
}

function GameCard({ game, dateStr, prediction, isAdmin, onSaveResult }: GameCardProps) {
  const [editing, setEditing] = useState(false)
  const [editScore1, setEditScore1] = useState(game.score1 !== null ? String(game.score1) : '')
  const [editScore2, setEditScore2] = useState(game.score2 !== null ? String(game.score2) : '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  async function handleSave() {
    if (!onSaveResult || editScore1 === '' || editScore2 === '') return
    setSaving(true)
    setSaveError('')
    try {
      await onSaveResult(game.number, Number(editScore1), Number(editScore2))
      setEditing(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setSaveError(msg || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

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
        {isAdmin && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="ml-1 text-xs text-slate-400 hover:text-copa-gold transition-colors"
            title="Editar resultado"
          >
            ✏️
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 pt-3 border-t border-copa-border">
          <div className="flex items-center gap-2 justify-center">
            <input
              type="number"
              min="0"
              value={editScore1}
              onChange={e => setEditScore1(e.target.value)}
              className="score-input w-12 h-10 text-center text-lg font-bold rounded-xl"
            />
            <span className="text-slate-600 font-bold">×</span>
            <input
              type="number"
              min="0"
              value={editScore2}
              onChange={e => setEditScore2(e.target.value)}
              className="score-input w-12 h-10 text-center text-lg font-bold rounded-xl"
            />
            <button
              onClick={handleSave}
              disabled={saving || editScore1 === '' || editScore2 === ''}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-opacity"
              style={{ backgroundColor: '#FFD100', color: '#1a1a1a', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? '...' : 'Salvar'}
            </button>
            <button
              onClick={() => { setEditing(false); setSaveError('') }}
              className="text-slate-400 text-xs"
            >
              Cancelar
            </button>
          </div>
          {saveError && <p className="text-copa-red text-xs text-center mt-1">{saveError}</p>}
        </div>
      )}

      {prediction && game.score1 !== null && (
        <div className={`mt-2 text-center text-xs py-1 rounded-lg font-medium ${
          prediction.points === 3
            ? 'bg-copa-menta/15 text-copa-teal'
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
  const [activeTab, setActiveTab] = useState<'ranking' | 'games' | 'summary'>('ranking')
  const [selectedEntry, setSelectedEntry] = useState<RankingEntry | null>(null)
  const [upcomingExpanded, setUpcomingExpanded] = useState(true)
  const [resultsExpanded, setResultsExpanded] = useState(true)
  const [summaryDate, setSummaryDate] = useState(() =>
    new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
  )
  const [sharing, setSharing] = useState(false)
  const summaryRef = useRef<HTMLDivElement>(null)

  const queryClient = useQueryClient()

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['daily-summary', poolCode, summaryDate],
    queryFn: async () => {
      const { data } = await api.get(`/pools/${poolCode}/daily-summary`, { params: { date: summaryDate } })
      return data as DailySummary
    },
    enabled: activeTab === 'summary' && !!poolCode,
  })

  async function handleShare() {
    if (!summaryRef.current) return
    setSharing(true)
    try {
      const canvas = await html2canvas(summaryRef.current, {
        backgroundColor: '#F5EDD0',
        scale: 2,
        useCORS: true,
        logging: false,
      })
      canvas.toBlob(blob => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `resumo-${summaryDate}.png`
        link.click()
        URL.revokeObjectURL(url)
      }, 'image/png')
    } finally {
      setSharing(false)
    }
  }

  async function handleSaveResult(gameNumber: number, score1: number, score2: number) {
    await api.post('/admin/results', { gameNumber, score1, score2 })
    await queryClient.invalidateQueries({ queryKey: ['games'] })
    await queryClient.invalidateQueries({ queryKey: ['ranking', poolCode] })
    await queryClient.invalidateQueries({ queryKey: ['predictions', poolCode] })
  }

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
  const isAllLocked = (predictionsData?.some(p => p.isLocked) ?? false)

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
          {user?.isAdmin && (
            <button
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === 'summary' ? 'bg-copa-gold text-copa-dark' : 'text-slate-600'
              }`}
              onClick={() => setActiveTab('summary')}
            >
              📊 Resumo
            </button>
          )}
        </div>
      </div>

      <div className="px-5 mt-5">
        {activeTab === 'ranking' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {!isAllLocked && (
              <div className="card p-4 flex items-start gap-3 mb-4">
                <span className="text-xl shrink-0">🔒</span>
                <div className="flex-1 min-w-0">
                  <p className="text-copa-dark font-bold text-sm">Confirme seus palpites</p>
                  <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">
                    Para ver os palpites dos outros participantes, finalize os seus primeiro.
                  </p>
                  <button
                    onClick={() => navigate(`/predictions/${poolCode}`)}
                    className="mt-2 text-xs bg-copa-gold/10 text-copa-gold border border-copa-gold/30 px-3 py-1.5 rounded-full font-semibold"
                  >
                    ✏️ Ir para palpites
                  </button>
                </div>
              </div>
            )}
            {rankingLoading ? (
              <div className="text-center text-slate-600 py-12">Carregando ranking...</div>
            ) : (
              <div className="space-y-3">
                {rankingData?.rankings.map((entry, index) => {
                  const hasFilledPredictions = entry.lockedCount > 0
                  const canViewPredictions = isAllLocked && hasFilledPredictions
                  return (
                    <motion.div
                      key={entry.userId}
                      className={`card p-4 ${canViewPredictions ? 'cursor-pointer active:opacity-70' : 'cursor-default'} ${entry.userId === user?.id ? 'border-copa-gold/40' : ''}`}
                      onClick={() => { if (canViewPredictions) setSelectedEntry(entry) }}
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
                          {hasFilledPredictions ? (
                            <p className="text-xs text-slate-600 mt-0.5">
                              {entry.exactScores} placar exato · {entry.correctResults} resultado certo
                              {entry.lockedCount < totalGames && (
                                <span className="text-slate-600"> · {entry.lockedCount}/{totalGames} palpites</span>
                              )}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-400 mt-0.5 italic">Palpites ainda não preenchidos</p>
                          )}
                        </div>
                        {hasFilledPredictions && (
                          <div className="text-right">
                            <p className="text-2xl font-extrabold text-copa-dark">{entry.totalPoints}</p>
                            <p className="text-xs text-slate-600">pts</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'summary' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center justify-between mb-4">
              <input
                type="date"
                value={summaryDate}
                onChange={e => setSummaryDate(e.target.value)}
                className="text-sm border border-copa-border rounded-lg px-3 py-1.5 bg-white text-copa-dark"
              />
              <button
                onClick={handleShare}
                disabled={sharing || summaryLoading || !summaryData}
                className="flex items-center gap-1.5 bg-copa-teal text-white text-sm font-semibold px-4 py-1.5 rounded-xl disabled:opacity-50"
              >
                {sharing ? '⏳' : '📤'} Compartilhar
              </button>
            </div>

            {summaryLoading && (
              <div className="text-center text-slate-600 py-12">Carregando resumo...</div>
            )}

            {!summaryLoading && summaryData && (
              <div ref={summaryRef} style={{ backgroundColor: '#F5EDD0', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {summaryData.games.length === 0 && (
                  <div style={{ backgroundColor: '#FFFDF5', border: '1px solid #D9CBAD', borderRadius: 0, padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
                    Nenhum jogo com resultado nessa data.
                  </div>
                )}

                {summaryData.games.map(game => (
                  <div key={game.number} style={{ backgroundColor: '#FFFDF5', border: '1px solid #D9CBAD', borderRadius: 0, overflow: 'hidden' }}>
                    {/* Cabeçalho do jogo */}
                    <div style={{ borderBottom: '1px solid #D9CBAD', padding: '10px 16px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
                        <tbody>
                          <tr>
                            <td style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
                              Jogo {game.number}
                            </td>
                            <td style={{ fontSize: 11, color: '#64748b', textAlign: 'right' }}>
                              {new Date(game.matchDate).toLocaleString('pt-BR', {
                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                                timeZone: 'America/Sao_Paulo',
                              })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr>
                            <td style={{ textAlign: 'right', width: '40%', paddingRight: 8, verticalAlign: 'middle' }}>
                              <img
                                src={`/flags/${FLAG_CODES[game.team1]}.png`}
                                alt={game.team1}
                                width={20}
                                height={20}
                                style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}
                              />
                              <span style={{ fontWeight: 700, color: '#1a1a1a', fontSize: 14, verticalAlign: 'middle' }}>
                                {TEAM_ABBR[game.team1] ?? game.team1}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', width: '20%', verticalAlign: 'middle' }}>
                              <span style={{ fontSize: 20, fontWeight: 900, color: '#1a1a1a', fontVariantNumeric: 'tabular-nums' }}>
                                {game.score1} × {game.score2}
                              </span>
                            </td>
                            <td style={{ textAlign: 'left', width: '40%', paddingLeft: 8, verticalAlign: 'middle' }}>
                              <span style={{ fontWeight: 700, color: '#1a1a1a', fontSize: 14, verticalAlign: 'middle' }}>
                                {TEAM_ABBR[game.team2] ?? game.team2}
                              </span>
                              <img
                                src={`/flags/${FLAG_CODES[game.team2]}.png`}
                                alt={game.team2}
                                width={20}
                                height={20}
                                style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 4 }}
                              />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Palpites */}
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        {game.predictions.map((pred, idx) => {
                          const bgColor = pred.points === 3
                            ? 'rgba(0,254,168,0.12)'
                            : pred.points === 1
                            ? 'rgba(255,209,0,0.12)'
                            : 'transparent'
                          const badgeStyle = pred.points === 3
                            ? { backgroundColor: 'rgba(0,254,168,0.2)', color: '#295A71' }
                            : pred.points === 1
                            ? { backgroundColor: 'rgba(255,209,0,0.2)', color: '#B8960A' }
                            : { backgroundColor: 'rgba(230,57,70,0.1)', color: '#e63946' }

                          return (
                            <tr key={pred.userId} style={{ backgroundColor: bgColor, borderTop: idx > 0 ? '1px solid #D9CBAD' : 'none' }}>
                              <td style={{ padding: '10px 16px', fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
                                {pred.name}
                              </td>
                              <td style={{ padding: '10px 8px', fontSize: 14, color: '#475569', textAlign: 'center', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                                {pred.score1 !== null ? `${pred.score1} × ${pred.score2}` : '—'}
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                <span style={{ ...badgeStyle, fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                                  {pred.points === 3 ? '+3 pts' : pred.points === 1 ? '+1 pt' : '0 pts'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}

                {summaryData.games.length > 0 && (
                  <div style={{ backgroundColor: '#FFFDF5', border: '1px solid #D9CBAD', borderRadius: 0, overflow: 'hidden' }}>
                    <div style={{ borderBottom: '1px solid #D9CBAD', padding: '10px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
                        Ranking geral
                      </span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #D9CBAD' }}>
                          <th style={{ textAlign: 'left', padding: '8px 16px', fontSize: 11, color: '#64748b', fontWeight: 600, width: 48 }}>#</th>
                          <th style={{ textAlign: 'left', padding: '8px 8px', fontSize: 11, color: '#64748b', fontWeight: 600 }}>Participante</th>
                          <th style={{ textAlign: 'center', padding: '8px 8px', fontSize: 11, color: '#64748b', fontWeight: 600, width: 56 }}>Hoje</th>
                          <th style={{ textAlign: 'center', padding: '8px 16px', fontSize: 11, color: '#64748b', fontWeight: 600, width: 56 }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summaryData.ranking.map((entry, idx) => {
                          const moved = entry.movement
                          const movementIcon = moved > 0 ? '▲' : moved < 0 ? '▼' : ''
                          const movementColor = moved > 0 ? '#22c55e' : moved < 0 ? '#e63946' : 'transparent'
                          const nameColor = entry.userId === user?.id ? '#FFD100' : '#1a1a1a'

                          return (
                            <tr key={entry.userId} style={{ borderTop: idx > 0 ? '1px solid #D9CBAD' : 'none', backgroundColor: entry.userId === user?.id ? 'rgba(255,209,0,0.05)' : 'transparent' }}>
                              <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                                <span style={{ fontWeight: 900, color: '#1a1a1a', fontVariantNumeric: 'tabular-nums' }}>{entry.position}º</span>
                                {movementIcon && (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: movementColor, marginLeft: 3 }}>{movementIcon}</span>
                                )}
                              </td>
                              <td style={{ padding: '10px 8px', fontWeight: 600, color: nameColor }}>{entry.name}</td>
                              <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#295A71', fontVariantNumeric: 'tabular-nums' }}>
                                {entry.todayPoints > 0 ? `+${entry.todayPoints}` : '—'}
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                                <span style={{ fontWeight: 900, color: '#1a1a1a', fontVariantNumeric: 'tabular-nums' }}>{entry.totalPoints}</span>
                                <span style={{ fontSize: 11, color: '#64748b', marginLeft: 2 }}>pts</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
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
                          isAdmin={user?.isAdmin}
                          onSaveResult={handleSaveResult}
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
                          isAdmin={user?.isAdmin}
                          onSaveResult={handleSaveResult}
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
                            const ptsColor = pts === 3 ? '#295A71' : pts === 1 ? '#FFD100' : '#e63946'
                            return (
                              <div key={pred.id}>
                                {idx > 0 && <div style={{ height: 1, backgroundColor: '#D9CBAD' }} />}
                                <div className="p-3 relative">
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="font-semibold text-copa-dark text-right flex-1 flex items-center justify-end gap-1">
                                      {TEAM_ABBR[pred.game.team1] ?? pred.game.team1}
                                      <FlagImage team={pred.game.team1} size={16} />
                                    </span>
                                    <span className="font-extrabold text-copa-dark shrink-0 tabular-nums">
                                      {pred.score1} × {pred.score2}
                                    </span>
                                    <span className="font-semibold text-copa-dark flex-1 flex items-center gap-1">
                                      <FlagImage team={pred.game.team2} size={16} />
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
