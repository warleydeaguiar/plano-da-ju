import { after } from 'next/server';
import type { createServiceClient } from '@/lib/supabase/server';
import { sendCapiEvent } from '@/lib/meta/capi';
import { getTrackingIdentity } from '@/lib/tracking-server';
import { sendDiscordFor } from '@/lib/discord';
import { sendEmail } from '@/lib/ses-mailer';
import { PROFISSOES } from '@/lib/quiz-link-bio-profissoes';

/**
 * Link na Bio PRO — regras de servidor compartilhadas pelas rotas de checkout,
 * pelo polling do PIX e pelo webhook da Pagar.me. Produto separado do Plano
 * Capilar: nada aqui toca `profiles`.
 */

export const BIO_PRO_PRECO_CENTS = 1990;
export const BIO_PRO_SOURCE = 'bio-pro-web';
export const BIO_PRO_ITEM_CODE = 'bio-pro-taxa-unica';
/** Mesmo número de atendimento do site (apps/site/lib/whatsapp.ts). */
export const WHATSAPP_JULIANE = '5531999994001';
const ADMIN_URL = process.env.ADMIN_URL ?? 'https://admin.julianecost.com';

type Supa = Awaited<ReturnType<typeof createServiceClient>>;

export interface PedidoBioPro {
  id: string;
  session_id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  profissao: string | null;
  respostas: Record<string, unknown> | null;
  metodo_pagamento: string | null;
  pagarme_order_id: string | null;
  valor_centavos: number;
  tracking_session_id: string | null;
}

/** session_id gerado no navegador: base36. Qualquer outra coisa é recusada. */
export const sessionIdValido = (s: unknown): s is string =>
  typeof s === 'string' && /^[a-z0-9]{8,40}$/i.test(s);

const idPagarme = (s: unknown): s is string => typeof s === 'string' && /^[a-z]{2}_[A-Za-z0-9]+$/.test(s);

/**
 * Evento da Pagar.me é do Link na Bio PRO?
 *
 * No `charge.paid` (o único evento de pagamento que chega no nosso endpoint) o
 * `data` é a COBRANÇA, não a order — mas a Pagar.me copia o `metadata` da
 * order pra ela. O código do item fica de segunda camada pro `order.paid`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ehEventoBioPro(data: any): boolean {
  if (data?.metadata?.source === BIO_PRO_SOURCE) return true;
  if (data?.order?.metadata?.source === BIO_PRO_SOURCE) return true;
  const codigo: unknown = data?.items?.[0]?.code ?? data?.order?.items?.[0]?.code;
  return typeof codigo === 'string' && codigo.startsWith('bio-pro');
}

/**
 * Marca o pedido como pago — atômico e idempotente.
 *
 * O mesmo pagamento chega por até três caminhos (webhook, polling do PIX na
 * tela, resposta do cartão), às vezes no mesmo segundo. A guarda
 * `status_pagamento <> 'pago'` faz só UM deles transicionar a linha; só esse
 * "vencedor" dispara Discord, CAPI e e-mail — sem duplicata.
 *
 * Localiza o pedido pelo que vier: session_id (vem no metadata de toda
 * cobrança), id da order ou id da cobrança. No `charge.paid` o `data.id` é
 * `ch_…`, então procurar só por order id deixava o PIX pago como pendente.
 */
export async function marcarPedidoPago(
  sb: Supa,
  chaves: { sessionId?: unknown; orderId?: unknown; chargeId?: unknown },
  ctx: { ip?: string; userAgent?: string; origem: string },
): Promise<{ venceu: boolean; pedido: PedidoBioPro | null }> {
  const filtros: string[] = [];
  if (sessionIdValido(chaves.sessionId)) filtros.push(`session_id.eq.${chaves.sessionId}`);
  if (idPagarme(chaves.orderId)) filtros.push(`pagarme_order_id.eq.${chaves.orderId}`);
  if (idPagarme(chaves.chargeId)) filtros.push(`pagarme_charge_id.eq.${chaves.chargeId}`);
  if (filtros.length === 0) return { venceu: false, pedido: null };

  const agora = new Date().toISOString();
  const patch: Record<string, unknown> = { status_pagamento: 'pago', pago_em: agora, atualizado_em: agora };
  if (idPagarme(chaves.chargeId)) patch.pagarme_charge_id = chaves.chargeId;
  if (idPagarme(chaves.orderId)) patch.pagarme_order_id = chaves.orderId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from('bio_pro_orders') as any)
    .update(patch)
    .or(filtros.join(','))
    .neq('status_pagamento', 'pago')
    .select('id, session_id, nome, email, telefone, profissao, respostas, metodo_pagamento, pagarme_order_id, valor_centavos, tracking_session_id');
  if (error) throw error;

  const pedido = (Array.isArray(data) && data[0]) ? (data[0] as PedidoBioPro) : null;
  if (!pedido) return { venceu: false, pedido: null };

  after(() => dispararVenda(sb, pedido, ctx).catch((e) => console.error('[bio-pro venda]', e)));
  return { venceu: true, pedido };
}

