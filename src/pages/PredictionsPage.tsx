import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { Game, Prediction, Pool } from '../types'
import { FLAG_CODES, TEAM_ABBR } from '../components/FlagImage'

const GROUPS = 'ABCDEFGHIJKL'.split('')

type KnockoutRoundKey = 'R32' | 'R16' | 'QF' | 'SF' | 'FIN'

interface KnockoutRoundConfig {
  key: KnockoutRoundKey
  groups: string[]
  tabLabel: string
  label: string
  lockedLabel: string
  confirmLabel: string
}

const KNOCKOUT_ROUNDS: KnockoutRoundConfig[] = [
  { key: 'R32', groups: ['R32'], tabLabel: '16 avos', label: '16 avos de final', lockedLabel: 'Palpites dos 16 avos confirmados — somente visualização', confirmLabel: 'Confirmar palpites dos 16 avos' },
  { key: 'R16', groups: ['R16'], tabLabel: 'Oitavas', label: 'oitavas de final', lockedLabel: 'Palpites das oitavas confirmados — somente visualização', confirmLabel: 'Confirmar palpites das oitavas' },
  { key: 'QF', groups: ['QF'], tabLabel: 'Quartas', label: 'quartas de final', lockedLabel: 'Palpites das quartas confirmados — somente visualização', confirmLabel: 'Confirmar palpites das quartas' },
  { key: 'SF', groups: ['SF'], tabLabel: 'Semi', label: 'semifinal', lockedLabel: 'Palpites da semifinal confirmados — somente visualização', confirmLabel: 'Confirmar palpites da semifinal' },
  { key: 'FIN', groups: ['TP', 'FIN'], tabLabel: 'Final', label: 'final e disputa de 3º lugar', lockedLabel: 'Palpites da final e do 3º lugar confirmados — somente visualização', confirmLabel: 'Confirmar palpites da final e do 3º lugar' },
]

const SLIDE_VARIANTS = {
  enter: (direction: number) => ({ x: direction > 0 ? '100%' : '-100%' }),
  center: { x: 0 },
  exit: (direction: number) => ({ x: direction > 0 ? '-100%' : '100%' }),
}
const SPRING = { type: 'spring', stiffness: 400, damping: 40 }

interface TeamStats {
  team: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  points: number
}

function emptyStats(team: string): TeamStats {
  return { team, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }
}

function isMatchupDefined(game: Game): boolean {
  return !game.team1.startsWith('Venc.') && !game.team1.startsWith('Perd.')
    && !game.team2.startsWith('Venc.') && !game.team2.startsWith('Perd.')
}

function applyGameResult(
  home: TeamStats,
  away: TeamStats,
  homeGoals: number,
  awayGoals: number
) {
  home.played++
  away.played++
  home.goalsFor += homeGoals
  home.goalsAgainst += awayGoals
  away.goalsFor += awayGoals
  away.goalsAgainst += homeGoals

  if (homeGoals > awayGoals) {
    home.won++
    home.points += 3
    away.lost++
    return
  }
  if (homeGoals < awayGoals) {
    away.won++
    away.points += 3
    home.lost++
    return
  }
  home.drawn++
  away.drawn++
  home.points++
  away.points++
}


function computeThirdPlaceQualifiers(
  gamesByGroup: Record<string, Game[]>,
  scores: Record<string, [string, string]>
): Set<string> {
  const thirdPlaceTeams: TeamStats[] = []
  for (const groupGames of Object.values(gamesByGroup)) {
    if (!groupGames.length) continue
    const standings = computeGroupStandings(groupGames, scores)
    if (standings.length >= 3) thirdPlaceTeams.push(standings[2])
  }
  thirdPlaceTeams.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdA = a.goalsFor - a.goalsAgainst
    const gdB = b.goalsFor - b.goalsAgainst
    if (gdB !== gdA) return gdB - gdA
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
    return b.won - a.won
  })
  return new Set(thirdPlaceTeams.slice(0, 8).map(t => t.team))
}

function computeGroupStandings(
  groupGames: Game[],
  scores: Record<string, [string, string]>
): TeamStats[] {
  const teams = [...new Set(groupGames.flatMap(g => [g.team1, g.team2]))]
  const statsMap: Record<string, TeamStats> = Object.fromEntries(
    teams.map(team => [team, emptyStats(team)])
  )

  for (const game of groupGames) {
    const [rawScore1, rawScore2] = scores[game.id] ?? ['', '']
    if (rawScore1 === '' || rawScore2 === '') continue
    applyGameResult(
      statsMap[game.team1],
      statsMap[game.team2],
      Number(rawScore1),
      Number(rawScore2)
    )
  }

  return teams
    .map(team => statsMap[team])
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      const gdA = a.goalsFor - a.goalsAgainst
      const gdB = b.goalsFor - b.goalsAgainst
      if (gdB !== gdA) return gdB - gdA
      return b.goalsFor - a.goalsFor
    })
}

