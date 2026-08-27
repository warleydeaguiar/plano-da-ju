-- Data em que a Juliane revisou o conteúdo com os próprios olhos.
--
-- Não dá para gravar isso em `modified_at`: esse campo vem do Yoast e é
-- reescrito a cada execução do importador, que é reexecutável de propósito.
-- Um UPDATE manual ali dura até a próxima sincronização — foi exatamente o
-- que aconteceu com a regra de noindex na véspera do cutover.
--
-- O site passa a publicar COALESCE(revisado_em, modified_at) como dateModified
-- e como lastmod no sitemap, então a revisão humana ganha precedência sobre a
-- data que o WordPress registrou.
alter table site_content
  add column if not exists revisado_em timestamptz;

comment on column site_content.revisado_em is
  'Revisão manual de conteúdo. Tem precedência sobre modified_at no dateModified e no sitemap. O importador nunca escreve aqui.';

create index if not exists site_content_revisado_em_idx
  on site_content (revisado_em desc nulls last);
