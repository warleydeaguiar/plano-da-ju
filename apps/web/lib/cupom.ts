import { createServiceClient } from '@/lib/supabase/server';
import { PLAN_BASE_CENTS } from '@/lib/pricing';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CupomResolvido {
  codigo: string;
  precoCents: number;
  descontoCents: number;
  descricao: string | null;
}

/**
 * Preço final de um cupom.
 *
 * `preco_final` cobra exatamente o valor combinado — é o caso do "de R$34,90
 * por R$14,90": o número na mensagem tem que ser o número na fatura, sem
 * arredondamento de porcentagem no meio.
 */
function precoCom(tipo: string, valorCents: number, base: number): number {
  if (tipo === 'preco_final') return Math.max(0, valorCents);
  // percentual: valor_cents guarda o percentual (ex.: 30 = 30%)
  const desconto = Math.round((base * Math.min(100, Math.max(0, valorCents))) / 100);
  return Math.max(0, base - desconto);
}

/**
 * Confere o cupom SEM consumir. Serve para a tela mostrar o preço antes de a
 * pessoa pagar.
 */
export async function conferirCupom(
  codigo: string | null | undefined,
  baseCents: number = PLAN_BASE_CENTS,
): Promise<CupomResolvido | null> {
  const cod = String(codigo ?? '').trim();
  if (!cod) return null;

  const sb = await createServiceClient();
  const { data } = await (sb.from('cupons') as any)
    .select('codigo, tipo, valor_cents, descricao, ativo, expira_em, usos, usos_max')
    .ilike('codigo', cod)
    .maybeSingle();

  if (!data || !data.ativo) return null;
  if (data.expira_em && new Date(data.expira_em).getTime() <= Date.now()) return null;
  if (data.usos_max != null && data.usos >= data.usos_max) return null;

  const preco = precoCom(data.tipo, data.valor_cents, baseCents);
  return {
    codigo: data.codigo,
    precoCents: preco,
    descontoCents: Math.max(0, baseCents - preco),
    descricao: data.descricao ?? null,
  };
}

/**
 * Preço a cobrar, consumindo um uso do cupom.
 *
 * Chamado DENTRO da rota de checkout, nunca no navegador: o cliente manda o
 * código, o servidor decide o valor. Se o cupom não valer, cobra o preço
 * cheio em silêncio — negar a compra por causa de um cupom expirado seria
 * perder a venda por um detalhe.
 */
export async function precoParaCobrar(
  codigo: string | null | undefined,
  baseCents: number = PLAN_BASE_CENTS,
  email?: string | null,
): Promise<{ precoCents: number; cupom: string | null }> {
  const cod = String(codigo ?? '').trim();
  if (!cod) return { precoCents: baseCents, cupom: null };

  const sb = await createServiceClient();
  // Consome de forma atômica: duas compras simultâneas no último uso não
  // passam as duas.
  const { data } = await (sb.rpc as any)('cupom_consumir', { p_codigo: cod });
  const linha = ((data ?? []) as any[])[0];
  if (!linha) return { precoCents: baseCents, cupom: null };

  const preco = precoCom(linha.tipo, linha.valor_cents, baseCents);
  await (sb.from('cupons_usos') as any).insert({
    cupom_id: linha.id, email: email ?? null, valor_cents: preco,
  });
  return { precoCents: preco, cupom: cod.toUpperCase() };
}
