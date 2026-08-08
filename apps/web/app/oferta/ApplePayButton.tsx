'use client';

// Botão Apple Pay / Google Pay via Stripe, embutido no nosso checkout (sem
// redirect). Aparece só quando o aparelho suporta (Safari/iOS com cartão na
// Wallet, ou Chrome/Android com Google Pay). Usa a chave PUBLICÁVEL do ambiente
// (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY); a ativação real é no webhook do servidor.
import { useEffect, useRef, useState } from 'react';
import { loadStripe, type Stripe, type PaymentRequest } from '@stripe/stripe-js';

const PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
let _stripePromise: ReturnType<typeof loadStripe> | null = null;
function stripeJs() {
  if (!PK) return null;
  if (!_stripePromise) _stripePromise = loadStripe(PK);
  return _stripePromise;
}

interface Props {
  amountCents: number;             // valor à vista (R$47 = 4700)
  getPayer: () => { email: string; name: string; phone: string; cpf: string; sessionId: string; quizAnswers: Record<string, unknown> };
  canPay: () => boolean;           // ex.: email/nome válidos no formulário
  onNeedInfo?: () => void;         // avisa o pai quando falta email/nome
  onSuccess: () => void;
  onError?: (msg: string) => void;
}

export default function ApplePayButton({ amountCents, getPayer, canPay, onNeedInfo, onSuccess, onError }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(false);
  const [label, setLabel] = useState<'apple' | 'google' | 'wallet'>('wallet');
  // refs pra o handler async sempre ler o estado mais novo do formulário
  const getPayerRef = useRef(getPayer); getPayerRef.current = getPayer;
  const canPayRef = useRef(canPay); canPayRef.current = canPay;
  const onSuccessRef = useRef(onSuccess); onSuccessRef.current = onSuccess;
  const onErrorRef = useRef(onError); onErrorRef.current = onError;
  const onNeedInfoRef = useRef(onNeedInfo); onNeedInfoRef.current = onNeedInfo;

  useEffect(() => {
    let cancelled = false;
    const sp = stripeJs();
    if (!sp) return;

    sp.then(async (stripe: Stripe | null) => {
      if (!stripe || cancelled) return;
      const pr: PaymentRequest = stripe.paymentRequest({
        country: 'BR',
        currency: 'brl',
        total: { label: 'Plano Capilar — Juliane Cost', amount: amountCents },
        requestPayerName: false,
        requestPayerEmail: false,
      });

      const result = await pr.canMakePayment();
      if (!result || cancelled) return;
      setLabel(result.applePay ? 'apple' : result.googlePay ? 'google' : 'wallet');

      const elements = stripe.elements();
      const prButton = elements.create('paymentRequestButton', {
        paymentRequest: pr,
        style: { paymentRequestButton: { type: 'default', theme: 'dark', height: '52px' } },
      });
      if (mountRef.current) { prButton.mount(mountRef.current); setAvailable(true); }

      // Ao tocar no botão, se faltar email/nome, cancela e avisa o pai.
      prButton.on('click', (ev) => {
        if (!canPayRef.current()) { ev.preventDefault(); onNeedInfoRef.current?.(); }
      });

      pr.on('paymentmethod', async (ev) => {
        try {
          const p = getPayerRef.current();
          // 1) cria o PaymentIntent no servidor (com o perfil pré-criado)
          const r = await fetch('/api/checkout/stripe/intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: p.email, name: p.name, phone: p.phone, cpf: p.cpf, session_id: p.sessionId, quiz_answers: p.quizAnswers }),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok || !data.client_secret) {
            ev.complete('fail');
            onErrorRef.current?.(data.error || 'Não consegui iniciar o pagamento.');
            return;
          }
          // 2) confirma com o método do Apple/Google Pay (sem redirect)
          const { error: confirmErr, paymentIntent } = await stripe.confirmCardPayment(
            data.client_secret,
            { payment_method: ev.paymentMethod.id },
            { handleActions: false },
          );
          if (confirmErr) {
            ev.complete('fail');
            onErrorRef.current?.(confirmErr.message || 'Pagamento não autorizado.');
            return;
          }
          ev.complete('success');
          // 3) se o banco pedir autenticação extra (3DS), resolve agora
          if (paymentIntent && paymentIntent.status === 'requires_action') {
            const { error: actErr } = await stripe.confirmCardPayment(data.client_secret);
            if (actErr) { onErrorRef.current?.(actErr.message || 'Falha na confirmação.'); return; }
          }
          onSuccessRef.current();
        } catch (e) {
          ev.complete('fail');
          onErrorRef.current?.(e instanceof Error ? e.message : 'Erro no pagamento.');
        }
      });
    });

    return () => { cancelled = true; };
  }, [amountCents]);

  if (!PK || !available) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div ref={mountRef} />
      <div style={{ textAlign: 'center', fontSize: 11, color: '#7C6B7E', marginTop: 6 }}>
        {label === 'apple' ? 'Pague em 1 toque com Apple Pay' : label === 'google' ? 'Pague em 1 toque com Google Pay' : 'Pagamento rápido e seguro'}
      </div>
    </div>
  );
}
