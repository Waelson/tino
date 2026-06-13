import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.js'

export function PrivateRoute() {
  const { token } = useAuth()
  const location = useLocation()

  if (!token) {
    // Preserva a rota de destino para redirecionar após login
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
