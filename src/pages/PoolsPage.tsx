import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { Pool } from '../types'

const TRASH_WIDTH = 72

interface PoolCardProps {
  pool: Pool
  onLeave: (code: string) => void
  onNavigate: (code: string) => void
  isLeaving: boolean
}

function PoolCard({ pool, onLeave, onNavigate, isLeaving }: PoolCardProps) {
  const [swiped, setSwiped] = useState(false)
  const touchStartX = useRef(0)

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (delta < -50) setSwiped(true)
    else if (delta > 30) setSwiped(false)
  }

  function handleClick() {
    if (swiped) { setSwiped(false); return }
    onNavigate(pool.code)
  }

  return (
    <div style={{ overflow: 'hidden' }}>
      {/* Card + lixeira num mesmo flex que desliza junto — a lixeira fica fora da área visível até o swipe */}
      <motion.div
        style={{ display: 'flex', width: `calc(100% + ${TRASH_WIDTH}px)` }}
        animate={{ x: swiped ? -TRASH_WIDTH : 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 40, mass: 0.8 }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Card */}
        <div
          className="card p-4 flex items-center gap-3 cursor-pointer"
          style={{ flex: 1, minWidth: 0, borderRadius: '1rem' }}
          onClick={handleClick}
        >
          <div className="flex-1 min-w-0">
            <p className="font-bold text-copa-dark">{pool.name}</p>
            <p className="text-slate-600 text-sm mt-0.5">
              {pool.memberCount} participante{(pool.memberCount ?? 0) > 1 ? 's' : ''}
            </p>
          </div>
          <span className="text-slate-600 text-xl shrink-0">›</span>
        </div>

        {/* Lixeira — sempre à direita do card, invisível até o swipe */}
        <div
            style={{
              width: TRASH_WIDTH,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#F5EDD0',
            }}
          >
            <button
              onClick={() => onLeave(pool.code)}
              disabled={isLeaving}
              style={{ padding: '0.75rem', display: 'flex' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          </div>
      </motion.div>
    </div>
  )
}

export default function PoolsPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'list' | 'join' | 'create'>('list')
  const [code, setCode] = useState('')
  const [poolName, setPoolName] = useState('')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    ;(document.activeElement as HTMLElement)?.blur()
    const timer = setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' }), 100)
    return () => clearTimeout(timer)
  }, [mode])

  const { data, isLoading } = useQuery({
    queryKey: ['my-pools'],
    queryFn: async () => {
      const { data } = await api.get('/pools/my')
      return data.pools as Pool[]
    },
  })

  const joinMutation = useMutation({
    mutationFn: (joinCode: string) => api.post('/pools/join', { code: joinCode }),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['my-pools'] })
      navigate(`/ranking/${data.pool.code}`)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Bolão não encontrado')
    },
  })

  const leaveMutation = useMutation({
    mutationFn: (poolCode: string) => api.delete(`/pools/${poolCode}/leave`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-pools'] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Erro ao sair do bolão')
    },
  })

  const createMutation = useMutation({
    mutationFn: (name: string) => api.post('/pools', { name }),
    onSuccess: ({ data }) => {
      setFeedback(`Bolão criado! Código: ${data.pool.code}`)
      queryClient.invalidateQueries({ queryKey: ['my-pools'] })
      setTimeout(() => navigate(`/ranking/${data.pool.code}`), 1500)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Erro ao criar bolão')
    },
  })

  function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    joinMutation.mutate(code.toUpperCase())
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    createMutation.mutate(poolName)
  }

  return (
    <div className="min-h-screen px-5 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-copa-dark">⚽ Meus Bolões</h1>
          <p className="text-slate-600 text-sm mt-0.5">Olá, {user?.name}!</p>
        </div>
        <button onClick={logout} className="text-slate-600 text-sm">Sair</button>
      </div>

      {error && (
        <p className="text-copa-red text-sm text-center mb-4">{error}</p>
      )}

      <AnimatePresence mode="wait">
        {mode === 'list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {isLoading ? (
              <div className="text-slate-600 text-center py-12">Carregando...</div>
            ) : data && data.length > 0 ? (
              <div className="space-y-3 mb-6">
                {data.map(pool => (
                  <PoolCard
                    key={pool.id}
                    pool={pool}
                    onLeave={poolCode => leaveMutation.mutate(poolCode)}
                    onNavigate={poolCode => navigate(`/ranking/${poolCode}`)}
                    isLeaving={leaveMutation.isPending}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <p className="text-4xl mb-3">🏆</p>
                <p className="text-slate-600">Você ainda não está em nenhum bolão</p>
              </div>
            )}

            <div className="space-y-3 mt-4">
              <button className="btn-primary" onClick={() => { setMode('join'); setError('') }}>
                Entrar em um bolão
              </button>
              <button className="btn-secondary" onClick={() => { setMode('create'); setError('') }}>
                Criar novo bolão
              </button>
            </div>
          </motion.div>
        )}

        {mode === 'join' && (
          <motion.div
            key="join"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
          >
            <button onClick={() => { setMode('list') }} className="text-slate-600 mb-6 flex items-center gap-2">
              ← Voltar
            </button>
            <h2 className="text-xl font-bold text-copa-dark mb-6">Entrar em um bolão</h2>
            <form onSubmit={handleJoin} className="space-y-4">
              <input
                className="input-field uppercase text-center text-2xl tracking-widest font-bold placeholder:text-sm placeholder:tracking-normal placeholder:font-normal placeholder:normal-case"
                placeholder="Código (ex: ABC123)"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase().slice(0, 6))}
                maxLength={6}
                required
              />
              {error && <p className="text-copa-red text-sm text-center">{error}</p>}
              <button type="submit" className="btn-primary" disabled={joinMutation.isPending}>
                {joinMutation.isPending ? 'Entrando...' : 'Entrar no bolão'}
              </button>
            </form>
          </motion.div>
        )}

        {mode === 'create' && (
          <motion.div
            key="create"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
          >
            <button onClick={() => { setMode('list') }} className="text-slate-600 mb-6 flex items-center gap-2">
              ← Voltar
            </button>
            <h2 className="text-xl font-bold text-copa-dark mb-6">Criar novo bolão</h2>
            {feedback ? (
              <motion.div
                className="text-center py-8"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                <p className="text-4xl mb-3">🎉</p>
                <p className="text-copa-dark font-bold text-lg">{feedback}</p>
                <p className="text-slate-600 text-sm mt-2">Compartilhe o código com sua família!</p>
              </motion.div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
                <input
                  className="input-field"
                  placeholder="Nome do bolão (ex: Família Silva)"
                  value={poolName}
                  onChange={e => setPoolName(e.target.value)}
                  required
                />
                {error && <p className="text-copa-red text-sm text-center">{error}</p>}
                <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Criando...' : 'Criar bolão'}
                </button>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
