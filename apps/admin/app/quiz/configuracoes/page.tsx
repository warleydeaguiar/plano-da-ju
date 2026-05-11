import { createAdminClient } from '@/lib/supabase'
import ConfiguracoesClient from './ConfiguracoesClient'

export const dynamic = 'force-dynamic'

async function getTestimonials() {
  const sb = createAdminClient()
  const { data } = await sb
    .from('wg_quiz_testimonials' as any)
    .select('*')
    .eq('quiz_slug', 'fashion-gold')
    .order('type')
    .order('sort_order')
  return (data ?? []) as any[]
}

export default async function ConfiguracoesPage() {
  const data = await getTestimonials()
  return <ConfiguracoesClient initialData={data} />
}
