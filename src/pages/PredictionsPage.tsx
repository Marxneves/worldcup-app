import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { Game, Prediction, Pool } from '../types'
import { FLAG_CODES, TEAM_ABBR } from '../components/FlagImage'

const GROUPS = 'ABCDEFGHIJKL'.split('')

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
  const color = points === 3 ? '#00FEA8' : points === 1 ? '#FFD100' : '#e63946'
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
  const [savingGames, setSavingGames] = useState<Record<string, boolean>>({})
  const [showConfirm, setShowConfirm] = useState(false)
  const [lockError, setLockError] = useState('')
  const [locking, setLocking] = useState(false)
  const [importing, setImporting] = useState(false)
  const queryClient = useQueryClient()

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
      const groupGames = games
        .filter(g => g.group === activeGroup)
        .sort((a, b) => a.number - b.number)
      const currentIdx = groupGames.findIndex(g => g.id === gameId)
      const nextGame = groupGames[currentIdx + 1]
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
      await api.post('/predictions/lock-all', { poolId: pool.id })
      navigate(`/ranking/${poolCode}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setLockError(msg || 'Erro ao confirmar palpites')
    } finally {
      setLocking(false)
    }
  }

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

  const filledCount = Object.values(scores).filter(
    ([score1, score2]) => score1 !== '' && score2 !== ''
  ).length

  const lockedPredictions = new Map(savedPredictions?.map(p => [p.gameId, p]) ?? [])
  const allFilled = filledCount === games.length
  const isAllLocked = !!savedPredictions?.length && savedPredictions.every(p => p.isLocked)

  if (showConfirm) {
    return (
      <motion.div
        className="min-h-screen flex flex-col justify-center px-6"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="text-center mb-8">
          <h2 className="text-2xl font-extrabold text-copa-dark">Confirmar palpites?</h2>
          <p className="text-slate-600 mt-3 leading-relaxed text-sm">
            Você preencheu <span className="text-copa-gold font-bold">{filledCount} de {games.length}</span> jogos.
          </p>
          <p className="text-copa-red text-sm font-semibold mt-2">
            Após confirmar, não será possível alterar.
          </p>
        </div>
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
      <div className="px-5 pt-6 pb-3 border-b border-copa-border sticky top-0 z-20" style={{ backgroundColor: '#F5EDD0' }}>
        <div className="flex justify-between items-center mb-3">
          <button
            onClick={() => navigate(`/ranking/${poolCode}`)}
            className="text-slate-600 text-sm"
          >
            ← {pool.name}
          </button>
          <span className="text-sm text-slate-600">
            {filledCount}/{games.length} palpites
          </span>
        </div>

        <div className="h-1.5 bg-copa-border rounded-full overflow-hidden mb-3">
          <motion.div
            className="h-full bg-copa-gold rounded-full"
            animate={{ width: `${(filledCount / games.length) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

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
                  backgroundColor: activeGroup === groupLetter ? '#FFD100' : isGroupComplete ? 'rgba(0,254,168,0.15)' : '#F5EDD0',
                  color: '#1a1a1a',
                  border: isGroupComplete && activeGroup !== groupLetter ? '1px solid rgba(0,254,168,0.4)' : '1px solid transparent',
                }}
              >
                {groupLetter}
              </button>
            )
          })}
        </div>
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

      {/* Carousel — clips horizontal overflow while allowing vertical page scroll */}
      <div
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
                    <th className="text-left pb-1.5 font-medium">Seleção</th>
                    <th className="text-center pb-1.5 font-medium w-6">J</th>
                    <th className="text-center pb-1.5 font-medium w-6">V</th>
                    <th className="text-center pb-1.5 font-medium w-6">E</th>
                    <th className="text-center pb-1.5 font-medium w-6">D</th>
                    <th className="text-center pb-1.5 font-medium w-8">SG</th>
                    <th className="text-center pb-1.5 font-bold text-copa-dark w-8">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((stat, index) => {
                    const goalDifference = stat.goalsFor - stat.goalsAgainst
                    const isTopTwo = index < 2
                    const isPotentialThirdQualifier = index === 2 && qualifyingThirdPlaceTeams.has(stat.team)
                    return (
                      <tr
                        key={stat.team}
                        className={
                          isTopTwo ? 'text-copa-dark' :
                          isPotentialThirdQualifier ? 'text-copa-menta' :
                          'text-slate-600'
                        }
                      >
                        <td className="py-1.5">
                          <span className={`text-center inline-block w-4 ${
                            isTopTwo ? 'text-copa-gold font-bold' :
                            isPotentialThirdQualifier ? 'text-copa-menta font-bold' :
                            ''
                          }`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="py-1.5">
                          <div className="flex items-center gap-1.5">
                            <img
                              src={`/flags/${FLAG_CODES[stat.team] ?? 'xx'}.png`}
                              alt={stat.team}
                              className="w-5 h-3.5 object-cover rounded-sm shrink-0"
                            />
                            <span>{TEAM_ABBR[stat.team] ?? stat.team}</span>
                          </div>
                        </td>
                        <td className="text-center py-1.5">{stat.played}</td>
                        <td className="text-center py-1.5">{stat.won}</td>
                        <td className="text-center py-1.5">{stat.drawn}</td>
                        <td className="text-center py-1.5">{stat.lost}</td>
                        <td className="text-center py-1.5">
                          {goalDifference > 0 ? `+${goalDifference}` : goalDifference}
                        </td>
                        <td className="text-center py-1.5 font-bold">{stat.points}</td>
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
                  <span className="text-copa-menta font-bold text-base leading-none">●</span> Melhor 3º geral
                </span>
              </div>
            </div>

            {/* Game rows — cardzão único por grupo */}
            {isAllLocked && (
              <div className="text-center py-2 px-3 rounded-xl bg-copa-menta/10 border border-copa-menta/30 text-copa-teal text-sm font-semibold">
                🔒 Palpites confirmados — somente visualização
              </div>
            )}

            <div className="card overflow-hidden">
              {activeGroupGames.map((game, index) => {
                const [score1, score2] = scores[game.id] ?? ['', '']
                const isSaving = savingGames[game.id] ?? false
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
                      return (
                        <div className="p-4">
                          <div className="flex items-center justify-between gap-2">
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

                            <div className="flex items-center gap-1.5 shrink-0">
                              <input
                                ref={el => { score1Refs.current[game.id] = el }}
                                type="text"
                                inputMode="numeric"
                                value={score1}
                                onChange={e => handleScoreChange(game.id, 0, e.target.value)}
                                onFocus={e => e.target.select()}
                                disabled={isPredictionLocked}
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
                                disabled={isPredictionLocked}
                                placeholder="–"
                                className="score-input w-11 h-11 text-center text-lg font-bold rounded-xl"
                              />
                            </div>

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

                          <p className="text-xs text-slate-600 text-center mt-2">
                            {dateStr}
                          </p>
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>

            {allFilled && !isAllLocked && (
              <button
                className="btn-primary mt-2"
                onClick={() => { setShowConfirm(true); window.scrollTo({ top: 0, behavior: 'instant' }) }}
              >
                🏆 Confirmar todos os palpites
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
