-- A migration 010 preencheu 'pendente' nas linhas existentes mas não definiu
-- DEFAULT, então tudo gerado depois dela nasceu NULL — e o revisor, que filtra
-- por 'pendente', simplesmente não veria essas perguntas. Elas ficariam para
-- sempre fora do ar sem ninguém notar.
alter table site_faq alter column revisao_status set default 'pendente';
update site_faq set revisao_status = 'pendente' where revisao_status is null;
notify pgrst, 'reload schema';
