-- Rastro da revisão do FAQ: sem isto, "revisado = false" não distingue
-- "ainda não olhei" de "olhei e reprovei", e a mesma pergunta ruim voltaria
-- a ser aprovada na próxima rodada.
alter table site_faq add column if not exists revisao_status text
  check (revisao_status in ('pendente', 'aprovada', 'reprovada'));
alter table site_faq add column if not exists revisao_motivo text;
alter table site_faq add column if not exists revisado_em timestamptz;

update site_faq set revisao_status = 'pendente' where revisao_status is null;

comment on column site_faq.revisao_motivo is
  'Por que reprovou: regra mecânica violada ou o que a checagem contra o artigo apontou.';

notify pgrst, 'reload schema';
