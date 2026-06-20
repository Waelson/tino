import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { capturar } from '../api/compromissos.js'
import { isApiError } from '../types/api.js'
import { useCapture } from '../contexts/CaptureContext.js'
import { useToast } from './Toast.js'
import dpStyles from './DelegarPopover.module.css'
import styles from './CaptureModal.module.css'

const MAX = 280

export function CaptureModal() {
  const [titulo, setTitulo] = useState('')
  const { closeCapture } = useCapture()
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const mutation = useMutation({
    mutationFn: (t: string) => capturar(t),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['triagem'] })
      void queryClient.invalidateQueries({ queryKey: ['metricas'] })
      showToast('Capturada. Faça a triagem quando puder.')
      closeCapture()
    },
    onError: (err: unknown) => {
      const msg = isApiError(err) ? err.mensagem : 'Erro ao capturar.'
      showToast(msg)
    },
  })

  function handleSubmit() {
    const t = titulo.trim()
    if (!t) return
    mutation.mutate(t)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit()
  }

  return (
    <>
      <div className={dpStyles.overlay} onClick={closeCapture} aria-hidden="true" />
      <div
        className={dpStyles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Capturar compromisso"
      >
        <div className={dpStyles.dialogHeader}>
          <span className={`material-symbols-outlined ${dpStyles.dialogIcon}`}>add_circle</span>
          <h2 className={dpStyles.dialogTitle}>Capturar compromisso</h2>
        </div>

        <p className={dpStyles.dialogDesc}>
          Descreva o <strong>resultado esperado</strong> — o que deve existir quando estiver concluído.
        </p>

        <div className={dpStyles.field}>
          <label className={dpStyles.label} htmlFor="capture-titulo">Resultado esperado</label>
          <textarea
            id="capture-titulo"
            className={styles.textarea}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value.slice(0, MAX))}
            onKeyDown={handleKeyDown}
            placeholder="Ex: API de billing estável em produção"
            rows={3}
            autoFocus
          />
          <span className={styles.counter}>{titulo.length} / {MAX}</span>
        </div>

        <div className={dpStyles.actions}>
          <button className={dpStyles.cancelBtn} onClick={closeCapture} type="button">
            Cancelar
          </button>
          <button
            className={dpStyles.submitBtn}
            onClick={handleSubmit}
            disabled={titulo.trim() === '' || mutation.isPending}
            type="button"
          >
            <span className={`material-symbols-outlined ${styles.sendIcon}`}>send</span>
            Capturar
          </button>
        </div>
      </div>
    </>
  )
}
