import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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

type Step = 'select-members' | 'select-target' | 'done'

export default function CopyMemberModal({ sourcePoolId, onClose }: Props) {
  const [step, setStep] = useState<Step>('select-members')
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [targetPoolId, setTargetPoolId] = useState('')
  const [asShadow, setAsShadow] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<CopyResult[]>([])

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

  async function handleSubmit() {
    setSubmitting(true)
    const copyResults: CopyResult[] = []

    for (const userId of selectedUserIds) {
      const member = membersData?.members.find(m => m.userId === userId)
      try {
        const response = await api.post<{ message: string; copiedPredictions: number }>('/admin/copy-member', {
          userId,
          sourcePoolId,
          targetPoolId,
          asShadow,
        })
        copyResults.push({ name: member?.name ?? userId, ...response.data })
      } catch (err: unknown) {
        const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao copiar'
        copyResults.push({ name: member?.name ?? userId, message, copiedPredictions: 0, error: message })
      }
    }

    setResults(copyResults)
    setStep('done')
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
          <h2 className="text-copa-dark font-bold text-base">Copiar membros</h2>
          <button onClick={onClose} className="text-slate-400 text-xl leading-none">×</button>
        </div>

        {step === 'select-members' && (
          <>
            <p className="text-xs text-slate-500 mb-3">Selecione quem deseja copiar para outro bolao</p>
            {membersLoading ? (
              <p className="text-sm text-slate-500 py-4 text-center">Carregando membros...</p>
            ) : (
              <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                {membersData?.members.map(member => (
                  <label
                    key={member.userId}
                    className="flex items-center gap-3 py-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.has(member.userId)}
                      onChange={() => toggleMember(member.userId)}
                      className="accent-copa-teal w-4 h-4"
                    />
                    <span className="text-sm text-copa-dark font-medium">{member.name}</span>
                    {member.isShadow && (
                      <span className="text-xs text-slate-400 ml-auto">shadow</span>
                    )}
                  </label>
                ))}
              </div>
            )}
            <button
              disabled={selectedUserIds.size === 0}
              onClick={() => setStep('select-target')}
              className="mt-4 w-full py-3 rounded-xl bg-copa-teal text-white font-semibold text-sm disabled:opacity-40"
            >
              Proximo ({selectedUserIds.size} selecionado{selectedUserIds.size !== 1 ? 's' : ''})
            </button>
          </>
        )}

        {step === 'select-target' && (
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
                        <p className="text-xs text-slate-500">A pessoa nao vera este bolao nem saberá que esta nele</p>
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
                onClick={() => setStep('select-members')}
                className="py-3 px-4 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold"
              >
                Voltar
              </button>
              <button
                disabled={!targetPoolId || submitting}
                onClick={handleSubmit}
                className="flex-1 py-3 rounded-xl bg-copa-teal text-white font-semibold text-sm disabled:opacity-40"
              >
                {submitting ? 'Copiando...' : `Copiar ${selectedUserIds.size} membro${selectedUserIds.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <div className="flex-1 overflow-y-auto space-y-2">
              {results.map((result, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl text-sm ${result.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}
                >
                  <p className="font-semibold">{result.name}</p>
                  <p className="text-xs mt-0.5">{result.message}</p>
                </div>
              ))}
            </div>
            <button
              onClick={onClose}
              className="mt-4 w-full py-3 rounded-xl bg-copa-gold text-copa-dark font-semibold text-sm"
            >
              Fechar
            </button>
          </>
        )}
      </div>
    </div>
  )
}
