-- Quem já tem o plano não pode receber mensagem de "finalize sua inscrição".
-- A checagem era só por e-mail e falhou com cortesias cadastradas com e-mail
-- errado (hormail.com, gamil.com) — a menina ganhou o plano e recebeu cobrança.
-- O telefone é a chave confiável: casa pelos 8 últimos dígitos (ignora DDI e o
-- nono dígito, que variam entre o cadastro e o WhatsApp).
create or replace function public.leads_com_acesso(p_finais text[])
returns table(final8 text, tipo text)
language sql
stable
as $$
  select right(regexp_replace(p.phone, '\D', '', 'g'), 8) as final8,
         case when p.subscription_type = 'parceria' then 'cortesia' else 'pago' end as tipo
  from public.profiles p
  where p.subscription_status = 'active'
    and p.phone is not null
    and right(regexp_replace(p.phone, '\D', '', 'g'), 8) = any(p_finais)
  group by 1, 2
$$;

create index if not exists idx_profiles_final8_ativos
  on public.profiles ((right(regexp_replace(phone, '\D', '', 'g'), 8)))
  where subscription_status = 'active' and phone is not null;
