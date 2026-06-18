import { useQuery } from '@tanstack/react-query'
import { Outlet, useSearchParams } from 'react-router-dom'
import { listarTriagem } from '../api/compromissos.js'
import { AppShell } from '../components/AppShell.js'
import { CaptureBar } from '../components/CaptureBar.js'
import { CommitmentList } from '../components/CommitmentList.js'
import { FilterChips } from '../components/FilterChips.js'
import { MetricsBar } from '../components/MetricsBar.js'
import { NavPrincipal, type Secao } from '../components/NavPrincipal.js'
import { SearchBar } from '../components/SearchBar.js'
import { TeamPanel } from '../components/TeamPanel.js'
import { TriageQueue } from '../components/TriageQueue.js'
import { WeeklyReview } from '../components/WeeklyReview.js'
import { ToastProvider } from '../components/Toast.js'

export function Painel() {
  const [searchParams] = useSearchParams()
  const secao = (searchParams.get('secao') ?? 'compromissos') as Secao

  const { data: triagemData } = useQuery({
    queryKey: ['triagem'],
    queryFn: listarTriagem,
    enabled: secao === 'compromissos',
  })

  return (
    <ToastProvider>
      <AppShell>
        <MetricsBar />
        <NavPrincipal />

        {secao === 'compromissos' && (
          <>
            <CaptureBar />
            <TriageQueue itens={triagemData?.itens ?? []} />
            <FilterChips />
            <SearchBar />
            <CommitmentList />
          </>
        )}

        {secao === 'equipe' && <TeamPanel />}

        {secao === 'revisao' && <WeeklyReview />}
      </AppShell>
      <Outlet />
    </ToastProvider>
  )
}
