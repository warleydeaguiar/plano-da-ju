import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generatePlanWithClaude, savePlanToDb } from '@/lib/plan-generator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/cron/recover-stuck-plans?k=<WA_AUTOREPLY_SECRET>  (ou Bearer CRON_SECRET)
 *
 * REDE DE SEGURANÇA: a cliente envia a foto → status vira 'processing' e dispara a
 * geração. Se a geração falha naquele instante (limite/erro transitório do
 * OpenRouter), o perfil fica preso em 'processing' pra sempre, SEM plano.
 *
 * Este cron pega quem está 'processing' há > MIN_AGE_MIN minutos, com foto, e
 * SEM as 12 semanas — regenera o plano, salva e LIBERA (ready + plan_released_at).
 * Processa um lote pequeno por execução (cada geração ~40s). Idempotente.
 *
 * ?dry=1 → só relata quem recuperaria.
 */
const MIN_AGE_MIN = 10;   // só age depois de 10 min preso (dá tempo do fluxo normal)
const BATCH = 4;          // 4 × ~40s < maxDuration 300s

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const waSecret = process.env.WA_AUTOREPLY_SECRET;
  const auth = req.headers.get('authorization');
  const k = req.nextUrl.searchParams.get('k');
  const authed =
    (secret && auth === `Bearer ${secret}`) ||
    (waSecret && k === waSecret) ||
    (secret && k === secret);
  if (!authed) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const dry = req.nextUrl.searchParams.get('dry') === '1';
  const sb = await createServiceClient();
  const sinceIso = new Date(Date.now() - MIN_AGE_MIN * 60_000).toISOString();

  // Candidatos: preso em processing há um tempo, com foto, com plano (ou não).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cands, error } = await (sb.from('profiles') as any)
    .select('id, email, full_name, hair_type, quiz_answers, photo_url, photo_back_url, photo_root_url, plan_status, plan_requested_at')
    .eq('plan_status', 'processing')
    .not('photo_url', 'is', null)
    .lt('plan_requested_at', sinceIso)
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = { scanned: cands?.length ?? 0, recovered: 0, already_had_plan: 0, failed: 0, details: [] as unknown[] };
  let processed = 0;

  for (const p of cands ?? []) {
    if (processed >= BATCH) break;

    // Já tem 12 semanas? (gerou mas o status ficou preso) → só liberar.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (sb.from('hair_plans') as any)
      .select('id', { count: 'exact', head: true }).eq('user_id', p.id);

    if ((count ?? 0) >= 12) {
      if (!dry) await releasePlan(sb, p.id);
      result.already_had_plan++;
      result.details.push({ email: p.email, action: 'liberado (já tinha plano)' });
      continue;
    }

    if (dry) { result.details.push({ email: p.email, action: 'regeneraria' }); processed++; continue; }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plan = await generatePlanWithClaude(sb as any, {
        email: p.email,
        hairType: p.hair_type ?? null,
        quizAnswers: p.quiz_answers ?? null,
        photo: {
          photoUrl: p.photo_url ?? undefined,
          extraPhotoUrls: [p.photo_back_url, p.photo_root_url].filter(Boolean),
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await savePlanToDb(sb as any, p.id, plan);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb.from('profiles') as any).update({
        hair_type: plan.tipo_cabelo?.toLowerCase() ?? p.hair_type,
        recommended_products: Array.isArray(plan.produtos_indicados) ? plan.produtos_indicados : null,
      }).eq('id', p.id);
      await releasePlan(sb, p.id);
      result.recovered++;
      result.details.push({ email: p.email, action: 'regenerado + liberado', semanas: plan.semanas?.length });
    } catch (e) {
      result.failed++;
      result.details.push({ email: p.email, err: e instanceof Error ? e.message.slice(0, 160) : 'erro' });
    }
    processed++;
  }

  return NextResponse.json({ ok: true, dry, ...result });
}

// Libera o plano: ready + visível agora; zera o flag de e-mail pro cron de entrega mandar.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function releasePlan(sb: any, id: string) {
  await sb.from('profiles').update({
    plan_status: 'ready',
    plan_released_at: new Date().toISOString(),
    plan_delivered_email_sent_at: null,
  }).eq('id', id);
}
