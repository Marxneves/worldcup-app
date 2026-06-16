import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'

interface PoolOption {
  id: string
  name: string
  code: string
  memberCount: number
}

interface MemberOption {
  userId: string
  name: string
  isShadow: boolean
}

interface CopyResult {
  name: string
  message: string
  copiedPredictions: number
  error?: string
}

interface Props {
  sourcePoolId: string
  onClose: () => void
}

type Step = 'list' | 'copy-target' | 'copy-done'

export default function ManageMembersModal({ sourcePoolId, onClose }: Props) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>('list')
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [targetPoolId, setTargetPoolId] = useState('')
  const [asShadow, setAsShadow] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [copyResults, setCopyResults] = useState<CopyResult[]>([])
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['admin-pool-members', sourcePoolId],
    queryFn: () => api.get<{ members: MemberOption[] }>(`/admin/pools/${sourcePoolId}/members`).then(r => r.data),
  })

  const { data: poolsData, isLoading: poolsLoading } = useQuery({
    queryKey: ['admin-pools'],
    queryFn: () => api.get<{ pools: PoolOption[] }>('/admin/pools').then(r => r.data),
  })

  const availablePools = poolsData?.pools.filter(p => p.id !== sourcePoolId) ?? []

  function toggleMember(userId: string) {
    setSelectedUserIds(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  async function handleRemove(userId: string) {
    setRemoving(true)
    try {
      await api.delete('/admin/remove-member', { data: { userId, poolId: sourcePoolId } })
      await queryClient.invalidateQueries({ queryKey: ['admin-pool-members', sourcePoolId] })
      await queryClient.invalidateQueries({ queryKey: ['ranking'] })
      setSelectedUserIds(prev => { const next = new Set(prev); next.delete(userId); return next })
    } finally {
      setConfirmRemoveId(null)
      setRemoving(false)
    }
  }

  async function handleCopy() {
    setSubmitting(true)
    const results: CopyResult[] = []

    for (const userId of selectedUserIds) {
      const member = membersData?.members.find(m => m.userId === userId)
      try {
        const response = await api.post<{ message: string; copiedPredictions: number }>('/admin/copy-member', {
          userId,
          sourcePoolId,
          targetPoolId,
          asShadow,
        })
        results.push({ name: member?.name ?? userId, ...response.data })
      } catch (err: unknown) {
        const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao copiar'
        results.push({ name: member?.name ?? userId, message, copiedPredictions: 0, error: message })
      }
    }

    setCopyResults(results)
    setStep('copy-done')
    setSubmitting(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md bg-white rounded-t-2xl p-5 pb-8 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-copa-dark font-bold text-base">Gerenciar membros</h2>
          <button onClick={onClose} className="text-slate-400 text-xl leading-none">×</button>
        </div>

        {step === 'list' && (
          <>
            <p className="text-xs text-slate-500 mb-3">Selecione membros para copiar ou remova individualmente</p>
            {membersLoading ? (
              <p className="text-sm text-slate-500 py-4 text-center">Carregando membros...</p>
            ) : (
              <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                {membersData?.members.map(member => (
                  <div key={member.userId} className="py-3">
                    {confirmRemoveId === member.userId ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-copa-dark font-medium flex-1">Remover {member.name}?</span>
                        <button
                          disabled={removing}
                          onClick={() => handleRemove(member.userId)}
                          className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg font-semibold disabled:opacity-40"
                        >
                          {removing ? '...' : 'Confirmar'}
                        </button>
                        <button
                          onClick={() => setConfirmRemoveId(null)}
                          className="text-xs text-slate-500 px-2 py-1.5"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.has(member.userId)}
                          onChange={() => toggleMember(member.userId)}
                          className="accent-copa-teal w-4 h-4 shrink-0"
                        />
                        <span className="text-sm text-copa-dark font-medium flex-1">{member.name}</span>
                        {member.isShadow && (
                          <span className="text-xs text-slate-400">oculto</span>
                        )}
                        <button
                          onClick={() => setConfirmRemoveId(member.userId)}
                          className="text-slate-300 hover:text-red-400 transition-colors p-1"
                          title="Remover do bolao"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button
              disabled={selectedUserIds.size === 0}
              onClick={() => setStep('copy-target')}
              className="mt-4 w-full py-3 rounded-xl bg-copa-teal text-white font-semibold text-sm disabled:opacity-40"
            >
              Copiar selecionados ({selectedUserIds.size})
            </button>
          </>
        )}

        {step === 'copy-target' && (
          <>
            <p className="text-xs text-slate-500 mb-3">Escolha o bolao destino e o tipo de copia</p>
            {poolsLoading ? (
              <p className="text-sm text-slate-500 py-4 text-center">Carregando boloes...</p>
            ) : (
              <div className="overflow-y-auto flex-1 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Bolao destino</p>
                  <div className="divide-y divide-slate-100">
                    {availablePools.map(pool => (
                      <label key={pool.id} className="flex items-center gap-3 py-3 cursor-pointer">
                        <input
                          type="radio"
                          name="targetPool"
                          value={pool.id}
                          checked={targetPoolId === pool.id}
                          onChange={() => setTargetPoolId(pool.id)}
                          className="accent-copa-teal w-4 h-4"
                        />
                        <span className="text-sm text-copa-dark font-medium">{pool.name}</span>
                        <span className="text-xs text-slate-400 ml-auto">{pool.memberCount} membros</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Tipo de copia</p>
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="copyMode"
                        checked={asShadow}
                        onChange={() => setAsShadow(true)}
                        className="accent-copa-teal w-4 h-4 mt-0.5"
                      />
                      <div>
                        <p className="text-sm text-copa-dark font-medium">Copia oculta</p>
                        <p className="text-xs text-slate-500">A pessoa nao vera este bolao nem sabera que esta nele</p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="copyMode"
                        checked={!asShadow}
                        onChange={() => setAsShadow(false)}
                        className="accent-copa-teal w-4 h-4 mt-0.5"
                      />
                      <div>
                        <p className="text-sm text-copa-dark font-medium">Membro real</p>
                        <p className="text-xs text-slate-500">A pessoa podera ver e participar normalmente deste bolao</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setStep('list')}
                className="py-3 px-4 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold"
              >
                Voltar
              </button>
              <button
                disabled={!targetPoolId || submitting}
                onClick={handleCopy}
                className="flex-1 py-3 rounded-xl bg-copa-teal text-white font-semibold text-sm disabled:opacity-40"
              >
                {submitting ? 'Copiando...' : `Copiar ${selectedUserIds.size} membro${selectedUserIds.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}

        {step === 'copy-done' && (
          <>
            <div className="flex-1 overflow-y-auto space-y-2">
              {copyResults.map((result, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl text-sm ${result.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}
                >
                  <p className="font-semibold">{result.name}</p>
                  <p className="text-xs mt-0.5">{result.message}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setStep('list'); setSelectedUserIds(new Set()); setCopyResults([]) }}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold"
              >
                Voltar
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-copa-gold text-copa-dark font-semibold text-sm"
              >
                Fechar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
