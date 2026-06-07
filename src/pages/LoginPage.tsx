import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

type Step = 'phone' | 'login' | 'register'

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const phoneInputRef = useRef<HTMLInputElement>(null)

  const phoneDigits = phone.replace(/\D/g, '')

  async function checkPhone(digits: string) {
    setError('')
    setLoading(true)
    try {
      const { data } = await api.get('/auth/check-phone', { params: { phone: digits } })
      setStep(data.exists ? 'login' : 'register')
    } catch {
      setError('Erro ao verificar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin() {
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { phone: phoneDigits, password })
      login(data.token, data.user)
      navigate('/pools')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Celular ou senha incorretos.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister() {
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register', { name, phone: phoneDigits, password })
      login(data.token, data.user)
      navigate('/pools')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Erro ao cadastrar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  function handlePhoneChange(value: string) {
    const formatted = formatPhone(value)
    setPhone(formatted)
    const digits = formatted.replace(/\D/g, '')
    if (digits.length === 11) {
      phoneInputRef.current?.blur()
      checkPhone(digits)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return
    if (step === 'login') handleLogin()
    else if (step === 'register') handleRegister()
  }

  return (
    <div
      className="relative overflow-hidden"
      style={{ backgroundColor: '#F5EDD0', height: '100dvh' }}
    >
      {/* Taça — esticada para ocupar quase toda a tela */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        style={{ zIndex: 0 }}
      >
        <span
          style={{
            fontSize: '90vh',
            lineHeight: 1,
            opacity: 0.22,
            color: '#E5CE75',
            userSelect: 'none',
            display: 'block',
            transform: 'scaleX(0.78) scaleY(1.08)',
            transformOrigin: 'center center',
          }}
        >
          🏆
        </span>
      </div>

      {/* Bandeira — topo centralizado */}
      <div className="absolute top-7 left-0 right-0 flex justify-center" style={{ zIndex: 10 }}>
        <img src="/flags/br.png" alt="Brasil" className="w-10 h-auto object-contain" />
      </div>

      {/* BOLÃO + 2026 — centro da tela, sobre a taça */}
      <div
        className="absolute left-7 right-7"
        style={{ top: '36%', zIndex: 10 }}
      >
        <h1
          className="font-extrabold tracking-widest uppercase leading-none"
          style={{ color: '#274CA3', fontSize: 'clamp(3rem, 14vw, 4.5rem)' }}
        >
          BOLÃO
        </h1>
        <div className="flex justify-end">
          <p
            className="font-caveat"
            style={{
              color: '#00FEA8',
              fontSize: 'clamp(2.5rem, 12vw, 4rem)',
              transform: 'rotate(-4deg)',
              display: 'inline-block',
              lineHeight: 1,
            }}
          >
            2026
          </p>
        </div>
      </div>

      {/* Formulário — sobre a taça */}
      <motion.div
        className="absolute left-5 right-5 space-y-3"
        animate={
          step === 'phone'
            ? { top: '60%', bottom: 'auto', y: '-50%' }
            : { top: 'auto', bottom: '8%', y: '0%' }
        }
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        style={{ zIndex: 10 }}
      >
        {error && (
          <motion.p
            className="text-sm font-semibold text-center py-2 px-4 rounded-xl"
            style={{ backgroundColor: '#e6393420', color: '#e63946' }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {error}
          </motion.p>
        )}

        {step !== 'phone' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2"
          >
            <button
              onClick={() => { setStep('phone'); setPassword(''); setName(''); setError('') }}
              className="text-sm font-bold px-3 py-1.5 rounded-full"
              style={{ color: '#274CA3', backgroundColor: '#E5CE7550' }}
            >
              ← Alterar
            </button>
            <span className="font-semibold text-sm" style={{ color: '#295A71' }}>{phone}</span>
          </motion.div>
        )}

        {step === 'phone' && (
          <div className="relative">
            <input
              ref={phoneInputRef}
              type="tel"
              inputMode="numeric"
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={e => handlePhoneChange(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              disabled={loading}
              className="login-phone-input w-full py-4 px-5 rounded-2xl text-base font-semibold outline-none"
              style={{ backgroundColor: '#E5CE75', color: '#000', border: 'none' }}
            />
            {loading && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#274CA3' }}>
                ···
              </span>
            )}
          </div>
        )}

        <AnimatePresence>
          {step === 'register' && (
            <motion.input
              key="name"
              type="text"
              placeholder="Nome"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full py-4 px-5 rounded-2xl text-base font-semibold outline-none"
              style={{ backgroundColor: '#E5CE75', color: '#000', border: 'none' }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {(step === 'login' || step === 'register') && (
            <motion.input
              key="password"
              type="password"
              placeholder={step === 'register' ? 'Crie uma senha (mín. 6 caracteres)' : 'Senha'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full py-4 px-5 rounded-2xl text-base font-semibold outline-none"
              style={{ backgroundColor: '#E5CE75', color: '#000', border: 'none' }}
            />
          )}
        </AnimatePresence>

        {step !== 'phone' && (
          <motion.button
            disabled={loading || password.trim() === '' || (step === 'register' && name.trim() === '')}
            onClick={step === 'login' ? handleLogin : handleRegister}
            className="w-full py-4 rounded-2xl font-extrabold text-lg transition-opacity"
            style={{
              backgroundColor: '#FFD100',
              color: '#000',
              opacity: (loading || password.trim() === '' || (step === 'register' && name.trim() === '')) ? 0.4 : 1,
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.97 }}
          >
            {loading ? '...' : step === 'login' ? 'Entrar' : 'Criar conta'}
          </motion.button>
        )}

        {step === 'register' && (
          <p className="text-center text-xs" style={{ color: '#295A71' }}>
            Número não cadastrado — preencha seus dados para criar conta.
          </p>
        )}
      </motion.div>

      {/* MAEMI — rodapé */}
      <div
        className="absolute bottom-0 left-0 right-0 flex justify-center pb-4"
        style={{ zIndex: 10 }}
      >
        <p
          className="uppercase"
          style={{
            fontFamily: '"Cormorant Garamond", serif',
            fontSize: '0.78rem',
            fontWeight: 600,
            color: '#C4A882',
            letterSpacing: '0.04em',
          }}
        >
          [MAEMI]
        </p>
      </div>
    </div>
  )
}
