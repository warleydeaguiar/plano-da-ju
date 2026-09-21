-- Plano de cliente PAGANTE passa a esperar a consulta no WhatsApp.
--
-- A entrega pelo aplicativo, sozinha, não estava sustentando a venda dos
-- produtos: a cliente recebe um PDF bonito e não fala com ninguém. No fluxo
-- novo o plano é gerado do mesmo jeito, mas fica retido até a Juliane liberar
-- — e a conversa é a consulta. Se ninguém liberar, o próprio prazo solta em
-- 3 dias, para que ninguém fique sem o que pagou.
--
-- Cortesia da parceria (UGC) NÃO muda: continua recebendo pelo app na hora.
alter table public.profiles
  add column if not exists plano_liberado_por text,   -- 'manual' | 'prazo' | null
  add column if not exists plano_liberado_em timestamptz;

comment on column public.profiles.plano_liberado_por is
  'Quem soltou o plano: manual (a Juliane clicou) ou prazo (os 3 dias correram).';

create index if not exists idx_profiles_aguardando_consulta
  on public.profiles (plan_released_at)
  where plan_status = 'ready' and plano_liberado_em is null;
