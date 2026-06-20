import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../contexts/ThemeContext.js'
import type { Tema } from '../contexts/ThemeContext.js'
// @ts-ignore
import styles from './ThemePicker.module.css'

const TEMAS: { id: Tema; label: string; swatch: string }[] = [
  { id: 'default',       label: 'Default',        swatch: '#0064A4' },
  { id: 'mercadolivre',  label: 'Mercado Livre',  swatch: '#FFE600' },
  { id: 'escuro',        label: 'Escuro',          swatch: '#191C1F' },
]

export function ThemePicker() {
  const { tema, setTema } = useTheme()
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    function fechar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [aberto])

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        className={styles.btn}
        onClick={() => setAberto((v) => !v)}
        aria-label="Selecionar tema"
        title="Selecionar tema"
      >
        <span className="material-symbols-outlined">palette</span>
      </button>

      {aberto && (
        <div className={styles.popover} role="listbox" aria-label="Temas disponíveis">
          {TEMAS.map((t) => (
            <button
              key={t.id}
              className={`${styles.option} ${tema === t.id ? styles.optionAtivo : ''}`}
              onClick={() => { setTema(t.id); setAberto(false) }}
              role="option"
              aria-selected={tema === t.id}
            >
              <span
                className={styles.swatch}
                style={{ background: t.swatch }}
                aria-hidden="true"
              />
              <span className={styles.label}>{t.label}</span>
              {tema === t.id && (
                <span className={`material-symbols-outlined ${styles.check}`} aria-hidden="true">
                  check
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
