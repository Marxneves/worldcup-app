import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import PoolsPage from './pages/PoolsPage'
import PredictionsPage from './pages/PredictionsPage'
import RankingPage from './pages/RankingPage'
import AdminPage from './pages/AdminPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-full max-w-md mx-auto">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/pools" element={<PrivateRoute><PoolsPage /></PrivateRoute>} />
          <Route path="/predictions/:poolCode" element={<PrivateRoute><PredictionsPage /></PrivateRoute>} />
          <Route path="/ranking/:poolCode" element={<PrivateRoute><RankingPage /></PrivateRoute>} />
          <Route path="/admin" element={<PrivateRoute><AdminPage /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/pools" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
