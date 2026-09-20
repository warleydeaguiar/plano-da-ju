-- Faixas de gasto novas (19/09/26): os cortes viraram 50 / 100 / 300 / +300 e
-- os precos 29,90 / 34,90 / 39,90 / 44,90. Na tabela antiga 93% das respostas
-- caiam nas duas primeiras faixas, entao quase todo mundo pagava o mesmo preco
-- e nao havia degrau abaixo de 34,90. Esta migration so troca o mapa de preco e
-- a ordem do relatorio; as faixas antigas continuam listadas (ha resposta
-- gravada com elas) e apontam para o teto novo.
-- Relatório do preço dinâmico: qual faixa de gasto vende mais.
--
-- A faixa vem da resposta do quiz (wg_quiz_answers.gasto_mensal, por sessão), o
-- lead liga a sessão ao e-mail, e o e-mail liga às compras em checkout_events.
-- Tudo numa função só: a página do admin faria uma dezena de consultas para
-- montar isso à mão, e o banco roda numa VPS de 2 núcleos.
--
-- 'sem_resposta' = lead do período que não respondeu a pergunta (quiz antigo,
-- link direto ou saiu antes) — é o grupo de comparação do preço padrão.

create or replace function preco_faixas_relatorio(p_desde timestamptz default now() - interval '30 days')
returns table (
  faixa         text,
  preco_cents   integer,
  respostas     bigint,
  leads         bigint,
  iniciaram     bigint,
  compras       bigint,
  receita_cents bigint
)
language sql
stable
as $$
  with resp as (
    -- Uma resposta por sessão: se a pessoa voltou e trocou, vale a última.
    select distinct on (a.session_id) a.session_id, a.answer #>> '{}' as faixa
      from wg_quiz_answers a
     where a.question_id = 'gasto_mensal' and a.created_at >= p_desde
     order by a.session_id, a.created_at desc
  ),
  por_resposta as (
    select r.faixa, count(*)::bigint as respostas from resp r group by 1
  ),
  leads_faixa as (
    select coalesce(r.faixa, 'sem_resposta') as faixa, lower(l.email) as email
      from wg_quiz_leads l
      left join resp r on r.session_id = l.session_id
     where l.created_at >= p_desde and coalesce(l.email, '') <> ''
  ),
  agregado as (
    select lf.faixa,
           count(distinct lf.email)::bigint as leads,
           count(distinct lf.email) filter (where exists (
             select 1 from checkout_events e
              where lower(e.email) = lf.email and e.event_type = 'checkout_initiated'
                and e.created_at >= p_desde))::bigint as iniciaram,
           count(distinct lf.email) filter (where exists (
             select 1 from checkout_events e
              where lower(e.email) = lf.email and e.event_type = 'payment_confirmed'
                and e.created_at >= p_desde))::bigint as compras,
           -- max() por e-mail: webhook e polling podem gravar o mesmo pagamento.
           coalesce(sum((select max(e.amount_cents) from checkout_events e
                          where lower(e.email) = lf.email and e.event_type = 'payment_confirmed'
                            and e.created_at >= p_desde)), 0)::bigint as receita_cents
      from leads_faixa lf group by 1
  )
  select coalesce(a.faixa, p.faixa) as faixa,
         case coalesce(a.faixa, p.faixa)
           when 'ate_50' then 2990 when 'ate_100' then 3490
           when 'ate_300' then 3990 when 'acima_300' then 4490
           -- faixas antigas (cortes até 19/09/26), ainda gravadas em respostas
           when 'ate_600' then 4490 when 'ate_1000' then 4490
           else 3490 end as preco_cents,
         coalesce(p.respostas, 0) as respostas,
         coalesce(a.leads, 0) as leads,
         coalesce(a.iniciaram, 0) as iniciaram,
         coalesce(a.compras, 0) as compras,
         coalesce(a.receita_cents, 0) as receita_cents
    from agregado a
    full join por_resposta p on p.faixa = a.faixa
   order by case coalesce(a.faixa, p.faixa)
              when 'ate_50' then 1 when 'ate_100' then 2 when 'ate_300' then 3
              when 'acima_300' then 4 when 'ate_600' then 5 when 'ate_1000' then 6
              else 7 end;
$$;

notify pgrst, 'reload schema';
