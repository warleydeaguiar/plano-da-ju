import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveAuthUserId } from '@/lib/supabase/auth-resolve';
import { extractFieldsFromQuiz } from '@/lib/quiz-to-profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/parceria/ativar
 * Body: { token, session_id, answers, name?, email?, phone? }
 *
 * Ativação por PARCERIA (cortesia). Quem entra pelo link mágico
 * (/quiz/plano-capilar?parceria=<token>) NÃO paga — vira cliente ATIVA direto,
 * em troca de UGC (ex.: alunas da Bianca). Cria/atualiza o profile como active,
 * e manda pro /obrigado (criar senha → enviar foto → plano).
 *
 * O token vem do link e é validado na tabela partner_tokens (token, label, active).
 * Cada token = um parceiro. Pra adicionar/desativar parceiros, é só mexer na tabela.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? '').trim();
    const answers = (body?.answers && typeof body.answers === 'object') ? body.answers : {};
    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pt } = await (supabase.from('partner_tokens') as any)
      .select('label').eq('token', token).eq('active', true).maybeSingle();
    if (!pt) return NextResponse.json({ ok: false, error: 'token inválido' }, { status: 401 });
    const partner: string = pt.label || 'parceria';

    // Identidade: prioriza o que veio no corpo; senão busca o lead pelo session_id.
    let name = String(body?.name ?? '').trim();
    let email = String(body?.email ?? '').trim().toLowerCase();
    let phone = String(body?.phone ?? '').replace(/\D/g, '');
    if ((!email || !phone) && body?.session_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: lead } = await (supabase.from('wg_quiz_leads') as any)
        .select('name, email, phone')
        .eq('session_id', body.session_id)
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle();
      if (lead) {
        if (!name) name = String(lead.name ?? '').trim();
        if (!email) email = String(lead.email ?? '').trim().toLowerCase();
        if (!phone) phone = String(lead.phone ?? '').replace(/\D/g, '');
      }
    }
    if (!email || !email.includes('@')) {
      return NextResponse.json({ ok: false, error: 'email não encontrado' }, { status: 400 });
    }

    const extracted = extractFieldsFromQuiz(answers);
    const now = new Date().toISOString();

    // Já existe? (não rebaixa quem já é ativa)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('profiles') as any)
      .select('id, subscription_status').eq('email', email).maybeSingle();

    const userId = existing?.id ?? await resolveAuthUserId(supabase, email);

    const patch = {
      id: userId,
      email,
      quiz_answers: answers,
      ...extracted,
      full_name: name || null,
      phone: phone || null,
      subscription_status: 'active',
      subscription_type: 'parceria',
      partner_label: partner,            // qual parceiro (ex.: bianca)
      plan_status: 'pending_photo',      // dispara o envio de foto no onboarding
      plan_requested_at: now,
      subscription_activated_at: now,
    };

    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('profiles') as any).update(patch).eq('id', userId);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('profiles') as any).upsert(patch);
    }

    return NextResponse.json({ ok: true, redirect: `/obrigado?email=${encodeURIComponent(email)}` });
  } catch (err) {
    console.error('[parceria/ativar]', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'erro' }, { status: 500 });
  }
}
