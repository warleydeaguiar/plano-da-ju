-- Avaliações de produto.
--
-- A Ju é afiliada: não processa o pedido e não sabe quem comprou. As
-- avaliações chegam por WhatsApp, de clientes reais que usaram o produto, e
-- ela lança à mão pelo painel. Por isso `origem` — é o rastro de onde veio,
-- que é o que sustenta a marcação perante o Google.
--
-- ⚠️ O Google exige que a avaliação esteja VISÍVEL na página. Marcar
-- aggregateRating sem exibir o texto é violação de política e rende ação
-- manual. Por isso não existe "avaliação oculta" aqui: publicada = visível.
create table if not exists site_avaliacoes (
  id          bigserial primary key,
  content_id  bigint not null references site_content(id) on delete cascade,
  autora      text not null,
  nota        smallint not null check (nota between 1 and 5),
  texto       text not null,
  data        date not null default current_date,
  origem      text not null default 'whatsapp'
              check (origem in ('whatsapp', 'instagram', 'site_antigo', 'email', 'outro')),
  publicada   boolean not null default true,
  criada_em   timestamptz not null default now(),
  -- mesma pessoa, mesmo texto, no mesmo produto = duplicata
  unique (content_id, autora, texto)
);

create index if not exists site_avaliacoes_content_idx
  on site_avaliacoes (content_id, publicada, data desc);

alter table site_avaliacoes enable row level security;
drop policy if exists site_avaliacoes_publico on site_avaliacoes;
create policy site_avaliacoes_publico on site_avaliacoes
  for select to anon, authenticated using (publicada);

/**
 * Nota média e contagem por produto, direto do banco.
 *
 * Fica numa view para o site nunca inventar número: o aggregateRating do
 * schema sai daqui, das mesmas linhas que aparecem na tela.
 */
create or replace view site_avaliacoes_resumo as
  select content_id,
         count(*)::int as total,
         round(avg(nota)::numeric, 1) as media
  from site_avaliacoes
  where publicada
  group by content_id;

grant select on site_avaliacoes_resumo to anon, authenticated;

notify pgrst, 'reload schema';
