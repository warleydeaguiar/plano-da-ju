import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { normalizeEmail } from '@/lib/normalize-email';
import { normalizarParaJpeg } from '@/lib/imagem-servidor';
import { sessionIdValido } from '@/lib/bio-pro';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'bio-pro-uploads';
const CAMPOS_TEXTO = ['nome', 'profissao', 'etapa_id', 'utm_source', 'utm_medium', 'utm_campaign', 'tracking_session_id'] as const;

const texto = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);

/** Estado do navegador → só strings curtas; nada de objeto aninhado nem resposta gigante. */
function limparRespostas(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>).slice(0, 60)) {
    if (!/^[a-z0-9_]{1,40}$/.test(k)) continue;
    const s = texto(val, 2000);
    if (s !== undefined) out[k] = s;
  }
  return out;
}

/**
 * Converte pra JPEG o que não for JPEG (PNG/WebP etc. que o navegador não
 * converteu), sobrescrevendo o mesmo caminho — a URL pública não muda.
 *
 * ⚠️ HEIC (iPhone) o sharp NÃO lê: o libvips que vem com ele não tem o codec
 * HEVC (testado em 05/10/2026). Nesse caso o arquivo fica como veio — a foto
 * não se perde (dá pra baixar no admin), só não tem prévia no Chrome. Na
 * prática o Safari do iPhone já converte pra JPEG antes de subir
 * (`prepararFoto`). Só falha de verdade se o arquivo não existir.
 */
async function garantirJpeg(sb: Awaited<ReturnType<typeof createServiceClient>>, path: string): Promise<boolean> {
  const { data: blob, error } = await sb.storage.from(BUCKET).download(path);
  if (error || !blob) return false;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const ehJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (ehJpeg) return true;
  const jpeg = await normalizarParaJpeg(bytes);
  if (jpeg) await sb.storage.from(BUCKET).upload(path, jpeg, { contentType: 'image/jpeg', upsert: true });
  return true;
}

/**
 * POST /api/link-bio-pro/session
 * Body: { session_id, seq, respostas?, campos?, imagem?: { slot, path } }
 *
 * Grava o estado do quiz numa chamada atômica (função `bio_pro_salvar`, ver
 * migration 040). `respostas` é o estado completo do navegador; `seq` evita que
 * uma requisição atrasada sobrescreva uma mais nova. Pedido pago não muda mais
 * — a resposta avisa (`pago: true`) pra o navegador começar uma sessão nova.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`bio-pro-session:${ip}`, { max: 90, windowMs: 60_000 }).allowed) {
    return NextResponse.json({ error: 'Muitas requisições' }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => null);
    const sessionId = body?.session_id;
    if (!sessionIdValido(sessionId)) {
      return NextResponse.json({ error: 'session_id inválido' }, { status: 400 });
    }

    const respostas = body?.respostas === undefined ? null : limparRespostas(body.respostas);
    const c = body?.campos && typeof body.campos === 'object' ? body.campos : {};
    const campos: Record<string, unknown> = {};
    for (const k of CAMPOS_TEXTO) {
      const v = texto(c[k], k === 'nome' ? 120 : 80);
      if (v) campos[k] = v;
    }
    if (typeof c.email === 'string' && c.email.trim()) campos.email = normalizeEmail(c.email).email.slice(0, 160);
    if (typeof c.telefone === 'string') {
      const tel = c.telefone.replace(/\D/g, '');
      if (tel.length >= 10 && tel.length <= 13) campos.telefone = tel;
    }
    if (Number.isInteger(c.etapa_indice) && c.etapa_indice >= 0 && c.etapa_indice < 100) campos.etapa_indice = c.etapa_indice;

    const sb = await createServiceClient();

    // Foto: o navegador manda o CAMINHO que subiu, nunca a URL. Só aceita
    // arquivo dentro da pasta da própria sessão — antes aceitava qualquer URL,
    // e o admin exibiria um link/imagem de fora (rastreio, phishing).
    let imagem: Record<string, string> | null = null;
    if (body?.imagem && typeof body.imagem === 'object') {
      const path = texto(body.imagem.path, 200) ?? '';
      const slot = (texto(body.imagem.slot, 30) ?? 'foto').replace(/[^a-z0-9_-]/gi, '') || 'foto';
      if (!path.startsWith(`${sessionId}/`) || !/^[a-z0-9]+\/\d+-[a-z0-9_-]+\.jpg$/i.test(path)) {
        return NextResponse.json({ error: 'Imagem inválida' }, { status: 400 });
      }
      if (!(await garantirJpeg(sb, path))) {
        return NextResponse.json({ error: 'Não consegui ler essa imagem. Tente outra foto.' }, { status: 422 });
      }
      imagem = { slot, url: sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
    }

    const seq = Number.isSafeInteger(body?.seq) ? body.seq : Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb as any).rpc('bio_pro_salvar', {
      p_session_id: sessionId,
      p_seq: seq,
      p_respostas: respostas,
      p_campos: campos,
      p_imagem: imagem,
    });
    if (error) throw error;
    const linha = Array.isArray(data) ? data[0] : data;

    return NextResponse.json({ ok: true, id: linha?.id ?? null, pago: linha?.status_pagamento === 'pago', imagem });
  } catch (err) {
    console.error('[link-bio-pro/session]', err);
    return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 });
  }
}
