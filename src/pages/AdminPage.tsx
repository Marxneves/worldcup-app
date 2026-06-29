import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { Game } from '../types'
import ManageMembersModal from '../components/ManageMembersModal'

type AdminTab = 'partidas' | 'boloes' | 'sistema'

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
  const { user, simulateUser, toggleSimulation } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<AdminTab>('partidas')

  const [fetching, setFetching] = useState(false)
  const [espnFeedback, setEspnFeedback] = useState('')
  const [espnError, setEspnError] = useState('')

  const [editTimeGameNumber, setEditTimeGameNumber] = useState('')
  const [editMatchDatePart, setEditMatchDatePart] = useState('')
  const [editMatchTimePart, setEditMatchTimePart] = useState('')
  const [timeFeedback, setTimeFeedback] = useState('')
  const [timeError, setTimeError] = useState('')

  const [togglingStats, setTogglingStats] = useState(false)

  const [syncingOdds, setSyncingOdds] = useState(false)
  const [oddsFeedback, setOddsFeedback] = useState('')
  const [oddsError, setOddsError] = useState('')

  const [managingPoolId, setManagingPoolId] = useState<string | null>(null)

  const { data: featureFlags } = useQuery({
    queryKey: ['features'],
    queryFn: async () => {
      const { data } = await api.get('/admin/features')
      return data as { statsEnabled: boolean }
    },
  })

  const { data: allPoolsData } = useQuery({
    queryKey: ['admin-pools'],
    queryFn: async () => {
      const { data } = await api.get('/admin/pools')
      return data as { pools: { id: string; name: string; code: string; memberCount: number }[] }
    },
  })

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

  async function handleFetchFromESPN() {
    setFetching(true)
    setEspnFeedback('')
    setEspnError('')
    try {
      const { data } = await api.post('/admin/fetch-results')
      setEspnFeedback(data.message)
      refetch()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setEspnError(msg || 'Falha na sincronização com a ESPN')
    } finally {
      setFetching(false)
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

  async function handleSyncOdds() {
    setSyncingOdds(true)
    setOddsFeedback('')
    setOddsError('')
    try {
      const { data } = await api.post('/admin/sync-odds')
      setOddsFeedback(data.message)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setOddsError(msg || 'Erro ao sincronizar odds')
    } finally {
      setSyncingOdds(false)
    }
  }

  async function handleToggleStats() {
    setTogglingStats(true)
    try {
      await api.post('/admin/features', { statsEnabled: !featureFlags?.statsEnabled })
      await queryClient.invalidateQueries({ queryKey: ['features'] })
    } finally {
      setTogglingStats(false)
    }
  }

  const finishedGames = gamesData?.filter(g => g.score1 !== null) ?? []
  const pendingGames = gamesData?.filter(g => g.score1 === null) ?? []

  const TABS: { id: AdminTab; label: string }[] = [
    { id: 'partidas', label: 'Partidas' },
    { id: 'boloes', label: 'Bolões' },
    { id: 'sistema', label: 'Sistema' },
  ]

  return (
    <div className="min-h-screen px-5 pt-8 pb-16">

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-0.5">Copa 2026</p>
          <h1 className="text-xl font-extrabold text-copa-dark leading-none">Painel Admin</h1>
        </div>
        <button
          onClick={() => navigate('/pools')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13, fontWeight: 600, color: '#295A71',
            background: 'rgba(41,90,113,0.08)', border: 'none',
            borderRadius: 10, padding: '7px 12px', cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8l4-4" />
          </svg>
          Voltar
        </button>
      </div>

      {/* Stats strip */}
      <div className="flex gap-3 mb-6">
        <div style={{ flex: 1, backgroundColor: 'rgba(0,254,168,0.08)', border: '1px solid rgba(0,254,168,0.2)', borderRadius: 12, padding: '10px 14px' }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: '#00c87e', lineHeight: 1 }}>{finishedGames.length}</p>
          <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>com resultado</p>
        </div>
        <div style={{ flex: 1, backgroundColor: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.15)', borderRadius: 12, padding: '10px 14px' }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: '#64748b', lineHeight: 1 }}>{pendingGames.length}</p>
          <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>aguardando</p>
        </div>
        <div style={{ flex: 1, backgroundColor: 'rgba(255,209,0,0.08)', border: '1px solid rgba(255,209,0,0.2)', borderRadius: 12, padding: '10px 14px' }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: '#B8960A', lineHeight: 1 }}>{gamesData?.length ?? 0}</p>
          <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>total de jogos</p>
        </div>
      </div>

      {/* Tab nav */}
      <div style={{ display: 'flex', borderBottom: '1.5px solid #D9CBAD', marginBottom: 20 }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '10px 4px',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 800 : 600,
              color: activeTab === tab.id ? '#295A71' : '#94a3b8',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2.5px solid #295A71' : '2.5px solid transparent',
              marginBottom: -1.5,
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Aba Partidas ── */}
      {activeTab === 'partidas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Últimos resultados */}
          {finishedGames.length > 0 && (
            <div className="card p-4">
              <p style={{ fontSize: 11, fontWeight: 800, color: '#295A71', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                Últimos resultados
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {finishedGames.slice(-5).reverse().map((game, idx) => (
                  <div
                    key={game.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 0',
                      borderTop: idx === 0 ? 'none' : '1px solid #F0E8D5',
                    }}
                  >
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                      J{game.number} · {game.team1} × {game.team2}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#295A71', fontVariantNumeric: 'tabular-nums' }}>
                      {game.score1} × {game.score2}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sincronizar ESPN */}
          <div className="card p-5">
            <p style={{ fontSize: 11, fontWeight: 800, color: '#295A71', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              Sincronizar com ESPN
            </p>
            <p className="text-slate-600 text-sm mb-4">
              Busca resultados de jogos finalizados e atualiza automaticamente.
            </p>
            <button className="btn-secondary" onClick={handleFetchFromESPN} disabled={fetching}>
              {fetching ? 'Sincronizando...' : 'Sincronizar resultados'}
            </button>
            {espnFeedback && (
              <motion.p className="text-copa-menta text-sm font-semibold mt-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {espnFeedback}
              </motion.p>
            )}
            {espnError && (
              <motion.p className="text-copa-red text-sm font-semibold mt-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {espnError}
              </motion.p>
            )}
          </div>

          {/* Alterar horário */}
          <div className="card p-5">
            <p style={{ fontSize: 11, fontWeight: 800, color: '#295A71', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              Alterar horário de jogo
            </p>
            <form onSubmit={handleUpdateMatchDate} className="space-y-3">
              <input
                className="input-field"
                type="number"
                placeholder="Número do jogo"
                value={editTimeGameNumber}
                onChange={e => handleEditGameNumberChange(e.target.value)}
                min="1"
                required
              />
              {editTimeGameNumber && gamesData?.find(g => g.number === Number(editTimeGameNumber)) && (
                <p className="text-xs text-slate-500 -mt-1">
                  {gamesData.find(g => g.number === Number(editTimeGameNumber))!.team1} ×{' '}
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
        </div>
      )}

      {/* ── Aba Bolões ── */}
      {activeTab === 'boloes' && (
        <div className="card p-5">
          <p style={{ fontSize: 11, fontWeight: 800, color: '#295A71', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
            Gerenciar membros
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(allPoolsData?.pools ?? []).map(pool => (
              <div
                key={pool.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  padding: '10px 12px',
                  backgroundColor: '#F5EDD0', borderRadius: 10,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pool.name}
                  </p>
                  <p style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                    {pool.memberCount} membros · {pool.code}
                  </p>
                </div>
                <button
                  onClick={() => setManagingPoolId(pool.id)}
                  style={{
                    fontSize: 12, fontWeight: 700, color: '#295A71',
                    backgroundColor: 'rgba(41,90,113,0.12)', border: 'none',
                    borderRadius: 8, padding: '7px 14px', cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  Gerenciar
                </button>
              </div>
            ))}
            {(allPoolsData?.pools ?? []).length === 0 && (
              <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>
                Nenhum bolão encontrado
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Aba Sistema ── */}
      {activeTab === 'sistema' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Simulação */}
          <div className="card p-5">
            <p style={{ fontSize: 11, fontWeight: 800, color: '#295A71', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              Simulação de usuário
            </p>
            <p className="text-slate-600 text-xs mb-4">
              Visualize o app como um participante normal. Funcionalidades admin ficam ocultas.
            </p>
            <button
              onClick={toggleSimulation}
              style={{
                width: '100%', padding: '12px 16px',
                borderRadius: 12, border: 'none', cursor: 'pointer',
                backgroundColor: simulateUser ? '#295A71' : 'rgba(41,90,113,0.08)',
                color: simulateUser ? '#F5EDD0' : '#295A71',
                fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {simulateUser ? 'Desativar simulação' : 'Ativar simulação de usuário'}
            </button>
          </div>

          {/* Feature flags */}
          <div className="card p-5">
            <p style={{ fontSize: 11, fontWeight: 800, color: '#295A71', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              Funcionalidades
            </p>
            <p className="text-slate-600 text-xs mb-4">Ative ou desative para todos os participantes.</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>Aba Projeção</p>
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Análise de chances de cada participante</p>
              </div>
              <button
                onClick={handleToggleStats}
                disabled={togglingStats}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${featureFlags?.statsEnabled ? 'bg-copa-teal' : 'bg-slate-300'}`}
                style={{ opacity: togglingStats ? 0.6 : 1, flexShrink: 0, marginLeft: 12 }}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${featureFlags?.statsEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
          </div>

          {/* Odds */}
          <div className="card p-5">
            <p style={{ fontSize: 11, fontWeight: 800, color: '#295A71', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              Probabilidades
            </p>
            <p className="text-slate-600 text-sm mb-4">
              Busca odds de casas de apostas para calcular chances de cada participante terminar em 1º, 2º ou 3º.
            </p>
            <button className="btn-secondary" onClick={handleSyncOdds} disabled={syncingOdds}>
              {syncingOdds ? 'Sincronizando...' : 'Sincronizar odds'}
            </button>
            {oddsFeedback && (
              <motion.p className="text-copa-menta text-sm font-semibold mt-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {oddsFeedback}
              </motion.p>
            )}
            {oddsError && (
              <motion.p className="text-copa-red text-sm font-semibold mt-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {oddsError}
              </motion.p>
            )}
          </div>
        </div>
      )}

      {managingPoolId && (
        <ManageMembersModal
          sourcePoolId={managingPoolId}
          onClose={() => setManagingPoolId(null)}
        />
      )}
    </div>
  )
}
