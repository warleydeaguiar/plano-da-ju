import { createAdminClient } from '@/lib/supabase'
import Sidebar from '../../components/Sidebar'
import AvaliacoesClient from './AvaliacoesClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Avaliações — Admin Plano da Ju' }

export default async function AvaliacoesPage() {
  const supabase = createAdminClient()
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [avaliacoes, produtos, baseline] = await Promise.all([
    (supabase as any).from('site_avaliacoes')
      .select('id,content_id,autora,nota,texto,data,origem,publicada,site_content(title,path)')
      .order('data', { ascending: false }).limit(500),
    (supabase as any).from('site_content')
      .select('id,title,path').eq('kind', 'product').order('title'),
    (supabase as any).from('site_seo_baseline').select('path,gsc_impressions,gsc_clicks'),
  ])
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const impressoes = new Map<string, number>()
  for (const b of baseline.data ?? []) impressoes.set(b.path, b.gsc_impressions ?? 0)

  // Produto com muita impressão e nenhuma avaliação é onde a estrela renderia
  // mais — é essa a fila de trabalho da Juliane, não a ordem alfabética.
  const comAvaliacao = new Set((avaliacoes.data ?? []).map((a: { content_id: number }) => a.content_id))
  const prioridade = (produtos.data ?? [])
    .map((p: { id: number; title: string; path: string }) => ({
      ...p,
      impressoes: impressoes.get(p.path) ?? 0,
      temAvaliacao: comAvaliacao.has(p.id),
    }))
    .sort((a: { impressoes: number }, b: { impressoes: number }) => b.impressoes - a.impressoes)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#FFFAF5' }}>
      <Sidebar />
      <AvaliacoesClient avaliacoes={avaliacoes.data ?? []} produtos={prioridade} />
    </div>
  )
}
