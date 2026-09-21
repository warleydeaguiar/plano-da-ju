-- Alunas que entraram por dia, separando quem PAGOU de quem recebeu CORTESIA
-- da parceria UGC. Misturar os dois já custou caro (o pixel contava cortesia
-- como venda); no painel elas precisam aparecer lado a lado, nunca somadas.
create or replace function public.alunas_por_dia(p_dias integer default 30)
returns table (dia date, pagantes integer, ugc integer)
language sql
stable
as $$
  select d::date as dia,
         count(p.id) filter (where p.subscription_type is distinct from 'parceria')::int as pagantes,
         count(p.id) filter (where p.subscription_type = 'parceria')::int as ugc
    from generate_series(
           (now() at time zone 'America/Sao_Paulo')::date - (p_dias - 1),
           (now() at time zone 'America/Sao_Paulo')::date,
           interval '1 day'
         ) d
    left join public.profiles p
      on p.subscription_status = 'active'
     and p.subscription_activated_at is not null
     and (p.subscription_activated_at at time zone 'America/Sao_Paulo')::date = d::date
   group by d
   order by d
$$;

revoke all on function public.alunas_por_dia(integer) from public, anon, authenticated;
grant execute on function public.alunas_por_dia(integer) to service_role;
