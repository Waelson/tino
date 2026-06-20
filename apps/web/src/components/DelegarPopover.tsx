import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { triagem } from '../api/compromissos.js'
import { isApiError } from '../types/api.js'
import { useToast } from './Toast.js'
import styles from './DelegarPopover.module.css'

interface DelegarPopoverProps {
  id: number
  onClose: () => void
  onSuccess: () => void
}

export function DelegarPopover({ id, onClose, onSuccess }: DelegarPopoverProps) {
  const [dono, setDono] = useState('')
  const [prazo, setPrazo] = useState('')
  const [checkpoint, setCheckpoint] = useState('')
  const [erroCheckpoint, setErroCheckpoint] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const checkpointInvalido =
    dono.trim() === '' ||
    prazo === '' ||
    checkpoint === '' ||
    checkpoint >= prazo

  const mutation = useMutation({
    mutationFn: () =>
      triagem(id, { decisao: 'delegar', dono: dono.trim(), prazo, checkpoint }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['triagem'] })
      void queryClient.invalidateQueries({ queryKey: ['compromissos'] })
      void queryClient.invalidateQueries({ queryKey: ['metricas'] })
      onSuccess()
    },
    onError: (err: unknown) => {
      if (isApiError(err) && err.erro === 'I-02') {
        setErroCheckpoint('Delegação exige dono, prazo e checkpoint anterior ao prazo.')
      } else {
        const msg = isApiError(err) ? err.mensagem : 'Erro ao delegar.'
        showToast(msg)
      }
    },
  })

  return (
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden="true" />
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Delegar compromisso"
      >
        <div className={styles.dialogHeader}>
          <span className={`material-symbols-outlined ${styles.dialogIcon}`}>group</span>
          <h2 className={styles.dialogTitle}>Delegar</h2>
        </div>

        <p className={styles.dialogDesc}>
          Delegação exige dono, prazo e checkpoint anterior ao prazo.
        </p>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`dp-dono-${id}`}>Dono</label>
          <input
            id={`dp-dono-${id}`}
            className={styles.input}
            value={dono}
            onChange={(e) => setDono(e.target.value)}
            placeholder="Nome do responsável"
            autoFocus
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`dp-prazo-${id}`}>Prazo</label>
          <input
            id={`dp-prazo-${id}`}
            type="date"
            className={styles.input}
            value={prazo}
            onChange={(e) => { setPrazo(e.target.value); setErroCheckpoint(null) }}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`dp-check-${id}`}>
            Checkpoint (antes do prazo)
          </label>
          <input
            id={`dp-check-${id}`}
            type="date"
            className={`${styles.input}${erroCheckpoint ? ` ${styles.inputError}` : ''}`}
            value={checkpoint}
            onChange={(e) => { setCheckpoint(e.target.value); setErroCheckpoint(null) }}
          />
          {erroCheckpoint && <span className={styles.erroMsg}>{erroCheckpoint}</span>}
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose} type="button">
            Cancelar
          </button>
          <button
            className={styles.submitBtn}
            onClick={() => mutation.mutate()}
            disabled={checkpointInvalido || mutation.isPending}
            type="button"
          >
            Delegar
          </button>
        </div>
      </div>
    </>
  )
}
