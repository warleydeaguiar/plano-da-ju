-- Marcação do envio do template "inscrição pendente" pelo WhatsApp oficial.
--
-- Sem isto não há como garantir "no máximo uma mensagem por pessoa": o cron
-- roda a cada poucos minutos e reencontraria o mesmo lead.
alter table wg_quiz_leads
  add column if not exists inscricao_wa_enviada_em timestamptz,
  add column if not exists inscricao_wa_tentativas smallint not null default 0,
  add column if not exists inscricao_wa_erro text;

comment on column wg_quiz_leads.inscricao_wa_enviada_em is
  'Quando o template inscricao_pendente foi entregue. Nulo = ainda não recebeu.';
comment on column wg_quiz_leads.inscricao_wa_tentativas is
  'Tentativas de envio. Trava a fila em 3 para um erro permanente não virar laço.';

-- A busca do cron é sempre "leads recentes ainda não avisados".
create index if not exists idx_wg_quiz_leads_inscricao_pendente
  on wg_quiz_leads (created_at desc)
  where inscricao_wa_enviada_em is null;
