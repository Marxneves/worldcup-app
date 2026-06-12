import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from './hooks/useAuth'
import { useBrazilDay } from './hooks/useBrazilDay'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import PoolsPage from './pages/PoolsPage'
import PredictionsPage from './pages/PredictionsPage'
import RankingPage from './pages/RankingPage'
import AdminPage from './pages/AdminPage'
import BrazilDayOverlay from './components/BrazilDayOverlay'
import api from './services/api'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function useApiWakeup() {
  const [sleeping, setSleeping] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        await api.get('/health', { timeout: 10000 })
      } catch {
        if (!cancelled) setSleeping(true)
        while (!cancelled) {
          await new Promise(r => setTimeout(r, 5000))
          try {
            await api.get('/health', { timeout: 10000 })
            if (!cancelled) window.location.reload()
            return
          } catch {
            // still sleeping
          }
        }
      }
    }

    check()

    return () => { cancelled = true }
  }, [])

  return sleeping
}

export default function App() {
  const sleeping = useApiWakeup()
  const isBrazilDay = useBrazilDay()

  return (
    <BrowserRouter>
      <div className={`min-h-full max-w-md mx-auto${isBrazilDay ? ' brazil-day' : ''}`}>
        {isBrazilDay && <BrazilDayOverlay />}

        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/pools" element={<PrivateRoute><PoolsPage /></PrivateRoute>} />
          <Route path="/predictions/:poolCode" element={<PrivateRoute><PredictionsPage /></PrivateRoute>} />
          <Route path="/ranking/:poolCode" element={<PrivateRoute><RankingPage /></PrivateRoute>} />
          <Route path="/admin" element={<PrivateRoute><AdminPage /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/pools" replace />} />
        </Routes>

        <AnimatePresence>
          {sleeping && (
            <motion.div
              className="fixed bottom-5 left-0 right-0 z-50 flex justify-center px-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div
                className="max-w-md w-full rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg"
                style={{ backgroundColor: '#1a1a1a', color: '#F5EDD0' }}
              >
                <span className="text-xl shrink-0">⏳</span>
                <p className="text-sm leading-snug">
                  O sistema está iniciando, aguenta mais{' '}
                  <span className="font-bold text-copa-gold">~30 segundinhos!</span>{' '}
                  A página vai recarregar sozinha quando estiver tudo pronto.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </BrowserRouter>
  )
}
