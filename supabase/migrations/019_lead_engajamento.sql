-- Sinais de engajamento do lead depois da primeira mensagem no WhatsApp.
--
-- São DOIS sinais diferentes, e eles custam coisas diferentes:
--   respondeu_em → abre a janela de 24h da Meta → podemos mandar texto livre,
--                  de graça, escrevendo o que quisermos;
--   clicou_em    → NÃO abre a janela (clicar num botão não manda mensagem),
--                  então falar com essa pessoa ainda exige template MARKETING.
-- Guardar os dois separados é o que permite tratar cada grupo pelo que ele é.

alter table wg_quiz_leads
  add column if not exists token_msg              text,
  add column if not exists clicou_em              timestamptz,
  add column if not exists respondeu_em           timestamptz,
  add column if not exists desconto_enviado_em    timestamptz,
  add column if not exists grupo_controle         boolean not null default false;

comment on column wg_quiz_leads.token_msg is
  'Token do link pessoal do template. Sem ele o clique chega anônimo e não dá para saber quem clicou.';
comment on column wg_quiz_leads.respondeu_em is
  'Resposta da pessoa no WhatsApp (via webhook do Chatwoot). É o que abre a janela de 24h.';
comment on column wg_quiz_leads.grupo_controle is
  'Fica FORA do desconto de propósito. Sem grupo de controle não dá para saber se o desconto trouxe venda nova ou se só deu desconto a quem compraria assim mesmo.';

create unique index if not exists idx_wg_quiz_leads_token_msg
  on wg_quiz_leads (token_msg) where token_msg is not null;

-- O webhook do Chatwoot chega com o telefone; a busca precisa ser barata.
create index if not exists idx_wg_quiz_leads_phone on wg_quiz_leads (phone) where phone is not null;

-- Fila do desconto: quem já recebeu a primeira e ainda não recebeu a segunda.
create index if not exists idx_wg_quiz_leads_desconto_pendente
  on wg_quiz_leads (inscricao_wa_enviada_em)
  where desconto_enviado_em is null and inscricao_wa_enviada_em is not null;
