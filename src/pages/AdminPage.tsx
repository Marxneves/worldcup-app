import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { Game } from '../types'

export default function AdminPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [gameNumber, setGameNumber] = useState('')
  const [score1, setScore1] = useState('')
  const [score2, setScore2] = useState('')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [fetching, setFetching] = useState(false)

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
          <h2 className="font-bold text-copa-dark mb-2">Buscar do GE Globo</h2>
          <p className="text-slate-600 text-sm mb-4">Tenta buscar resultados automaticamente. Use como complemento ao cadastro manual.</p>
          <button
            className="btn-secondary"
            onClick={handleFetchFromGlobo}
            disabled={fetching}
          >
            {fetching ? '⏳ Buscando...' : '🌐 Buscar resultados agora'}
          </button>
        </div>

        {feedback && (
          <motion.p
            className="text-copa-menta text-center font-semibold"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            ✅ {feedback}
          </motion.p>
        )}
        {error && (
          <motion.p
            className="text-copa-red text-center font-semibold"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            ❌ {error}
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
