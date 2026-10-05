'use client';

import { useEffect } from 'react';

const WHATSAPP = '5531999994001';
const MSG = 'Oi Ju! Acabei de fazer meu pedido do Link na Bio PRO e queria te mandar mais algumas coisas.';

/**
 * Purchase no navegador com o MESMO eventID do CAPI (id da order da Pagar.me,
 * ver lib/bio-pro.ts) — a Meta deduplica. Trava contra disparo duplo ao
 * recarregar, igual ao /obrigado do Plano Capilar.
 */
export default function ObrigadoClient() {
  useEffect(() => {
    try {
      const raw = localStorage.getItem('bio_pro_purchase');
      if (!raw) return;
      const compra = JSON.parse(raw) as { orderId?: string; value?: number; ts?: number };
      if (!compra.orderId || (compra.ts && Date.now() - compra.ts > 6 * 3600_000)) return;
      const trava = `bio_pro_purchase_fired_${compra.orderId}`;
      if (localStorage.getItem(trava)) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fbq = (window as any).fbq;
      if (typeof fbq !== 'function') return;
      fbq('track', 'Purchase', { value: compra.value ?? 19.9, currency: 'BRL', content_name: 'Link na Bio PRO' }, { eventID: compra.orderId });
      localStorage.setItem(trava, '1');
    } catch { /* sem pixel não quebra a página */ }
  }, []);

  return (
    <a
      href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(MSG)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-7 inline-flex items-center justify-center gap-2 w-full rounded-2xl py-4 font-bold text-white active:scale-[0.98] transition"
      style={{ background: '#25D366' }}
    >
      Mandar fotos e links no WhatsApp
    </a>
  );
}
