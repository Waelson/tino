import { createContext, useContext, useEffect, useState } from 'react'

export type Tema = 'default' | 'mercadolivre' | 'escuro'

const STORAGE_KEY = 'radar-tema'

interface ThemeContextValue {
  tema: Tema
  setTema: (t: Tema) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  tema: 'default',
  setTema: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTemaState] = useState<Tema>(
    () => (localStorage.getItem(STORAGE_KEY) as Tema) ?? 'default'
  )

  useEffect(() => {
    if (tema === 'default') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', tema)
    }
    return () => document.documentElement.removeAttribute('data-theme')
  }, [tema])

  function setTema(t: Tema) {
    setTemaState(t)
    localStorage.setItem(STORAGE_KEY, t)
  }

  return (
    <ThemeContext.Provider value={{ tema, setTema }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
