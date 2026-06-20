import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { triagem, atualizar } from '../api/compromissos.js'
import type { Compromisso } from '../types/api.js'
import { isApiError } from '../types/api.js'
import { DelegarPopover } from './DelegarPopover.js'
import { useToast } from './Toast.js'
import { saveOrigin } from './CommitmentList.js'
import styles from './TriageQueue.module.css'
import dpStyles from './DelegarPopover.module.css'

interface TriageQueueProps {
  itens: Compromisso[]
}

type AcaoAberta = 'adiar' | 'delegar' | null

export function TriageQueue({ itens }: TriageQueueProps) {
  const [acoesAbertas, setAcoesAbertas] = useState<Record<number, AcaoAberta>>({})

  if (itens.length === 0) return null

  function setAcao(id: number, acao: AcaoAberta) {
    setAcoesAbertas((prev) => ({ ...prev, [id]: acao }))
  }

  return (
    <section className={styles.queue} aria-label="Triagem pendente">
      <div className={styles.heading}>
        <span className={`material-symbols-outlined ${styles.headingIcon}`}>inbox</span>
        <span className={styles.headingTitle}>Fila de entrada</span>
        <span className={styles.headingBadge}>{itens.length}</span>
      </div>
      <div className={styles.list}>
        {itens.map((item) => (
          <TriageItem
            key={item.id}
            item={item}
            acaoAberta={acoesAbertas[item.id] ?? null}
            setAcao={(a) => setAcao(item.id, a)}
          />
        ))}
      </div>
    </section>
  )
}

interface TriageItemProps {
  item: Compromisso
  acaoAberta: AcaoAberta
  setAcao: (a: AcaoAberta) => void
}

