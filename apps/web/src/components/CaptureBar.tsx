import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { capturar } from '../api/compromissos.js'
import { isApiError } from '../types/api.js'
import { useToast } from './Toast.js'
import { useCapture } from '../contexts/CaptureContext.js'
// @ts-ignore
import styles from './CaptureBar.module.css'

export function CaptureBar() {
  const [titulo, setTitulo] = useState('')
  const [erroInline, setErroInline] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const { registerCapture } = useCapture()

  useEffect(() => {
    registerCapture(() => {
      inputRef.current?.focus()
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [registerCapture])

  const mutation = useMutation({
    mutationFn: (t: string) => capturar(t),
    onSuccess: () => {
      setTitulo('')
      setErroInline(null)
      inputRef.current?.focus()
      void queryClient.invalidateQueries({ queryKey: ['triagem'] })
      void queryClient.invalidateQueries({ queryKey: ['metricas'] })
      showToast('Capturada. Faça a triagem quando puder.')
    },
    onError: (err: unknown) => {
      if (isApiError(err) && err.erro === 'I-01') {
        setErroInline('Descreva o resultado esperado.')
        inputRef.current?.focus()
      } else {
        const msg = isApiError(err) ? err.mensagem : 'Erro ao capturar.'
        showToast(msg)
      }
    },
  })

  function handleSubmit() {
    const t = titulo.trim()
    if (!t) return
    setErroInline(null)
    mutation.mutate(t)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <section className={styles.capture}>
      <div className={styles.inputWrap}>
        <input
          ref={inputRef}
          className={styles.input}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Capture uma demanda — descreva o resultado esperado…"
          aria-label="Nova demanda"
          aria-invalid={erroInline !== null}
          aria-describedby={erroInline ? 'capture-erro' : undefined}
          disabled={mutation.isPending}
        />
        {erroInline && (
          <span id="capture-erro" className={styles.erro}>
            {erroInline}
          </span>
        )}
      </div>
      <button
        className={styles.btn}
        onClick={handleSubmit}
        disabled={titulo.trim() === '' || mutation.isPending}
      >
        Capturar
      </button>
    </section>
  )
}
