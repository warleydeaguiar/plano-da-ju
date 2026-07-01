import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generatePlanWithClaude, savePlanToDb } from '@/lib/plan-generator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/cron/generate-no-photo?k=<WA_AUTOREPLY_SECRET>  (ou Bearer CRON_SECRET)
 *
 * Muita cliente paga/cortesia NUNCA envia a foto e fica presa em 'pending_photo'
 * sem receber o plano. Regra: passadas 48h sem foto, a Ju gera o plano MESMO ASSIM
 * com base só no questionário (a mensagem avisa que a foto não chegou e convida a
 * enviar depois pra ajustar). Se ela mandar a foto depois, o plano é refeito COM
 * a foto (flag plan_without_photo dispara a regeneração na rota de foto).
 *
 * Processa um lote pequeno por execução (cada geração ~40s) e respeita o budget
 * do OpenRouter: se a chave estourar (403/402), para o lote sem queimar.
 * ?dry=1 → só relata quem entraria.
 */
const MIN_AGE_HOURS = 48;
const BATCH = 4;

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

  // Prioridade é o cliente pagante AO VIVO. Este backlog só roda se o saldo do
  // OpenRouter estiver confortável — nunca queima os últimos dólares (que um
  // plano em tempo real pode precisar). Guarda: saldo mínimo de US$ MIN_BALANCE.
  const MIN_BALANCE = 4;
  const orKey = process.env.OPENROUTER_API_KEY;
  if (!dry && orKey) {
    try {
      const cr = await fetch('https://openrouter.ai/api/v1/credits', { headers: { Authorization: `Bearer ${orKey}` } });
      const cj = await cr.json();
      const bal = (cj?.data?.total_credits ?? 0) - (cj?.data?.total_usage ?? 0);
      if (bal < MIN_BALANCE) {
        return NextResponse.json({ ok: true, skipped: 'saldo OpenRouter baixo — protegendo clientes ao vivo', balance: Math.round(bal * 100) / 100 });
      }
    } catch { /* se a checagem falhar, segue — o loop já para no 403/402 */ }
  }

  const sb = await createServiceClient();
  const cutoff = new Date(Date.now() - MIN_AGE_HOURS * 3600_000).toISOString();

  // Ativa (paga OU cortesia), em pending_photo, SEM foto, elegível há >48h.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cands, error } = await (sb.from('profiles') as any)
    .select('id, email, full_name, hair_type, quiz_answers, subscription_status, subscription_type, partner_label, plan_requested_at, subscription_activated_at, created_at')
    .eq('plan_status', 'pending_photo')
    .is('photo_url', null)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const eligible = (cands ?? []).filter((p: Record<string, unknown>) => {
    const active = p.subscription_status === 'active' || p.subscription_type === 'parceria' || p.partner_label === 'bianca';
    const since = (p.plan_requested_at || p.subscription_activated_at || p.created_at) as string | null;
    return active && !!p.email && !!p.quiz_answers && !!since && since < cutoff;
  });

  const result = { eligible: eligible.length, generated: 0, failed: 0, budgetHit: false, details: [] as unknown[] };
  let processed = 0;

  for (const p of eligible) {
    if (processed >= BATCH || result.budgetHit) break;

    if (dry) { result.details.push({ email: p.email, action: 'geraria (sem foto)' }); processed++; continue; }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plan = await generatePlanWithClaude(sb as any, {
        email: p.email,
        hairType: p.hair_type ?? null,
        quizAnswers: p.quiz_answers ?? null,
        photo: {}, // SEM foto — o gerador monta pelo questionário e avisa a cliente
      });
      // Nota da Ju que a cliente VÊ no app (juliane_notes da semana 1): avisa que
      // o plano saiu pelo questionário e convida a enviar a foto pra ajustar.
      const NOTA_SEM_FOTO = 'Como ainda não recebi a foto do seu cabelo, montei este plano com base nas suas respostas do questionário. 💛 Quando puder, envie sua foto aqui no app que eu ajusto os detalhes pra deixar ainda mais certeiro pra você!';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await savePlanToDb(sb as any, p.id, plan, { extraNote: NOTA_SEM_FOTO });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb.from('profiles') as any).update({
        hair_type: plan.tipo_cabelo?.toLowerCase() ?? p.hair_type,
        recommended_products: Array.isArray(plan.produtos_indicados) ? plan.produtos_indicados : null,
        plan_status: 'ready',
        plan_released_at: new Date().toISOString(),
        plan_delivered_email_sent_at: null, // cron de entrega manda o "plano pronto"
        plan_without_photo: true,           // se ela mandar a foto depois, refaz COM foto
      }).eq('id', p.id);
      result.generated++;
      result.details.push({ email: p.email, action: 'plano gerado sem foto + liberado' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'erro';
      // Budget do OpenRouter estourou → para o lote (tenta de novo no próximo run).
      if (/403|402|limit exceeded|insufficient|créditos/i.test(msg)) {
        result.budgetHit = true;
        result.details.push({ email: p.email, err: 'budget OpenRouter — lote interrompido' });
        break;
      }
      result.failed++;
      result.details.push({ email: p.email, err: msg.slice(0, 160) });
    }
    processed++;
  }

  return NextResponse.json({ ok: true, dry, ...result });
}
