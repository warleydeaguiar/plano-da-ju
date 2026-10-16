-- DISCADOR do Plano da Ju (16/10/2026) — porte do discador da Quadros
-- Decorativos (qd-discador + qd-loja/lib/discador.ts). Um app Android, no
-- celular da empresa, liga sozinho para a fila de recuperação de vendas.
--
-- Princípio (igual à QD): o painel manda, o app só pergunta. O app não guarda
-- fila nem configuração; antes de cada ligação pede "quem é o próximo?" e a
-- resposta já vem com as regras do momento.
--
-- Decisões do Warley (16/10):
--   * 1 atendente, 1 celular
--   * fila, por urgência: PIX gerado e não pago (15 min) → cartão recusado →
--     abriu o checkout e saiu → fez o quiz e não abriu o checkout
--   * 5 tentativas em 5 dias; seg–sex 8h–17h
--   * SMS automático quando a pessoa não atende
-- Tudo nasce DESLIGADO.

-- ── Configuração única ──────────────────────────────────────────────────────
create table if not exists discador_config (
  id             smallint primary key default 1 check (id = 1),
  ligado         boolean not null default false,  -- o app liga
  motor_ligado   boolean not null default false,  -- o robô cria tarefas
  parametros     jsonb not null default '{}'::jsonb,
  atualizado_em  timestamptz not null default now(),
  atualizado_por text
);
insert into discador_config (id) values (1) on conflict do nothing;

