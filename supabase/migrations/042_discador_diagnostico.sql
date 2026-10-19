-- DISCADOR: diagnóstico do celular (19/10/2026).
-- Em 19/10 o app deixou de receber as chamadas (não era mais o telefone padrão
-- do Samsung) e seguiu discando: 10 erros em 4 minutos, sem ninguém ver nada.
-- Agora o app conta ao site se é o app de telefone padrão (cabeçalho em toda
-- chamada) e manda os erros e travamentos que acontecem no aparelho.

alter table discador_aparelhos
  add column if not exists padrao boolean,          -- é o app de telefone padrão? (último contato)
  add column if not exists padrao_em timestamptz;   -- quando isso mudou pela última vez

create table if not exists discador_erros (
  id          bigserial primary key,
  aparelho_id bigint references discador_aparelhos(id) on delete cascade,
  tipo        text not null,      -- travou | chamada_sumiu | perdeu_padrao | outro
  mensagem    text,
  detalhe     jsonb not null default '{}'::jsonb,
  app_versao  text,
  criado_em   timestamptz not null default now()
);
create index if not exists discador_erros_aparelho on discador_erros (aparelho_id, criado_em desc);
alter table discador_erros enable row level security;

-- Celular com 2 chips: por qual chip saiu cada ligação/SMS (ex.: "Chip 1 · Vivo").
alter table discador_chamadas add column if not exists chip text;
alter table discador_sms add column if not exists chip text;

notify pgrst, 'reload schema';

-- Fila do discador só com quem ENTROU PARA COMPRAR (Warley, 19/10/2026): ninguém
-- que já teve acesso — pago ou cortesia, ativo ou vencido — mesmo que tenha
-- feito o quiz com outro e-mail. Chave do telefone = DDD + 8 últimos dígitos
-- (ignora 55 e nono dígito), igual a apps/web/lib/acesso-lead.ts.
create or replace function discador_telefones_com_acesso(p_chaves text[])
returns table(chave text, tipo text)
language sql stable as $$
  with p as (
    select regexp_replace(coalesce(phone, ''), '\D', '', 'g') d, subscription_type
      from profiles where coalesce(subscription_type, 'none') <> 'none' and phone is not null
  ), k as (
    select case when d like '55%' and length(d) >= 12 then substr(d, 3) else d end d, subscription_type from p
  )
  select distinct left(d, 2) || right(d, 8), case when subscription_type = 'parceria' then 'cortesia' else 'pago' end
    from k where length(d) >= 10 and left(d, 2) || right(d, 8) = any(p_chaves);
$$;
revoke execute on function discador_telefones_com_acesso(text[]) from public, anon, authenticated;
grant execute on function discador_telefones_com_acesso(text[]) to service_role;
notify pgrst, 'reload schema';
