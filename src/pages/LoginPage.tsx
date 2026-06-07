import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function formatPhone(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 2) return digits
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', {
        phone: phone.replace(/\D/g, ''),
        password,
      })
      login(data.token, data.user)
      navigate('/pools')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Erro ao entrar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      className="min-h-screen flex flex-col justify-center px-6 py-12"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-10 text-center">
        <div className="text-6xl mb-4">⚽</div>
        <h1 className="text-3xl font-extrabold text-white">Bolão Copa 2026</h1>
        <p className="text-slate-400 mt-2">Entre com seu celular e senha</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="input-field"
          type="tel"
          placeholder="Celular (ex: (11) 99999-9999)"
          value={phone}
          onChange={e => setPhone(formatPhone(e.target.value))}
          inputMode="numeric"
          required
        />
        <input
          className="input-field"
          type="password"
          placeholder="Senha"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />

        {error && (
          <motion.p
            className="text-copa-red text-sm text-center font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {error}
          </motion.p>
        )}

        <div className="pt-2">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      </form>

      <p className="text-center text-slate-400 mt-6">
        Não tem conta?{' '}
        <Link to="/register" className="text-copa-gold font-semibold">
          Cadastrar
        </Link>
      </p>
    </motion.div>
  )
}
