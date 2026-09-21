-- "Cortesia" no painel era só `subscription_type = 'parceria'`, mas existem 27
-- acessos dados de presente (`is_gift`) com tipo de assinatura normal. Eles
-- apareciam na barra de PAGANTES — a mistura que este gráfico existe para
-- evitar. O critério passa a ser o mesmo do resto do sistema: parceria OU
-- presente.
create or replace function public.alunas_por_dia(p_dias integer default 30)
returns table (dia date, pagantes integer, ugc integer)
language sql
stable
as $$
  select d::date as dia,
         count(p.id) filter (
           where p.subscription_type is distinct from 'parceria' and coalesce(p.is_gift, false) = false
         )::int as pagantes,
         count(p.id) filter (
           where p.subscription_type = 'parceria' or coalesce(p.is_gift, false) = true
         )::int as ugc
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
