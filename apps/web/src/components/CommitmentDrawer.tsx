import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adicionarReferencia,
  adicionarRegistro,
  atualizar,
  concluirComp,
  descartarComp,
  detalhe,
  removerReferencia,
} from '../api/compromissos.js'
import type { CompromissoDetalhe, PatchBody, Referencia, RegistroEntrada } from '../types/api.js'
import { isApiError } from '../types/api.js'
import { useToast } from './Toast.js'
import { originElement } from './CommitmentList.js'
import styles from './CommitmentDrawer.module.css'

// ─── Focus trap (manual, sem dependência) ────────────────────────────────────

function useFocusTrap(ref: React.RefObject<HTMLElement | null>, onEsc: () => void) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    function focusable() {
      return Array.from(
        el!.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]',
        ),
      )
    }

    // Foco inicial no primeiro elemento
    focusable()[0]?.focus()

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onEsc()
        return
      }
      if (e.key !== 'Tab') return
      const nodes = focusable()
      if (nodes.length === 0) return
      const first = nodes[0]!
      const last = nodes[nodes.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [ref, onEsc])
}

// ─── Mapa 422 → campo ────────────────────────────────────────────────────────

const ERRO_CAMPO: Record<string, string> = {
  'I-01': 'titulo',
  'I-02': 'checkpoint',
  'I-04': 'prazo',
}

const ERRO_MSG: Record<string, string> = {
  'I-01': 'Descreva o resultado esperado.',
  'I-02': 'Delegação exige dono, prazo e checkpoint anterior ao prazo.',
  'I-04': 'Adiar exige uma nova data.',
}

// ─── CommitmentDrawer ─────────────────────────────────────────────────────────

export function CommitmentDrawer() {
  const { id: idParam } = useParams<{ id: string }>()
  const id = Number(idParam)
  const navigate = useNavigate()
  const { showToast } = useToast()
  const drawerRef = useRef<HTMLElement>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['compromisso', id],
    queryFn: () => detalhe(id),
    retry: false,
  })

  function fechar() {
    void navigate('/')
    setTimeout(() => originElement?.focus(), 50)
  }

  useFocusTrap(drawerRef, fechar)

  useEffect(() => {
    if (isError) {
      showToast('Compromisso não encontrado.')
      fechar()
    }
  }, [isError])

  return (
    <aside
      ref={drawerRef}
      className={styles.drawer}
      aria-label="Ficha do compromisso"
      role="dialog"
      aria-modal="true"
    >
      <FichaHeader data={data} id={id} onClose={fechar} />
      <div className={styles.body}>
        {isLoading && <p className={styles.loading}>Carregando…</p>}
        {data && (
          <>
            <FichaForm data={data} id={id} />
            <RefSection refs={data.referencias} id={id} />
            <LogSection registro={data.registro} id={id} />
          </>
        )}
      </div>
      <FichaFooter id={id} status={data?.status} onClose={fechar} />
    </aside>
  )
}

// ─── FichaHeader ──────────────────────────────────────────────────────────────

function FichaHeader({
  data,
  id,
  onClose,
}: {
  data: CompromissoDetalhe | undefined
  id: number
  onClose: () => void
}) {
  const dataCap = data?.criadaEm
    ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(
        new Date(data.criadaEm),
      )
    : '…'

  return (
    <div className={styles.head}>
      <span className={styles.headMeta}>
        #{id} · capturada em {dataCap}
      </span>
      <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar ficha">
        <span className="material-symbols-outlined">close</span>
      </button>
    </div>
  )
}

// ─── FichaForm ────────────────────────────────────────────────────────────────

