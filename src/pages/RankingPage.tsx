import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import domtoimage from 'dom-to-image-more'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { RankingEntry, Game, Prediction, Pool, DailySummary, DailySummaryRankingEntry, RankingStats } from '../types'
import FlagImage, { TEAM_ABBR, FLAG_CODES } from '../components/FlagImage'
import CopyButton from '../components/CopyButton'
import ManageMembersModal from '../components/ManageMembersModal'
import GamesTab from '../components/GamesTab'

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

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <motion.div
        style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '3px solid #D9CBAD',
          borderTopColor: '#FFD100',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 0.75, repeat: Infinity, ease: 'linear' }}
      />
      <p className="text-sm text-slate-500">Carregando...</p>
    </div>
  )
}

function getOutcome(s1: number, s2: number): 'home' | 'away' | 'draw' {
  if (s1 > s2) return 'home'
  if (s2 > s1) return 'away'
  return 'draw'
}

function computeSimPoints(predScore1: number, predScore2: number, realScore1: number, realScore2: number): number {
  if (predScore1 === realScore1 && predScore2 === realScore2) return 3
  if (getOutcome(predScore1, predScore2) === getOutcome(realScore1, realScore2)) return 1
  return 0
}

function applyStandardRanking<T extends { totalPoints: number; exactScores: number }>(
  sorted: T[]
): Array<T & { position: number }> {
  const positions: number[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) {
      positions.push(1)
    } else if (
      sorted[i].totalPoints === sorted[i - 1].totalPoints &&
      sorted[i].exactScores === sorted[i - 1].exactScores
    ) {
      positions.push(positions[i - 1])
    } else {
      positions.push(i + 1)
    }
  }
  return sorted.map((item, i) => ({ ...item, position: positions[i] }))
}


