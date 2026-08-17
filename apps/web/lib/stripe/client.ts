import Stripe from 'stripe';

// Cliente Stripe do lado servidor. A chave secreta vem SEMPRE do ambiente
// (STRIPE_SECRET_KEY) — nunca hardcode. Usada pra criar PaymentIntents (Apple
// Pay / Google Pay) e validar webhooks. Pagamento único (R$39,90), não recorrente.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.startsWith('X')) return null;
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

export const STRIPE_ENABLED = !!(process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.startsWith('X'));
