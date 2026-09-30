-- ============================================================================
-- Teste A/B checkout próprio × Hotmart (30/09/2026)
--
-- Produto cadastrado na Hotmart (ID 8631129, "Plano Capilar Personalizado —
-- Juliane Cost") com o mesmo preço R$34,90 do checkout próprio, à vista
-- (PIX/cartão) ou parcelado até 3x. O webhook de "Compra aprovada" ativa o
-- perfil igual ao webhook da Pagar.me — ver project_plano_da_ju_hotmart_ab.
-- ============================================================================

alter table public.profiles
  drop constraint profiles_subscription_type_check;

alter table public.profiles
  add constraint profiles_subscription_type_check
  check (subscription_type in ('annual_card','annual_pix','none','parceria','hotmart_card','hotmart_pix'));

alter table public.profiles
  add column if not exists hotmart_transaction_id text;

comment on column public.profiles.hotmart_transaction_id is
  'ID da transação Hotmart (data.purchase.transaction do webhook) — idempotência, análogo a pagarme_charge_id.';
