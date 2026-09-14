-- Distribuição de leads para os grupos sem depender do Evolution.
--
-- Até aqui a ocupação de cada grupo vinha só do Evolution (sync + webhook de
-- entrada). Com o número banido em 28/07/2026 a contagem congelou, e o
-- distribuidor (/g/entrar) seguiu mandando todo mundo para o grupo "mais vazio"
-- segundo o banco: o #BM, com 0 membros registrados, recebeu 2.202 entradas em
-- um grupo que comporta 1.024.
--
-- Agora o próprio banco conta: cada entrada pelo link soma 1 em
-- `entradas_desde_contagem`, e a ocupação estimada é
--   member_count (última contagem, do Evolution ou digitada) + entradas desde então.
-- Contar de novo (sync ou operador) zera o contador.

alter table wg_groups add column if not exists entradas_desde_contagem integer not null default 0;
alter table wg_groups add column if not exists contagem_em timestamptz;

comment on column wg_groups.entradas_desde_contagem is
  'Entradas pelo /g/entrar desde a última contagem de membros. Zera quando member_count é recontado.';
comment on column wg_groups.contagem_em is
  'Quando member_count foi contado pela última vez (sync do Evolution ou digitado no admin).';

-- Ponto de partida honesto: as entradas registradas desde a última contagem.
update wg_groups g
   set entradas_desde_contagem = coalesce((
         select count(*) from wg_redirect_clicks c
          where c.group_id = g.id
            and c.created_at > coalesce(g.last_synced_at, g.created_at)), 0),
       contagem_em = coalesce(g.last_synced_at, g.created_at)
 where g.contagem_em is null;

/**
 * Escolhe o grupo do próximo lead e já conta a entrada, numa operação só.
 *
 * Mesma ordem de preferência que o /g/entrar sempre teve, agora com a
 * ocupação estimada no lugar da contagem congelada:
 *   1) recebendo e com vaga;
 *   2) qualquer ativo com vaga (se os marcados como "recebendo" lotaram, é
 *      melhor mandar para um pausado com vaga do que para um cheio);
 *   3) o menos ocupado, mesmo cheio — a estimativa pode errar para cima
 *      (gente sai do grupo), e sem destino a pessoa se perde.
 * Só entra grupo com link de convite marcado como válido.
 */
create or replace function wg_grupo_escolher()
returns table (id uuid, invite_link text, name text)
language sql volatile
as $$
  with escolhido as (
    select g.id
      from wg_groups g
     where g.status = 'active'
       and g.link_ok is true
       and g.invite_link like 'https://chat.whatsapp.com/%'
     order by
       (g.is_receiving and g.member_count + g.entradas_desde_contagem < coalesce(nullif(g.capacity, 0), 1024)) desc,
       (g.member_count + g.entradas_desde_contagem < coalesce(nullif(g.capacity, 0), 1024)) desc,
       g.member_count + g.entradas_desde_contagem asc
     limit 1
  )
  update wg_groups g
     set entradas_desde_contagem = g.entradas_desde_contagem + 1
    from escolhido e
   where g.id = e.id
  returning g.id, g.invite_link, g.name;
$$;

notify pgrst, 'reload schema';
