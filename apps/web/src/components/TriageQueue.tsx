import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { triagem } from '../api/compromissos.js'
import type { Compromisso } from '../types/api.js'
import { isApiError } from '../types/api.js'
import { DelegarPopover } from './DelegarPopover.js'
import { useToast } from './Toast.js'
import styles from './TriageQueue.module.css'

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
      <h2 className={styles.heading}>
        Entrada — aguardando triagem{' '}
        <span className={styles.count}>({itens.length})</span>
      </h2>
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
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  function invalidar() {
    void queryClient.invalidateQueries({ queryKey: ['triagem'] })
    void queryClient.invalidateQueries({ queryKey: ['compromissos'] })
    void queryClient.invalidateQueries({ queryKey: ['metricas'] })
  }

  const mutFazer = useMutation({
    mutationFn: () => triagem(item.id, { decisao: 'fazer' }),
    onSuccess: () => { invalidar(); showToast('Marcado para fazer.') },
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

  const isPending = mutFazer.isPending || mutAdiar.isPending || mutDescartar.isPending

  function handleDescartar() {
    if (!window.confirm('Descartar este item? Ele será removido da lista.')) return
    mutDescartar.mutate()
  }

  return (
    <div className={styles.item}>
      <span className={styles.titulo}>{item.titulo}</span>
      <span className={styles.btns}>
        <button
          className={styles.btn}
          onClick={() => mutFazer.mutate()}
          disabled={isPending}
        >
          Fazer
        </button>
        <button
          className={styles.btn}
          onClick={() => setAcao(acaoAberta === 'delegar' ? null : 'delegar')}
          disabled={isPending}
        >
          Delegar
        </button>
        <button
          className={styles.btn}
          onClick={() => setAcao(acaoAberta === 'adiar' ? null : 'adiar')}
          disabled={isPending}
        >
          Adiar
        </button>
        <button
          className={`${styles.btn} ${styles.btnDescartar}`}
          onClick={handleDescartar}
          disabled={isPending}
        >
          Descartar
        </button>
      </span>

      {acaoAberta === 'adiar' && (
        <div className={styles.acaoInline}>
          <label className={styles.acaoLabel} htmlFor={`adiar-prazo-${item.id}`}>
            Nova data
          </label>
          <div className={styles.acaoRow}>
            <input
              id={`adiar-prazo-${item.id}`}
              type="date"
              className={styles.dateInput}
              value={prazoAdiar}
              onChange={(e) => setPrazoAdiar(e.target.value)}
            />
            <button
              className={styles.acaoSubmit}
              onClick={() => { if (prazoAdiar) mutAdiar.mutate(prazoAdiar) }}
              disabled={!prazoAdiar || mutAdiar.isPending}
            >
              Confirmar
            </button>
            <button
              className={styles.acaoCancel}
              onClick={() => { setAcao(null); setPrazoAdiar('') }}
            >
              Cancelar
            </button>
          </div>
        </div>
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
