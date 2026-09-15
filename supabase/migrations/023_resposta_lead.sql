-- Que template o lead recebeu e que tipo de resposta ele deu.
--
-- Para quê:
-- 1) medir o teste A/B entre as versões da mensagem de inscrição pendente;
-- 2) parar de mandar o cupom de R$14,90 para quem respondeu "cancela, não
--    quero" ou para a resposta automática de outra empresa ("Fulano agradece
--    seu contato") — hoje qualquer resposta entra na fila do cupom.

alter table wg_quiz_leads add column if not exists inscricao_wa_template text;
alter table wg_quiz_leads add column if not exists resposta_tipo text;
alter table wg_quiz_leads add column if not exists resposta_texto text;

comment on column wg_quiz_leads.inscricao_wa_template is
  'Nome do template usado no envio da inscrição pendente (para comparar versões).';
comment on column wg_quiz_leads.resposta_tipo is
  'Como a pessoa respondeu: botao_concluir, botao_duvida, humana, automatica (bot de empresa), recusa, bloqueio.';

notify pgrst, 'reload schema';
