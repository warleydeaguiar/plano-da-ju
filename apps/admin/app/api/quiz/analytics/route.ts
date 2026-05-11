import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/quiz/analytics?slug=fashion-gold|plano-capilar&period=30
 * Retorna métricas completas de um quiz.
 */
export async function GET(req: NextRequest) {
  const slug   = req.nextUrl.searchParams.get('slug') ?? 'fashion-gold'
  const period = parseInt(req.nextUrl.searchParams.get('period') ?? '30', 10)
  const sb     = createAdminClient()

  const since = new Date(Date.now() - period * 86400_000).toISOString()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString()

  if (slug === 'fashion-gold') {
    const [allRes, todayRes, weekRes, viewsAllRes, viewsPeriodRes, dailyLeadsRes, utmRes, leadsListRes] = await Promise.all([
      // Total leads
      sb.from('wg_quiz_leads' as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', slug),
      // Leads hoje
      sb.from('wg_quiz_leads' as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', slug).gte('created_at', today.toISOString()),
      // Leads 7 dias
      sb.from('wg_quiz_leads' as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', slug).gte('created_at', weekAgo),
      // Views total
      sb.from('wg_quiz_views' as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', slug),
      // Views período
      sb.from('wg_quiz_views' as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', slug).gte('created_at', since),
      // Leads por dia (últimos N dias)
      sb.from('wg_quiz_leads' as any).select('created_at').eq('quiz_slug', slug).gte('created_at', since).order('created_at', { ascending: true }),
      // UTM breakdown
      sb.from('wg_quiz_leads' as any).select('utm_source, utm_campaign').eq('quiz_slug', slug).not('utm_source', 'is', null),
      // Lista de leads
      sb.from('wg_quiz_leads' as any).select('*').eq('quiz_slug', slug).order('created_at', { ascending: false }).limit(100),
    ])

    // Série diária
    const dailyMap: Record<string, number> = {}
    const days = Array.from({ length: period }, (_, i) => {
      const d = new Date(Date.now() - (period - 1 - i) * 86400_000)
      return d.toISOString().slice(0, 10)
    })
    days.forEach(d => { dailyMap[d] = 0 })
    for (const row of (dailyLeadsRes.data ?? []) as any[]) {
      const key = (row.created_at as string).slice(0, 10)
      if (key in dailyMap) dailyMap[key]++
    }
    const dailySeries = days.map(d => ({ date: d, leads: dailyMap[d] }))

    // UTM breakdown
    const utmMap: Record<string, number> = {}
    for (const row of (utmRes.data ?? []) as any[]) {
      const src = (row.utm_source ?? 'direto').toLowerCase()
      utmMap[src] = (utmMap[src] ?? 0) + 1
    }
    const utmBreakdown = Object.entries(utmMap)
      .sort(([, a], [, b]) => b - a)
      .map(([source, count]) => ({ source, count }))

    const totalLeads   = allRes.count ?? 0
    const periodViews  = viewsPeriodRes.count ?? 0
    const conversion   = periodViews > 0 ? Math.round((totalLeads / Math.max(periodViews, 1)) * 100) : null

    return NextResponse.json({
      slug,
      kpis: {
        totalLeads,
        todayLeads:   todayRes.count ?? 0,
        weekLeads:    weekRes.count ?? 0,
        totalViews:   viewsAllRes.count ?? 0,
        periodViews,
        conversionRate: conversion,
      },
      dailySeries,
      utmBreakdown,
      leads: leadsListRes.data ?? [],
    })
  }

  if (slug === 'plano-capilar') {
    const [allViewsRes, periodViewsRes, allLeadsRes, todayLeadsRes, answersRes, dailyViewsRes] = await Promise.all([
      // Views total
      sb.from('wg_quiz_views' as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', slug),
      // Views período
      sb.from('wg_quiz_views' as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', slug).gte('created_at', since),
      // Leads (pessoas que compraram após o quiz - profiles)
      sb.from('profiles').select('id', { count: 'exact', head: true }),
      // Hoje
      sb.from('wg_quiz_views' as any).select('id', { count: 'exact', head: true }).eq('quiz_slug', slug).gte('created_at', today.toISOString()),
      // Respostas para analytics de perguntas
      sb.from('wg_quiz_answers' as any).select('question_id, answer').eq('quiz_slug', slug).gte('created_at', since),
      // Views por dia
      sb.from('wg_quiz_views' as any).select('created_at').eq('quiz_slug', slug).gte('created_at', since).order('created_at', { ascending: true }),
    ])

    // Série diária de views
    const dailyMap: Record<string, number> = {}
    const days = Array.from({ length: period }, (_, i) => {
      const d = new Date(Date.now() - (period - 1 - i) * 86400_000)
      return d.toISOString().slice(0, 10)
    })
    days.forEach(d => { dailyMap[d] = 0 })
    for (const row of (dailyViewsRes.data ?? []) as any[]) {
      const key = (row.created_at as string).slice(0, 10)
      if (key in dailyMap) dailyMap[key]++
    }
    const dailySeries = days.map(d => ({ date: d, views: dailyMap[d] }))

    // Agregar respostas por pergunta
    const questionStats: Record<string, Record<string, number>> = {}
    for (const row of (answersRes.data ?? []) as any[]) {
      const qid = row.question_id as string
      const ans = row.answer
      if (!questionStats[qid]) questionStats[qid] = {}
      const values = Array.isArray(ans) ? ans : [ans]
      for (const v of values) {
        const s = String(v)
        questionStats[qid][s] = (questionStats[qid][s] ?? 0) + 1
      }
    }

    // Calcular percentuais
    const questionAnalytics = Object.entries(questionStats).map(([questionId, counts]) => {
      const total = Object.values(counts).reduce((a, b) => a + b, 0)
      const options = Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .map(([value, count]) => ({ value, count, pct: Math.round((count / total) * 100) }))
      return { questionId, total, options }
    })

    return NextResponse.json({
      slug,
      kpis: {
        totalViews:    allViewsRes.count ?? 0,
        periodViews:   periodViewsRes.count ?? 0,
        todayViews:    todayLeadsRes.count ?? 0,
        totalProfiles: allLeadsRes.count ?? 0,
      },
      dailySeries,
      questionAnalytics,
    })
  }

  return NextResponse.json({ error: 'slug inválido' }, { status: 400 })
}
