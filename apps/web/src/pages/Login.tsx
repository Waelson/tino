import { useState } from 'react'
import horizontalLogo from '../assets/leadtrack_horizontal_logo.svg'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { client } from '../api/client.js'
import { useAuth } from '../contexts/AuthContext.js'
import type { ApiError, AuthResponse } from '../types/api.js'
import { isApiError } from '../types/api.js'
// @ts-ignore
import styles from './Login.module.css'

export function Login() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: Location } | null)?.from?.pathname ?? '/'

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)

    try {
      const data = await client.post<AuthResponse>('/auth/login', { email, senha })
      auth.login(data.token, data.usuario)
      navigate(from, { replace: true })
    } catch (err) {
      if (isApiError(err)) {
        const e = err as ApiError
        if (e.status === 401) {
          setErro('E-mail ou senha inválidos.')
        } else {
          setErro(e.mensagem)
        }
      } else {
        setErro('Erro ao conectar. Tente novamente.')
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoArea}>
          <img src={horizontalLogo} alt="LeadTrack" className={styles.logoImg} />
        </div>
        <div className={styles.subtitle}>Entre na sua conta</div>

        <form className={styles.form} onSubmit={(e) => { void handleSubmit(e) }}>
          {erro && <div className={styles.globalError}>{erro}</div>}

          <div className={styles.field}>
            <input
              id="email"
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder=" "
              required
              autoComplete="email"
              autoFocus
            />
            <label className={styles.label} htmlFor="email">E-mail</label>
          </div>

          <div className={styles.field}>
            <input
              id="senha"
              type="password"
              className={styles.input}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder=" "
              required
              autoComplete="current-password"
            />
            <label className={styles.label} htmlFor="senha">Senha</label>
          </div>

          <button
            type="submit"
            className={styles.submit}
            disabled={enviando || !email || !senha}
          >
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div className={styles.footer}>
          Não tem conta?{' '}
          <Link to="/registro">Criar conta</Link>
        </div>
      </div>
    </div>
  )
}