function TriageItem({ item, acaoAberta, setAcao }: TriageItemProps) {
  const [prazoAdiar, setPrazoAdiar] = useState('')
  const [editandoTitulo, setEditandoTitulo] = useState(false)
  const [novoTitulo, setNovoTitulo] = useState(item.titulo)
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const navigate = useNavigate()

  function invalidar() {
    void queryClient.invalidateQueries({ queryKey: ['triagem'] })
    void queryClient.invalidateQueries({ queryKey: ['compromissos'] })
    void queryClient.invalidateQueries({ queryKey: ['metricas'] })
  }

  const mutFazer = useMutation({
    mutationFn: () => triagem(item.id, { decisao: 'fazer' }),
    onSuccess: () => {
      invalidar()
      showToast('Marcado para fazer.')
      saveOrigin()
      void navigate(`/compromissos/${item.id}`)
    },
    onError: (err: unknown) => {
      showToast(isApiError(err) ? err.mensagem : 'Erro ao processar.')
    },
  })

  const mutAdiar = useMutation({
    mutationFn: (prazo: string) => triagem(item.id, { decisao: 'adiar', prazo }),
    onSuccess: () => { invalidar(); setAcao(null); showToast('Adiado.') },
    onError: (err: unknown) => {
      showToast(isApiError(err) ? err.mensagem : 'Erro ao adiar.')
    },
  })

  const mutDescartar = useMutation({
    mutationFn: () => triagem(item.id, { decisao: 'descartar' }),
    onSuccess: () => { invalidar(); showToast('Descartada.') },
    onError: (err: unknown) => {
      showToast(isApiError(err) ? err.mensagem : 'Erro ao descartar.')
    },
  })

  const mutEditarTitulo = useMutation({
    mutationFn: (titulo: string) => atualizar(item.id, { titulo }),
    onSuccess: () => {
      invalidar()
      setEditandoTitulo(false)
      showToast('Resultado esperado atualizado.')
    },
    onError: (err: unknown) => {
      showToast(isApiError(err) ? err.mensagem : 'Erro ao atualizar.')
    },
  })

  function salvarTitulo() {
    const t = novoTitulo.trim()
    if (!t || t === item.titulo) { setEditandoTitulo(false); return }
    mutEditarTitulo.mutate(t)
  }

  function cancelarEdicao() {
    setNovoTitulo(item.titulo)
    setEditandoTitulo(false)
  }

  const isPending = mutFazer.isPending || mutAdiar.isPending || mutDescartar.isPending

  function handleDescartar() {
    if (!window.confirm('Descartar este item? Ele será removido da lista.')) return
    mutDescartar.mutate()
  }

  return (
    <div className={styles.item}>
      <span className={styles.itemCircle} aria-hidden="true" />
      <div className={styles.itemBody}>
        {editandoTitulo ? (
          <div className={styles.editTituloRow}>
            <input
              className={styles.tituloInput}
              value={novoTitulo}
              onChange={(e) => setNovoTitulo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') salvarTitulo(); if (e.key === 'Escape') cancelarEdicao() }}
              autoFocus
              maxLength={280}
            />
            <div className={styles.editActions}>
              <button
                className={styles.acaoSubmit}
                onClick={salvarTitulo}
                disabled={mutEditarTitulo.isPending || !novoTitulo.trim()}
                type="button"
              >
                Salvar
              </button>
              <button className={styles.acaoCancel} onClick={cancelarEdicao} type="button">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.tituloRow}>
            <span
              className={styles.titulo}
              onClick={() => { setNovoTitulo(item.titulo); setEditandoTitulo(true) }}
              title="Clique para editar"
            >
              {item.titulo}
            </span>
            <button
              className={styles.editBtn}
              onClick={() => { setNovoTitulo(item.titulo); setEditandoTitulo(true) }}
              title="Editar resultado esperado"
              aria-label="Editar resultado esperado"
              type="button"
            >
              <span className="material-symbols-outlined">edit</span>
            </button>
          </div>
        )}
        <div className={styles.btns}>
          <button
            className={`${styles.btn} ${styles.btnFazer}`}
            onClick={() => mutFazer.mutate()}
            disabled={isPending}
          >
            <span className="material-symbols-outlined">person</span>
            Fazer
          </button>
          <button
            className={styles.btn}
            onClick={() => setAcao(acaoAberta === 'delegar' ? null : 'delegar')}
            disabled={isPending}
          >
            <span className="material-symbols-outlined">group</span>
            Delegar
          </button>
          <button
            className={styles.btn}
            onClick={() => setAcao(acaoAberta === 'adiar' ? null : 'adiar')}
            disabled={isPending}
          >
            <span className="material-symbols-outlined">schedule</span>
            Adiar
          </button>
          <button
            className={`${styles.btn} ${styles.btnDescartar}`}
            onClick={handleDescartar}
            disabled={isPending}
          >
            <span className="material-symbols-outlined">delete</span>
            Descartar
          </button>
        </div>
      </div>

      {acaoAberta === 'adiar' && (
        <AdiarModal
          isPending={mutAdiar.isPending}
          onConfirmar={(prazo) => mutAdiar.mutate(prazo)}
          onClose={() => { setAcao(null); setPrazoAdiar('') }}
          prazo={prazoAdiar}
          setPrazo={setPrazoAdiar}
        />
      )}

      {acaoAberta === 'delegar' && (
        <DelegarPopover
          id={item.id}
          onClose={() => setAcao(null)}
          onSuccess={() => { setAcao(null); showToast('Delegado.') }}
        />
      )}
    </div>
  )
}

interface AdiarModalProps {
  isPending: boolean
  onConfirmar: (prazo: string) => void
  onClose: () => void
  prazo: string
  setPrazo: (v: string) => void
}

function AdiarModal({ isPending, onConfirmar, onClose, prazo, setPrazo }: AdiarModalProps) {
  return (
    <>
      <div className={dpStyles.overlay} onClick={onClose} aria-hidden="true" />
      <div
        className={dpStyles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Adiar compromisso"
      >
        <div className={dpStyles.dialogHeader}>
          <span className={`material-symbols-outlined ${dpStyles.dialogIcon}`}>schedule</span>
          <h2 className={dpStyles.dialogTitle}>Adiar</h2>
        </div>

        <div className={dpStyles.field}>
          <label className={dpStyles.label} htmlFor="adiar-prazo">Nova data</label>
          <input
            id="adiar-prazo"
            type="date"
            className={dpStyles.input}
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
            autoFocus
          />
        </div>

        <div className={dpStyles.actions}>
          <button className={dpStyles.cancelBtn} onClick={onClose} type="button">
            Cancelar
          </button>
          <button
            className={dpStyles.submitBtn}
            onClick={() => onConfirmar(prazo)}
            disabled={!prazo || isPending}
            type="button"
          >
            Adiar
          </button>
        </div>
      </div>
    </>
  )
}
