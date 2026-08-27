-- Cliques nos links que levam ao WhatsApp da Juliane.
--
-- O evento também vai para o GA4 e para a Meta, mas guardar aqui dá três
-- coisas que lá não temos: número imediato (o GA4 atrasa horas), histórico que
-- não depende de autorização OAuth pendente, e o produto exato em coluna
-- própria, pronto para cruzar com as impressões do Search Console.
create table if not exists site_cliques_whatsapp (
  id         bigserial primary key,
  path       text not null,
  produto    text,
  rotulo     text,
  -- 87% do tráfego é celular; separar aqui evita ter que adivinhar depois
  dispositivo text check (dispositivo in ('celular', 'computador')),
  criado_em  timestamptz not null default now()
);

create index if not exists site_cliques_whatsapp_data_idx on site_cliques_whatsapp (criado_em desc);
create index if not exists site_cliques_whatsapp_path_idx on site_cliques_whatsapp (path);

-- Só o service_role escreve (a rota de API do site) e só ele lê: é dado
-- interno de operação, não tem por que ficar exposto na chave anônima.
alter table site_cliques_whatsapp enable row level security;

notify pgrst, 'reload schema';
