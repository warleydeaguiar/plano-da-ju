import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase'
import Sidebar from '../../components/Sidebar'
import EditorClient from './EditorClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Editar — Admin Plano da Ju' }

export default async function EditarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [conteudo, faq, baseline] = await Promise.all([
    (supabase as any).from('site_content')
      .select('id,kind,slug,path,title,content_clean,excerpt_html,seo_title,seo_description,og_image,status,noindex,published_at,modified_at,word_count,affiliate_url,price_cents,price_original_cents')
      .eq('id', id).maybeSingle(),
    (supabase as any).from('site_faq')
      .select('id,pergunta,resposta,revisao_status,revisao_motivo,ordem')
      .eq('content_id', id).order('ordem'),
    (supabase as any).from('site_seo_baseline')
      .select('gsc_clicks,gsc_impressions,gsc_position,is_top50').eq('path', '').maybeSingle(),
  ])
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (!conteudo.data) notFound()

  // baseline é por path, então busca depois de saber o path
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const { data: metricas } = await (supabase as any)
    .from('site_seo_baseline')
    .select('gsc_clicks,gsc_impressions,gsc_position,is_top50')
    .eq('path', conteudo.data.path)
    .maybeSingle()

  void baseline

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#FFFAF5' }}>
      <Sidebar />
      <EditorClient item={conteudo.data} faq={faq.data ?? []} metricas={metricas ?? null} />
    </div>
  )
}
