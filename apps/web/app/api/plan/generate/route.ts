import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const PLAN_PROMPT = `Você é a Juliane Cost, especialista em cuidados capilares com mais de 10 anos de experiência.
Analise a foto do cabelo da cliente e as respostas do quiz para criar um plano capilar personalizado de 52 semanas.

REGRAS IMPORTANTES:
- NUNCA use nomenclatura técnica como 2B, 3A, 4C. Use apenas: Crespo, Cacheado, Ondulado, Liso
- Seja calorosa e motivadora no tom
- Foque em produtos acessíveis (Iberaparis, Salon Line, Keratex e alternativos)
- Cada semana deve ter 1 foco principal, 2-3 tarefas e 1-2 produtos sugeridos

Retorne SOMENTE um JSON válido neste formato:
{
  "diagnostico": "Análise em 2-3 frases do cabelo visto na foto + perfil do quiz",
  "tipo_cabelo": "Crespo|Cacheado|Ondulado|Liso",
  "semanas": [
    {
      "semana": 1,
      "foco": "Hidratação intensa — recuperar a umidade perdida",
      "tarefas": ["Lavar com shampoo lowpoo", "Aplicar máscara de hidratação por 20min", "Finalizar com leave-in"],
      "produtos": ["Máscara Novex Óleo de Coco", "Leave-in Salon Line"],
      "dica": "Dica motivadora para a semana"
    }
  ],
  "produtos_essenciais": ["Lista de 5-8 produtos essenciais para o tipo de cabelo"],
  "mensagem_juliane": "Mensagem pessoal motivadora da Juliane para esta cliente"
}

Gere todas as 52 semanas seguindo o cronograma capilar correto (hidratação, nutrição, reconstrução em rotação adequada para o tipo de cabelo).`;

export async function POST(req: NextRequest) {
  try {
    const { email, photo_base64, photo_mime_type } = await req.json();

    if (!email || !photo_base64) {
      return NextResponse.json({ error: 'Email e foto são obrigatórios' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Get quiz answers from profile
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase.from('profiles') as any)
      .select('quiz_answers, hair_type, full_name')
      .eq('email', email)
      .single();

    const quizContext = profile?.quiz_answers
      ? `\n\nRESPOSTAS DO QUIZ:\n${JSON.stringify(profile.quiz_answers, null, 2)}`
      : '';

    // Upload photo to Supabase Storage
    const photoBuffer = Buffer.from(photo_base64, 'base64');
    const photoPath = `${email.replace('@', '_').replace('.', '_')}/${Date.now()}.jpg`;

    await supabase.storage
      .from('hair-photos')
      .upload(photoPath, photoBuffer, { contentType: photo_mime_type || 'image/jpeg', upsert: true });

    // Get signed URL for the uploaded photo
    const { data: signedData } = await supabase.storage
      .from('hair-photos')
      .createSignedUrl(photoPath, 60 * 60 * 24 * 365); // 1 year

    const photoUrl = signedData?.signedUrl || '';

    // Call Claude Vision via OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://planodaju.julianecost.com',
        'X-Title': 'Plano da Ju',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-6',
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:${photo_mime_type || 'image/jpeg'};base64,${photo_base64}` },
              },
              {
                type: 'text',
                text: PLAN_PROMPT + quizContext,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter error: ${err}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || '';

    // Parse JSON from Claude's response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Plan JSON not found in AI response');

    const plan = JSON.parse(jsonMatch[0]);

    // Store weeks in hair_plans table
    const weekRows = (plan.semanas || []).map((s: { semana: number; foco: string; tarefas: string[]; produtos: string[]; dica: string }) => ({
      user_id: null as string | null, // will be set via profile lookup
      week_number: s.semana,
      focus: s.foco,
      tasks: s.tarefas,
      products: s.produtos,
      tips: [s.dica],
    }));

    // Get user_id from profile
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profileWithId } = await (supabase.from('profiles') as any)
      .select('id')
      .eq('email', email)
      .single();

    if (profileWithId) {
      const userId = profileWithId.id;
      const rowsWithUserId = weekRows.map((r: typeof weekRows[0]) => ({ ...r, user_id: userId }));

      // Upsert all 52 weeks
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('hair_plans') as any).upsert(rowsWithUserId, { onConflict: 'user_id,week_number' });

      // Update profile: plan processing + photo url
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('profiles') as any)
        .update({
          photo_url: photoUrl,
          photo_taken_at: new Date().toISOString(),
          plan_status: 'processing',
          plan_requested_at: new Date().toISOString(),
        })
        .eq('email', email);
    }

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
