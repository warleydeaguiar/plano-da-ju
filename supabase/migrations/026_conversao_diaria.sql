-- Série diária para o relatório de Conversão (cliques do Meta × vendas).
--
-- Antes a página somava TODAS as vendas (orgânico, WhatsApp, grupos, e-mail) e
-- dividia pelos cliques só das campanhas de PLANO — a taxa saía inflada. Aqui a
-- venda é classificada pela campanha que trouxe o lead (wg_quiz_leads.utm_campaign
-- guarda o ID da campanha do Meta), então dá para comparar clique e venda do
-- MESMO conjunto de campanhas.
--
-- Uma venda = um cliente por dia, pelo MENOR valor do grupo — mesma regra do
-- dashboard (getRealSales): o webhook grava order.paid e charge.paid, e o menor
-- valor é o preço sem os juros da parcela (que ficam com a adquirente).
-- Cortesia da parceria não aparece aqui: não tem pagamento.
create or replace function public.conversao_vendas_diarias(
  p_desde date,
  p_campanhas_plano text[] default '{}'
)
returns table (
  dia                   date,
  vendas                integer,
  receita_cents         bigint,
  vendas_plano          integer,
  receita_plano_cents   bigint,
  vendas_outra_campanha integer,
  vendas_sem_origem     integer
)
language sql
stable
as $$
  with ev as (
    select lower(email) em,
           (created_at at time zone 'America/Sao_Paulo')::date d,
           amount_cents,
           created_at
    from public.checkout_events
    where event_type = 'payment_confirmed'
      and created_at >= p_desde
  ),
  venda as (
    select em, d, min(amount_cents) cents, min(created_at) ts
    from ev
    group by em, d
  ),
  com_origem as (
    select v.em, v.d, v.cents, l.utm_campaign
    from venda v
    left join lateral (
      select utm_campaign
      from public.wg_quiz_leads
      where lower(email) = v.em
        and created_at <= v.ts + interval '1 day'
      order by created_at desc
      limit 1
    ) l on true
  )
  select d,
         count(*)::int,
         coalesce(sum(cents), 0)::bigint,
         count(*) filter (where utm_campaign = any(p_campanhas_plano))::int,
         coalesce(sum(cents) filter (where utm_campaign = any(p_campanhas_plano)), 0)::bigint,
         count(*) filter (where coalesce(utm_campaign, '') <> ''
                            and not (utm_campaign = any(p_campanhas_plano)))::int,
         count(*) filter (where coalesce(utm_campaign, '') = '')::int
  from com_origem
  group by d
  order by d
$$;