function PtsTag({ points }: { points?: number | null }) {
  if (points === null || points === undefined) return null
  const bg = points === 3 ? 'rgba(0,254,168,0.15)' : points === 1 ? 'rgba(255,209,0,0.15)' : 'rgba(230,57,70,0.1)'
  const color = points === 3 ? '#295A71' : points === 1 ? '#FFD100' : '#e63946'
  return (
    <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: bg, color }}>
      +{points}pts
    </span>
  )
}

export default function PredictionsPage() {
  const { poolCode } = useParams<{ poolCode: string }>()
  const navigate = useNavigate()

  const [activeGroup, setActiveGroup] = useState('A')
  const [groupDirection, setGroupDirection] = useState(1)
  const [scores, setScores] = useState<Record<string, [string, string]>>({})
  const [, setSavingGames] = useState<Record<string, boolean>>({})
  const [showConfirm, setShowConfirm] = useState(false)
  const [lockError, setLockError] = useState('')
  const [locking, setLocking] = useState(false)
  const [validating, setValidating] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [importing, setImporting] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [activeSession, setActiveSession] = useState<'grupos' | KnockoutRoundKey>('grupos')
  const queryClient = useQueryClient()

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(interval)
  }, [])

  const score1Refs = useRef<Record<string, HTMLInputElement | null>>({})
  const score2Refs = useRef<Record<string, HTMLInputElement | null>>({})
  const swipeTouchStart = useRef<{ x: number; y: number } | null>(null)
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    tabButtonRefs.current[activeGroup]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [activeGroup])

  const { data: pool } = useQuery({
    queryKey: ['pool', poolCode],
    queryFn: async () => {
      const { data } = await api.get(`/pools/${poolCode}`)
      return data.pool as Pool
    },
    enabled: !!poolCode,
  })

  const { data: games } = useQuery({
    queryKey: ['games'],
    queryFn: async () => {
      const { data } = await api.get('/games')
      return data.games as Game[]
    },
  })

  const { data: savedPredictions } = useQuery({
    queryKey: ['predictions', poolCode],
    queryFn: async () => {
      const { data } = await api.get('/predictions', { params: { poolId: pool!.id } })
      return data.predictions as Prediction[]
    },
    enabled: !!pool?.id,
  })

  const { data: templatePredictions } = useQuery({
    queryKey: ['predictions-template', pool?.id],
    queryFn: async () => {
      const { data } = await api.get('/predictions/template', { params: { excludePoolId: pool!.id } })
      return data.predictions as Prediction[]
    },
    enabled: !!pool?.id && savedPredictions !== undefined && savedPredictions.length === 0,
  })

  useEffect(() => {
    if (!savedPredictions) return
    const loaded: Record<string, [string, string]> = {}
    for (const prediction of savedPredictions) {
      loaded[prediction.gameId] = [String(prediction.score1), String(prediction.score2)]
    }
    setScores(loaded)
  }, [savedPredictions])

  const saveMutation = useMutation({
    mutationFn: ({ gameId, score1, score2 }: { gameId: string; score1: number; score2: number }) =>
      api.post('/predictions/save', { poolId: pool!.id, gameId, score1, score2 }),
  })

  function saveGame(gameId: string, score1: number, score2: number) {
    if (!pool) return
    setSavingGames(prev => ({ ...prev, [gameId]: true }))
    saveMutation.mutateAsync({ gameId, score1, score2 })
      .catch(() => {})
      .finally(() => setSavingGames(prev => ({ ...prev, [gameId]: false })))
  }

  function navigateToGroup(targetGroup: string) {
    const currentIndex = GROUPS.indexOf(activeGroup)
    const targetIndex = GROUPS.indexOf(targetGroup)
    setGroupDirection(targetIndex > currentIndex ? 1 : -1)
    setActiveGroup(targetGroup)
  }

  function handleSwipeTouchStart(e: React.TouchEvent) {
    swipeTouchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  function handleSwipeTouchEnd(e: React.TouchEvent) {
    if (!swipeTouchStart.current) return
    const deltaX = e.changedTouches[0].clientX - swipeTouchStart.current.x
    const deltaY = e.changedTouches[0].clientY - swipeTouchStart.current.y
    swipeTouchStart.current = null

    if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY)) return

    const groupIndex = GROUPS.indexOf(activeGroup)
    if (deltaX < 0 && groupIndex < GROUPS.length - 1) {
      navigateToGroup(GROUPS[groupIndex + 1])
    }
    if (deltaX > 0 && groupIndex > 0) {
      navigateToGroup(GROUPS[groupIndex - 1])
    }
  }

  function handleScoreChange(gameId: string, team: 0 | 1, value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 2)
    const prev = scores[gameId] ?? ['', '']
    const updated: [string, string] = team === 0 ? [digits, prev[1]] : [prev[0], digits]
    setScores(s => ({ ...s, [gameId]: updated }))

    if (team === 0 && digits.length >= 1) {
      score2Refs.current[gameId]?.focus({ preventScroll: true })
      score2Refs.current[gameId]?.select()
    }

    if (team === 1 && digits.length >= 1 && games) {
      const navGames = activeSession === 'grupos'
        ? games.filter(g => g.group === activeGroup).sort((a, b) => a.number - b.number)
        : gamesByRound[activeSession]
      const currentIdx = navGames.findIndex(g => g.id === gameId)
      const nextGame = navGames[currentIdx + 1]
      if (nextGame) {
        setTimeout(() => {
          const el = score1Refs.current[nextGame.id]
          if (el) {
            el.focus()
            el.select()
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 50)
      } else {
        score2Refs.current[gameId]?.blur()
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 150)
      }
    }

    const newScore1 = team === 0 ? digits : prev[0]
    const newScore2 = team === 1 ? digits : prev[1]
    if (newScore1 !== '' && newScore2 !== '') {
      saveGame(gameId, Number(newScore1), Number(newScore2))
    }
  }

  async function handleLockAll() {
    if (!pool) return
    setLocking(true)
    setLockError('')
    try {
      await api.post('/predictions/lock-all', { poolId: pool.id, round: activeSession })
      await queryClient.invalidateQueries({ queryKey: ['predictions', poolCode] })
      await queryClient.invalidateQueries({ queryKey: ['ranking', poolCode] })
      navigate(`/ranking/${poolCode}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setLockError(msg || 'Erro ao confirmar palpites')
    } finally {
      setLocking(false)
    }
  }

  async function handleClickConfirm() {
    if (!pool) return
    setValidating(true)
    setSyncError('')

    try {
      const { data } = await api.get('/predictions', { params: { poolId: pool.id } })
      const savedMap = new Map((data.predictions as Prediction[]).map((p: Prediction) => [p.gameId, p]))

      const needsSync = openGames.filter(g => {
        const [s1, s2] = scores[g.id] ?? ['', '']
        if (s1 === '' || s2 === '') return false
        const saved = savedMap.get(g.id)
        if (!saved) return true
        return saved.score1 !== Number(s1) || saved.score2 !== Number(s2)
      })

      if (needsSync.length > 0) {
        await Promise.all(
          needsSync.map(g => {
            const [s1, s2] = scores[g.id]
            return api.post('/predictions/save', {
              poolId: pool.id, gameId: g.id,
              score1: Number(s1), score2: Number(s2),
            }).catch(() => null)
          })
        )

        const { data: data2 } = await api.get('/predictions', { params: { poolId: pool.id } })
        const savedMap2 = new Map((data2.predictions as Prediction[]).map((p: Prediction) => [p.gameId, p]))
        const checkNow = new Date()
        const stillUnsaved = openGames.filter(g => {
          if (new Date(g.matchDate) <= checkNow) return false
          const [s1, s2] = scores[g.id] ?? ['', '']
          if (s1 === '' || s2 === '') return false
          const saved = savedMap2.get(g.id)
          return !saved || saved.score1 !== Number(s1) || saved.score2 !== Number(s2)
        })

        if (stillUnsaved.length > 0) {
          setSyncError(`${stillUnsaved.length} palpite(s) não puderam ser salvos. Verifique sua conexão e tente novamente.`)
          return
        }
      }

      setShowConfirm(true)
      window.scrollTo({ top: 0, behavior: 'instant' })
    } catch {
      setSyncError('Erro ao verificar seus palpites. Verifique sua conexão e tente novamente.')
    } finally {
      setValidating(false)
    }
  }

  const gamesByRound = useMemo(() => {
    const map = {} as Record<KnockoutRoundKey, Game[]>
    for (const round of KNOCKOUT_ROUNDS) {
      map[round.key] = (games ?? [])
        .filter(g => round.groups.includes(g.group))
        .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime())
    }
    return map
  }, [games])

  const visibleRounds = useMemo(() =>
    KNOCKOUT_ROUNDS.filter(round => {
      const roundGames = gamesByRound[round.key]
      if (round.key === 'R32') return roundGames.length > 0
      return roundGames.some(isMatchupDefined)
    }),
    [gamesByRound]
  )

  const autoSessionRef = useRef(false)
  useEffect(() => {
    if (autoSessionRef.current || !games?.length) return
    autoSessionRef.current = true
    const lastVisible = visibleRounds[visibleRounds.length - 1]
    if (lastVisible) setActiveSession(lastVisible.key)
  }, [games, visibleRounds])

  const gameIdsByRound = useMemo(() => {
    const map = {} as Record<KnockoutRoundKey, Set<string>>
    for (const round of KNOCKOUT_ROUNDS) map[round.key] = new Set(gamesByRound[round.key].map(g => g.id))
    return map
  }, [gamesByRound])

  const allKnockoutGameIds = useMemo(() =>
    new Set(KNOCKOUT_ROUNDS.flatMap(round => gamesByRound[round.key].map(g => g.id))),
    [gamesByRound]
  )

  const resolveTeamName = useCallback((name: string): string => {
    if (!games) return name
    const match = name.match(/^(\d)º Grupo ([A-L])$/)
    if (!match) return name
    const pos = parseInt(match[1]) - 1
    const groupLetter = match[2]
    const groupGames = games.filter(g => g.group === groupLetter && g.score1 !== null)

    const teamStats = new Map<string, { pts: number; gd: number; gf: number }>()
    for (const g of groupGames) {
      if (!teamStats.has(g.team1)) teamStats.set(g.team1, { pts: 0, gd: 0, gf: 0 })
      if (!teamStats.has(g.team2)) teamStats.set(g.team2, { pts: 0, gd: 0, gf: 0 })
      const t1 = teamStats.get(g.team1)!
      const t2 = teamStats.get(g.team2)!
      t1.gf += g.score1!; t1.gd += g.score1! - g.score2!
      t2.gf += g.score2!; t2.gd += g.score2! - g.score1!
      if (g.score1! > g.score2!) t1.pts += 3
      else if (g.score1! === g.score2!) { t1.pts += 1; t2.pts += 1 }
      else t2.pts += 3
    }

    const sorted = [...teamStats.entries()].sort(([, a], [, b]) =>
      b.pts !== a.pts ? b.pts - a.pts : b.gd !== a.gd ? b.gd - a.gd : b.gf - a.gf
    )

    return sorted[pos]?.[0] ?? name
  }, [games])

  if (!games || !pool) {
    return <div className="flex items-center justify-center min-h-screen text-slate-600">Carregando...</div>
  }

  async function handleImportTemplate() {
    if (!templatePredictions?.length || !pool) return
    setImporting(true)
    const newScores: Record<string, [string, string]> = {}
    for (const pred of templatePredictions) {
      newScores[pred.gameId] = [String(pred.score1), String(pred.score2)]
    }
    setScores(newScores)
    await Promise.all(
      templatePredictions.map(pred =>
        api.post('/predictions/save', { poolId: pool.id, gameId: pred.gameId, score1: pred.score1, score2: pred.score2 }).catch(() => {})
      )
    )
    await queryClient.invalidateQueries({ queryKey: ['predictions', poolCode] })
    setImporting(false)
  }

  const gamesByGroup: Record<string, Game[]> = {}
  for (const groupLetter of GROUPS) gamesByGroup[groupLetter] = []
  for (const game of games) gamesByGroup[game.group]?.push(game)

  const startedGames = new Set(games.filter(g => new Date(g.matchDate) <= now).map(g => g.id))

  const groupOpenGames = games.filter(g => g.number <= 72 && new Date(g.matchDate) > now)
  const openGames = activeSession === 'grupos'
    ? groupOpenGames
    : gamesByRound[activeSession].filter(g => new Date(g.matchDate) > now)

  const filledCount = Object.values(scores).filter(
    ([score1, score2]) => score1 !== '' && score2 !== ''
  ).length
  const openFilledCount = openGames.filter(g => {
    const [s1, s2] = scores[g.id] ?? ['', '']
    return s1 !== '' && s2 !== ''
  }).length

  const lockedPredictions = new Map(savedPredictions?.map(p => [p.gameId, p]) ?? [])
  const allFilled = openGames.length > 0
    ? openFilledCount === openGames.length
    : filledCount > 0
  const isGroupsLocked = savedPredictions?.some(p => p.isLocked && !allKnockoutGameIds.has(p.gameId)) ?? false
  const isAllLocked = activeSession === 'grupos'
    ? isGroupsLocked
    : (savedPredictions?.filter(p => gameIdsByRound[activeSession].has(p.gameId)).some(p => p.isLocked) ?? false)

  const startedGamesList = (activeSession === 'grupos'
    ? games.filter(g => g.number <= 72)
    : gamesByRound[activeSession]
  ).filter(g => startedGames.has(g.id))

  const activeRound = activeSession === 'grupos' ? undefined : KNOCKOUT_ROUNDS.find(r => r.key === activeSession)
  const sessionLabel = activeRound?.label ?? 'fase de grupos'

  if (showConfirm) {
    return (
      <motion.div
        className="min-h-screen flex flex-col justify-center px-6"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="text-center mb-6">
          <h2 className="text-2xl font-extrabold text-copa-dark">Confirmar palpites?</h2>
          <p className="text-xs text-slate-600 mb-1">{sessionLabel}</p>
          <p className="text-slate-600 mt-3 leading-relaxed text-sm">
            Você preencheu <span className="text-copa-gold font-bold">{openFilledCount} de {openGames.length}</span> jogos disponíveis.
          </p>
          <p className="text-copa-red text-sm font-semibold mt-2">
            Após confirmar, não será possível alterar.
          </p>
        </div>

        {startedGamesList.length > 0 && (
          <div className="card p-4 mb-6 border border-copa-red/20">
            <p className="text-sm font-bold text-copa-red mb-2">
              {startedGamesList.length} jogo{startedGamesList.length > 1 ? 's' : ''} já iniciado{startedGamesList.length > 1 ? 's' : ''} — não serão pontuados:
            </p>
            <div className="space-y-1">
              {startedGamesList.map(g => (
                <p key={g.id} className="text-xs text-slate-600">
                  · {TEAM_ABBR[g.team1] ?? g.team1} × {TEAM_ABBR[g.team2] ?? g.team2}
                </p>
              ))}
            </div>
          </div>
        )}

        {lockError && <p className="text-copa-red text-sm text-center mb-4">{lockError}</p>}
        <div className="space-y-3">
          <button className="btn-primary" onClick={handleLockAll} disabled={locking}>
            {locking ? 'Confirmando...' : 'Confirmar e travar palpites'}
          </button>
          <button className="btn-secondary" onClick={() => setShowConfirm(false)}>
            Voltar e revisar
          </button>
        </div>
      </motion.div>
    )
  }

  const activeGroupGames = gamesByGroup[activeGroup] ?? []
  const standings = computeGroupStandings(activeGroupGames, scores)
  const qualifyingThirdPlaceTeams = computeThirdPlaceQualifiers(gamesByGroup, scores)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sticky header */}
      <div className="px-5 pt-6 pb-3 border-b border-copa-border sticky top-0 z-20 bg-copa-cream">
        <div className="flex justify-between items-center mb-3">
          <button
            onClick={() => navigate(`/ranking/${poolCode}`)}
            className="text-slate-600 text-sm"
          >
            ← {pool.name}
          </button>
          <span className="text-sm text-slate-600">
            {openFilledCount}/{openGames.length} palpites
          </span>
        </div>

        {visibleRounds.length > 0 && (
          <div className="flex gap-2 mb-3 flex-wrap">
            <button
              onClick={() => setActiveSession('grupos')}
              className="flex-1 py-1.5 text-sm font-bold rounded-lg transition-all"
              style={{
                minWidth: 64,
                backgroundColor: activeSession === 'grupos' ? '#FFD100' : 'transparent',
                color: '#1a1a1a',
                border: `1px solid ${activeSession === 'grupos' ? 'transparent' : '#D9CBAD'}`,
              }}
            >
              Grupos
            </button>
            {visibleRounds.map(round => (
              <button
                key={round.key}
                onClick={() => setActiveSession(round.key)}
                className="flex-1 py-1.5 text-sm font-bold rounded-lg transition-all"
                style={{
                  minWidth: 64,
                  backgroundColor: activeSession === round.key ? '#FFD100' : 'transparent',
                  color: '#1a1a1a',
                  border: `1px solid ${activeSession === round.key ? 'transparent' : '#D9CBAD'}`,
                }}
              >
                {round.tabLabel}
              </button>
            ))}
          </div>
        )}

        <div className="h-1.5 bg-copa-border rounded-full overflow-hidden mb-3">
          <motion.div
            className="h-full bg-copa-gold rounded-full"
            animate={{ width: `${openGames.length > 0 ? (openFilledCount / openGames.length) * 100 : 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        {activeSession === 'grupos' && (
          <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {GROUPS.map(groupLetter => {
              const groupGames = gamesByGroup[groupLetter]
              if (!groupGames?.length) return null
              const groupFilledCount = groupGames.filter(game => {
                const [score1, score2] = scores[game.id] ?? ['', '']
                return score1 !== '' && score2 !== ''
              }).length
              const isGroupComplete = groupFilledCount === groupGames.length
              return (
                <button
                  key={groupLetter}
                  ref={el => { tabButtonRefs.current[groupLetter] = el }}
                  onClick={() => navigateToGroup(groupLetter)}
                  className="shrink-0 h-8 w-8 rounded-lg text-sm font-bold transition-all"
                  style={{
                    backgroundColor: activeGroup === groupLetter ? '#FFD100' : isGroupComplete ? 'rgba(0,254,168,0.15)' : 'rgb(var(--copa-cream))',
                    color: '#1a1a1a',
                    border: isGroupComplete && activeGroup !== groupLetter ? '1px solid rgba(0,254,168,0.4)' : '1px solid transparent',
                  }}
                >
                  {groupLetter}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Banner de reutilização de palpites */}
      {!isAllLocked && filledCount === 0 && templatePredictions && templatePredictions.length > 0 && (
        <motion.div
          className="mx-5 mt-4 card p-4 flex items-center gap-3"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex-1 min-w-0">
            <p className="font-bold text-copa-dark text-sm">Reutilizar palpites?</p>
            <p className="text-slate-600 text-xs mt-0.5">Você tem palpites de outro bolão. Use como ponto de partida e edite o que quiser.</p>
          </div>
          <button
            onClick={handleImportTemplate}
            disabled={importing}
            className="shrink-0 px-3 py-2 rounded-xl text-sm font-bold transition-opacity"
            style={{ backgroundColor: '#FFD100', color: '#1a1a1a', opacity: importing ? 0.6 : 1 }}
          >
            {importing ? '...' : 'Importar'}
          </button>
        </motion.div>
      )}

      {/* Carousel — grupos only */}
      {activeSession === 'grupos' && <div
        className="overflow-hidden"
        onTouchStart={handleSwipeTouchStart}
        onTouchEnd={handleSwipeTouchEnd}
      >
        <AnimatePresence mode="popLayout" custom={groupDirection}>
          <motion.div
            key={activeGroup}
            custom={groupDirection}
            variants={SLIDE_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={SPRING}
            className="px-5 pb-8 pt-4 space-y-3"
          >
            {/* Live standings */}
            <div className="card p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-copa-gold mb-0.5">
                Classificação · Grupo {activeGroup}
              </p>
              <p className="text-xs text-slate-600 mb-2">Simulação pelos seus palpites</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-600 border-b border-copa-border">
                    <th className="text-left pb-1.5 font-medium w-5">#</th>
                    <th className="text-left pb-1.5 font-medium max-w-0 w-full">Seleção</th>
                    <th className="text-center pb-1.5 font-medium w-8 px-1">J</th>
                    <th className="text-center pb-1.5 font-medium w-8 px-1">V</th>
                    <th className="text-center pb-1.5 font-medium w-8 px-1">E</th>
                    <th className="text-center pb-1.5 font-medium w-8 px-1">D</th>
                    <th className="text-center pb-1.5 font-medium w-10 px-1">SG</th>
                    <th className="text-center pb-1.5 font-bold text-copa-dark w-10 px-1">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((stat, index) => {
                    const goalDifference = stat.goalsFor - stat.goalsAgainst
                    const isTopTwo = index < 2
                    const isQualifiedThird = index === 2 && qualifyingThirdPlaceTeams.has(stat.team)
                    return (
                      <tr
                        key={stat.team}
                        style={isQualifiedThird ? { color: '#295A71' } : undefined}
                        className={isTopTwo ? 'text-copa-dark' : isQualifiedThird ? '' : 'text-slate-400'}
                      >
                        <td className="py-1.5">
                          <span className={`text-center inline-block w-4 ${
                            isTopTwo ? 'text-copa-gold font-bold' : isQualifiedThird ? 'font-bold' : ''
                          }`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="py-1.5 max-w-0 w-full">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <img
                              src={`/flags/${FLAG_CODES[stat.team] ?? 'xx'}.png`}
                              alt={stat.team}
                              className="w-5 h-3.5 object-cover rounded-sm shrink-0"
                            />
                            <span className="truncate">{stat.team}</span>
                          </div>
                        </td>
                        <td className="text-center py-1.5 px-1">{stat.played}</td>
                        <td className="text-center py-1.5 px-1">{stat.won}</td>
                        <td className="text-center py-1.5 px-1">{stat.drawn}</td>
                        <td className="text-center py-1.5 px-1">{stat.lost}</td>
                        <td className="text-center py-1.5 px-1">
                          {goalDifference > 0 ? `+${goalDifference}` : goalDifference}
                        </td>
                        <td className="text-center py-1.5 px-1 font-bold">{stat.points}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="flex gap-4 text-xs text-slate-600 mt-2 pt-2 border-t border-copa-border">
                <span className="flex items-center gap-1">
                  <span className="text-copa-gold font-bold text-base leading-none">●</span> Classificado direto
                </span>
                <span className="flex items-center gap-1">
                  <span className="font-bold text-base leading-none" style={{ color: '#295A71' }}>●</span> 3º colocado
                </span>
              </div>
            </div>

            {/* Game rows — cardzão único por grupo */}
            {isAllLocked && (
              <div className="text-center py-2 px-3 rounded-xl bg-copa-menta/10 border border-copa-menta/30 text-copa-teal text-sm font-semibold">
                Palpites confirmados — somente visualização
              </div>
            )}

            <div className="card overflow-hidden">
              {activeGroupGames.map((game, index) => {
                const [score1, score2] = scores[game.id] ?? ['', '']
                const matchDate = new Date(game.matchDate)
                const dateStr = matchDate.toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'America/Sao_Paulo',
                })

                return (
                  <div key={game.id}>
                    {index > 0 && <div style={{ height: 1, backgroundColor: '#D9CBAD' }} />}

                    {isAllLocked ? (
                      <div className="p-4">
                        <div className="flex items-center justify-center gap-3">
                          <div className="flex items-center gap-1.5 flex-1 justify-end">
                            <span className="text-sm font-semibold text-copa-dark">
                              {TEAM_ABBR[game.team1] ?? game.team1}
                            </span>
                            <img
                              src={`/flags/${FLAG_CODES[game.team1] ?? 'xx'}.png`}
                              alt={game.team1}
                              className="w-8 h-6 object-cover rounded-sm shrink-0"
                            />
                          </div>
                          <span className="text-xl font-extrabold text-copa-dark tabular-nums shrink-0">
                            {score1} × {score2}
                          </span>
                          <div className="flex items-center gap-1.5 flex-1">
                            <img
                              src={`/flags/${FLAG_CODES[game.team2] ?? 'xx'}.png`}
                              alt={game.team2}
                              className="w-8 h-6 object-cover rounded-sm shrink-0"
                            />
                            <span className="text-sm font-semibold text-copa-dark">
                              {TEAM_ABBR[game.team2] ?? game.team2}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 text-center mt-2">{dateStr}</p>
                        {game.score1 !== null && (
                          <div className="flex items-center justify-center gap-2 mt-1.5">
                            <span className="text-xs font-medium" style={{ color: '#295A71' }}>
                              Resultado: {game.score1} × {game.score2}
                            </span>
                            <PtsTag points={lockedPredictions.get(game.id)?.points} />
                          </div>
                        )}
                      </div>
                    ) : (() => {
                      const isPredictionLocked = lockedPredictions.get(game.id)?.isLocked ?? false
                      const isGameStarted = startedGames.has(game.id)
                      const isDisabled = isPredictionLocked || isGameStarted
                      return (
                        <div className="p-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-1 justify-end">
                              <span className={`text-sm font-semibold ${isGameStarted ? 'text-slate-400' : 'text-copa-dark'}`}>
                                {TEAM_ABBR[game.team1] ?? game.team1}
                              </span>
                              <img
                                src={`/flags/${FLAG_CODES[game.team1] ?? 'xx'}.png`}
                                alt={game.team1}
                                className={`w-8 h-6 object-cover rounded-sm shrink-0 ${isGameStarted ? 'opacity-40' : ''}`}
                              />
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <input
                                ref={el => { score1Refs.current[game.id] = el }}
                                type="text"
                                inputMode="numeric"
                                value={score1}
                                onChange={e => handleScoreChange(game.id, 0, e.target.value)}
                                onFocus={e => e.target.select()}
                                disabled={isDisabled}
                                placeholder="–"
                                className="score-input w-11 h-11 text-center text-lg font-bold rounded-xl"
                              />
                              <span className="text-slate-600 font-bold text-base">×</span>
                              <input
                                ref={el => { score2Refs.current[game.id] = el }}
                                type="text"
                                inputMode="numeric"
                                value={score2}
                                onChange={e => handleScoreChange(game.id, 1, e.target.value)}
                                onFocus={e => e.target.select()}
                                disabled={isDisabled}
                                placeholder="–"
                                className="score-input w-11 h-11 text-center text-lg font-bold rounded-xl"
                              />
                            </div>

                            <div className="flex items-center gap-1.5 flex-1">
                              <img
                                src={`/flags/${FLAG_CODES[game.team2] ?? 'xx'}.png`}
                                alt={game.team2}
                                className={`w-8 h-6 object-cover rounded-sm shrink-0 ${isGameStarted ? 'opacity-40' : ''}`}
                              />
                              <span className={`text-sm font-semibold ${isGameStarted ? 'text-slate-400' : 'text-copa-dark'}`}>
                                {TEAM_ABBR[game.team2] ?? game.team2}
                              </span>
                            </div>
                          </div>

                          <p className="text-xs text-center mt-2">
                            {isGameStarted
                              ? <span className="text-copa-red font-semibold">Jogo iniciado — sem pontuação</span>
                              : <span className="text-slate-600">{dateStr}</span>
                            }
                          </p>
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>

            {allFilled && !isAllLocked && (
              <div className="mt-2 space-y-2">
                {syncError && (
                  <p className="text-copa-red text-sm text-center font-semibold">{syncError}</p>
                )}
                <button
                  className="btn-primary"
                  onClick={handleClickConfirm}
                  disabled={validating}
                >
                  {validating ? 'Verificando palpites...' : 'Confirmar todos os palpites'}
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>}

      {/* Sessão fase de mata-mata (16 avos, oitavas, quartas, semi, final) */}
      {activeRound && (
        <div className="px-5 pb-8 pt-4 space-y-3">
          {isAllLocked && (
            <div className="text-center py-2 px-3 rounded-xl bg-copa-menta/10 border border-copa-menta/30 text-copa-teal text-sm font-semibold">
              {activeRound.lockedLabel}
            </div>
          )}

          <div className="card overflow-hidden">
            {gamesByRound[activeRound.key].map((game, index) => {
              const resolvedTeam1 = resolveTeamName(game.team1)
              const resolvedTeam2 = resolveTeamName(game.team2)
              const [score1, score2] = scores[game.id] ?? ['', '']
              const matchDate = new Date(game.matchDate)
              const dateStr = matchDate.toLocaleDateString('pt-BR', {
                weekday: 'long', day: '2-digit', month: 'short',
                hour: '2-digit', minute: '2-digit',
                timeZone: 'America/Sao_Paulo',
              })
              const isPredictionLocked = lockedPredictions.get(game.id)?.isLocked ?? false
              const isGameStarted = startedGames.has(game.id)
              const matchupDefined = isMatchupDefined(game)
              const isDisabled = isPredictionLocked || isGameStarted || !matchupDefined

              return (
                <div key={game.id}>
                  {index > 0 && <div style={{ height: 1, backgroundColor: '#D9CBAD' }} />}

                  {isAllLocked ? (
                    <div className="p-4">
                      <div className="flex items-center justify-center gap-3">
                        <div className="flex items-center gap-1.5 flex-1 justify-end">
                          <span className="text-sm font-semibold text-copa-dark">
                            {TEAM_ABBR[resolvedTeam1] ?? resolvedTeam1}
                          </span>
                          <img
                            src={`/flags/${FLAG_CODES[resolvedTeam1] ?? FLAG_CODES[game.team1] ?? 'xx'}.png`}
                            alt={resolvedTeam1}
                            className="w-8 h-6 object-cover rounded-sm shrink-0"
                          />
                        </div>
                        <span className="text-xl font-extrabold text-copa-dark tabular-nums shrink-0">
                          {score1 !== '' && score2 !== '' ? `${score1} × ${score2}` : '– × –'}
                        </span>
                        <div className="flex items-center gap-1.5 flex-1">
                          <img
                            src={`/flags/${FLAG_CODES[resolvedTeam2] ?? FLAG_CODES[game.team2] ?? 'xx'}.png`}
                            alt={resolvedTeam2}
                            className="w-8 h-6 object-cover rounded-sm shrink-0"
                          />
                          <span className="text-sm font-semibold text-copa-dark">
                            {TEAM_ABBR[resolvedTeam2] ?? resolvedTeam2}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 text-center mt-2">{dateStr}</p>
                      {game.score1 !== null && (
                        <div className="flex items-center justify-center gap-2 mt-1.5">
                          <span className="text-xs font-medium" style={{ color: '#295A71' }}>
                            Resultado: {game.score1} × {game.score2}
                          </span>
                          <PtsTag points={lockedPredictions.get(game.id)?.points} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-1 justify-end">
                          <span className={`text-sm font-semibold ${isGameStarted ? 'text-slate-400' : 'text-copa-dark'}`}>
                            {TEAM_ABBR[resolvedTeam1] ?? resolvedTeam1}
                          </span>
                          <img
                            src={`/flags/${FLAG_CODES[resolvedTeam1] ?? FLAG_CODES[game.team1] ?? 'xx'}.png`}
                            alt={resolvedTeam1}
                            className={`w-8 h-6 object-cover rounded-sm shrink-0 ${isGameStarted ? 'opacity-40' : ''}`}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            ref={el => { score1Refs.current[game.id] = el }}
                            type="text" inputMode="numeric" value={score1}
                            onChange={e => handleScoreChange(game.id, 0, e.target.value)}
                            onFocus={e => e.target.select()}
                            disabled={isDisabled} placeholder="–"
                            className="score-input w-11 h-11 text-center text-lg font-bold rounded-xl"
                          />
                          <span className="text-slate-600 font-bold text-base">×</span>
                          <input
                            ref={el => { score2Refs.current[game.id] = el }}
                            type="text" inputMode="numeric" value={score2}
                            onChange={e => handleScoreChange(game.id, 1, e.target.value)}
                            onFocus={e => e.target.select()}
                            disabled={isDisabled} placeholder="–"
                            className="score-input w-11 h-11 text-center text-lg font-bold rounded-xl"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 flex-1">
                          <img
                            src={`/flags/${FLAG_CODES[resolvedTeam2] ?? FLAG_CODES[game.team2] ?? 'xx'}.png`}
                            alt={resolvedTeam2}
                            className={`w-8 h-6 object-cover rounded-sm shrink-0 ${isGameStarted ? 'opacity-40' : ''}`}
                          />
                          <span className={`text-sm font-semibold ${isGameStarted ? 'text-slate-400' : 'text-copa-dark'}`}>
                            {TEAM_ABBR[resolvedTeam2] ?? resolvedTeam2}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-center mt-2">
                        {!matchupDefined
                          ? <span className="text-slate-500 italic">Confronto ainda não definido</span>
                          : isGameStarted
                            ? <span className="text-copa-red font-semibold">Jogo iniciado — sem pontuação</span>
                            : <span className="text-slate-600">{dateStr}</span>
                        }
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {!gamesByRound[activeRound.key].every(g => isMatchupDefined(g)) && (
            <p className="text-xs text-slate-500 text-center px-2">
              Você já pode preencher os confrontos definidos. A confirmação só é liberada quando todos os confrontos desta fase saírem.
            </p>
          )}

          {allFilled && !isAllLocked && openGames.length > 0 && (
            <div className="mt-2 space-y-2">
              {syncError && (
                <p className="text-copa-red text-sm text-center font-semibold">{syncError}</p>
              )}
              <button
                className="btn-primary"
                onClick={handleClickConfirm}
                disabled={validating}
              >
                {validating ? 'Verificando palpites...' : activeRound.confirmLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
