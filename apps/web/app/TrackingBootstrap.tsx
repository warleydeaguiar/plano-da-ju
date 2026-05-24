'use client';

import { useEffect } from 'react';
import { captureIdentity } from '@/lib/tracking-client';

/**
 * Dispara a captura da identidade de tracking (fbp/fbc/UTMs/landing/referrer +
 * IP/UA/geo no servidor) no carregamento de qualquer página do funil. Sem UI.
 */
export default function TrackingBootstrap() {
  useEffect(() => {
    captureIdentity();
  }, []);
  return null;
}
