import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import type { Usuario } from '../types/api.js'

interface AuthState {
  token: string | null
  usuario: Usuario | null
}

interface AuthContextValue extends AuthState {
  login: (token: string, usuario: Usuario) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function carregarSessao(): AuthState {
  try {
    const token = localStorage.getItem('radar:token')
    const raw = localStorage.getItem('radar:usuario')
    const usuario = raw ? (JSON.parse(raw) as Usuario) : null
    return { token, usuario }
  } catch {
    return { token: null, usuario: null }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(carregarSessao)
  const navigate = useNavigate()

  const login = useCallback((token: string, usuario: Usuario) => {
    localStorage.setItem('radar:token', token)
    localStorage.setItem('radar:usuario', JSON.stringify(usuario))
    setState({ token, usuario })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('radar:token')
    localStorage.removeItem('radar:usuario')
    setState({ token: null, usuario: null })
  }, [])

  // Escuta evento 'auth:expirado' disparado pelo client.ts em respostas 401
  useEffect(() => {
    const handler = () => {
      logout()
      navigate('/login', { replace: true })
    }
    window.addEventListener('auth:expirado', handler)
    return () => window.removeEventListener('auth:expirado', handler)
  }, [logout, navigate])

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
