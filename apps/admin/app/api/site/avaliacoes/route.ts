import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ORIGENS = ['whatsapp', 'instagram', 'site_antigo', 'email', 'outro'];

/** POST: lança uma avaliação nova. */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const autora = String(b?.autora || '').trim();
  const texto = String(b?.texto || '').trim();
  const nota = Number(b?.nota);
  const contentId = Number(b?.content_id);

  if (!contentId) return NextResponse.json({ error: 'Escolha o produto.' }, { status: 400 });
  if (!autora) return NextResponse.json({ error: 'Informe quem escreveu.' }, { status: 400 });
  if (texto.length < 20) {
    return NextResponse.json({ error: 'O texto está curto demais — escreva pelo menos uma frase completa.' }, { status: 400 });
  }
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
    return NextResponse.json({ error: 'A nota vai de 1 a 5.' }, { status: 400 });
  }

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('site_avaliacoes').insert({
    content_id: contentId,
    autora: autora.slice(0, 80),
    nota,
    texto: texto.slice(0, 1500),
    data: b?.data || new Date().toISOString().slice(0, 10),
    origem: ORIGENS.includes(b?.origem) ? b.origem : 'whatsapp',
  });

  if (error) {
    const duplicada = error.code === '23505';
    return NextResponse.json(
      { error: duplicada ? 'Essa avaliação já foi lançada para este produto.' : error.message },
      { status: duplicada ? 409 : 500 },
    );
  }
  return NextResponse.json({ ok: true });
}

/**
 * PATCH: tira do ar ou devolve ao ar.
 *
 * "Despublicar" some com a avaliação da página E do cálculo da nota, porque o
 * Google exige que a nota marcada corresponda ao que está visível.
 */
export async function PATCH(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b?.id) return NextResponse.json({ error: 'Faltou o id.' }, { status: 400 });

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('site_avaliacoes')
    .update({ publicada: !!b.publicada })
    .eq('id', b.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Faltou o id.' }, { status: 400 });

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('site_avaliacoes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
