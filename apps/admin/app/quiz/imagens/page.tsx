import { createAdminClient } from '@/lib/supabase'
import ImagensClient from './ImagensClient'

export const dynamic = 'force-dynamic'

async function getImages() {
  const sb = createAdminClient()
  const { data } = await sb
    .from('wg_quiz_images' as any)
    .select('*')
    .order('section', { ascending: true })
    .order('sort_order', { ascending: true })
  return (data ?? []) as any[]
}

export default async function QuizImagensPage() {
  const data = await getImages()
  return <ImagensClient initialData={data} />
}
