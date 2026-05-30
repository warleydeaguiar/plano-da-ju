'use client';

import { useEffect } from 'react';
import { captureIdentity, newEventId, sendServerEvent } from '@/lib/tracking-client';

/**
 * Dispara a captura da identidade de tracking E o PageView (Pixel + CAPI com
 * o mesmo eventID → deduplicação). O PageView passou a sair daqui em vez do
 * fbq automático do layout pra fechar o gap "Servidor envia menos eventos que
 * o Pixel" apontado pelo Events Manager.
 */
export default function TrackingBootstrap() {
  useEffect(() => {
    captureIdentity();

    // PageView único — dispara no Pixel e espelha no CAPI com mesmo eventID
    // pra ROAS/EMQ funcionarem direito (a CAPI cobre quem tem ad-block/Safari).
    const pvEventId = newEventId();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fbq = (window as any).fbq;
      if (typeof fbq === 'function') {
        fbq('track', 'PageView', {}, { eventID: pvEventId });
      }
    } catch { /* ignore */ }

    sendServerEvent('PageView', { eventId: pvEventId });
  }, []);

  return null;
}
