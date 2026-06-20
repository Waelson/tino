import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext.js'
import { ThemeProvider } from './contexts/ThemeContext.js'
import { PrivateRoute } from './components/PrivateRoute.js'
import { Login } from './pages/Login.js'
import { Registro } from './pages/Registro.js'
import { Painel } from './pages/Painel.js'
import { CommitmentDrawer } from './components/CommitmentDrawer.js'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Rotas públicas */}
          <Route path="/login"    element={<Login />} />
          <Route path="/registro" element={<Registro />} />

          {/* Rotas protegidas */}
          <Route element={<PrivateRoute />}>
            <Route path="/" element={
              <ThemeProvider>
                <Painel />
              </ThemeProvider>
            }>
              <Route path="compromissos/:id" element={<CommitmentDrawer />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
