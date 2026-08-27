import { createAdminClient } from '@/lib/supabase'
import Sidebar from '../components/Sidebar'
import SiteClient from './SiteClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Site — Admin Plano da Ju' }

export interface LinhaConteudo {
  id: number
  kind: string
  path: string
  title: string
  status: string
  word_count: number | null
  published_at: string | null
  modified_at: string | null
  revisado_em: string | null
  seo_description: string | null
  og_image: string | null
}

async function carregar() {
  const supabase = createAdminClient()
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [conteudo, faq, baseline] = await Promise.all([
    (supabase as any).from('site_content')
      .select('id,kind,path,title,status,word_count,published_at,modified_at,revisado_em,seo_description,og_image')
      .order('published_at', { ascending: false, nullsFirst: false }).limit(500),
    (supabase as any).from('site_faq').select('revisao_status'),
    (supabase as any).from('site_seo_baseline').select('path,gsc_clicks,is_top50'),
  ])
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const cliquesPorPath = new Map<string, number>()
  const top50 = new Set<string>()
  for (const b of baseline.data ?? []) {
    cliquesPorPath.set(b.path, b.gsc_clicks ?? 0)
    if (b.is_top50) top50.add(b.path)
  }

  const linhas = (conteudo.data ?? []) as LinhaConteudo[]
  const faqs = (faq.data ?? []) as { revisao_status: string }[]

  return {
    linhas: linhas.map((l) => ({
      ...l,
      cliques: cliquesPorPath.get(l.path) ?? 0,
      top50: top50.has(l.path),
    })),
    faqPendentes: faqs.filter((f) => f.revisao_status === 'pendente').length,
    faqAprovadas: faqs.filter((f) => f.revisao_status === 'aprovada').length,
    faqReprovadas: faqs.filter((f) => f.revisao_status === 'reprovada').length,
  }
}

export default async function SitePage() {
  const dados = await carregar()
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#FFFAF5' }}>
      <Sidebar />
      <SiteClient {...dados} />
    </div>
  )
}
