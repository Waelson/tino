import { useAuth } from '../contexts/AuthContext.js'
import styles from './AppShell.module.css'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { usuario, logout } = useAuth()

  return (
    <>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.dot} aria-hidden="true" />
          <h1 className={styles.title}>Radar</h1>
          <span className={styles.sub}>controle de compromissos do Tech Lead</span>
        </div>
        <div className={styles.userArea}>
          {usuario && <span className={styles.userName}>{usuario.nome}</span>}
          <button className={styles.logoutBtn} onClick={logout}>
            Sair
          </button>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </>
  )
}