async function dispararVenda(sb: Supa, p: PedidoBioPro, ctx: { ip?: string; userAgent?: string; origem: string }) {
  const valor = (p.valor_centavos ?? BIO_PRO_PRECO_CENTS) / 100;
  const profissao = p.profissao ? (PROFISSOES[p.profissao]?.label ?? p.profissao) : '—';
  const estilo = typeof p.respostas?.estilo === 'string' ? String(p.respostas.estilo) : '—';
  const metodo = p.metodo_pagamento === 'credit_card' ? 'Cartão' : p.metodo_pagamento === 'pix' ? 'PIX' : '—';

  await sendDiscordFor('venda_bio_pro', process.env.DISCORD_SALES_WEBHOOK ?? '', [{
    title: '🔗 Nova venda — Link na Bio PRO',
    color: 0xee5d8a,
    fields: [
      { name: 'Cliente', value: p.nome || '—', inline: true },
      { name: 'Profissão', value: profissao, inline: true },
      { name: 'Estilo', value: estilo, inline: true },
      { name: 'Pagamento', value: `${metodo} · R$ ${valor.toFixed(2).replace('.', ',')}`, inline: true },
      { name: 'Pedido', value: `${ADMIN_URL}/link-bio-pro/${p.id}` },
    ],
    footer: { text: `Plano da Ju • ${ctx.origem}` },
    timestamp: new Date().toISOString(),
  }]);

  const nomes = (p.nome ?? '').trim().split(/\s+/).filter(Boolean);
  const tel = (p.telefone ?? '').replace(/\D/g, '');
  const trk = await getTrackingIdentity(sb, { sessionId: p.tracking_session_id, email: p.email });
  await sendCapiEvent({
    eventName: 'Purchase',
    // Mesmo id que o navegador usa no fbq da página de obrigado → a Meta deduplica.
    eventId: p.pagarme_order_id ?? `bio_${p.id}`,
    eventSourceUrl: 'https://planodaju.julianecost.com/link-bio-pro',
    user: {
      email: p.email ?? undefined,
      phone: tel.length === 10 || tel.length === 11 ? `55${tel}` : undefined,
      firstName: nomes[0],
      lastName: nomes.slice(1).join(' ') || undefined,
      fbp: trk.fbp,
      fbc: trk.fbc,
      ip: ctx.ip ?? trk.ip,
      userAgent: ctx.userAgent ?? trk.userAgent,
      zip: trk.zip,
      cpf: trk.cpf,
    },
    customData: {
      value: valor,
      currency: 'BRL',
      content_name: 'Link na Bio PRO',
      content_category: 'link-na-bio',
      order_id: p.pagarme_order_id ?? p.id,
    },
  });

  if (p.email) {
    await sendEmail({
      to: p.email,
      toName: p.nome ?? undefined,
      subject: 'Recebi seu pedido do Link na Bio PRO 💛',
      html: emailPedidoConfirmado(primeiroNome(p.nome)),
    });
  }
}

export function primeiroNome(nome?: string | null): string {
  const n = (nome ?? '').trim().split(/\s+/)[0] ?? '';
  return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : 'Oi';
}

const linkWhats = (texto: string) => `https://wa.me/${WHATSAPP_JULIANE}?text=${encodeURIComponent(texto)}`;

function moldura(conteudo: string) {
  return `
  <div style="background:#FFF8F4;padding:32px 0;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif">
    <div style="max-width:460px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #F3DCE3">
      <div style="background-color:#B5398F;background-image:linear-gradient(135deg,#FF8FB1,#B5398F);padding:24px 30px">
        <div style="color:#fff;font-size:20px;font-weight:800">Link na Bio PRO</div>
        <div style="color:#fff;opacity:.85;font-size:13px;margin-top:2px">por Juliane Cost</div>
      </div>
      <div style="padding:26px 30px;color:#2A1F2D;font-size:14px;line-height:1.6">${conteudo}</div>
    </div>
  </div>`;
}

function emailPedidoConfirmado(first: string) {
  return moldura(`
    <p style="font-size:16px;margin:0 0 12px">Oi, ${first}! 💛</p>
    <p style="margin:0 0 14px;color:#6B5A63">Seu pagamento de <strong>R$ 19,90</strong> foi confirmado.
    Agora é comigo: vou montar o seu link na bio com tudo o que você me contou.</p>
    <p style="margin:0 0 18px;color:#6B5A63">Lembrou de alguma foto, logo ou link que ficou de fora? Me manda no WhatsApp:</p>
    <a href="${linkWhats('Oi Ju! Fiz meu pedido do Link na Bio PRO e queria te mandar mais algumas coisas.')}"
       style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">Falar no WhatsApp</a>`);
}

export function emailPix(first: string, codigo: string, qrUrl?: string) {
  return moldura(`
    <p style="font-size:16px;margin:0 0 12px">Oi, ${first}! 💛</p>
    <p style="margin:0 0 16px;color:#6B5A63">Seu PIX do <strong>Link na Bio PRO</strong> (R$ 19,90) foi gerado.
    É só pagar com o código abaixo que eu já começo a montar a sua bio. <strong>O PIX expira em 1 hora.</strong></p>
    ${qrUrl ? `<div style="text-align:center;margin:0 0 16px"><img src="${qrUrl}" alt="QR Code PIX" width="170" height="170" style="border-radius:12px"/></div>` : ''}
    <div style="font-size:11px;font-weight:700;color:#B5398F;text-transform:uppercase;letter-spacing:.5px;margin:0 0 6px">PIX copia e cola</div>
    <div style="font-family:monospace;font-size:12.5px;line-height:1.5;background:#FFF2F6;border:1px dashed #F0C0CE;border-radius:10px;padding:12px;word-break:break-all">${codigo}</div>
    <p style="font-size:12.5px;margin:16px 0 0;color:#6B5A63">No app do seu banco: <strong>PIX › Copia e Cola</strong>, cole o código e confirme.</p>`);
}