-- ── Quem liga ───────────────────────────────────────────────────────────────
create table if not exists discador_atendentes (
  id         bigserial primary key,
  nome       text not null,
  foto_url   text,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

-- ── Aparelhos pareados (só HASH do código e do token) ───────────────────────
create table if not exists discador_aparelhos (
  id                bigserial primary key,
  atendente_id      bigint not null references discador_atendentes(id) on delete cascade,
  nome              text,
  codigo_hash       text unique,
  codigo_expira     timestamptz,
  token_hash        text unique,
  pareado_em        timestamptz,
  pausado           boolean not null default false,
  revogado_em       timestamptz,
  ultimo_contato_em timestamptz,
  estado            text,
  app_versao        text,
  modelo            text,
  android           text,
  criado_em         timestamptz not null default now()
);
create index if not exists discador_aparelhos_atendente on discador_aparelhos (atendente_id);

-- ── Fila: uma tarefa ABERTA por pessoa ──────────────────────────────────────
create table if not exists discador_tarefas (
  id             bigserial primary key,
  email          text not null,
  nome           text,
  telefone       text,
  motivo         text not null check (motivo in ('pix_nao_pago','cartao_recusado','checkout_abandonado','quiz_sem_checkout')),
  prioridade     smallint not null default 2,   -- 1 = mais urgente
  contexto       jsonb not null default '{}'::jsonb,  -- valor, quando, cabelo, incômodo, cupom…
  status         text not null default 'aberta' check (status in ('aberta','concluida','cancelada')),
  tentativas     int not null default 0,
  proxima_em     timestamptz not null default now(),
  resultado      text,
  nota           text,
  fim_motivo     text,      -- comprou | cortesia | optout | tentativas | resultado | expirou
  atendente_id   bigint references discador_atendentes(id) on delete set null,
  criada_em      timestamptz not null default now(),
  atualizada_em  timestamptz not null default now(),
  concluida_em   timestamptz
);
create unique index if not exists discador_tarefas_uma_aberta
  on discador_tarefas (lower(btrim(email))) where status = 'aberta';
create index if not exists discador_tarefas_fila on discador_tarefas (status, prioridade, proxima_em);
create index if not exists discador_tarefas_email on discador_tarefas (lower(btrim(email)));

-- ── Cada ligação ────────────────────────────────────────────────────────────
create table if not exists discador_chamadas (
  id             bigserial primary key,
  aparelho_id    bigint references discador_aparelhos(id) on delete set null,
  atendente_id   bigint references discador_atendentes(id) on delete set null,
  tarefa_id      bigint references discador_tarefas(id) on delete cascade,
  tentativa      int not null default 1,
  criada_em      timestamptz not null default now(),
  discou_em      timestamptz,
  atendeu_em     timestamptz,
  encerrou_em    timestamptz,
  duracao_s      int,
  desfecho       text check (desfecho in ('atendeu','nao_atendeu','ocupado','recusou','caixa_postal','erro','pulou','expirou')),
  resultado      text,
  nota           text,
  sms_enviado_em timestamptz
);
create index if not exists discador_chamadas_tarefa on discador_chamadas (tarefa_id);
create index if not exists discador_chamadas_criada on discador_chamadas (criada_em);
create index if not exists discador_chamadas_aparelho on discador_chamadas (aparelho_id, criada_em);

-- ── SMS enviados pelo discador (trava de 1 por dia por telefone) ────────────
create table if not exists discador_sms (
  id          bigserial primary key,
  tarefa_id   bigint references discador_tarefas(id) on delete set null,
  telefone    text not null,
  texto       text not null,
  ok          boolean not null default false,
  erro        text,
  enviado_em  timestamptz not null default now()
);
create index if not exists discador_sms_tel on discador_sms (telefone, enviado_em);

-- Sem acesso público: tudo passa pelas rotas do admin (service role).
alter table discador_config      enable row level security;
alter table discador_atendentes  enable row level security;
alter table discador_aparelhos   enable row level security;
alter table discador_tarefas     enable row level security;
alter table discador_chamadas    enable row level security;
alter table discador_sms         enable row level security;

-- ── "Quem é o próximo?" — atômico ───────────────────────────────────────────
-- Trava por atendente (dois aparelhos nunca ligam para o mesmo número ao mesmo
-- tempo), fecha chamadas órfãs (sem encerrar há mais de 10 min), escolhe a
-- tarefa mais urgente que já pode ser chamada e abre a chamada.
create or replace function discador_proxima(p_aparelho bigint)
returns jsonb
language plpgsql
as $$
declare
  v_ap   discador_aparelhos;
  v_t    discador_tarefas;
  v_cham bigint;
begin
  select * into v_ap from discador_aparelhos where id = p_aparelho;
  if not found then return jsonb_build_object('acao','esperar','motivo','aparelho desconhecido'); end if;

  perform pg_advisory_xact_lock(4848, v_ap.atendente_id::int);

  update discador_chamadas set desfecho = 'expirou', encerrou_em = now()
   where aparelho_id = p_aparelho and encerrou_em is null and criada_em < now() - interval '10 minutes';

  -- não pede outra enquanto houver ligação em andamento neste aparelho
  if exists (select 1 from discador_chamadas where aparelho_id = p_aparelho and encerrou_em is null) then
    return jsonb_build_object('acao','esperar','motivo','ligação em andamento');
  end if;

  select t.* into v_t
    from discador_tarefas t
   where t.status = 'aberta'
     and t.proxima_em <= now()
     and t.telefone is not null
     and not exists (select 1 from discador_chamadas c where c.tarefa_id = t.id and c.encerrou_em is null)
     -- atendeu e ninguém marcou o resultado nas últimas 24 h: não liga de novo
     and not exists (select 1 from discador_chamadas c where c.tarefa_id = t.id and c.desfecho = 'atendeu'
                       and c.resultado is null and c.criada_em > now() - interval '24 hours')
   order by t.prioridade, t.proxima_em, t.id
   limit 1
   for update skip locked;

  if not found then return jsonb_build_object('acao','esperar','motivo','fila vazia'); end if;

  insert into discador_chamadas (aparelho_id, atendente_id, tarefa_id, tentativa)
  values (p_aparelho, v_ap.atendente_id, v_t.id, v_t.tentativas + 1)
  returning id into v_cham;

  -- tira da frente da fila enquanto a chamada acontece (o resultado reagenda)
  update discador_tarefas set proxima_em = now() + interval '15 minutes', atualizada_em = now(),
         atendente_id = coalesce(atendente_id, v_ap.atendente_id)
   where id = v_t.id;

  return jsonb_build_object('acao','ligar','chamada_id', v_cham, 'tarefa_id', v_t.id);
end;
$$;

-- Só o servidor (service role) chama — nunca a chave pública.
revoke execute on function discador_proxima(bigint) from public, anon, authenticated;
grant execute on function discador_proxima(bigint) to service_role;

notify pgrst, 'reload schema';
