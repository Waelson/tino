import { useQuery } from '@tanstack/react-query'
import { useOutlet, useSearchParams } from 'react-router-dom'
import { listarTriagem } from '../api/compromissos.js'
import { AppShell } from '../components/AppShell.js'
import { CaptureBar } from '../components/CaptureBar.js'
import { CommitmentList } from '../components/CommitmentList.js'
import { FilterChips } from '../components/FilterChips.js'
import { MetricsBar } from '../components/MetricsBar.js'
import { type Secao } from '../components/NavPrincipal.js'
import { SearchBar } from '../components/SearchBar.js'
import { RiscoBriefing } from '../components/RiscoBriefing.js'
import { TeamPanel } from '../components/TeamPanel.js'
import { TriageQueue } from '../components/TriageQueue.js'
import { WeeklyReview } from '../components/WeeklyReview.js'
import { TimelineView } from '../components/TimelineView.js'
import { LinksPanel } from '../components/LinksPanel.js'
import { ToastProvider } from '../components/Toast.js'
import { CaptureProvider } from '../contexts/CaptureContext.js'

export function Painel() {
  const [searchParams] = useSearchParams()
  const secao = (searchParams.get('secao') ?? 'compromissos') as Secao
  const filtro = searchParams.get('filtro') ?? 'ativas'
  const outlet = useOutlet()

  const { data: triagemData } = useQuery({
    queryKey: ['triagem'],
    queryFn: listarTriagem,
    enabled: secao === 'compromissos',
  })

  return (
    <CaptureProvider>
      <ToastProvider>
        <AppShell drawer={outlet}>
          {secao === 'compromissos' && (
            <>
              <MetricsBar />
              <CaptureBar />
              <TriageQueue itens={triagemData?.itens ?? []} />
              <FilterChips />
              <SearchBar />
              {filtro === 'risco' && <RiscoBriefing />}
              <CommitmentList />
            </>
          )}

          {secao === 'equipe' && <TeamPanel />}

          {secao === 'revisao' && <WeeklyReview />}

          {secao === 'timeline' && <TimelineView />}

          {secao === 'links' && <LinksPanel />}
        </AppShell>
      </ToastProvider>
    </CaptureProvider>
  )
}
