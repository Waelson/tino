import { createContext, useCallback, useContext, useRef, useState } from 'react'
import styles from './Toast.module.css'

interface ToastContextValue {
  showToast: (msg: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setMsg(message)
    timerRef.current = setTimeout(() => setMsg(null), 2200)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {msg !== null && (
        <div className={styles.toast} role="status">
          {msg}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider')
  return ctx
}
