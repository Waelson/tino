import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listar, criar, atualizar, excluir, registrarClique } from '../api/links.js'
import type { LinkFavorito } from '../types/api.js'
import type { LinkBody } from '../api/links.js'
// @ts-ignore
import styles from './LinksPanel.module.css'

// ─── Formulário inline ────────────────────────────────────────────────────────

interface FormState {
  nome:      string
  url:       string
  descricao: string
  categoria: string
}

const FORM_VAZIO: FormState = { nome: '', url: '', descricao: '', categoria: '' }

function LinkForm({
  inicial,
  onSalvar,
  onCancelar,
  salvando,
}: {
  inicial?: FormState
  onSalvar: (body: LinkBody) => void
  onCancelar: () => void
  salvando: boolean
}) {
  const [form, setForm] = useState<FormState>(inicial ?? FORM_VAZIO)

  function set(campo: keyof FormState, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.url.trim() || !form.nome.trim()) return
    onSalvar({
      url:       form.url.trim(),
      nome:      form.nome.trim(),
      descricao: form.descricao.trim() || null,
      categoria: form.categoria.trim() || null,
    })
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.formRow}>
        <input
          className={styles.input}
          placeholder="Nome *"
          value={form.nome}
          onChange={(e) => set('nome', e.target.value)}
          required
        />
        <input
          className={`${styles.input} ${styles.inputUrl}`}
          placeholder="URL *"
          value={form.url}
          onChange={(e) => set('url', e.target.value)}
          required
        />
      </div>
      <div className={styles.formRow}>
        <input
          className={styles.input}
          placeholder="Descrição"
          value={form.descricao}
          onChange={(e) => set('descricao', e.target.value)}
        />
        <input
          className={styles.input}
          placeholder="Categoria (ex: Docs, Monitor)"
          value={form.categoria}
          onChange={(e) => set('categoria', e.target.value)}
        />
      </div>
      <div className={styles.formActions}>
        <button type="submit" className={styles.btnPrimary} disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" className={styles.btnSecondary} onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ─── Linha de link ────────────────────────────────────────────────────────────

function LinkRow({
  item,
  onEditar,
  onExcluir,
  onClique,
}: {
  item:      LinkFavorito
  onEditar:  (item: LinkFavorito) => void
  onExcluir: (id: number) => void
  onClique:  (id: number) => void
}) {
  function abrir() {
    onClique(item.id)
    window.open(item.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={styles.row}>
      <button
        className={styles.rowLink}
        onClick={abrir}
        title={item.url}
      >
        <div className={styles.rowInfo}>
          <span className={styles.rowNome}>
            {item.nome}
            <span className={styles.rowNomeArrow}>↗</span>
          </span>
          {item.descricao && <span className={styles.rowDesc}>{item.descricao}</span>}
        </div>
      </button>
      <div className={styles.rowMeta}>
        {item.categoria && (
          <span className={styles.badge}>{item.categoria}</span>
        )}
        <span className={styles.cliques}>{item.cliques}x</span>
        <div className={styles.rowActions}>
          <button
            className={styles.iconBtn}
            onClick={() => onEditar(item)}
            title="Editar"
            aria-label={`Editar ${item.nome}`}
          >
            ✎
          </button>
          <button
            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
            onClick={() => onExcluir(item.id)}
            title="Excluir"
            aria-label={`Excluir ${item.nome}`}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── LinksPanel ───────────────────────────────────────────────────────────────

export function LinksPanel() {
  const qc = useQueryClient()
  const [mostrando, setMostrando] = useState<'nenhum' | 'criar' | number>('nenhum')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['links'],
    queryFn:  listar,
  })

  const criarMutation = useMutation({
    mutationFn: criar,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['links'] })
      setMostrando('nenhum')
    },
  })

  const atualizarMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<LinkBody> }) => atualizar(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['links'] })
      setMostrando('nenhum')
    },
  })

  const excluirMutation = useMutation({
    mutationFn: excluir,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['links'] }),
  })

  const cliqueMutation = useMutation({
    mutationFn: registrarClique,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['links'] }),
  })

  const itens = data?.itens ?? []

  function itemEmEdicao(): LinkFavorito | undefined {
    if (typeof mostrando === 'number') {
      return itens.find((i) => i.id === mostrando)
    }
    return undefined
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h2 className={styles.titulo}>Meus Links</h2>
        {mostrando === 'nenhum' && (
          <button className={styles.btnPrimary} onClick={() => setMostrando('criar')}>
            + Adicionar link
          </button>
        )}
      </div>

      {mostrando === 'criar' && (
        <div className={styles.formWrap}>
          <LinkForm
            onSalvar={(body) => criarMutation.mutate(body)}
            onCancelar={() => setMostrando('nenhum')}
            salvando={criarMutation.isPending}
          />
          {criarMutation.isError && (
            <p className={styles.erro}>
              {(criarMutation.error as { mensagem?: string })?.mensagem ?? 'Erro ao salvar.'}
            </p>
          )}
        </div>
      )}

      {isLoading && <p className={styles.info}>Carregando…</p>}

      {isError && (
        <div className={styles.info}>
          <p>Erro ao carregar links.</p>
          <button className={styles.retryBtn} onClick={() => void refetch()}>Tentar de novo</button>
        </div>
      )}

      {!isLoading && !isError && itens.length === 0 && mostrando !== 'criar' && (
        <p className={styles.info}>Nenhum link cadastrado ainda. Adicione o primeiro acima.</p>
      )}

      {!isLoading && !isError && itens.map((item) => (
        typeof mostrando === 'number' && mostrando === item.id ? (
          <div key={item.id} className={styles.formWrap}>
            <LinkForm
              inicial={{
                nome:      item.nome,
                url:       item.url,
                descricao: item.descricao ?? '',
                categoria: item.categoria ?? '',
              }}
              onSalvar={(body) => atualizarMutation.mutate({ id: item.id, body })}
              onCancelar={() => setMostrando('nenhum')}
              salvando={atualizarMutation.isPending}
            />
            {atualizarMutation.isError && (
              <p className={styles.erro}>
                {(atualizarMutation.error as { mensagem?: string })?.mensagem ?? 'Erro ao salvar.'}
              </p>
            )}
          </div>
        ) : (
          <LinkRow
            key={item.id}
            item={item}
            onEditar={(i) => setMostrando(i.id)}
            onExcluir={(id) => excluirMutation.mutate(id)}
            onClique={(id) => cliqueMutation.mutate(id)}
          />
        )
      ))}
    </div>
  )
}
