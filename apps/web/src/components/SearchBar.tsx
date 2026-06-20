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
      const donoAtual = searchParams.get('dono')
      const params: Record<string, string> = {}
      if (donoAtual) params['dono'] = donoAtual
      if (valor.trim()) {
        params['q'] = valor.trim()
        if (!donoAtual) params['filtro'] = 'todas'
      }
      setSearchParams(params, { replace: true })
    }, 300)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor])

  function limpar() {
    setValor('')
    const donoAtual = searchParams.get('dono')
    const params: Record<string, string> = {}
    if (donoAtual) params['dono'] = donoAtual
    setSearchParams(params, { replace: true })
  }

  return (
    <div role="search" className={styles.wrap}>
      <span className={`${styles.searchIcon} material-symbols-outlined`}>search</span>
      <input
        type="search"
        className={styles.input}
        placeholder="Buscar compromissos..."
        aria-label="Buscar compromissos"
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
          <span className="material-symbols-outlined">close</span>
        </button>
      )}
    </div>
  )
}
