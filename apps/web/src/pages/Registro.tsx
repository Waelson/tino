import { useState } from 'react'
import horizontalLogo from '../assets/leadtrack_horizontal_logo.svg'
import { Link, useNavigate } from 'react-router-dom'
import { client } from '../api/client.js'
import { useAuth } from '../contexts/AuthContext.js'
import type { ApiError, AuthResponse } from '../types/api.js'
import { isApiError } from '../types/api.js'
// @ts-ignore
import styles from './Registro.module.css'

export function Registro() {
  const auth = useAuth()
  const navigate = useNavigate()

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erros, setErros] = useState<{ email?: string; senha?: string; global?: string }>({})
  const [enviando, setEnviando] = useState(false)

  function validar() {
    const novosErros: typeof erros = {}
    if (senha.length > 0 && senha.length < 8) {
      novosErros.senha = 'A senha deve ter pelo menos 8 caracteres.'
    }
    setErros(novosErros)
    return Object.keys(novosErros).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validar()) return

    setErros({})
    setEnviando(true)

    try {
      const data = await client.post<AuthResponse>('/auth/registro', { nome, email, senha })
      auth.login(data.token, data.usuario)
      navigate('/', { replace: true })
    } catch (err) {
      if (isApiError(err)) {
        const e = err as ApiError
        if (e.erro === 'EMAIL_EM_USO') {
          setErros({ email: 'Este e-mail já está cadastrado.' })
        } else {
          setErros({ global: e.mensagem })
        }
      } else {
        setErros({ global: 'Erro ao conectar. Tente novamente.' })
      }
    } finally {
      setEnviando(false)
    }
  }

  const podeEnviar = nome.trim().length > 0 && email.length > 0 && senha.length >= 8

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoArea}>
          <img src={horizontalLogo} alt="LeadTrack" className={styles.logoImg} />
        </div>
        <div className={styles.subtitle}>Crie sua conta</div>

        <form className={styles.form} onSubmit={(e) => { void handleSubmit(e) }}>
          {erros.global && <div className={styles.globalError}>{erros.global}</div>}

          <div className={styles.field}>
            <input
              id="nome"
              type="text"
              className={styles.input}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder=" "
              required
              autoComplete="name"
              autoFocus
            />
            <label className={styles.label} htmlFor="nome">Nome</label>
          </div>

          <div className={styles.field}>
            <input
              id="email"
              type="email"
              className={`${styles.input} ${erros.email ? styles.inputError : ''}`}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setErros((prev) => ({ ...prev, email: undefined }))
              }}
              placeholder=" "
              required
              autoComplete="email"
            />
            <label className={styles.label} htmlFor="email">E-mail</label>
            {erros.email && <span className={styles.fieldError}>{erros.email}</span>}
          </div>

          <div className={styles.field}>
            <input
              id="senha"
              type="password"
              className={`${styles.input} ${erros.senha ? styles.inputError : ''}`}
              value={senha}
              onChange={(e) => {
                setSenha(e.target.value)
                setErros((prev) => ({ ...prev, senha: undefined }))
              }}
              placeholder=" "
              required
              autoComplete="new-password"
              minLength={8}
            />
            <label className={styles.label} htmlFor="senha">Senha</label>
            {erros.senha && <span className={styles.fieldError}>{erros.senha}</span>}
          </div>

          <button
            type="submit"
            className={styles.submit}
            disabled={enviando || !podeEnviar}
          >
            {enviando ? 'Criando conta…' : 'Criar conta'}
          </button>
        </form>

        <div className={styles.footer}>
          Já tem conta?{' '}
          <Link to="/login">Entrar</Link>
        </div>
      </div>
    </div>
  )
}
