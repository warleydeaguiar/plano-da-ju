'use client';

import { fonts } from './theme';
import { CANAL_IG } from '@/lib/contact';

/**
 * Convite para o canal de promoções da Juliane no Instagram.
 *
 * Complementa o grupo do WhatsApp em vez de competir com ele: o canal é
 * transmissão, não custa mensagem, não depende de janela de 24 h e — o que
 * mais importa hoje — não some se um número for bloqueado.
 */
export default function CanalInstagram({ compacto = false }: { compacto?: boolean }) {
  return (
    <a
      href={CANAL_IG}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none',
        background: 'linear-gradient(120deg,#F58529 0%,#DD2A7B 45%,#8134AF 100%)',
        borderRadius: 16, padding: compacto ? '12px 14px' : '14px 16px',
        boxShadow: '0 6px 16px rgba(221,42,123,0.28)',
      }}
    >
      <div style={{
        width: compacto ? 36 : 42, height: compacto ? 36 : 42, borderRadius: '50%', background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: compacto ? 18 : 21,
      }}>📣</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: compacto ? 14 : 15, fontFamily: fonts.ui }}>
          Canal de promoções no Instagram
        </div>
        <div style={{ color: 'rgba(255,255,255,0.92)', fontSize: 12.5, marginTop: 2, lineHeight: 1.35 }}>
          Entre no canal da Ju e receba os descontos em primeira mão ✨
        </div>
      </div>
      <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, flexShrink: 0 }}>→</div>
    </a>
  );
}
