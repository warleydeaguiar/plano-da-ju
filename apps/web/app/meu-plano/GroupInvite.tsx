'use client';

import { T, fonts } from './theme';
import { IconWhatsApp } from './icons';

// Convite pro grupo VIP de promoções no WhatsApp + prova social/meta.
// Usado na página de Promoções e na aba "Produtos" do plano.
export const GROUP_URL = 'https://planodaju.julianecost.com/g/entrar';
export const GROUP_MEMBERS = 23673;
export const GROUP_GOAL = 25000;

export default function GroupInvite() {
  const pct = Math.min(100, Math.round((GROUP_MEMBERS / GROUP_GOAL) * 100));
  return (
    <a
      href={GROUP_URL}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', flexDirection: 'column', gap: 11, textDecoration: 'none',
        background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
        borderRadius: 16, padding: '14px 16px',
        boxShadow: '0 6px 16px rgba(18,140,126,0.28)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: '50%', background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}><IconWhatsApp size={28} color="#25D366" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, fontFamily: fonts.ui }}>
            Grupo VIP de promoções
          </div>
          <div style={{ color: 'rgba(255,255,255,0.92)', fontSize: 12.5, marginTop: 2, lineHeight: 1.35 }}>
            Descontos exclusivos no WhatsApp — você recebe primeiro 💚
          </div>
        </div>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, flexShrink: 0 }}>→</div>
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
          <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>
            {GROUP_MEMBERS.toLocaleString('pt-BR')} pessoas no grupo
          </span>
          <span style={{ color: 'rgba(255,255,255,0.92)', fontSize: 11.5, fontWeight: 600 }}>
            meta {Math.round(GROUP_GOAL / 1000)} mil
          </span>
        </div>
        <div style={{ height: 7, borderRadius: 99, background: 'rgba(255,255,255,0.28)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: '#fff' }} />
        </div>
        <div style={{ color: 'rgba(255,255,255,0.96)', fontSize: 11.5, marginTop: 6, lineHeight: 1.4 }}>
          Falta pouco pra bater a meta — entra e faz parte! 💚
        </div>
      </div>
    </a>
  );
}
