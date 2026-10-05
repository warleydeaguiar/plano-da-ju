-- Link na Bio PRO — funil medível e notificação de venda (05/10/2026).
--
-- `etapa_*`: até onde a pessoa chegou no quiz. Toda visita cria a linha (antes
-- só nascia na 1ª resposta), então o painel consegue mostrar o funil inteiro
-- sem depender das tabelas wg_quiz_* do Plano Capilar — lá os crons de
-- recuperação mandam WhatsApp sobre plano capilar pra quem estiver na tabela.
--
-- `tracking_session_id`: o mesmo id que o pixel/CAPI usam (checkout_session_id
-- do navegador), pra o Purchase server-side casar com fbp/fbc da visita.

alter table bio_pro_orders
  add column if not exists etapa_id            text,
  add column if not exists etapa_indice        integer,
  add column if not exists utm_source          text,
  add column if not exists utm_medium          text,
  add column if not exists utm_campaign        text,
  add column if not exists tracking_session_id text;

create index if not exists bio_pro_orders_criado_idx on bio_pro_orders (criado_em desc);

insert into wg_notif_discord (chave, nome, descricao, quando, ativo) values
  ('venda_bio_pro', 'Nova venda — Link na Bio PRO',
   'Cliente, profissão, estilo escolhido, forma de pagamento e link do pedido no admin — disparada quando a taxa de R$ 19,90 é confirmada (webhook da Pagar.me, cartão aprovado ou PIX confirmado na tela).',
   'A cada venda do Link na Bio PRO', true)
on conflict (chave) do nothing;
