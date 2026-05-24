-- 003_tracking_identity.sql
-- Identidade de tracking por sessão — alimenta o Advanced Matching de TODOS os
-- eventos do funil (Meta CAPI). Persistida no 1º toque e enriquecida conforme a
-- pessoa avança (email/telefone no quiz). Permite Purchase/Checkout/Lead com
-- matching completo mesmo quando o evento dispara sem contexto de navegador
-- (ex: webhook PagarMe) e re-hidratação de quem retorna.
--
-- LGPD: dados de tracking com retenção curta (limpeza via cron, 90 dias).
-- RLS habilitado sem policies → anon/authenticated não acessam; só service_role
-- (nossas APIs) escreve/lê.

create table if not exists public.tracking_identity (
  session_id    text primary key,

  -- Identificadores Meta (sinais de match mais fortes)
  fbp           text,
  fbc           text,
  fbclid        text,

  -- Origem / atribuição
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  utm_term      text,
  landing_url   text,
  referrer      text,

  -- Contexto (capturado no servidor — mais confiável)
  ip            text,
  user_agent    text,
  geo_country   text,
  geo_region    text,
  geo_city      text,

  -- PII (quando conhecida — usada hasheada no CAPI)
  email         text,
  phone         text,
  cpf           text,
  external_id   text,
  zip           text,

  -- Tempo
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

-- Índices para re-hidratação (achar identidade anterior por fbp ou email)
create index if not exists idx_tracking_identity_fbp       on public.tracking_identity (fbp)       where fbp is not null;
create index if not exists idx_tracking_identity_email     on public.tracking_identity (email)     where email is not null;
create index if not exists idx_tracking_identity_last_seen on public.tracking_identity (last_seen_at);

-- RLS: trava acesso público. service_role (APIs) bypassa RLS.
alter table public.tracking_identity enable row level security;

-- Atualiza last_seen_at em todo update
create or replace function public.touch_tracking_identity()
returns trigger language plpgsql as $$
begin
  new.last_seen_at = now();
  return new;
end; $$;

drop trigger if exists trg_touch_tracking_identity on public.tracking_identity;
create trigger trg_touch_tracking_identity
  before update on public.tracking_identity
  for each row execute function public.touch_tracking_identity();