function FichaForm({ data, id }: { data: CompromissoDetalhe; id: number }) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const [titulo, setTitulo] = useState(data.titulo)
  const [dono, setDono] = useState(data.dono ?? '')
  const [tipo, setTipo] = useState(data.tipo ?? '')
  const [prazo, setPrazo] = useState(data.prazo ?? '')
  const [checkpoint, setCheckpoint] = useState(data.checkpoint ?? '')
  const [status, setStatus] = useState(data.status)
  const [critica, setCritica] = useState(data.critica)

  const [saved, setSaved] = useState({
    titulo: data.titulo,
    dono: data.dono ?? '',
    tipo: data.tipo ?? '',
    prazo: data.prazo ?? '',
    checkpoint: data.checkpoint ?? '',
    status: data.status,
  })

  const [fieldErr, setFieldErr] = useState<Record<string, string>>({})

  // Sincronizar quando React Query invalida e retorna dados novos
  useEffect(() => {
    setTitulo(data.titulo)
    setDono(data.dono ?? '')
    setTipo(data.tipo ?? '')
    setPrazo(data.prazo ?? '')
    setCheckpoint(data.checkpoint ?? '')
    setStatus(data.status)
    setCritica(data.critica)
    setSaved({
      titulo: data.titulo,
      dono: data.dono ?? '',
      tipo: data.tipo ?? '',
      prazo: data.prazo ?? '',
      checkpoint: data.checkpoint ?? '',
      status: data.status,
    })
  }, [data])

  const patchMutation = useMutation({
    mutationFn: (body: PatchBody) => atualizar(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['compromisso', id] })
      void queryClient.invalidateQueries({ queryKey: ['compromissos'] })
      void queryClient.invalidateQueries({ queryKey: ['metricas'] })
    },
  })

  function patch(field: string, value: string | null, currentSaved: string) {
    const val = value ?? ''
    if (val === currentSaved) return
    setFieldErr((f) => ({ ...f, [field]: '' }))
    patchMutation.mutate(
      { [field]: value === '' ? null : value },
      {
        onSuccess: () => setSaved((s) => ({ ...s, [field]: val })),
        onError: (err) => {
          if (isApiError(err)) {
            const campo = ERRO_CAMPO[err.erro]
            if (campo) {
              setFieldErr((f) => ({ ...f, [campo]: ERRO_MSG[err.erro] ?? err.mensagem }))
            } else {
              showToast(err.mensagem)
            }
          }
        },
      },
    )
  }

  const donoTravado = tipo === 'fazer'

  return (
    <div className={styles.section}>
      <div className={styles.field}>
        <label htmlFor="fTitulo">Resultado esperado</label>
        <input
          id="fTitulo"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={() => patch('titulo', titulo, saved.titulo)}
        />
        {fieldErr['titulo'] && <span className={styles.fieldErr}>{fieldErr['titulo']}</span>}
      </div>

      <div className={styles.grid2}>
        <div className={styles.field}>
          <label htmlFor="fTipo">Tipo</label>
          <select
            id="fTipo"
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value)
              if (e.target.value === 'fazer') setDono('Eu')
            }}
            onBlur={() => patch('tipo', tipo || null, saved.tipo)}
          >
            <option value="">—</option>
            <option value="fazer">Fazer</option>
            <option value="delegada">Delegada</option>
            <option value="adiada">Adiada</option>
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="fDono">Dono</label>
          <input
            id="fDono"
            value={donoTravado ? 'Eu' : dono}
            disabled={donoTravado}
            onChange={(e) => setDono(e.target.value)}
            onBlur={() => patch('dono', dono || null, saved.dono)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="fPrazo">Prazo</label>
          <input
            id="fPrazo"
            type="date"
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
            onBlur={() => patch('prazo', prazo || null, saved.prazo)}
          />
          {fieldErr['prazo'] && <span className={styles.fieldErr}>{fieldErr['prazo']}</span>}
        </div>

        <div className={styles.field}>
          <label htmlFor="fCheckpoint">Checkpoint</label>
          <input
            id="fCheckpoint"
            type="date"
            value={checkpoint}
            onChange={(e) => setCheckpoint(e.target.value)}
            onBlur={() => patch('checkpoint', checkpoint || null, saved.checkpoint)}
          />
          {fieldErr['checkpoint'] && (
            <span className={styles.fieldErr}>{fieldErr['checkpoint']}</span>
          )}
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="fStatus">Status</label>
        <select
          id="fStatus"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            patch('status', e.target.value, saved.status)
          }}
        >
          <option value="nao_iniciada">Não iniciada</option>
          <option value="em_andamento">Em andamento</option>
          <option value="bloqueada">Bloqueada</option>
          <option value="aguardando">Aguardando</option>
          <option value="concluida">Concluída</option>
        </select>
      </div>

      <div className={styles.field}>
        <label>Criticidade</label>
        <button
          type="button"
          className={`${styles.criticaBtn} ${critica ? styles.criticaBtnOn : ''}`}
          onClick={() => {
            const novo = !critica
            setCritica(novo)
            patchMutation.mutate({ critica: novo })
          }}
        >
          {critica ? '★ Crítico' : '☆ Marcar como crítico'}
        </button>
      </div>
    </div>
  )
}

// ─── RefSection ───────────────────────────────────────────────────────────────