export default function RankingPage() {
  const { poolCode } = useParams<{ poolCode: string }>()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<'ranking' | 'games' | 'summary' | 'chances'>('ranking')
  const [selectedEntry, setSelectedEntry] = useState<RankingEntry | null>(null)
  const todayBRT = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const [summaryDate, setSummaryDate] = useState(() => todayBRT)
  const [sharing, setSharing] = useState(false)
  const [selectedGameNumber, setSelectedGameNumber] = useState<number | null>(null)
  const [simulatorMode, setSimulatorMode] = useState(false)
  const [simulatedScores, setSimulatedScores] = useState<Record<number, { score1: string; score2: string }>>({})
  const [liveScores, setLiveScores] = useState<Record<number, { score1: number; score2: number; timeElapsed: string }>>({})
  const [liveSyncError, setLiveSyncError] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncDone, setSyncDone] = useState(false)
  const [showCopyModal, setShowCopyModal] = useState(false)
  const summaryRef = useRef<HTMLDivElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoSelectedLiveRef = useRef(false)

  const queryClient = useQueryClient()

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['daily-summary', poolCode, summaryDate],
    queryFn: async () => {
      const { data } = await api.get(`/pools/${poolCode}/daily-summary`, { params: { date: summaryDate } })
      return data as DailySummary
    },
    enabled: activeTab === 'summary' && !!poolCode,
  })

  useEffect(() => {
    autoSelectedLiveRef.current = false
  }, [activeTab, summaryDate])

  useEffect(() => {
    setSelectedGameNumber(null)
    setSimulatorMode(false)
    setSimulatedScores({})
  }, [summaryDate])

  useEffect(() => {
    setSimulatedScores({})
  }, [selectedGameNumber])

  useEffect(() => {
    if (autoSelectedLiveRef.current) return
    if (activeTab !== 'summary') return
    if (!summaryData) return
    const liveGame = summaryData.games.find(g => liveScores[g.number])
    if (!liveGame) return
    setSelectedGameNumber(liveGame.number)
    autoSelectedLiveRef.current = true
  }, [liveScores, activeTab, summaryData])

  useEffect(() => {
    if (!simulatorMode) setSimulatedScores({})
  }, [simulatorMode])

  const fetchLiveScores = useCallback(async () => {
    try {
      const mockLive = new URLSearchParams(window.location.search).get('mockLive')
      const { data } = await api.get('/games/sync-live', { params: mockLive ? { mockLive } : undefined })
      const liveMap: Record<number, { score1: number; score2: number; timeElapsed: string }> = {}
      for (const ls of data.liveScores) {
        liveMap[ls.gameNumber] = ls
      }
      setLiveScores(liveMap)
      setLiveSyncError(null)
      queryClient.invalidateQueries({ queryKey: ['daily-summary', poolCode, summaryDate] })
      queryClient.invalidateQueries({ queryKey: ['games'] })
      return data.liveScores.length as number
    } catch (err) {
      setLiveSyncError(err instanceof Error ? err.message : String(err))
      return 0
    }
  }, [poolCode, summaryDate, queryClient])

  const handleManualSync = useCallback(async () => {
    setIsSyncing(true)
    setSyncDone(false)
    const [result] = await Promise.all([
      fetchLiveScores(),
      new Promise(resolve => setTimeout(resolve, 1000)),
    ])
    setIsSyncing(false)
    if (result !== undefined) {
      setSyncDone(true)
      setTimeout(() => setSyncDone(false), 2500)
    }
  }, [fetchLiveScores])

  useEffect(() => {
    if (liveIntervalRef.current) {
      clearInterval(liveIntervalRef.current)
      liveIntervalRef.current = null
    }

    setLiveScores({})
    setLiveSyncError(null)

    if (activeTab !== 'summary' || !poolCode || !summaryData) return

    const now = new Date()
    const hasPendingGames = summaryData.games.some(
      g => (g.score1 as number | null) === null && new Date(g.matchDate) <= now
    )
    if (!hasPendingGames) return

    const sync = async () => {
      const count = await fetchLiveScores()
      if (count > 0 && !liveIntervalRef.current) {
        liveIntervalRef.current = setInterval(sync, 30_000)
      } else if (count === 0 && liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current)
        liveIntervalRef.current = null
      }
    }

    sync()

    return () => {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current)
        liveIntervalRef.current = null
      }
    }
  }, [activeTab, poolCode, summaryDate, summaryData, fetchLiveScores])

  const { data: gameRankingData, isLoading: gameRankingLoading } = useQuery({
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
      const blob = await fetch(dataUrl).then(r => r.blob())
      const file = new File([blob], `resumo-${summaryDate}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Resumo ${summaryDate}` })
      } else {
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = `resumo-${summaryDate}.png`
        link.click()
      }
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
    refetchInterval: (query) => {
      const games = query.state.data
      if (!games) return false
      const now = new Date()
      const hasLiveGame = games.some(g => g.score1 === null && new Date(g.matchDate) <= now)
      return hasLiveGame ? 60_000 : false
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

  const { data: featureFlags } = useQuery({
    queryKey: ['features'],
    queryFn: async () => {
      const { data } = await api.get('/admin/features')
      return data as { statsEnabled: boolean }
    },
  })

  const [statsPhase, setStatsPhase] = useState<'grupos' | 'knockout'>('grupos')

  const { data: rankingStats, isLoading: statsLoading } = useQuery({
    queryKey: ['ranking-stats', poolCode, statsPhase],
    queryFn: async () => {
      const { data } = await api.get(`/pools/${poolCode}/ranking-stats`, { params: { phase: statsPhase } })
      return data as RankingStats
    },
    enabled: activeTab === 'chances' && !!poolCode,
  })

  const showStatsTab = user?.isAdmin || (featureFlags?.statsEnabled ?? false)

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

  const activeData = selectedGameNumber !== null ? gameRankingData : summaryData
  const visibleGames = activeData?.games ?? []
  const visibleRanking = activeData?.ranking ?? []

  const isSummaryLoading = summaryLoading || (selectedGameNumber !== null && gameRankingLoading)

  const hasUnfinishedGames = visibleGames.some(g => (g.score1 as number | null) === null)

  const resolveKnockoutTeam = useMemo(() => {
    return (name: string): string => {
      const match = name.match(/^(\d+)º Grupo ([A-L])$/)
      if (!match) return name
      const pos = parseInt(match[1], 10)
      const group = match[2]
      if (!gamesData) return name
      const groupGames = gamesData.filter(g => g.group === group && g.number < 73)
      const teamsMap = new Map<string, { pts: number; gd: number; gf: number }>()
      for (const g of groupGames) {
        for (const team of [g.team1, g.team2]) {
          if (!teamsMap.has(team)) teamsMap.set(team, { pts: 0, gd: 0, gf: 0 })
        }
        if (g.score1 === null || g.score2 === null) continue
        const s1 = g.score1 as number
        const s2 = g.score2 as number
        const t1 = teamsMap.get(g.team1)!
        const t2 = teamsMap.get(g.team2)!
        t1.gf += s1; t1.gd += s1 - s2
        t2.gf += s2; t2.gd += s2 - s1
        if (s1 > s2) { t1.pts += 3 }
        else if (s1 === s2) { t1.pts += 1; t2.pts += 1 }
        else { t2.pts += 3 }
      }
      const sorted = [...teamsMap.entries()]
        .sort(([nameA, a], [nameB, b]) =>
          b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || nameA.localeCompare(nameB)
        )
        .map(([team]) => team)
      return sorted[pos - 1] ?? name
    }
  }, [gamesData])

  useEffect(() => {
    if (!hasUnfinishedGames) setSimulatorMode(false)
  }, [hasUnfinishedGames])

  const simulatedRanking = useMemo((): Array<DailySummaryRankingEntry & { position: number }> | null => {
    if (!simulatorMode || !activeData) return null

    const { games, ranking } = activeData
    const hasAnyScore = Object.values(simulatedScores).some(s => s.score1 !== '' && s.score2 !== '')
    if (!hasAnyScore) return null

    const entries = ranking.map(entry => {
      const basePoints = entry.totalPoints - entry.todayPoints

      let scopeExactScores = 0
      games.forEach(game => {
        if ((game.score1 as number | null) !== null) {
          const pred = game.predictions.find(p => p.userId === entry.userId)
          if (pred?.points === 3) scopeExactScores++
        }
      })
      const baseExactScores = entry.exactScores - scopeExactScores

      let simTodayPoints = 0
      let simExactScores = baseExactScores

      games.forEach(game => {
        const pred = game.predictions.find(p => p.userId === entry.userId)
        if (!pred || pred.score1 === null) return

        if ((game.score1 as number | null) !== null) {
          simTodayPoints += pred.points ?? 0
          if (pred.points === 3) simExactScores++
        } else {
          const simScore = simulatedScores[game.number]
          if (simScore && simScore.score1 !== '' && simScore.score2 !== '') {
            const pts = computeSimPoints(pred.score1!, pred.score2!, Number(simScore.score1), Number(simScore.score2))
            simTodayPoints += pts
            if (pts === 3) simExactScores++
          }
        }
      })

      return {
        ...entry,
        totalPoints: basePoints + simTodayPoints,
        todayPoints: simTodayPoints,
        exactScores: simExactScores,
        movement: 0,
      }
    })

    entries.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
      return b.exactScores - a.exactScores
    })

    return applyStandardRanking(entries)
  }, [simulatorMode, activeData, simulatedScores])

  const liveRanking = useMemo((): Array<DailySummaryRankingEntry & { position: number }> | null => {
    if (!activeData || Object.keys(liveScores).length === 0) return null

    const { games, ranking } = activeData

    const entries = ranking.map(entry => {
      const basePoints = entry.totalPoints - entry.todayPoints

      let scopeExactScores = 0
      games.forEach(game => {
        if ((game.score1 as number | null) !== null) {
          const pred = game.predictions.find(p => p.userId === entry.userId)
          if (pred?.points === 3) scopeExactScores++
        }
      })
      const baseExactScores = entry.exactScores - scopeExactScores

      let liveTodayPoints = 0
      let liveExactScores = baseExactScores

      games.forEach(game => {
        const pred = game.predictions.find(p => p.userId === entry.userId)
        if (!pred || pred.score1 === null) return

        if ((game.score1 as number | null) !== null) {
          liveTodayPoints += pred.points ?? 0
          if (pred.points === 3) liveExactScores++
        } else {
          const live = liveScores[game.number]
          if (live) {
            const pts = computeSimPoints(pred.score1!, pred.score2!, live.score1, live.score2)
            liveTodayPoints += pts
            if (pts === 3) liveExactScores++
          }
        }
      })

      return {
        ...entry,
        totalPoints: basePoints + liveTodayPoints,
        todayPoints: liveTodayPoints,
        exactScores: liveExactScores,
        movement: 0,
      }
    })

    entries.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
      return b.exactScores - a.exactScores
    })

    return applyStandardRanking(entries)
  }, [activeData, liveScores])

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
          {showStatsTab && (
            <button
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === 'chances' ? 'bg-copa-gold text-copa-dark' : 'text-slate-600'
              }`}
              onClick={() => setActiveTab('chances')}
            >
              Projeção
            </button>
          )}
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
            {user?.isAdmin && poolData && (
              <div className="mb-3 flex justify-end">
                <button
                  onClick={() => setShowCopyModal(true)}
                  className="text-xs bg-copa-teal/10 text-copa-teal border border-copa-teal/30 px-3 py-1.5 rounded-full font-semibold"
                >
                  Gerenciar membros
                </button>
              </div>
            )}
            {rankingLoading ? (
              <div className="text-center text-slate-600 py-12">Carregando ranking...</div>
            ) : (
              <div className="card overflow-hidden" style={{ borderRadius: 16 }}>
                {rankingData?.rankings.map((entry, index) => {
                  const { rankings } = rankingData
                  const isFirstInTieGroup = index === 0 || rankings[index - 1].position !== entry.position
                  const isLastOfTop3 = entry.position <= 3 && (index === rankings.length - 1 || rankings[index + 1].position > 3)
                  const hasFilledPredictions = entry.lockedCount > 0
                  const canViewPredictions = isAllLocked && hasFilledPredictions
                  const isMe = entry.userId === user?.id

                  const MEDAL_COLORS = {
                    1: { bg: '#FFD100', text: '#1a1a1a', border: 'rgba(255,209,0,0.75)', rowBg: 'rgba(255,209,0,0.08)' },
                    2: { bg: '#94a3b8', text: '#fff',    border: 'rgba(148,163,184,0.5)', rowBg: 'rgba(148,163,184,0.07)' },
                    3: { bg: '#c97c3a', text: '#fff',    border: 'rgba(180,83,9,0.45)',   rowBg: 'rgba(180,83,9,0.05)' },
                  } as const
                  const medal = MEDAL_COLORS[entry.position as 1 | 2 | 3]
                  const isTop3 = !!medal

                  return (
                    <div
                      key={entry.userId}
                      className={canViewPredictions ? 'cursor-pointer active:opacity-70' : 'cursor-default'}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: isTop3 ? '13px 16px' : '9px 16px',
                        background: medal
                          ? isMe ? `rgba(${entry.position === 1 ? '255,209,0' : entry.position === 2 ? '148,163,184' : '180,83,9'},0.14)` : medal.rowBg
                          : isMe ? 'rgba(255,209,0,0.05)' : 'transparent',
                        borderLeft: medal ? `3px solid ${medal.border}` : '3px solid transparent',
                        borderBottom: isLastOfTop3
                          ? '2px solid rgb(var(--copa-border))'
                          : '1px solid rgb(var(--copa-border) / 0.6)',
                      }}
                      onClick={() => { if (canViewPredictions) setSelectedEntry(entry) }}
                    >
                      {isTop3 && isFirstInTieGroup ? (
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%',
                          background: medal.bg, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{ fontSize: 13, fontWeight: 900, color: medal.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                            {entry.position}
                          </span>
                        </div>
                      ) : (
                        <div style={{ width: 30, flexShrink: 0, textAlign: 'center' }}>
                          <span style={{
                            fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                            color: isTop3 ? medal!.bg : '#94a3b8',
                          }}>
                            {isFirstInTieGroup ? `${entry.position}º` : '—'}
                          </span>
                        </div>
                      )}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontWeight: 700,
                          fontSize: isTop3 ? 15 : 14,
                          color: isMe ? 'rgb(var(--copa-gold))' : 'rgb(var(--copa-dark))',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {entry.name}{isMe ? ' (você)' : ''}
                        </p>
                        {hasFilledPredictions ? (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {entry.exactScores} exato · {entry.correctResults} resultado
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 mt-0.5 italic">Palpites não preenchidos</p>
                        )}
                      </div>

                      {hasFilledPredictions && (
                        <div style={{ flexShrink: 0, textAlign: 'right' }}>
                          <span style={{
                            fontSize: isTop3 ? 22 : 18,
                            fontWeight: 900,
                            fontVariantNumeric: 'tabular-nums',
                            color: 'rgb(var(--copa-dark))',
                          }}>
                            {entry.totalPoints}
                          </span>
                          <span className="text-xs text-slate-500 ml-0.5">pts</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <p className="text-xs text-slate-400 text-center mt-3 px-2 leading-relaxed">
              Desempate por placares exatos. Em caso de igualdade em pontos e placares exatos, os jogadores ficam na mesma posição.
            </p>
          </motion.div>
        )}

        {activeTab === 'summary' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center justify-between mb-3">
              <div className="relative">
                <input
                  ref={dateInputRef}
                  type="date"
                  value={summaryDate}
                  onChange={e => {
                    setSummaryDate(e.target.value)
                    dateInputRef.current?.blur()
                  }}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
                <button
                  onClick={() => dateInputRef.current?.showPicker()}
                  className="text-sm border border-copa-border rounded-lg px-3 py-1.5 bg-copa-card text-copa-dark flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {summaryDate}
                </button>
              </div>
              <div className="flex items-center gap-2">
                {hasUnfinishedGames && !isSummaryLoading && visibleGames.some(g => g.predictions.some(p => p.score1 !== null)) && (
                  <button
                    onClick={() => setSimulatorMode(v => !v)}
                    className={`text-sm font-semibold px-4 py-1.5 rounded-full border transition-colors ${
                      simulatorMode
                        ? 'bg-copa-teal text-white border-copa-teal'
                        : 'bg-copa-card text-copa-dark border-copa-border'
                    }`}
                  >
                    Simular
                  </button>
                )}
                {!simulatorMode && (
                  <button
                    onClick={handleShare}
                    disabled={sharing || isSummaryLoading || !summaryData || summaryData.games.length === 0}
                    className="text-copa-teal disabled:opacity-40 transition-opacity p-1"
                    style={{ background: 'none', border: 'none' }}
                  >
                    <ShareIcon />
                  </button>
                )}
              </div>
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
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${selectedGameNumber === g.number ? 'bg-copa-teal text-white border-copa-teal' : 'bg-copa-card text-copa-dark border-copa-border'}`}
                  >
                    {liveScores[g.number] && (
                      <span className="w-2 h-2 bg-copa-red rounded-full flex-shrink-0" />
                    )}
                    Jogo {g.number}
                  </button>
                ))}
              </div>
            )}

            {isSummaryLoading && <LoadingSpinner />}

            {user?.isAdmin && liveSyncError && (
              <div className="mb-3 p-3 rounded-lg border border-red-400 bg-red-50 text-red-700 text-xs font-mono break-all">
                <span className="font-bold">[Admin] Erro no sync ao vivo:</span> {liveSyncError}
              </div>
            )}

            {!isSummaryLoading && activeData && (
              <>
                <div ref={summaryRef} style={{ backgroundColor: '#F5EDD0', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {visibleGames.length === 0 && (
                    <div style={{ backgroundColor: '#FFFDF5', border: '1px solid #D9CBAD', borderRadius: 0, padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
                      Nenhum jogo nessa data.
                    </div>
                  )}

                  {visibleGames.map(game => {
                    const gameScore1 = game.score1 as number | null
                    const hasOfficialResult = gameScore1 !== null
                    const liveScore = liveScores[game.number]
                    const hasLiveScore = !hasOfficialResult && liveScore != null
                    const simScore = simulatedScores[game.number]
                    const simScore1 = simScore?.score1 ?? ''
                    const simScore2 = simScore?.score2 ?? ''
                    const hasSimScore = simulatorMode && !hasOfficialResult && !hasLiveScore && simScore1 !== '' && simScore2 !== ''
                    const showAdminSync = user?.isAdmin && !hasOfficialResult && new Date(game.matchDate) <= new Date()

                    const getEffectivePoints = (pred: typeof game.predictions[0]): number | null => {
                      if (hasOfficialResult) return pred.points ?? 0
                      if (hasLiveScore && pred.score1 !== null) {
                        return computeSimPoints(pred.score1, pred.score2!, liveScore.score1, liveScore.score2)
                      }
                      if (hasSimScore && pred.score1 !== null) {
                        return computeSimPoints(pred.score1, pred.score2!, Number(simScore1), Number(simScore2))
                      }
                      return null
                    }

                    const outcomeOrder = (s1: number | null, s2: number | null) => {
                      if (s1 === null || s2 === null) return 3
                      if (s1 > s2) return 0
                      if (s1 === s2) return 1
                      return 2
                    }
                    const sortedPredictions = [...game.predictions].sort((a, b) => {
                      const outcomeA = outcomeOrder(a.score1, a.score2)
                      const outcomeB = outcomeOrder(b.score1, b.score2)
                      if (outcomeA !== outcomeB) return outcomeA - outcomeB
                      const ptsA = getEffectivePoints(a)
                      const ptsB = getEffectivePoints(b)
                      if (ptsA !== null && ptsB !== null && ptsA !== ptsB) return ptsB - ptsA
                      if (a.score1 !== b.score1) return (a.score1 ?? 0) - (b.score1 ?? 0)
                      if (a.score2 !== b.score2) return (a.score2 ?? 0) - (b.score2 ?? 0)
                      return a.name.localeCompare(b.name)
                    })

                    return (
                      <div key={game.number}>
                        {simulatorMode && !hasOfficialResult && (
                          <div style={{ backgroundColor: '#FFFDF5', border: '1px solid #D9CBAD', borderBottom: 'none', padding: '10px 16px' }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#295A71', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                              Jogo {game.number} — resultado simulado
                            </p>
                            <div className="flex items-center gap-3">
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>
                                {TEAM_ABBR[game.team1] ?? game.team1}
                              </span>
                              <input
                                type="number"
                                min="0"
                                max="99"
                                value={simScore1}
                                onChange={e => setSimulatedScores(prev => ({
                                  ...prev,
                                  [game.number]: { score1: e.target.value, score2: prev[game.number]?.score2 ?? '' },
                                }))}
                                className="score-input w-10 h-9 text-center text-base font-bold rounded-lg"
                                placeholder="0"
                              />
                              <span className="text-slate-600 font-bold">×</span>
                              <input
                                type="number"
                                min="0"
                                max="99"
                                value={simScore2}
                                onChange={e => setSimulatedScores(prev => ({
                                  ...prev,
                                  [game.number]: { score1: prev[game.number]?.score1 ?? '', score2: e.target.value },
                                }))}
                                className="score-input w-10 h-9 text-center text-base font-bold rounded-lg"
                                placeholder="0"
                              />
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>
                                {TEAM_ABBR[game.team2] ?? game.team2}
                              </span>
                              {(simScore1 !== '' || simScore2 !== '') && (
                                <button
                                  onClick={() => setSimulatedScores(prev => {
                                    const next = { ...prev }
                                    delete next[game.number]
                                    return next
                                  })}
                                  className="text-slate-400 text-xs ml-1"
                                >
                                  limpar
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#FFFDF5', border: '1px solid #D9CBAD' }}>
                          <tbody>
                            <tr>
                              <td colSpan={3} style={{ paddingTop: 10, paddingBottom: 4, paddingLeft: 16, paddingRight: 16 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                  <tbody><tr>
                                    <td style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
                                      Jogo {game.number}
                                      {hasLiveScore && (
                                        <span style={{ marginLeft: 8, color: '#e63946', fontWeight: 800, letterSpacing: 0.5 }}>
                                          AO VIVO{liveScore.timeElapsed ? ` ${liveScore.timeElapsed}` : ''}
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ fontSize: 11, color: '#64748b', textAlign: 'right' }}>
                                      {showAdminSync ? (
                                        <button
                                          onClick={handleManualSync}
                                          disabled={isSyncing}
                                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4, color: '#295A71', opacity: isSyncing ? 0.5 : 1 }}
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={isSyncing ? 'animate-spin' : ''}>
                                            <polyline points="23 4 23 10 17 10" />
                                            <polyline points="1 20 1 14 7 14" />
                                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                          </svg>
                                          <span style={{ fontSize: 10, fontWeight: 700 }}>
                                            {isSyncing ? 'Sincronizando...' : syncDone ? 'Sincronizado' : 'Sincronizar'}
                                          </span>
                                        </button>
                                      ) : (
                                        new Date(game.matchDate).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
                                      )}
                                    </td>
                                  </tr></tbody>
                                </table>
                              </td>
                            </tr>

                            <tr style={{ borderBottom: '1px solid #D9CBAD' }}>
                              <td style={{ textAlign: 'right', paddingTop: 10, paddingBottom: 10, paddingLeft: 16, paddingRight: 8, whiteSpace: 'nowrap' }}>
                                {FLAG_CODES[resolveKnockoutTeam(game.team1)] && (
                                  <img
                                    src={`/flags/${FLAG_CODES[resolveKnockoutTeam(game.team1)]}.png`}
                                    crossOrigin="anonymous"
                                    width={FLAG_CODES[resolveKnockoutTeam(game.team1)] === 'ch' ? 14 : 21}
                                    height={14}
                                    style={{ verticalAlign: 'middle', marginRight: 4, display: 'inline' }}
                                  />
                                )}
                                <span style={{ fontWeight: 700, fontSize: 13, color: '#1a1a1a', verticalAlign: 'middle' }}>
                                  {TEAM_ABBR[resolveKnockoutTeam(game.team1)] ?? resolveKnockoutTeam(game.team1)}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center', paddingTop: 10, paddingBottom: 10, paddingLeft: 6, paddingRight: 6, width: 80, whiteSpace: 'nowrap', fontSize: 22, fontWeight: 900, color: hasLiveScore ? '#e63946' : hasSimScore ? '#295A71' : '#1a1a1a' }}>
                                {hasOfficialResult
                                  ? `${game.score1} × ${game.score2}`
                                  : hasLiveScore
                                  ? `${liveScore.score1} × ${liveScore.score2}`
                                  : hasSimScore
                                  ? `${simScore1} × ${simScore2}`
                                  : '—'}
                              </td>
                              <td style={{ textAlign: 'left', paddingTop: 10, paddingBottom: 10, paddingLeft: 8, paddingRight: 16, whiteSpace: 'nowrap' }}>
                                <span style={{ fontWeight: 700, fontSize: 13, color: '#1a1a1a', verticalAlign: 'middle' }}>
                                  {TEAM_ABBR[resolveKnockoutTeam(game.team2)] ?? resolveKnockoutTeam(game.team2)}
                                </span>
                                {FLAG_CODES[resolveKnockoutTeam(game.team2)] && (
                                  <img
                                    src={`/flags/${FLAG_CODES[resolveKnockoutTeam(game.team2)]}.png`}
                                    crossOrigin="anonymous"
                                    width={FLAG_CODES[resolveKnockoutTeam(game.team2)] === 'ch' ? 14 : 21}
                                    height={14}
                                    style={{ verticalAlign: 'middle', marginLeft: 4, display: 'inline' }}
                                  />
                                )}
                              </td>
                            </tr>

                            {sortedPredictions.some(p => p.score1 !== null) && sortedPredictions.map((pred, idx) => {
                              let bgColor = 'transparent'
                              let ptsColor = '#e63946'
                              let ptsLabel = ''

                              if (hasOfficialResult) {
                                bgColor = pred.points === 3 ? 'rgba(0,254,168,0.12)' : pred.points === 1 ? 'rgba(255,209,0,0.12)' : 'transparent'
                                ptsColor = pred.points === 3 ? '#295A71' : pred.points === 1 ? '#B8960A' : '#e63946'
                                ptsLabel = pred.points === 3 ? '+3 pts' : pred.points === 1 ? '+1 pt' : '0 pts'
                              } else if (hasLiveScore && pred.score1 !== null) {
                                const livePts = computeSimPoints(pred.score1, pred.score2!, liveScore.score1, liveScore.score2)
                                bgColor = livePts === 3 ? 'rgba(230,57,70,0.08)' : livePts === 1 ? 'rgba(255,209,0,0.12)' : 'transparent'
                                ptsColor = livePts === 3 ? '#e63946' : livePts === 1 ? '#B8960A' : '#94a3b8'
                                ptsLabel = livePts === 3 ? '+3 pts' : livePts === 1 ? '+1 pt' : '0 pts'
                              } else if (hasSimScore && pred.score1 !== null) {
                                const simPts = computeSimPoints(pred.score1, pred.score2!, Number(simScore1), Number(simScore2))
                                bgColor = simPts === 3 ? 'rgba(0,254,168,0.12)' : simPts === 1 ? 'rgba(255,209,0,0.12)' : 'transparent'
                                ptsColor = simPts === 3 ? '#295A71' : simPts === 1 ? '#B8960A' : '#e63946'
                                ptsLabel = simPts === 3 ? '+3 pts' : simPts === 1 ? '+1 pt' : '0 pts'
                              }

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
                                    {ptsLabel}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  })}

                  {visibleGames.length > 0 && !simulatorMode && visibleGames.some(g => g.predictions.some(p => p.score1 !== null)) && (
                    <div style={{ backgroundColor: '#FFFDF5', border: `1px solid ${liveRanking ? '#e63946' : '#D9CBAD'}`, borderRadius: 0, overflow: 'hidden' }}>
                      <div style={{ borderBottom: '1px solid #D9CBAD', padding: '10px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
                          Ranking geral
                        </span>
                        {liveRanking && (
                          <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, color: '#e63946', letterSpacing: 0.5 }}>AO VIVO</span>
                        )}
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
                          {(liveRanking ?? visibleRanking).map((entry, idx) => {
                            const moved = entry.movement
                            const movementIcon = moved > 0 ? '▲' : moved < 0 ? '▼' : ''
                            const movementColor = moved > 0 ? '#22c55e' : moved < 0 ? '#e63946' : 'transparent'
                            const displayRanking = liveRanking ?? visibleRanking
                            const isFirstInTieGroup = idx === 0 || displayRanking[idx - 1].position !== entry.position
                            return (
                              <tr key={entry.userId} style={{ borderTop: idx > 0 ? '1px solid #D9CBAD' : 'none' }}>
                                <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                                  <span style={{ fontWeight: 900, color: '#1a1a1a', fontVariantNumeric: 'tabular-nums' }}>
                                    {isFirstInTieGroup ? `${entry.position}º` : '—'}
                                  </span>
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

                {simulatorMode && simulatedRanking && (
                  <div style={{ marginTop: 16, backgroundColor: '#FFFDF5', border: '1px solid #295A71', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ borderBottom: '1px solid #D9CBAD', padding: '10px 16px', backgroundColor: '#295A71' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 }}>
                        Ranking simulado
                      </span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #D9CBAD' }}>
                          <th style={{ textAlign: 'left', padding: '8px 16px', fontSize: 11, color: '#64748b', fontWeight: 600, width: 40 }}>#</th>
                          <th style={{ textAlign: 'left', padding: '8px 8px', fontSize: 11, color: '#64748b', fontWeight: 600 }}>Participante</th>
                          <th style={{ textAlign: 'center', padding: '8px 8px', fontSize: 11, color: '#64748b', fontWeight: 600, width: 56 }}>Jogo</th>
                          <th style={{ textAlign: 'center', padding: '8px 16px', fontSize: 11, color: '#64748b', fontWeight: 600, width: 56 }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {simulatedRanking.map((entry, idx) => {
                          const isFirstInTieGroup = idx === 0 || simulatedRanking[idx - 1].position !== entry.position
                          const isMe = entry.userId === user?.id
                          return (
                            <tr key={entry.userId} style={{ borderTop: idx > 0 ? '1px solid #D9CBAD' : 'none', backgroundColor: isMe ? 'rgba(41,90,113,0.06)' : 'transparent' }}>
                              <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', fontWeight: 900, color: '#1a1a1a', fontVariantNumeric: 'tabular-nums' }}>
                                {isFirstInTieGroup ? `${entry.position}º` : '—'}
                              </td>
                              <td style={{ padding: '10px 8px', fontWeight: 600, color: isMe ? '#295A71' : '#1a1a1a' }}>
                                {entry.name}{isMe ? ' (você)' : ''}
                              </td>
                              <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#295A71', fontVariantNumeric: 'tabular-nums' }}>
                                {entry.todayPoints > 0 ? `+${entry.todayPoints}` : '—'}
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'center' }}>
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

                {simulatorMode && !simulatedRanking && hasUnfinishedGames && (
                  <div className="mt-4 text-center text-sm text-slate-500 py-4">
                    Preencha um resultado simulado acima para ver como ficaria o ranking.
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {activeTab === 'games' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <GamesTab
              gamesData={gamesData ?? []}
              isAdmin={user?.isAdmin}
              myPredictions={myPredictions}
              onSaveResult={handleSaveResult}
            />
          </motion.div>
        )}

        {activeTab === 'chances' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {statsLoading ? (
              <LoadingSpinner />
            ) : !rankingStats ? (
              <p className="text-center text-slate-500 text-sm py-8">Erro ao carregar estatísticas.</p>
            ) : (() => {
              const maxPossibleAll = Math.max(
                ...rankingStats.members.map(m => m.currentPoints + m.maxAdditionalPoints),
                1
              )
              return (
                <div className="space-y-3">
                  <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                    <button
                      onClick={() => setStatsPhase('grupos')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${statsPhase === 'grupos' ? 'bg-white text-copa-dark shadow-sm' : 'text-slate-500'}`}
                    >
                      Fase de Grupos
                    </button>
                    <button
                      onClick={() => setStatsPhase('knockout')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${statsPhase === 'knockout' ? 'bg-white text-copa-dark shadow-sm' : 'text-slate-500'}`}
                    >
                      Mata-mata
                    </button>
                  </div>
                  <div className="card p-3 flex items-center justify-between">
                    <span className="text-copa-teal text-sm font-semibold">Jogos restantes</span>
                    <span className="text-copa-dark font-bold text-lg">{rankingStats.remainingGamesCount}</span>
                  </div>
                  <p className="text-xs text-slate-500 text-center leading-relaxed px-1">
                    Potencial máximo considerando palpites confirmados e jogos ainda abertos para palpite.
                  </p>
                  {rankingStats.members.map((member) => {
                    const maxPoints = member.currentPoints + member.maxAdditionalPoints
                    const vsLeader = member.opponents.find(o => o.currentRank === 1)
                    const canWin = member.position === 1 || (vsLeader?.canOvertake ?? false)
                    const canReachTop3 = member.bestPossibleRank <= 3

                    const barPct = Math.round((member.currentPoints / maxPossibleAll) * 100)
                    const maxBarPct = Math.round((maxPoints / maxPossibleAll) * 100)

                    let statusLabel: string
                    let statusBg: string
                    let statusText: string
                    if (member.position === 1) {
                      statusLabel = '1º lugar'
                      statusBg = 'bg-copa-gold/25'
                      statusText = 'text-amber-700'
                    } else if (canWin) {
                      statusLabel = 'Pode vencer'
                      statusBg = 'bg-copa-menta/20'
                      statusText = 'text-copa-teal'
                    } else if (canReachTop3) {
                      statusLabel = `Pode chegar top ${member.bestPossibleRank}`
                      statusBg = 'bg-blue-50'
                      statusText = 'text-blue-700'
                    } else {
                      statusLabel = `Min. ${member.bestPossibleRank}º lugar`
                      statusBg = 'bg-copa-red/10'
                      statusText = 'text-copa-red'
                    }

                    return (
                      <div key={member.userId} className="card p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-copa-teal font-bold text-sm">{member.position}º</span>
                              <span className="text-copa-dark font-bold text-sm">{member.name}</span>
                            </div>
                            <span className="text-slate-500 text-xs">
                              {member.currentPoints} pts · {member.exactScores} exatos
                            </span>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusBg} ${statusText}`}>
                            {statusLabel}
                          </span>
                        </div>

                        <div className="relative h-2 rounded-full bg-slate-100 mb-2 overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full bg-copa-menta/40"
                            style={{ width: `${maxBarPct}%` }}
                          />
                          <div
                            className="absolute inset-y-0 left-0 rounded-full bg-copa-gold"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 mb-2">
                          <span>{member.currentPoints} pts atuais</span>
                          <span>máx. {maxPoints} pts</span>
                        </div>

                        {member.position > 1 && (
                          <div className="border-t border-slate-100 pt-2">
                            <div className="flex items-center justify-between text-xs mb-2">
                              <span className="text-slate-500 font-semibold">Melhor posição possível</span>
                              <span className="font-bold text-copa-dark">{member.bestPossibleRank}º lugar</span>
                            </div>
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5" style={{ letterSpacing: '0.06em', fontSize: 10 }}>
                              Comparação com membros à frente
                            </div>
                            <div className="space-y-1">
                              {member.opponents
                                .filter(o => o.gap > 0)
                                .sort((a, b) => a.gap - b.gap)
                                .map(opponent => (
                                  <div key={opponent.userId} className="flex items-center gap-2 text-xs">
                                    <span className="text-copa-teal font-bold w-5 shrink-0">{opponent.currentRank}º</span>
                                    <span className="text-copa-dark font-semibold flex-1 truncate">{opponent.name}</span>
                                    <span className="text-slate-500 shrink-0">{opponent.gap} atrás</span>
                                    <span className={`font-bold shrink-0 ${opponent.canOvertake ? 'text-copa-teal' : 'text-copa-red'}`}>
                                      {opponent.canOvertake ? '✓' : '✗'}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
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

      {showCopyModal && poolData && (
        <ManageMembersModal
          sourcePoolId={poolData.id}
          onClose={() => setShowCopyModal(false)}
        />
      )}
    </div>
  )
}
