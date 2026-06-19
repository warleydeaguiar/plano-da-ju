import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generatePlanWithClaude, savePlanToDb } from '@/lib/plan-generator';
import { logServerError } from '@/lib/server-log';

// 300s = max do Vercel Pro plan. Plano de 90 dias = 12 semanas.
// Gera 12 semanas (90 dias) — cabe folgado em 300s.
export const maxDuration = 300;

/**
 * POST /api/plan/generate
 * Body: { email, photo_base64, photo_mime_type }
 *
 * Gera plano usando Claude Vision com o CATÁLOGO REAL Ybera injetado no prompt.
 */
/**
 * GET /api/plan/generate?email=<>&k=<WA_AUTOREPLY_SECRET>&dry=1
 * TESTE: gera o plano com o prompt atual usando a FOTO já salva da cliente,
 * retorna o JSON e NÃO salva nada (não toca no plano real). Só pra validação.
 */
export async function GET(req: NextRequest) {
  const k = req.nextUrl.searchParams.get('k');
  if (!process.env.WA_AUTOREPLY_SECRET || k !== process.env.WA_AUTOREPLY_SECRET) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }
  const email = (req.nextUrl.searchParams.get('email') ?? '').trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'email obrigatório' }, { status: 400 });

  const supabase = await createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase.from('profiles') as any)
    .select('id, quiz_answers, hair_type, full_name, photo_url, photo_back_url, photo_root_url')
    .eq('email', email).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'profile não encontrado' }, { status: 404 });

  const fotosEnviadas = [profile.photo_url, profile.photo_back_url, profile.photo_root_url].filter(Boolean);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let usage: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plan = await generatePlanWithClaude(supabase as any, {
    email,
    hairType: profile.hair_type ?? null,
    quizAnswers: profile.quiz_answers ?? null,
    photo: {
      photoUrl: profile.photo_url ?? undefined,
      extraPhotoUrls: [profile.photo_back_url, profile.photo_root_url].filter(Boolean),
    },
  }, { onUsage: (u) => { usage = u; } });

  // save=1 → REGENERA de verdade (sobrescreve o plano) PRESERVANDO a entrega
  // (não mexe em plan_released_at / plan_status — a cliente já recebeu).
  const save = req.nextUrl.searchParams.get('save') === '1';
  if (save) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await savePlanToDb(supabase as any, profile.id, plan);
    const af = plan.analise_foto ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('profiles') as any).update({
      hair_type: plan.tipo_cabelo?.toLowerCase() ?? profile.hair_type,
      recommended_products: Array.isArray(plan.produtos_indicados) ? plan.produtos_indicados : null,
    }).eq('id', profile.id);
    // atualiza os scores da foto na análise mais recente (se existir)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lastPa } = await (supabase.from('photo_analyses') as any)
      .select('id').eq('user_id', profile.id).order('analyzed_at', { ascending: false }).limit(1).maybeSingle();
    if (lastPa?.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('photo_analyses') as any).update({
        frizz_score: af.frizz_score ?? null, brilho_score: af.brilho_score ?? null,
        hidratacao_score: af.hidratacao_score ?? null, pontas_score: af.pontas_score ?? null,
      }).eq('id', lastPa.id);
    }
  }

  // resumo compacto pra inspeção
  return NextResponse.json({
    saved: save,
    dry: true,
    fotos_enviadas_para_ia: fotosEnviadas.length,
    usage,
    nome: profile.full_name,
    incomoda: profile.quiz_answers?.incomoda ?? null,
    incomodo_principal: plan.incomodo_principal,
    produto_ancora: plan.produto_ancora,
    analise_foto: plan.analise_foto,
    diagnostico: plan.diagnostico,
    produtos_indicados: plan.produtos_indicados,
    semana_1: plan.semanas?.[0],
    produtos_por_semana: plan.semanas?.map(s => ({ s: s.semana, produtos: s.produtos })),
    plano_completo: plan,
  });
}