function RefSection({ refs, id }: { refs: Referencia[]; id: number }) {
  const queryClient = useQueryClient()
  const [url, setUrl] = useState('')
  const [desc, setDesc] = useState('')
  const [urlErr, setUrlErr] = useState('')

  const addMutation = useMutation({
    mutationFn: () => adicionarReferencia(id, { url, descricao: desc || null }),
    onSuccess: () => {
      setUrl('')
      setDesc('')
      setUrlErr('')
      void queryClient.invalidateQueries({ queryKey: ['compromisso', id] })
    },
    onError: (err) => {
      if (isApiError(err) && err.erro === 'I-12') {
        setUrlErr('Use um link http(s) válido.')
      }
    },
  })

  const removeMutation = useMutation({
    mutationFn: (refId: number) => removerReferencia(id, refId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['compromisso', id] })
    },
  })

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Referências</h3>
      {refs.map((r) => (
        <div key={r.id} className={styles.refRow}>
          <div>
            <a href={r.url} target="_blank" rel="noopener noreferrer" className={styles.refLink}>
              {r.url}
            </a>
            {r.descricao && <div className={styles.refDesc}>{r.descricao}</div>}
          </div>
          <button
            className={styles.refRemoveBtn}
            onClick={() => removeMutation.mutate(r.id)}
            aria-label={`Remover referência ${r.url}`}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      ))}

      <div className={styles.refAddForm}>
        <div className={styles.refAddRow}>
          <input
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-label="URL da referência"
          />
          <input
            placeholder="Descrição (opcional)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            aria-label="Descrição da referência"
          />
        </div>
        {urlErr && <span className={styles.fieldErr}>{urlErr}</span>}
        <button
          className={styles.addBtn}
          onClick={() => addMutation.mutate()}
          disabled={!url || addMutation.isPending}
        >
          Adicionar
        </button>
      </div>
    </div>
  )
}

// ─── LogSection ───────────────────────────────────────────────────────────────

function LogSection({ registro, id }: { registro: RegistroEntrada[]; id: number }) {
  const queryClient = useQueryClient()
  const [texto, setTexto] = useState('')

  const addMutation = useMutation({
    mutationFn: () => adicionarRegistro(id, { texto }),
    onSuccess: () => {
      setTexto('')
      void queryClient.invalidateQueries({ queryKey: ['compromisso', id] })
    },
  })

  function fmtDate(iso: string) {
    const [, m, d] = iso.split('-')
    return `${d}/${m}`
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Registro</h3>

      <div className={styles.logAddForm}>
        <textarea
          className={styles.logTextarea}
          placeholder="Adicionar anotação…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-label="Nova anotação"
        />
        <button
          className={styles.addBtn}
          onClick={() => addMutation.mutate()}
          disabled={!texto.trim() || addMutation.isPending}
        >
          Adicionar ao registro
        </button>
      </div>

      {registro.map((e) => (
        <div key={e.id} className={styles.logEntry}>
          <span className={styles.logDate}>{fmtDate(e.data)}</span>
          <span className={e.origem === 'sistema' ? styles.logTextSistema : styles.logText}>
            {e.texto}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── FichaFooter ─────────────────────────────────────────────────────────────

function FichaFooter({
  id,
  status,
  onClose,
}: {
  id: number
  status: string | undefined
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const concluirMutation = useMutation({
    mutationFn: () => concluirComp(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['compromisso', id] })
      void queryClient.invalidateQueries({ queryKey: ['compromissos'] })
      void queryClient.invalidateQueries({ queryKey: ['metricas'] })
      showToast('Compromisso concluído.')
      onClose()
    },
  })

  const descartarMutation = useMutation({
    mutationFn: () => descartarComp(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['compromisso', id] })
      void queryClient.invalidateQueries({ queryKey: ['compromissos'] })
      void queryClient.invalidateQueries({ queryKey: ['metricas'] })
      showToast('Compromisso descartado.')
      onClose()
    },
  })

  function handleDescartar() {
    if (window.confirm('Descartar este compromisso?')) {
      descartarMutation.mutate()
    }
  }

  return (
    <div className={styles.foot}>
      {status !== 'concluida' && (
        <>
          <button
            className={styles.btnConcluir}
            onClick={() => concluirMutation.mutate()}
            disabled={concluirMutation.isPending}
          >
            Concluir
          </button>
          <button
            className={styles.btnDescartar}
            onClick={handleDescartar}
            disabled={descartarMutation.isPending}
          >
            Descartar
          </button>
        </>
      )}
      <button className={styles.btnFechar} onClick={onClose}>
        Fechar
      </button>
    </div>
  )
}
