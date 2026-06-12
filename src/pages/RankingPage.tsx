import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import domtoimage from 'dom-to-image-more'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { useBrazilDay } from '../hooks/useBrazilDay'
import { RankingEntry, Game, Prediction, Pool, DailySummary } from '../types'
import FlagImage, { TEAM_ABBR, FLAG_CODES } from '../components/FlagImage'
import CopyButton from '../components/CopyButton'

function LockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle' }}>
      <rect x="2" y="8" width="12" height="7" rx="1.5" />
      <path d="M5 8V5.5a3 3 0 016 0V8" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v9" />
      <path d="M5 5l3-3 3 3" />
      <path d="M3 11v2a1 1 0 001 1h8a1 1 0 001-1v-2" />
    </svg>
  )
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
    <div className="card p-3" style={{ borderRadius: 0 }}>
      {dateStr && (
        <p className="text-xs text-copa-gold font-bold text-center mb-2">
          Grupo {game.group} · {dateStr}
        </p>
      )}
      <div className="flex items-center justify-center gap-3">
        <div className="flex items-center gap-1.5">
          <FlagImage team={game.team1} size={16} className="shrink-0" />
          <span className="text-sm font-semibold text-copa-dark">{TEAM_ABBR[game.team1] ?? game.team1}</span>
        </div>
        <span className="text-sm font-bold text-copa-dark px-1">
          {game.score1 !== null ? `${game.score1} × ${game.score2}` : '-'}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-copa-dark">{TEAM_ABBR[game.team2] ?? game.team2}</span>
          <FlagImage team={game.team2} size={16} className="shrink-0" />
        </div>
        {isAdmin && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="ml-1 text-xs text-slate-400 hover:text-copa-gold transition-colors"
            title="Editar resultado"
          >
            editar
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
  const isBrazilDay = useBrazilDay()
  const [activeTab, setActiveTab] = useState<'ranking' | 'games' | 'summary'>('ranking')
  const [selectedEntry, setSelectedEntry] = useState<RankingEntry | null>(null)
  const [upcomingExpanded, setUpcomingExpanded] = useState(true)
  const [resultsExpanded, setResultsExpanded] = useState(true)
  const todayBRT = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const [summaryDate, setSummaryDate] = useState(() => todayBRT)
  const [sharing, setSharing] = useState(false)
  const [selectedGameNumber, setSelectedGameNumber] = useState<number | null>(null)
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

  useEffect(() => { setSelectedGameNumber(null) }, [summaryDate])

  const { data: gameRankingData } = useQuery({
    queryKey: ['daily-summary', poolCode, summaryDate, selectedGameNumber],
    queryFn: async () => {
      const { data } = await api.get(`/pools/${poolCode}/daily-summary`, {
        params: { date: summaryDate, upToGame: selectedGameNumber },
      })
      return data as DailySummary
    },
    enabled: activeTab === 'summary' && !!poolCode && selectedGameNumber !== null,
  })

  async function handleShare() {
    if (!summaryRef.current) return
    setSharing(true)
    try {
      const dataUrl = await domtoimage.toPng(summaryRef.current, {
        bgcolor: '#F5EDD0',
        scale: 2,
      })
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `resumo-${summaryDate}.png`
      link.click()
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

  const activeData = selectedGameNumber !== null ? gameRankingData : summaryData
  const visibleGames = activeData?.games ?? []
  const visibleRanking = activeData?.ranking ?? []

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 sticky top-0 z-10 border-b border-copa-border bg-copa-cream">
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
              {isAllLocked ? <span className="flex items-center gap-1"><LockIcon /> Palpites</span> : filledCount === 0 ? 'Preencher' : `${filledCount}/${totalGames}`}
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
            Ranking
          </button>
          <button
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === 'games' ? 'bg-copa-gold text-copa-dark' : 'text-slate-600'
            }`}
            onClick={() => setActiveTab('games')}
          >
            Jogos
          </button>
          <button
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === 'summary' ? 'bg-copa-gold text-copa-dark' : 'text-slate-600'
            }`}
            onClick={() => setActiveTab('summary')}
          >
            Resumo
          </button>
        </div>
      </div>

      <div className="px-5 mt-5">
        {activeTab === 'ranking' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {!isAllLocked && (
              <div className="card p-4 flex items-start gap-3 mb-4">
                <div className="flex-1 min-w-0">
                  <p className="text-copa-dark font-bold text-sm">Confirme seus palpites</p>
                  <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">
                    Para ver os palpites dos outros participantes, finalize os seus primeiro.
                  </p>
                  <button
                    onClick={() => navigate(`/predictions/${poolCode}`)}
                    className="mt-2 text-xs bg-copa-gold/10 text-copa-gold border border-copa-gold/30 px-3 py-1.5 rounded-full font-semibold"
                  >
                    Ir para palpites
                  </button>
                </div>
              </div>
            )}
            {rankingLoading ? (
              <div className="text-center text-slate-600 py-12">Carregando ranking...</div>
            ) : (
              <div className="card overflow-hidden" style={{ borderRadius: 0 }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-copa-border">
                      <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-semibold w-10">#</th>
                      <th className="text-left px-2 py-2.5 text-xs text-slate-500 font-semibold">Participante</th>
                      <th className="text-center px-4 py-2.5 text-xs text-slate-500 font-semibold w-16">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingData?.rankings.map((entry, index) => {
                      const hasFilledPredictions = entry.lockedCount > 0
                      const canViewPredictions = isAllLocked && hasFilledPredictions
                      return (
                        <tr
                          key={entry.userId}
                          className={`border-t border-copa-border ${canViewPredictions ? 'cursor-pointer active:opacity-70' : 'cursor-default'} ${entry.userId === user?.id ? 'bg-copa-gold/5' : ''}`}
                          onClick={() => { if (canViewPredictions) setSelectedEntry(entry) }}
                        >
                          <td className="px-4 py-3 font-extrabold text-copa-dark tabular-nums">{index + 1}º</td>
                          <td className="px-2 py-3">
                            <p className={`font-bold ${entry.userId === user?.id ? 'text-copa-gold' : 'text-copa-dark'}`}>
                              {entry.name} {entry.userId === user?.id ? '(você)' : ''}
                            </p>
                            {hasFilledPredictions ? (
                              <p className="text-xs text-slate-500 mt-0.5">
                                {entry.exactScores} exato · {entry.correctResults} resultado certo
                              </p>
                            ) : (
                              <p className="text-xs text-slate-400 mt-0.5 italic">Palpites não preenchidos</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {hasFilledPredictions && (
                              <>
                                <span className="text-xl font-extrabold text-copa-dark tabular-nums">{entry.totalPoints}</span>
                                <span className="text-xs text-slate-500 ml-0.5">pts</span>
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'summary' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center justify-between mb-3">
              <input
                type="date"
                value={summaryDate}

                onChange={e => setSummaryDate(e.target.value)}
                className="text-sm border border-copa-border rounded-lg px-3 py-1.5 bg-copa-card text-copa-dark"
              />
              <button
                onClick={handleShare}
                disabled={sharing || summaryLoading || !summaryData || summaryData.games.length === 0}
                className="text-copa-teal disabled:opacity-40 transition-opacity p-1"
                style={{ background: 'none', border: 'none' }}
              >
                <ShareIcon />
              </button>
            </div>

            {summaryData && summaryData.games.length > 1 && (
              <div className="flex gap-2 mb-4 flex-wrap">
                <button
                  onClick={() => setSelectedGameNumber(null)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${selectedGameNumber === null ? 'bg-copa-teal text-white border-copa-teal' : 'bg-copa-card text-copa-dark border-copa-border'}`}
                >
                  Todos
                </button>
                {summaryData.games.map(g => (
                  <button
                    key={g.number}
                    onClick={() => setSelectedGameNumber(g.number)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${selectedGameNumber === g.number ? 'bg-copa-teal text-white border-copa-teal' : 'bg-copa-card text-copa-dark border-copa-border'}`}
                  >
                    Jogo {g.number}
                  </button>
                ))}
              </div>
            )}

            {summaryLoading && (
              <div className="text-center text-slate-600 py-12">Carregando resumo...</div>
            )}

            {!summaryLoading && summaryData && (
              <div ref={summaryRef} style={{ backgroundColor: '#F5EDD0', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {summaryData.games.length === 0 && (
                  <div style={{ backgroundColor: '#FFFDF5', border: '1px solid #D9CBAD', borderRadius: 0, padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
                    Nenhum jogo nessa data.
                  </div>
                )}

                {visibleGames.map(game => (
                  <table key={game.number} style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#FFFDF5', border: '1px solid #D9CBAD' }}>
                    <tbody>
                      {/* Meta: Jogo X e horário */}
                      <tr>
                        <td colSpan={3} style={{ paddingTop: 10, paddingBottom: 4, paddingLeft: 16, paddingRight: 16 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody><tr>
                              <td style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>Jogo {game.number}</td>
                              <td style={{ fontSize: 11, color: '#64748b', textAlign: 'right' }}>
                                {new Date(game.matchDate).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
                              </td>
                            </tr></tbody>
                          </table>
                        </td>
                      </tr>

                      {/* Placar — img inline com verticalAlign:middle, abordagem mais confiável no html2canvas */}
                      <tr style={{ borderBottom: '1px solid #D9CBAD' }}>
                        <td style={{ textAlign: 'right', paddingTop: 10, paddingBottom: 10, paddingLeft: 16, paddingRight: 8, whiteSpace: 'nowrap' }}>
                          {FLAG_CODES[game.team1] && (
                            <img
                              src={`/flags/${FLAG_CODES[game.team1]}.png`}
                              crossOrigin="anonymous"
                              width={FLAG_CODES[game.team1] === 'ch' ? 14 : 21}
                              height={14}
                              style={{ verticalAlign: 'middle', marginRight: 4, display: 'inline' }}
                            />
                          )}
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#1a1a1a', verticalAlign: 'middle' }}>
                            {TEAM_ABBR[game.team1] ?? game.team1}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', paddingTop: 10, paddingBottom: 10, paddingLeft: 6, paddingRight: 6, width: 80, whiteSpace: 'nowrap', fontSize: 22, fontWeight: 900, color: '#1a1a1a' }}>
                          {game.score1 !== null ? `${game.score1} × ${game.score2}` : '—'}
                        </td>
                        <td style={{ textAlign: 'left', paddingTop: 10, paddingBottom: 10, paddingLeft: 8, paddingRight: 16, whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#1a1a1a', verticalAlign: 'middle' }}>
                            {TEAM_ABBR[game.team2] ?? game.team2}
                          </span>
                          {FLAG_CODES[game.team2] && (
                            <img
                              src={`/flags/${FLAG_CODES[game.team2]}.png`}
                              crossOrigin="anonymous"
                              width={FLAG_CODES[game.team2] === 'ch' ? 14 : 21}
                              height={14}
                              style={{ verticalAlign: 'middle', marginLeft: 4, display: 'inline' }}
                            />
                          )}
                        </td>
                      </tr>

                      {/* Palpites — mesmas 3 colunas, placar alinha com o do jogo */}
                      {game.predictions.map((pred, idx) => {
                        const hasResult = game.score1 !== null
                        const bgColor = hasResult
                          ? (pred.points === 3 ? 'rgba(0,254,168,0.12)' : pred.points === 1 ? 'rgba(255,209,0,0.12)' : 'transparent')
                          : 'transparent'
                        const ptsColor = pred.points === 3 ? '#295A71' : pred.points === 1 ? '#B8960A' : '#e63946'
                        const firstName = pred.name.split(' ')[0]
                        return (
                          <tr key={pred.userId} style={{ backgroundColor: bgColor, borderTop: idx === 0 ? 'none' : '1px solid #D9CBAD' }}>
                            <td style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 16, paddingRight: 8, fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
                              {firstName}
                            </td>
                            <td style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 6, paddingRight: 6, fontSize: 14, color: '#475569', textAlign: 'center', whiteSpace: 'nowrap', width: 80 }}>
                              {pred.score1 !== null ? `${pred.score1} × ${pred.score2}` : '—'}
                            </td>
                            <td style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 8, paddingRight: 16, fontSize: 13, fontWeight: 700, color: ptsColor, textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {hasResult ? (pred.points === 3 ? '+3 pts' : pred.points === 1 ? '+1 pt' : '0 pts') : ''}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ))}

                {visibleGames.length > 0 && (
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
                          <th style={{ textAlign: 'center', padding: '8px 8px', fontSize: 11, color: '#64748b', fontWeight: 600, width: 56 }}>Jogo</th>
                          <th style={{ textAlign: 'center', padding: '8px 16px', fontSize: 11, color: '#64748b', fontWeight: 600, width: 56 }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRanking.map((entry, idx) => {
                          const moved = entry.movement
                          const movementIcon = moved > 0 ? '▲' : moved < 0 ? '▼' : ''
                          const movementColor = moved > 0 ? '#22c55e' : moved < 0 ? '#e63946' : 'transparent'
                          return (
                            <tr key={entry.userId} style={{ borderTop: idx > 0 ? '1px solid #D9CBAD' : 'none' }}>
                              <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                                <span style={{ fontWeight: 900, color: '#1a1a1a', fontVariantNumeric: 'tabular-nums' }}>{entry.position}º</span>
                                {movementIcon && (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: movementColor, marginLeft: 3 }}>{movementIcon}</span>
                                )}
                              </td>
                              <td style={{ padding: '10px 8px', fontWeight: 600, color: '#1a1a1a' }}>{entry.name}</td>
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
                  className="flex items-center justify-between w-full text-xs font-bold uppercase tracking-wider text-copa-dark mb-3 py-1"
                  onClick={() => setUpcomingExpanded(v => !v)}
                >
                  <span style={{ color: isBrazilDay ? '#000080' : undefined }}>Próximos jogos <span className="text-copa-gold" style={{ color: isBrazilDay ? '#000080' : undefined }}>({upcomingGames.length})</span></span>
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
                  className="flex items-center justify-between w-full text-xs font-bold uppercase tracking-wider text-copa-dark mb-3 py-1"
                  onClick={() => setResultsExpanded(v => !v)}
                >
                  <span style={{ color: isBrazilDay ? '#000080' : undefined }}>Resultados <span className="text-copa-gold" style={{ color: isBrazilDay ? '#000080' : undefined }}>({finishedGames.length})</span></span>
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
              style={{ backgroundColor: 'rgb(var(--copa-cream))' }}
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
                        <div className="card overflow-hidden" style={{ borderRadius: 0 }}>
                          {byGroup[group].map((pred, idx) => {
                            const pts = pred.game.score1 !== null ? pred.points : null
                            const ptsBg = pts === 3 ? 'rgba(0,254,168,0.15)' : pts === 1 ? 'rgba(255,209,0,0.15)' : 'rgba(230,57,70,0.1)'
                            const ptsColor = pts === 3 ? '#295A71' : pts === 1 ? '#FFD100' : '#e63946'
                            return (
                              <div key={pred.id}>
                                {idx > 0 && <div style={{ height: 1, backgroundColor: '#D9CBAD' }} />}
                                <div className="p-3 relative">
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="font-semibold text-copa-dark flex-1 flex items-center justify-end gap-1.5">
                                      <FlagImage team={pred.game.team1} size={16} />
                                      {TEAM_ABBR[pred.game.team1] ?? pred.game.team1}
                                    </span>
                                    <div className="shrink-0 text-center tabular-nums font-extrabold text-copa-dark" style={{ minWidth: 56 }}>
                                      {pred.score1} × {pred.score2}
                                    </div>
                                    <span className="font-semibold text-copa-dark flex-1 flex items-center gap-1.5">
                                      {TEAM_ABBR[pred.game.team2] ?? pred.game.team2}
                                      <FlagImage team={pred.game.team2} size={16} />
                                    </span>
                                  </div>
                                  {pred.game.score1 !== null && (
                                    <div className="flex items-center gap-2 text-xs mt-0.5">
                                      <div className="flex-1 text-right font-semibold" style={{ color: '#295A71' }}>Resultado</div>
                                      <div className="shrink-0 tabular-nums font-semibold text-center" style={{ minWidth: 56, color: '#295A71' }}>
                                        {pred.game.score1} × {pred.game.score2}
                                      </div>
                                      <div className="flex-1" />
                                    </div>
                                  )}
                                  {pts !== null && pts !== undefined && (
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: ptsBg, color: ptsColor }}>
                                      +{pts}pts
                                    </span>
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
