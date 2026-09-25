import type { Metadata } from 'next'
import { Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import QuizFashionGoldClient from './QuizFashionGoldClient'
import type { ExperimentoAtivo } from '@/lib/ab'

export const metadata: Metadata = {
  title: 'Grupo VIP Ybera Paris — Promoções Exclusivas',
}

export const dynamic = 'force-dynamic'

/**
 * Experimentos rodando neste quiz.
 *
 * Mesmo padrão do /quiz: lidos no servidor e entregues prontos ao cliente, com
 * timeout curto. Página que não abre custa mais caro que página sem teste, então
 * qualquer falha aqui devolve lista vazia e o quiz segue na versão padrão.
 */
async function experimentos(): Promise<ExperimentoAtivo[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return []
  try {
    const sb = createClient(url, key, { auth: { persistSession: false } })
    const consulta = (sb.from('wg_experiments') as never as {
      select: (s: string) => { eq: (k: string, v: string) => { eq: (k: string, v: string) => Promise<{ data: ExperimentoAtivo[] | null }> } }
    })
      .select('id, flag_key, target_step_id, traffic_pct, variant_content')
      .eq('target_quiz_slug', 'fashion-gold')
      .eq('status', 'running')
    const limite = new Promise<{ data: null }>(r => setTimeout(() => r({ data: null }), 3000))
    const { data } = await Promise.race([consulta, limite])
    return (data ?? []) as ExperimentoAtivo[]
  } catch {
    return []
  }
}

export default async function QuizFashionGoldPage() {
  const exps = await experimentos()
  return (
    <Suspense fallback={<div style={{ minHeight: '100svh', background: '#faf7f2' }} />}>
      <QuizFashionGoldClient experimentos={exps} />
    </Suspense>
  )
}
