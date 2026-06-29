import { useState } from 'react'
import { User } from '../types'

const SIMULATE_KEY = 'simulate_user'

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })

  const simulateUser = sessionStorage.getItem(SIMULATE_KEY) === '1'
  const isAdmin = (user?.isAdmin ?? false) && !simulateUser

  function toggleSimulation() {
    if (simulateUser) sessionStorage.removeItem(SIMULATE_KEY)
    else sessionStorage.setItem(SIMULATE_KEY, '1')
    window.location.reload()
  }

  function login(token: string, userData: User) {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('activePool')
    sessionStorage.removeItem(SIMULATE_KEY)
    setUser(null)
    window.location.href = '/login'
  }

  return { user, isAdmin, simulateUser, toggleSimulation, login, logout }
}
