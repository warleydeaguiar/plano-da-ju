-- ============================================================================
-- Painel de notificações Discord — /admin/notificacoes (30/09/2026)
--
-- Antes cada rota tinha seu próprio `process.env.DISCORD_X_WEBHOOK` cravado no
-- código: trocar o canal de uma notificação exigia mexer em env var na Vercel
-- e redeployar — e não havia um lugar único pra ver "o que a gente manda pro
-- Discord, quando, e pra qual canal". Mesmo padrão já aplicado no QD Gestão
-- em 29/09 (ver project_qd_notificacoes_discord na memória).
--
-- O banco passa a ter prioridade sobre o env var (que vira só fallback, pra
-- não quebrar nada enquanto a migração de código não estiver em todo lugar).
-- ============================================================================

create table if not exists wg_notif_discord (
  chave        text primary key,          -- identifica a notificação no código (ex: 'venda')
  nome         text not null,             -- nome amigável exibido no painel
  descricao    text,                      -- o que ela manda / de onde vêm os dados
  quando       text not null,             -- frequência em texto livre ("a cada venda", "diário 10:30 BR"...)
  webhook_url  text,                      -- null = usa o env var de fallback do código
  ativo        boolean not null default true,
  last_sent_at timestamptz,               -- atualizado pelo próprio código a cada envio OK
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table wg_notif_discord is
  'Controle central de notificações enviadas ao Discord (venda, relatórios, erros...). Editável em /admin/notificacoes.';

insert into wg_notif_discord (chave, nome, descricao, quando, ativo) values
  ('venda', 'Nova venda',
   'Cliente, e-mail, tipo de cabelo, forma de pagamento e valor — disparada pelo webhook da Pagar.me quando uma cobrança é confirmada.',
   'A cada venda confirmada', true),
  ('daily_report', 'Relatório diário',
   'Dois blocos: Plano da Ju (investimento/receita/lucro de ontem) e Grupos Ybera (investimento/leads/CPL/vendas/comissão/lucro).',
   'Diário às 10:30 (Vercel Cron)', true),
  ('content_ideas', 'Ideias de conteúdo semanal',
   'Cruza quiz dos últimos 30 dias, notas da Juliane em planos aprovados, check-ins e análises de foto pra sugerir pauta de conteúdo.',
   'Toda segunda às 10:30 (Vercel Cron)', true),
  ('error_digest', 'Revisão de erros',
   'Erros novos de checkout e do app desde a última revisão, com destaque para o que precisa de atenção.',
   'A cada 3 dias (systemd timer na VPS)', true),
  ('pix_manual', 'PIX manual — conferir comprovante',
   'Cliente envia comprovante de PIX manual, o acesso é liberado na hora e o time precisa CONFERIR — se não bater, revogar. Pede ação, não é só informativo.',
   'A cada comprovante enviado', true)
on conflict (chave) do nothing;
