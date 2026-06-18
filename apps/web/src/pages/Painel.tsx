import { useQuery } from '@tanstack/react-query'
import { Outlet, useSearchParams } from 'react-router-dom'
import { listarTriagem } from '../api/compromissos.js'
import { AppShell } from '../components/AppShell.js'
import { CaptureBar } from '../components/CaptureBar.js'
import { CommitmentList } from '../components/CommitmentList.js'
import { FilterChips, type FiltroPainel } from '../components/FilterChips.js'
import { MetricsBar } from '../components/MetricsBar.js'
import { SearchBar } from '../components/SearchBar.js'
import { TeamPanel } from '../components/TeamPanel.js'
import { TriageQueue } from '../components/TriageQueue.js'
import { ToastProvider } from '../components/Toast.js'

export function Painel() {
  const [searchParams] = useSearchParams()
  const filtro = (searchParams.get('filtro') ?? 'ativas') as FiltroPainel

  const { data: triagemData } = useQuery({
    queryKey: ['triagem'],
    queryFn: listarTriagem,
  })

  return (
    <ToastProvider>
      <AppShell>
        <MetricsBar />
        <CaptureBar />
        <TriageQueue itens={triagemData?.itens ?? []} />
        <FilterChips />
        <SearchBar />
        {filtro === 'equipe' ? <TeamPanel /> : <CommitmentList />}
      </AppShell>
      <Outlet />
    </ToastProvider>
  )
}
