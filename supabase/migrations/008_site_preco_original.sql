-- Produto de afiliado quase nunca tem preço próprio: dos 47, só 7 publicam.
-- Quando publicam, é sempre par "de/por", então guardar os dois.
alter table site_content add column if not exists price_original_cents integer;
comment on column site_content.price_cents is
  'Preço atual exibido na página do produto. Nulo é o normal: 40 dos 47 produtos não publicam preço — quem cobra é o site do parceiro, atrás do link de afiliado.';
comment on column site_content.price_original_cents is
  'Preço "de" riscado, quando há desconto.';
notify pgrst, 'reload schema';
