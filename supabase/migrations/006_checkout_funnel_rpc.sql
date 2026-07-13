create or replace function checkout_funnel(p_since timestamptz)
returns json language sql stable as $$
  with ev as (
    select event_type, session_id, payment_type, amount_cents, created_at
    from checkout_events
    where created_at >= p_since and session_id is not null
  ),
  paid as (
    select distinct on (session_id) session_id, payment_type, amount_cents
    from ev where event_type = 'payment_confirmed'
    order by session_id, created_at asc
  )
  select json_build_object(
    'viewed',       (select count(distinct session_id) from ev where event_type='offer_viewed'),
    'initiated',    (select count(distinct session_id) from ev where event_type='checkout_initiated'),
    'pay_started',  (select count(distinct session_id) from ev where event_type in ('pix_generated','card_submitted')),
    'pix_started',  (select count(distinct session_id) from ev where event_type='pix_generated'),
    'card_started', (select count(distinct session_id) from ev where event_type='card_submitted'),
    'paid',         (select count(*) from paid),
    'paid_pix',     (select count(*) from paid where payment_type='pix'),
    'paid_card',    (select count(*) from paid where payment_type='card'),
    'revenue',      (select coalesce(sum(amount_cents),0)/100.0 from paid),
    'errors',       (select count(distinct session_id) from ev where event_type='checkout_error'),
    'password_set', (select count(distinct session_id) from ev where event_type='password_set')
  );
$$;
grant execute on function checkout_funnel(timestamptz) to anon, authenticated, service_role;
notify pgrst, 'reload schema';
