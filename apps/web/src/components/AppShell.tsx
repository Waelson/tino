import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.js'
import { useCapture } from '../contexts/CaptureContext.js'
import { CaptureModal } from './CaptureModal.js'
import { getMetricas } from '../api/metricas.js'
import type { Secao } from './NavPrincipal.js'
// @ts-ignore
import styles from './AppShell.module.css'

const SECOES: { id: Secao; label: string; icon: string }[] = [
  { id: 'compromissos', label: 'Compromissos', icon: 'inbox' },
  { id: 'equipe',       label: 'Equipe',       icon: 'groups' },
  { id: 'revisao',      label: 'Revisão',      icon: 'rate_review' },
  { id: 'timeline',     label: 'Timeline',     icon: 'timeline' },
  { id: 'links',        label: 'Links',        icon: 'link' },
]

interface AppShellProps {
  children: React.ReactNode
  drawer?: React.ReactNode
}

export function AppShell({ children, drawer }: AppShellProps) {
  const { usuario, logout } = useAuth()
  const { isOpen, openCapture } = useCapture()
  const [searchParams, setSearchParams] = useSearchParams()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Mantém conteúdo do drawer visível durante animação de saída
  const [closing, setClosing] = useState(false)
  const prevDrawer = useRef<React.ReactNode>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (drawer) {
      prevDrawer.current = drawer
      setClosing(false)
      if (closeTimer.current) clearTimeout(closeTimer.current)
    } else if (prevDrawer.current) {
      setClosing(true)
      closeTimer.current = setTimeout(() => {
        setClosing(false)
        prevDrawer.current = null
      }, 220)
    }
  }, [drawer])

  const drawerContent = drawer ?? (closing ? prevDrawer.current : null)

  const secao = (searchParams.get('secao') ?? 'compromissos') as Secao

  const { data: metricas } = useQuery({
    queryKey: ['metricas'],
    queryFn: getMetricas,
  })
  const atencao = metricas?.precisamAtencao ?? 0

  const initials = usuario?.nome
    ? usuario.nome.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
    : 'RD'

  function navegar(s: Secao) {
    if (s === 'compromissos') {
      setSearchParams({})
    } else {
      setSearchParams({ secao: s })
    }
    setDrawerOpen(false)
  }

  function handleCapturar() {
    if (secao !== 'compromissos') navegar('compromissos')
    // Pequeno delay para a seção renderizar antes de focar o input
    setTimeout(() => openCapture(), 80)
  }

  return (
    <>
      {/* Scrim (mobile drawer overlay) */}
      {drawerOpen && (
        <div
          className={styles.scrim}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── TOP APP BAR ── */}
      <header className={styles.topbar}>
        <button
          className={styles.iconBtn}
          onClick={() => setDrawerOpen((v) => !v)}
          aria-label="Menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>

        <div className={styles.topbarLogo}>
          <div className={styles.logoMark}>
            <span className="material-symbols-outlined">radar</span>
          </div>
          <span className={styles.topbarTitle}>Radar</span>
        </div>

        <div className={styles.topbarSpacer} />

        <button
          className={styles.avatarBtn}
          aria-label={`Conta de ${usuario?.nome ?? 'usuário'}`}
          title={usuario?.email ?? ''}
        >
          {initials}
        </button>
      </header>

      {/* ── APP BODY ── */}
      <div className={styles.appBody}>

        {/* NAV DRAWER */}
        <nav
          className={`${styles.navDrawer} ${drawerOpen ? styles.mobileOpen : ''}`}
          aria-label="Navegação"
        >
          {/* FAB Estendido — Capturar */}
          <button className={styles.fabExtended} onClick={handleCapturar}>
            <span className="material-symbols-outlined">add</span>
            <span className={styles.fabLabel}>Capturar</span>
          </button>

          <div className={styles.navSectionLabel}>Painel</div>

          {SECOES.map((s) => (
            <button
              key={s.id}
              className={`${styles.navItem} ${secao === s.id ? styles.navItemActive : ''}`}
              onClick={() => navegar(s.id)}
              aria-current={secao === s.id ? 'page' : undefined}
            >
              <span className="material-symbols-outlined">{s.icon}</span>
              <span className={styles.navItemLabel}>{s.label}</span>
              {s.id === 'compromissos' && atencao > 0 && (
                <span className={styles.navBadge} aria-label={`${atencao} itens precisam de atenção`}>
                  {atencao}
                </span>
              )}
            </button>
          ))}

          <div className={styles.navDivider} />
          <div className={styles.navSectionLabel}>Conta</div>

          <button className={styles.navItem} onClick={logout}>
            <span className="material-symbols-outlined">logout</span>
            <span className={styles.navItemLabel}>Sair</span>
          </button>

          <div className={styles.navFooter}>
            <div className={styles.navAvatar}>{initials}</div>
            <div className={styles.navUserInfo}>
              <div className={styles.navUserName}>{usuario?.nome}</div>
              <div className={styles.navUserEmail}>{usuario?.email}</div>
            </div>
          </div>
        </nav>

        {/* CONTENT */}
        <div className={styles.contentWrapper}>
          <main className={styles.main}>
            {children}
          </main>
          {drawerContent && (
            <div className={`${styles.drawerPanel} ${closing ? styles.drawerClosing : ''}`}>
              {drawerContent}
            </div>
          )}
        </div>

      </div>{/* /appBody */}

      {/* ── BOTTOM NAV (mobile) ── */}
      <nav className={styles.bottomNav} aria-label="Navegação inferior">
        {SECOES.map((s) => (
          <button
            key={s.id}
            className={`${styles.bottomNavItem} ${secao === s.id ? styles.bottomNavActive : ''}`}
            onClick={() => navegar(s.id)}
            aria-current={secao === s.id ? 'page' : undefined}
          >
            <div className={styles.bottomNavIndicator}>
              <span className="material-symbols-outlined">{s.icon}</span>
            </div>
            <span className={styles.bottomNavLabel}>
              {s.id === 'compromissos' ? 'Início' : s.label.split(' ')[0]}
            </span>
          </button>
        ))}
      </nav>

      {/* ── FAB MOBILE ── */}
      <button
        className={styles.fabMobile}
        onClick={handleCapturar}
        aria-label="Capturar compromisso"
      >
        <span className="material-symbols-outlined">add</span>
        Capturar
      </button>
    </>
  )
}
