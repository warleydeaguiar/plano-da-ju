-- Registro da mensagem de boas-vindas (template acesso_plano) de cada cliente.
--
-- Até aqui ela era disparada de dentro do webhook da Pagar.me sem esperar
-- terminar, e a função era encerrada ao responder: parte dos envios nunca saía,
-- e nada ficava gravado — não havia como saber quem recebeu. Agora quem envia é
-- um cron (/api/cron/boas-vindas), e cada envio fica anotado aqui.

alter table profiles add column if not exists boas_vindas_wa_em timestamptz;
alter table profiles add column if not exists boas_vindas_wa_erro text;
alter table profiles add column if not exists boas_vindas_wa_tentativas integer not null default 0;

comment on column profiles.boas_vindas_wa_em is
  'Quando a boas-vindas (acesso_plano) foi aceita pela API do WhatsApp. Nulo = ainda não enviada.';

-- O cron procura clientes ativas sem boas-vindas: índice parcial, pequeno.
create index if not exists idx_profiles_boas_vindas_pendente
  on profiles (subscription_activated_at)
  where boas_vindas_wa_em is null and subscription_status = 'active';

notify pgrst, 'reload schema';
