import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [name, setName] = useState('')
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
      const { data } = await api.post('/auth/register', {
        name,
        phone: phone.replace(/\D/g, ''),
        password,
      })
      login(data.token, data.user)
      navigate('/pools')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Erro ao cadastrar. Tente novamente.')
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
        <h1 className="text-3xl font-extrabold text-white">Criar conta</h1>
        <p className="text-slate-400 mt-2">Cadastre-se para participar do bolão</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="input-field"
          type="text"
          placeholder="Seu nome"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />
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
          placeholder="Senha (mín. 6 caracteres)"
          value={password}
          onChange={e => setPassword(e.target.value)}
          minLength={6}
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
            {loading ? 'Cadastrando...' : 'Criar conta'}
          </button>
        </div>
      </form>

      <p className="text-center text-slate-400 mt-6">
        Já tem conta?{' '}
        <Link to="/login" className="text-copa-gold font-semibold">
          Entrar
        </Link>
      </p>
    </motion.div>
  )
}
