import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
// @ts-ignore
import styles from './SearchBar.module.css'

export function SearchBar() {
  const [searchParams, setSearchParams] = useSearchParams()
  const qUrl = searchParams.get('q') ?? ''
  const [valor, setValor] = useState(qUrl)

  // Sincroniza o input quando a URL muda externamente (ex: botão voltar)
  useEffect(() => {
    setValor(searchParams.get('q') ?? '')
  }, [searchParams])

  // Debounce: atualiza a URL 300 ms após o usuário parar de digitar
  useEffect(() => {
    const timer = setTimeout(() => {
      const params: Record<string, string> = {}
      if (valor.trim()) {
        params['filtro'] = 'todas'
        params['q'] = valor.trim()
      }
      setSearchParams(params, { replace: true })
    }, 300)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor])

  function limpar() {
    setValor('')
    setSearchParams({}, { replace: true })
  }

  return (
    <div role="search" className={styles.wrap}>
      <input
        type="search"
        className={styles.input}
        placeholder="Buscar por resultado esperado…"
        aria-label="Buscar por resultado esperado"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
      />
      {valor && (
        <button
          type="button"
          className={styles.limpar}
          aria-label="Limpar busca"
          onClick={limpar}
        >
          ✕
        </button>
      )}
    </div>
  )
}