export async function POST(req: NextRequest) {
  let emailForLog: string | null = null;
  try {
    const { email, photo_base64, photo_mime_type } = await req.json();
    emailForLog = email ?? null;

    if (!email || !photo_base64) {
      return NextResponse.json({ error: 'Email e foto são obrigatórios' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase.from('profiles') as any)
      .select('id, quiz_answers, hair_type, full_name, photo_back_url, photo_root_url')
      .eq('email', email)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });
    }

    // Upload da foto pra storage (mantém histórico)
    const photoBuffer = Buffer.from(photo_base64, 'base64');
    const photoPath = `${email.replace('@', '_').replace('.', '_')}/${Date.now()}.jpg`;
    await supabase.storage.from('hair-photos').upload(photoPath, photoBuffer, {
      contentType: photo_mime_type || 'image/jpeg',
      upsert: true,
    });
    const { data: signedData } = await supabase.storage
      .from('hair-photos')
      .createSignedUrl(photoPath, 60 * 60 * 24 * 365);
    const photoUrl = signedData?.signedUrl || '';

    // Gera o plano (com catálogo real injetado)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plan = await generatePlanWithClaude(supabase as any, {
      email,
      hairType: profile.hair_type ?? null,
      quizAnswers: profile.quiz_answers ?? null,
      photo: {
        photoBase64: photo_base64,
        photoMimeType: photo_mime_type,
        extraPhotoUrls: [profile.photo_back_url, profile.photo_root_url].filter(Boolean),
      },
    });

    // Persiste plano + atualiza profile
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await savePlanToDb(supabase as any, profile.id, plan);

    // ENTREGA AUTOMÁTICA: sem aprovação manual da Juliane. O plano é gerado e
    // já fica 'ready'; a VISIBILIDADE é liberada 30 min depois (plan_released_at),
    // mantendo a percepção de preparo — mas MUITO antes do prazo prometido (24h).
    const now = Date.now();
    const releasedAt = new Date(now + 30 * 60 * 1000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('profiles') as any)
      .update({
        photo_url: photoUrl,
        photo_taken_at: new Date(now).toISOString(),
        plan_status: 'ready',
        plan_requested_at: new Date(now).toISOString(),
        plan_released_at: releasedAt,
        plan_delivered_email_sent_at: null, // o cron envia o e-mail quando liberar
        hair_type: plan.tipo_cabelo?.toLowerCase() ?? profile.hair_type,
        // Indicações personalizadas (produto + motivo) pra aba Promoções
        recommended_products: Array.isArray(plan.produtos_indicados) ? plan.produtos_indicados : null,
      })
      .eq('id', profile.id);

    // Registra a foto INICIAL como 1º ponto da timeline de progresso. A foto do
    // onboarding fica em profiles.photo_url, mas a tela de Progresso lê
    // photo_analyses — sem isto, a foto "antes" não aparecia lá. Guardado por
    // contagem pra não duplicar se o trigger rodar 2x.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: existingPhotos } = await (supabase.from('photo_analyses') as any)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id);
    if (!existingPhotos) {
      const af = plan.analise_foto ?? {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('photo_analyses') as any).insert({
        user_id: profile.id,
        photo_url: photoUrl,
        avaliacao_texto: plan.diagnostico ?? 'Foto inicial do cabelo',
        frizz_score: af.frizz_score ?? null,
        brilho_score: af.brilho_score ?? null,
        hidratacao_score: af.hidratacao_score ?? null,
        pontas_score: af.pontas_score ?? null,
        analyzed_at: new Date().toISOString(),
        raw_response: { source: 'onboarding', analise_foto: af, incomodo_principal: plan.incomodo_principal, produto_ancora: plan.produto_ancora },
      });
    }

    return NextResponse.json({
      success: true,
      diagnostico: plan.diagnostico,
      tipo_cabelo: plan.tipo_cabelo,
      mensagem_juliane: plan.mensagem_juliane,
      photo_url: photoUrl,
    });
  } catch (err) {
    // Log RICO + persistente: era a maior cegueira (planos travavam em
    // 'processing' sem ninguém ver). Também tira o perfil do limbo: marca
    // plan_status='photo_error' pra aparecer como problema, não como "gerando".
    await logServerError({
      route: 'plan/generate',
      err,
      email: emailForLog,
      severity: 'critical',
      context: { impact: 'cliente pagante pode ficar sem plano (travado em processing)' },
    });
    if (emailForLog) {
      try {
        const sb = await createServiceClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (sb.from('profiles') as any).update({ plan_status: 'photo_error' }).eq('email', emailForLog).eq('plan_status', 'processing');
      } catch { /* best-effort */ }
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao gerar plano' },
      { status: 500 },
    );
  }
}
