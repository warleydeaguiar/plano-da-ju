import { NextRequest, NextResponse } from 'next/server';
import { logServerError } from '@/lib/server-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/meu-plano/falha-foto
 * Body: { motivo, tipo?, tamanho?, etapa? }
 *
 * Avisa o servidor quando o envio da foto falha NO NAVEGADOR. Sem isto ficamos
 * cegos: clientes reclamavam que não conseguiam mandar a foto e não havia um
 * único registro do lado de cá, porque a falha nunca chegava ao servidor.
 *
 * Não recebe a imagem nem exige login: é só um sinal técnico, e pedir sessão
 * aqui esconderia justamente o caso de quem tropeça antes de entrar.
 */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({} as Record<string, unknown>));
    const motivo = String(b?.motivo ?? 'sem motivo').slice(0, 200);
    await logServerError({
      route: 'meu-plano/foto-navegador',
      err: new Error(motivo),
      severity: 'warning',
      context: {
        impact: 'cliente não conseguiu enviar a foto do cabelo',
        etapa: String(b?.etapa ?? '').slice(0, 40),
        tipo_arquivo: String(b?.tipo ?? '').slice(0, 60),
        tamanho_bytes: Number(b?.tamanho) || null,
        navegador: (req.headers.get('user-agent') ?? '').slice(0, 180),
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
