import { useState, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../services/api'
import { Game, Prediction, Pool } from '../types'
import FlagImage, { FLAG_CODES } from '../components/FlagImage'

const SLIDE_VARIANTS = {
  enter: (direction: number) => ({ x: direction > 0 ? '100%' : '-100%' }),
  center: { x: 0 },
  exit: (direction: number) => ({ x: direction > 0 ? '-100%' : '100%' }),
}

const SPRING = { type: 'spring', stiffness: 600, damping: 50 }

export default function PredictionsPage() {
  const { poolCode } = useParams<{ poolCode: string }>()
  const navigate = useNavigate()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [scores, setScores] = useState<Record<string, [string, string]>>({})
  const [savingGameId, setSavingGameId] = useState<string | null>(null)
  const score1Refs = useRef<Record<string, HTMLInputElement | null>>({})
  const score2Refs = useRef<Record<string, HTMLInputElement | null>>({})
  const nextButtonRef = useRef<HTMLButtonElement>(null)
  const keyboardAnchorRef = useRef<HTMLInputElement>(null)
  const initialFocusDone = useRef(false)
  const [showNavigation, setShowNavigation] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [lockError, setLockError] = useState('')
  const [locking, setLocking] = useState(false)

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

  useEffect(() => {
    if (!savedPredictions || !games) return
    const loaded: Record<string, [string, string]> = {}
    for (const p of savedPredictions) {
      loaded[p.gameId] = [String(p.score1), String(p.score2)]
    }
    setScores(loaded)
    const filled = savedPredictions.length
    if (filled > 0 && filled < games.length) setCurrentIndex(filled)
  }, [savedPredictions, games])

  useEffect(() => {
    if (!games) return
    const game = games[currentIndex]
    if (!game) return
    const [cs1, cs2] = scores[game.id] ?? ['', '']
    const locked = savedPredictions?.find(p => p.gameId === game.id)?.isLocked ?? false
    if (cs1 !== '' && cs2 !== '' && !locked) {
      nextButtonRef.current?.focus()
    }
  }, [scores, currentIndex])

  useEffect(() => {
    if (!games || initialFocusDone.current) return
    initialFocusDone.current = true
    const timer = setTimeout(() => {
      score1Refs.current[games[currentIndex]?.id ?? '']?.focus({ preventScroll: true })
    }, 300)
    return () => clearTimeout(timer)
  }, [games])

  const saveMutation = useMutation({
    mutationFn: ({ gameId, score1, score2 }: { gameId: string; score1: number; score2: number }) =>
      api.post('/predictions/save', { poolId: pool!.id, gameId, score1, score2 }),
  })

  function saveCurrentInBackground() {
    if (!currentGame || !pool) return
    const [cs1, cs2] = scores[currentGame.id] ?? ['', '']
    if (cs1 === '' || cs2 === '') return
    setSavingGameId(currentGame.id)
    saveMutation.mutateAsync({ gameId: currentGame.id, score1: Number(cs1), score2: Number(cs2) })
      .catch(() => {})
      .finally(() => setSavingGameId(null))
  }

  function goToGame(delta: number) {
    if (!games || !currentGame) return
    const next = currentIndex + delta
    if (next < 0 || next >= games.length) return
    saveCurrentInBackground()
    const nextGame = games[next]
    const [ns1, ns2] = scores[nextGame.id] ?? ['', '']
    const nextIsFilled = ns1 !== '' && ns2 !== ''
    if (!nextIsFilled) {
      keyboardAnchorRef.current?.focus({ preventScroll: true })
    }
    flushSync(() => {
      setDirection(delta)
      setCurrentIndex(next)
    })
    if (!nextIsFilled) {
      setTimeout(() => score1Refs.current[nextGame.id]?.focus({ preventScroll: true }), 160)
    }
  }

  function jumpToGame(index: number) {
    if (!games) return
    saveCurrentInBackground()
    const targetGame = games[index]
    const [ts1, ts2] = scores[targetGame.id] ?? ['', '']
    const targetIsFilled = ts1 !== '' && ts2 !== ''
    if (!targetIsFilled) {
      keyboardAnchorRef.current?.focus({ preventScroll: true })
    }
    flushSync(() => {
      setDirection(index > currentIndex ? 1 : -1)
      setCurrentIndex(index)
      setShowNavigation(false)
    })
    if (!targetIsFilled) {
      setTimeout(() => score1Refs.current[targetGame.id]?.focus({ preventScroll: true }), 160)
    }
  }

  async function saveAndConfirm() {
    if (!games || !currentGame || !pool) return
    const [cs1, cs2] = scores[currentGame.id] ?? ['', '']
    if (cs1 !== '' && cs2 !== '') {
      setSavingGameId(currentGame.id)
      try {
        await saveMutation.mutateAsync({ gameId: currentGame.id, score1: Number(cs1), score2: Number(cs2) })
      } catch { /* silent */ }
      finally { setSavingGameId(null) }
    }
    setShowConfirm(true)
  }

  function handleScoreChange(team: 0 | 1, value: string) {
    if (!currentGame) return
    const digits = value.replace(/\D/g, '').slice(0, 2)
    const prev = scores[currentGame.id] ?? ['', '']
    const updated: [string, string] = team === 0 ? [digits, prev[1]] : [prev[0], digits]
    setScores(s => ({ ...s, [currentGame.id]: updated }))

    if (team === 0 && digits.length >= 1) {
      const s2 = score2Refs.current[currentGame.id]
      s2?.focus({ preventScroll: true })
      s2?.select()
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
    } finally { setLocking(false) }
  }

  if (!games || !pool) {
    return <div className="flex items-center justify-center min-h-screen text-slate-400">Carregando...</div>
  }

  const currentGame = games[currentIndex]
  const filledCount = Object.values(scores).filter(([s1, s2]) => s1 !== '' && s2 !== '').length
  const isCurrentLocked = savedPredictions?.find(p => p.gameId === currentGame?.id)?.isLocked ?? false
  const [s1, s2] = scores[currentGame?.id] ?? ['', '']
  const matchDate = new Date(currentGame.matchDate)
  const dateStr = matchDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', weekday: 'short' })
  const isSaving = savingGameId === currentGame.id

  // Group games by group letter
  const groups = 'ABCDEFGHIJKL'.split('')
  const gamesByGroup: Record<string, Game[]> = {}
  for (const g of groups) gamesByGroup[g] = []
  for (const game of games) gamesByGroup[game.group]?.push(game)

  if (showConfirm) {
    return (
      <motion.div
        className="min-h-screen flex flex-col justify-center px-6"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-extrabold text-white">Confirmar palpites?</h2>
          <p className="text-slate-400 mt-3 leading-relaxed text-sm">
            Você preencheu <span className="text-copa-gold font-bold">{filledCount} de {games.length}</span> jogos.
          </p>
          <p className="text-copa-red text-sm font-semibold mt-2">
            Após confirmar, não será possível alterar.
          </p>
        </div>
        {lockError && <p className="text-copa-red text-sm text-center mb-4">{lockError}</p>}
        <div className="space-y-3">
          <button className="btn-primary" onClick={handleLockAll} disabled={locking}>
            {locking ? 'Confirmando...' : '✅ Confirmar e travar palpites'}
          </button>
          <button className="btn-secondary" onClick={() => setShowConfirm(false)}>
            Voltar e revisar
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Keyboard anchor: keeps iOS keyboard open during game transitions */}
      <input
        ref={keyboardAnchorRef}
        inputMode="numeric"
        value=""
        onChange={() => {}}
        aria-hidden="true"
        tabIndex={-1}
        style={{ position: 'fixed', bottom: 0, left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
      />

      {/* Header */}
      <div className="px-5 pt-6 pb-3 bg-copa-dark border-b border-copa-border">
        <div className="flex justify-between items-center mb-3">
          <button onClick={() => navigate(`/ranking/${poolCode}`)} className="text-slate-400 text-sm">
            ← {pool.name}
          </button>
          <span className={`text-sm font-medium transition-colors ${isSaving ? 'text-copa-green' : 'text-slate-400'}`}>
            {isSaving ? '💾 Salvando...' : `${filledCount}/${games.length} palpites`}
          </span>
        </div>
        <div className="h-1.5 bg-copa-border rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-copa-gold rounded-full"
            animate={{ width: `${(filledCount / games.length) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      {/* Collapsible group navigation */}
      <div className="border-b border-copa-border">
        <button
          className="w-full px-5 py-3 flex justify-between items-center text-sm text-slate-400 active:bg-copa-card transition-colors"
          onClick={() => setShowNavigation(v => !v)}
        >
          <span className="font-medium">
            📋 Navegar por grupo
          </span>
          <span className="flex items-center gap-2">
            <span className="text-xs text-copa-gold font-bold">
              Jogo {currentGame.number} · Grupo {currentGame.group}
            </span>
            <span className={`transition-transform duration-200 ${showNavigation ? 'rotate-180' : ''}`}>▾</span>
          </span>
        </button>

        <AnimatePresence>
          {showNavigation && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-2 space-y-3">
                {groups.map(groupLetter => {
                  const groupGames = gamesByGroup[groupLetter]
                  if (!groupGames?.length) return null
                  const groupTeams = [...new Set(groupGames.flatMap(g => [g.team1, g.team2]))]
                  return (
                    <div key={groupLetter}>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Grupo {groupLetter}{' '}
                        <span className="font-normal normal-case text-slate-600">
                          ({groupTeams.join(', ')})
                        </span>
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {groupGames.map(game => {
                          const gameIndex = games.findIndex(g => g.id === game.id)
                          const filled = (scores[game.id]?.[0] ?? '') !== '' && (scores[game.id]?.[1] ?? '') !== ''
                          const isCurrent = gameIndex === currentIndex
                          return (
                            <button
                              key={game.id}
                              onClick={() => jumpToGame(gameIndex)}
                              className={`h-9 px-1.5 rounded-xl flex items-center gap-1 transition-all active:scale-90 ${
                                isCurrent
                                  ? 'bg-copa-gold scale-110 shadow-lg shadow-copa-gold/30'
                                  : filled
                                  ? 'bg-copa-green/20 border border-copa-green/40'
                                  : 'bg-copa-border'
                              }`}
                            >
                              <img
                                src={`/flags/${FLAG_CODES[game.team1] ?? 'xx'}.png`}
                                alt={game.team1}
                                className="w-6 h-4 object-cover rounded-sm"
                              />
                              <img
                                src={`/flags/${FLAG_CODES[game.team2] ?? 'xx'}.png`}
                                alt={game.team2}
                                className="w-6 h-4 object-cover rounded-sm"
                              />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Game card carousel */}
      <div className="mt-5 mx-5 relative overflow-hidden" style={{ minHeight: '200px' }}>
        <AnimatePresence mode="sync" custom={direction}>
          <motion.div
            key={currentGame.id}
            className="absolute inset-x-0 top-0"
            custom={direction}
            variants={SLIDE_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={SPRING}
          >
            <div className="card p-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-copa-gold bg-copa-gold/10 px-3 py-1 rounded-full">
                  Grupo {currentGame.group}
                </span>
                <span className="text-slate-400 text-xs">{dateStr}</span>
              </div>

              <div className="flex items-center justify-between gap-2 mb-4">
                {/* Team 1 */}
                <div className="flex-1 text-center">
                  <div className="w-12 h-8 mx-auto mb-2 overflow-hidden rounded-sm">
                    <FlagImage team={currentGame.team1} size={48} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-xs font-bold text-white leading-snug">{currentGame.team1}</p>
                </div>

                {/* Scores */}
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    ref={el => { score1Refs.current[currentGame.id] = el }}
                    className={`score-input ${isCurrentLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                    type="text"
                    inputMode="numeric"
                    value={s1}
                    onChange={e => handleScoreChange(0, e.target.value)}
                    onFocus={e => e.target.select()}
                    disabled={isCurrentLocked}
                    placeholder="–"
                  />
                  <span className="text-slate-500 font-bold text-lg">×</span>
                  <input
                    ref={el => { score2Refs.current[currentGame.id] = el }}
                    className={`score-input ${isCurrentLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                    type="text"
                    inputMode="numeric"
                    value={s2}
                    onChange={e => handleScoreChange(1, e.target.value)}
                    onFocus={e => e.target.select()}
                    disabled={isCurrentLocked}
                    placeholder="–"
                  />
                </div>

                {/* Team 2 */}
                <div className="flex-1 text-center">
                  <div className="w-12 h-8 mx-auto mb-2 overflow-hidden rounded-sm">
                    <FlagImage team={currentGame.team2} size={48} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-xs font-bold text-white leading-snug">{currentGame.team2}</p>
                </div>
              </div>

              <p className="text-center text-xs text-slate-500">
                Jogo {currentGame.number} de {games.length}
                {isCurrentLocked && <span className="ml-2 text-copa-green">🔒 confirmado</span>}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation buttons */}
      <div className="px-5 pt-4 pb-8 space-y-3">
        {currentIndex < games.length - 1 ? (
          <button
            ref={nextButtonRef}
            className={`btn-primary ${s1 === '' || s2 === '' ? 'opacity-40' : ''}`}
            onClick={() => goToGame(1)}
            disabled={s1 === '' || s2 === '' || isSaving}
          >
            {isSaving ? 'Salvando...' : 'Próximo jogo →'}
          </button>
        ) : (
          <button
            className="btn-primary"
            onClick={saveAndConfirm}
            disabled={filledCount < games.length || isSaving}
          >
            {filledCount < games.length
              ? `Faltam ${games.length - filledCount} palpites`
              : '🏆 Confirmar todos os palpites'}
          </button>
        )}
        {currentIndex > 0 && (
          <button className="btn-secondary" onClick={() => goToGame(-1)}>
            ← Anterior
          </button>
        )}
      </div>
    </div>
  )
}
