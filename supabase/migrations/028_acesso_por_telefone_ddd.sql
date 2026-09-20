-- Dois ajustes em leads_com_acesso (migration 025):
--
-- 1. Casava só pelos 8 últimos dígitos, ou seja, IGNORANDO o DDD: um lead de
--    outro estado com o mesmo número local era marcado como "já tem o plano" e
--    saía calado da régua. Agora compara DDD + 8 finais.
-- 2. Sem revoke, o EXECUTE vai para PUBLIC e o PostgREST expõe a função para a
--    chave anon — viraria um oráculo "este telefone tem plano ativo?".
create or replace function public.leads_com_acesso(p_finais text[])
returns table (final8 text, tipo text)
language sql
stable
as $$
  with tel as (
    select case when left(regexp_replace(p.phone, '\D', '', 'g'), 2) = '55'
                  and length(regexp_replace(p.phone, '\D', '', 'g')) >= 12
                then substr(regexp_replace(p.phone, '\D', '', 'g'), 3)
                else regexp_replace(p.phone, '\D', '', 'g')
           end as d,
           p.subscription_type
    from public.profiles p
    where p.subscription_status = 'active'
      and p.phone is not null
  )
  select left(d, 2) || right(d, 8) as final8,
         case when subscription_type = 'parceria' then 'cortesia' else 'pago' end as tipo
  from tel
  where length(d) >= 10
    and left(d, 2) || right(d, 8) = any(p_finais)
  group by 1, 2
$$;

revoke all on function public.leads_com_acesso(text[]) from public;
revoke all on function public.leads_com_acesso(text[]) from anon;
revoke all on function public.leads_com_acesso(text[]) from authenticated;
grant execute on function public.leads_com_acesso(text[]) to service_role;

drop index if exists public.idx_profiles_final8_ativos;
