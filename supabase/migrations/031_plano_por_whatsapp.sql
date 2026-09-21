-- Consentimento para receber o plano pelo WhatsApp.
--
-- A mensagem de compra (template acesso_plano_v2) traz um botão de resposta
-- rápida: quando a cliente toca, é ELA quem inicia a conversa — abre a janela
-- de 24 h e, com isso, dá para mandar o plano por texto, sem template e sem
-- custo por mensagem. Guardamos o pedido dela para não ficar dependendo da
-- memória de quem atende.
alter table public.profiles
  add column if not exists plano_por_wa_pedido_em timestamptz,
  add column if not exists plano_por_wa_enviado_em timestamptz;

create index if not exists idx_profiles_plano_por_wa
  on public.profiles (plano_por_wa_pedido_em)
  where plano_por_wa_pedido_em is not null and plano_por_wa_enviado_em is null;
