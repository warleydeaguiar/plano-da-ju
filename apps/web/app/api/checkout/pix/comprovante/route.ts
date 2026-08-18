import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveAuthUserId } from '@/lib/supabase/auth-resolve';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { normalizeEmail, isValidEmailFormat } from '@/lib/normalize-email';
import { extractFieldsFromQuiz } from '@/lib/quiz-to-profile';
import { PLAN_BASE_CENTS } from '@/lib/pricing';
import { sendDiscord } from '@/lib/discord';
import { logCheckoutError } from '@/lib/checkout-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/checkout/pix/comprovante  (multipart/form-data)
 *
 * PIX MANUAL — plano B quando a PagarMe não consegue gerar o QR. A cliente paga
 * na chave (CPF) da Juliane e anexa o comprovante aqui. O acesso é liberado NA
 * HORA (decisão de negócio: zero atrito > risco de fraude), mas tudo fica
 * auditável e reversível:
 *   • comprovante salvo em bucket PRIVADO (pix-comprovantes)
 *   • perfil marcado com pix_manual_* → dá pra listar e revogar
 *   • aviso no Discord pra conferência humana
 * ⚠️ Não há validação do comprovante — é confiança + auditoria.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  // Limite apertado: é uma ação que concede acesso.
  const rl = checkRateLimit(`pix-comprovante:${ip}`, { max: 4, windowMs: 60_000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde 1 minuto.' }, { status: 429 });

  let logEmail: string | null = null;
  try {
    const form = await req.formData();
    const file = form.get('comprovante');
    const rawEmail = String(form.get('email') ?? '');
    const name = String(form.get('name') ?? '').trim();
    const orderId = String(form.get('order_id') ?? '');
    const sessionId = String(form.get('session_id') ?? '');
    const quizRaw = form.get('quiz_answers');

    const email = normalizeEmail(rawEmail).email;
    logEmail = email || null;
    if (!email || !isValidEmailFormat(email)) {
      return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
    }
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Anexe o comprovante do PIX.' }, { status: 400 });
    }
    const f = file as File;
    if (f.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Arquivo muito grande (máx. 10 MB).' }, { status: 400 });
    }
    const okType = f.type.startsWith('image/') || f.type === 'application/pdf';
    if (!okType) {
      return NextResponse.json({ error: 'Envie uma imagem (print) ou PDF do comprovante.' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // ── Sobe o comprovante (bucket privado) ──
    const ext = f.type === 'application/pdf' ? 'pdf'
      : f.type === 'image/png' ? 'png'
      : f.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${email.replace(/[^a-z0-9@._-]/gi, '_')}/${Date.now()}.${ext}`;
    const bytes = new Uint8Array(await f.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from('pix-comprovantes')
      .upload(path, bytes, { contentType: f.type, upsert: false });
    if (upErr) {
      console.error('[pix comprovante] upload', upErr);
      return NextResponse.json({ error: 'Não consegui salvar o comprovante. Tente de novo.' }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let quizAnswers: any = {};
    if (typeof quizRaw === 'string' && quizRaw) { try { quizAnswers = JSON.parse(quizRaw); } catch { /* ignora */ } }
    const extracted = extractFieldsFromQuiz(quizAnswers);

    // ── Perfil já ativo? Idempotente — só registra o comprovante e sai. ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('profiles') as any)
      .select('id, subscription_status').eq('email', email).maybeSingle();

    const nowIso = new Date().toISOString();
    const manualFields = {
      pix_manual_comprovante_path: path,
      pix_manual_sent_at: nowIso,
      pix_manual_reviewed: false,
    };

    if (existing?.subscription_status === 'active') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('profiles') as any).update(manualFields).eq('email', email);
      return NextResponse.json({ ok: true, already_active: true, redirect_url: '/obrigado' });
    }

    // ── Ativa (mesmos campos do webhook de pagamento) ──
    const activation = {
      subscription_type: 'annual_pix',
      subscription_status: 'active',
      subscription_activated_at: nowIso,
      subscription_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      plan_status: 'pending_photo',
      plan_requested_at: nowIso,
      ...manualFields,
    };

    if (!existing) {
      const userId = await resolveAuthUserId(supabase, email);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('profiles') as any).upsert({
        id: userId, email, full_name: name || null, quiz_answers: quizAnswers, ...extracted,
        quiz_session_id: sessionId || null, checkout_session_id: sessionId || null,
        pagarme_pix_order_id: orderId || null,
        ...activation,
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('profiles') as any)
        .update({ full_name: name || undefined, ...activation })
        .eq('email', email);
    }

    // ── Faturamento + trilha de auditoria ──
    // ⚠️ Sem `await` de verdade o insert NÃO roda: o builder do Supabase é lazy
    // (só executa no then/await). E o erro precisa ser inspecionado — senão a
    // venda some dos relatórios sem ninguém perceber.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: evErr } = await (supabase.from('checkout_events') as any).insert({
      session_id: sessionId || `pix-manual-${Date.now()}`,
      event_type: 'payment_confirmed',
      email,
      payment_type: 'pix',
      amount_cents: PLAN_BASE_CENTS,
      order_id: orderId || `pix-manual-${Date.now()}`,
      metadata: { gateway: 'pix_manual', comprovante_path: path, needs_review: true },
    });
    if (evErr) console.error('[pix comprovante] checkout_events', evErr);

    // ── Aviso pra conferência humana (não bloqueia a resposta) ──
    sendDiscord([{
      title: '🧾 PIX manual — comprovante recebido (CONFERIR)',
      description: 'Acesso liberado automaticamente. Confira o comprovante e, se não bater, revogue o acesso.',
      color: 16769305, // amarelo
      fields: [
        { name: 'Cliente', value: `${name || '—'}\n${email}`, inline: true },
        { name: 'Valor esperado', value: `R$ ${(PLAN_BASE_CENTS / 100).toFixed(2).replace('.', ',')}`, inline: true },
        { name: 'Comprovante', value: `\`${path}\`\n(bucket privado pix-comprovantes)` },
      ],
      footer: { text: 'Plano da Ju • PIX manual' },
      timestamp: nowIso,
    }]).catch(() => {});

    return NextResponse.json({ ok: true, activated: true, redirect_url: '/obrigado' });
  } catch (err) {
    await logCheckoutError({
      route: 'checkout/pix/comprovante', email: logEmail, payment_type: 'pix',
      kind: 'exception', err,
    }).catch(() => {});
    return NextResponse.json({ error: 'Erro ao enviar o comprovante. Tente de novo.' }, { status: 500 });
  }
}
