import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { Game } from '../types'

function utcToSaoPauloInput(utcIso: string): string {
  const d = new Date(utcIso)
  const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000)
  return brt.toISOString().slice(0, 16)
}

function saoPauloInputToUtc(brtValue: string): string {
  const brtAsUtc = new Date(brtValue + ':00Z')
  return new Date(brtAsUtc.getTime() + 3 * 60 * 60 * 1000).toISOString()
}

export default function AdminPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [gameNumber, setGameNumber] = useState('')
  const [score1, setScore1] = useState('')
  const [score2, setScore2] = useState('')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [fetching, setFetching] = useState(false)
  const [syncingBracket, setSyncingBracket] = useState(false)
  const [editTimeGameNumber, setEditTimeGameNumber] = useState('')
  const [editMatchDatePart, setEditMatchDatePart] = useState('')
  const [editMatchTimePart, setEditMatchTimePart] = useState('')
  const [timeFeedback, setTimeFeedback] = useState('')
  const [timeError, setTimeError] = useState('')

  const { data: gamesData, refetch } = useQuery({
    queryKey: ['games-admin'],
    queryFn: async () => {
      const { data } = await api.get('/games')
      return data.games as Game[]
    },
  })

  if (!user?.isAdmin) {
    navigate('/')
    return null
  }

  async function handleUpdateResult(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setFeedback('')
    try {
      const { data } = await api.post('/admin/results', {
        gameNumber: Number(gameNumber),
        score1: Number(score1),
        score2: Number(score2),
      })
      setFeedback(data.message)
      setGameNumber('')
      setScore1('')
      setScore2('')
      refetch()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Erro ao atualizar')
    }
  }

  function handleEditGameNumberChange(value: string) {
    setEditTimeGameNumber(value)
    const found = gamesData?.find(g => g.number === Number(value))
    if (found) {
      const brt = utcToSaoPauloInput(found.matchDate.toString())
      setEditMatchDatePart(brt.slice(0, 10))
      setEditMatchTimePart(brt.slice(11, 16))
    } else {
      setEditMatchDatePart('')
      setEditMatchTimePart('')
    }
  }

  async function handleUpdateMatchDate(e: React.FormEvent) {
    e.preventDefault()
    setTimeError('')
    setTimeFeedback('')
    try {
      const utcDate = saoPauloInputToUtc(`${editMatchDatePart}T${editMatchTimePart}`)
      const { data } = await api.patch(`/admin/games/${editTimeGameNumber}/match-date`, {
        matchDate: utcDate,
      })
      setTimeFeedback(data.message)
      refetch()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setTimeError(msg || 'Erro ao atualizar horário')
    }
  }

  async function handleSyncBracket() {
    setSyncingBracket(true)
    setError('')
    setFeedback('')
    try {
      const { data } = await api.post('/admin/sync-bracket')
      setFeedback(data.message)
      refetch()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Erro ao sincronizar bracket')
    } finally {
      setSyncingBracket(false)
    }
  }

  async function handleFetchFromGlobo() {
    setFetching(true)
    setError('')
    setFeedback('')
    try {
      const { data } = await api.post('/admin/fetch-results')
      setFeedback(data.message)
      refetch()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Falha no scraping do GE Globo')
    } finally {
      setFetching(false)
    }
  }

  const finishedGames = gamesData?.filter(g => g.score1 !== null) ?? []
  const pendingGames = gamesData?.filter(g => g.score1 === null) ?? []

  return (
    <div className="min-h-screen px-5 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-xl font-extrabold text-copa-dark">🔧 Admin</h1>
        <button onClick={() => navigate('/pools')} className="text-slate-600 text-sm">← Voltar</button>
      </div>

      <div className="space-y-5">
        {/* Manual update */}
        <div className="card p-5">
          <h2 className="font-bold text-copa-dark mb-4">Inserir resultado manualmente</h2>
          <form onSubmit={handleUpdateResult} className="space-y-3">
            <input
              className="input-field"
              type="number"
              placeholder="Número do jogo (1-72)"
              value={gameNumber}
              onChange={e => setGameNumber(e.target.value)}
              min="1" max="72"
              required
            />
            <div className="flex gap-3">
              <input
                className="input-field text-center text-xl font-bold"
                type="number"
                placeholder="Gols time 1"
                value={score1}
                onChange={e => setScore1(e.target.value)}
                min="0"
                required
              />
              <span className="text-slate-600 text-2xl flex items-center font-bold">x</span>
              <input
                className="input-field text-center text-xl font-bold"
                type="number"
                placeholder="Gols time 2"
                value={score2}
                onChange={e => setScore2(e.target.value)}
                min="0"
                required
              />
            </div>
            <button type="submit" className="btn-primary">Salvar resultado</button>
          </form>
        </div>

        {/* Auto fetch */}
        <div className="card p-5">
          <h2 className="font-bold text-copa-dark mb-2">Sincronizar com ESPN</h2>
          <p className="text-slate-600 text-sm mb-4">Busca resultados de jogos finalizados via ESPN e atualiza automaticamente.</p>
          <button
            className="btn-secondary"
            onClick={handleFetchFromGlobo}
            disabled={fetching}
          >
            {fetching ? 'Sincronizando...' : 'Sincronizar resultados'}
          </button>
        </div>

        {/* Sync bracket */}
        <div className="card p-5">
          <h2 className="font-bold text-copa-dark mb-2">Atualizar bracket do mata-mata</h2>
          <p className="text-slate-600 text-sm mb-4">Conforme os times avançam, atualiza automaticamente os nomes nas próximas fases (oitavas, quartas, semis, final).</p>
          <button
            className="btn-secondary"
            onClick={handleSyncBracket}
            disabled={syncingBracket}
          >
            {syncingBracket ? 'Atualizando...' : 'Atualizar bracket'}
          </button>
        </div>

        {/* Edit match time */}
        <div className="card p-5">
          <h2 className="font-bold text-copa-dark mb-4">Alterar horário de jogo</h2>
          <form onSubmit={handleUpdateMatchDate} className="space-y-3">
            <input
              className="input-field"
              type="number"
              placeholder="Número do jogo (1-72)"
              value={editTimeGameNumber}
              onChange={e => handleEditGameNumberChange(e.target.value)}
              min="1" max="72"
              required
            />
            {editTimeGameNumber && gamesData?.find(g => g.number === Number(editTimeGameNumber)) && (
              <p className="text-xs text-slate-500">
                {gamesData.find(g => g.number === Number(editTimeGameNumber))!.team1} x{' '}
                {gamesData.find(g => g.number === Number(editTimeGameNumber))!.team2}
              </p>
            )}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Horário de Brasília (BRT)</label>
              <div className="flex gap-2">
                <input
                  className="input-field flex-1 min-w-0"
                  type="date"
                  value={editMatchDatePart}
                  onChange={e => setEditMatchDatePart(e.target.value)}
                  required
                />
                <input
                  className="input-field w-28"
                  type="time"
                  value={editMatchTimePart}
                  onChange={e => setEditMatchTimePart(e.target.value)}
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={!editMatchDatePart || !editMatchTimePart}>
              Salvar horário
            </button>
          </form>
          {timeFeedback && (
            <motion.p className="text-copa-menta text-sm font-semibold mt-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {timeFeedback}
            </motion.p>
          )}
          {timeError && (
            <motion.p className="text-copa-red text-sm font-semibold mt-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {timeError}
            </motion.p>
          )}
        </div>

        {feedback && (
          <motion.p
            className="text-copa-menta text-center font-semibold"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {feedback}
          </motion.p>
        )}
        {error && (
          <motion.p
            className="text-copa-red text-center font-semibold"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {error}
          </motion.p>
        )}

        {/* Status */}
        <div className="card p-5">
          <h2 className="font-bold text-copa-dark mb-3">Status dos jogos</h2>
          <div className="flex gap-4 text-center mb-4">
            <div className="flex-1 bg-copa-menta/10 rounded-xl p-3">
              <p className="text-2xl font-extrabold text-copa-menta">{finishedGames.length}</p>
              <p className="text-xs text-slate-600">com resultado</p>
            </div>
            <div className="flex-1 bg-slate-800 rounded-xl p-3">
              <p className="text-2xl font-extrabold text-slate-600">{pendingGames.length}</p>
              <p className="text-xs text-slate-600">aguardando</p>
            </div>
          </div>
          {finishedGames.slice(-5).reverse().map(game => (
            <div key={game.id} className="flex justify-between items-center py-2 border-b border-copa-border last:border-0">
              <span className="text-sm text-slate-600">Jogo {game.number} · {game.team1} x {game.team2}</span>
              <span className="text-copa-gold font-bold text-sm">{game.score1} x {game.score2}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
