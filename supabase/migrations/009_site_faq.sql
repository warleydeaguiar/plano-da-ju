-- Perguntas frequentes no fim do artigo.
--
-- Captura busca de cauda longa que o corpo do texto não responde de forma
-- direta ("progressiva sem formol pode em cabelo descolorido?"). Fica fora da
-- tabela de conteúdo porque é gerada e revisada separadamente do post.
--
-- `revisado` começa falso de propósito: a resposta é redigida a partir do
-- próprio artigo, mas é conteúdo sobre química capilar — e quem valida é a
-- tricologista, não o script.
create table if not exists site_faq (
  id         bigserial primary key,
  content_id bigint not null references site_content(id) on delete cascade,
  pergunta   text not null,
  resposta   text not null,
  ordem      integer not null default 0,
  revisado   boolean not null default false,
  gerado_em  timestamptz not null default now(),
  unique (content_id, pergunta)
);

create index if not exists site_faq_content_idx on site_faq (content_id, ordem);

alter table site_faq enable row level security;
drop policy if exists site_faq_publico on site_faq;
create policy site_faq_publico on site_faq for select to anon, authenticated using (true);

notify pgrst, 'reload schema';
