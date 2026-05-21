import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generatePlanWithClaude, savePlanToDb } from '@/lib/plan-generator';

// 300s = max do Vercel Pro plan. Era 120 antes mas estouramos com 52 semanas.
// Plan-generator agora gera 16 semanas (4 meses) — cabe folgado em 300s.
export const maxDuration = 300;

/**
 * POST /api/plan/generate
 * Body: { email, photo_base64, photo_mime_type }
 *
 * Gera plano usando Claude Vision com o CATÁLOGO REAL Ybera injetado no prompt.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, photo_base64, photo_mime_type } = await req.json();

    if (!email || !photo_base64) {
      return NextResponse.json({ error: 'Email e foto são obrigatórios' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase.from('profiles') as any)
      .select('id, quiz_answers, hair_type, full_name')
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
      photo: { photoBase64: photo_base64, photoMimeType: photo_mime_type },
    });

    // Persiste plano + atualiza profile
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await savePlanToDb(supabase as any, profile.id, plan);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('profiles') as any)
      .update({
        photo_url: photoUrl,
        photo_taken_at: new Date().toISOString(),
        plan_status: 'processing',
        plan_requested_at: new Date().toISOString(),
        hair_type: plan.tipo_cabelo?.toLowerCase() ?? profile.hair_type,
      })
      .eq('id', profile.id);

    return NextResponse.json({
      success: true,
      diagnostico: plan.diagnostico,
      tipo_cabelo: plan.tipo_cabelo,
      mensagem_juliane: plan.mensagem_juliane,
      photo_url: photoUrl,
    });
  } catch (err) {
    console.error('[plan/generate]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao gerar plano' },
      { status: 500 },
    );
  }
}
