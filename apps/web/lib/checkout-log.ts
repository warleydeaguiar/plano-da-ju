import { createServiceClient } from '@/lib/supabase/server';
import { PagarMeError } from '@/lib/pagarme/client';

/** Tipo do problema capturado — distingue exceção de recusa de pagamento. */
export type CheckoutErrorKind =
  | 'exception'   // erro lançado (rede, 422 estrutural, bug)
  | 'refused'     // pagamento recusado pela adquirente (cartão negado, etc.)
  | 'frontend'    // erro reportado pelo navegador (tokenização)
  | 'block'       // bloqueio de venda no checkout (faltou campo, CPF inválido…)
  | 'pix_failed'; // PIX cancelado/expirado/falhou

type CheckoutErrorInput = {
  route: string;                 // ex: 'checkout/card', 'checkout/pix'
  email?: string | null;
  payment_type?: 'card' | 'pix' | null;
  session_id?: string | null;
  err: unknown;                  // o erro capturado (ou Error sintético p/ recusa)
  kind?: CheckoutErrorKind;      // default 'exception'
  context?: Record<string, unknown>; // dados extras (installments, acquirer, etc.)
};

/**
 * Loga um erro/recusa de checkout na tabela checkout_events
 * (event_type='checkout_error'). Fire-and-forget — NUNCA lança, pra não
 * mascarar o erro original do checkout.
 */
export async function logCheckoutError(input: CheckoutErrorInput): Promise<void> {
  try {
    const { route, email, payment_type, session_id, err, context } = input;
    const kind: CheckoutErrorKind = input.kind ?? 'exception';

    const message = err instanceof Error ? err.message : String(err);
    const status = err instanceof PagarMeError ? err.status : null;
    const details = err instanceof PagarMeError ? err.details : null;

    const supabase = await createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('checkout_events') as any).insert({
      session_id: session_id ?? `error-${Date.now()}`,
      event_type: 'checkout_error',
      email: email ?? null,
      payment_type: payment_type ?? null,
      metadata: {
        route,
        kind,
        message,
        status,            // HTTP status da PagarMe (ex: 422)
        pagarme_errors: details,  // objeto errors campo-a-campo
        context: context ?? null,
        at: new Date().toISOString(),
      },
    });
  } catch (logErr) {
    // Só loga no console se nem o log no banco funcionar
    console.error('[checkout-log] falha ao gravar erro:', logErr);
  }
}
