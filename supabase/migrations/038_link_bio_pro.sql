-- Link na Bio PRO: produto novo, separado do Plano Capilar.
-- Tabela própria — nunca toca `profiles`/`wg_quiz_*` (ver project_plano_da_ju_fila_tarefas
-- na memória do Claude e o plano em .claude/plans/juliane-cost-a-mutable-ripple.md).

create table if not exists bio_pro_orders (
  id                uuid primary key default gen_random_uuid(),
  session_id        text not null,

  nome              text,
  email             text,
  telefone          text,

  profissao         text,
  respostas         jsonb not null default '{}',   -- { [step_id]: valor }
  imagens           jsonb not null default '[]',   -- [{ slot, url, uploaded_at }]

  valor_centavos    integer not null default 1990,
  metodo_pagamento  text,                           -- 'credit_card' | 'pix'
  pagarme_order_id  text,
  pagarme_charge_id text,
  status_pagamento  text not null default 'pendente'
                      check (status_pagamento in ('pendente','pago','falhou','cancelado')),
  pago_em           timestamptz,

  status_entrega    text not null default 'pendente'
                      check (status_entrega in ('pendente','em_producao','entregue')),
  entregue_em       timestamptz,
  notas_internas    text,

  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

create index if not exists bio_pro_orders_session_idx on bio_pro_orders (session_id);
create index if not exists bio_pro_orders_email_idx on bio_pro_orders (email);
create index if not exists bio_pro_orders_status_entrega_idx on bio_pro_orders (status_entrega);
create index if not exists bio_pro_orders_pagarme_order_idx on bio_pro_orders (pagarme_order_id);

-- RLS fechada por padrão: toda escrita/leitura passa pelas API routes com service role.
alter table bio_pro_orders enable row level security;

-- Bucket de upload dedicado (análogo às migrations 034/035 do bucket hair-photos).
insert into storage.buckets (id, name, public, file_size_limit)
values ('bio-pro-uploads', 'bio-pro-uploads', true, 26214400)
on conflict (id) do nothing;
