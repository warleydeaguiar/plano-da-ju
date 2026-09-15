-- Quem pediu para não receber mensagens automáticas pelo WhatsApp oficial.
--
-- Entrada: botão "Bloquear mensagens" do template de inscrição pendente, ou a
-- pessoa escrevendo só "sair"/"parar" (webhook do Chatwoot → /api/wa/resposta).
-- Todo envio automático (inscrição, desconto, PIX, boas-vindas, grupo) consulta
-- esta tabela antes de mandar.
--
-- Chave = 8 últimos dígitos: o lead guarda DDD+número, o WhatsApp manda com 55
-- na frente e às vezes sem o nono dígito. Oito dígitos casam os três formatos.

create table if not exists wa_optout (
  final8     text primary key,
  telefone   text not null,
  origem     text,
  criado_em  timestamptz not null default now()
);

comment on table wa_optout is
  'Telefones que pediram para não receber mensagens automáticas no WhatsApp. Consultada antes de todo envio.';

alter table wa_optout enable row level security;
drop policy if exists wa_optout_service on wa_optout;
create policy wa_optout_service on wa_optout for all to service_role using (true) with check (true);
grant all on wa_optout to service_role;

notify pgrst, 'reload schema';
