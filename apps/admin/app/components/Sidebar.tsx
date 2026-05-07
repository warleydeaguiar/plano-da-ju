'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { icon: '📊', label: 'Dashboard', href: '/' },
  { icon: '🔍', label: 'Revisão de Planos', href: '/planos' },
  { icon: '👥', label: 'Usuárias', href: '/usuarios' },
  { icon: '💳', label: 'Assinaturas', href: '/assinaturas' },
  { icon: '💬', label: 'Grupos de Promoções', href: '/grupos' },
  { icon: '🎧', label: 'Suporte Plano Capilar', href: '/suporte' },
  { icon: '📈', label: 'Analytics', href: '/analytics' },
  { icon: '⚙️', label: 'Configurações', href: '/configuracoes' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside style={{
      width: 220, minWidth: 220, background: '#1C1C1E',
      display: 'flex', flexDirection: 'column', height: '100vh',
      position: 'fixed', left: 0, top: 0,
    }}>
      <div style={{ padding: '28px 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: -0.3 }}>Plano da Ju</div>
        <div style={{ fontSize: 11, fontWeight: 500, color: '#C4607A', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 2 }}>Admin</div>
      </div>

      <nav style={{ flex: 1, padding: '16px 0', overflowY: 'auto' }}>
        {NAV.map(item => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 20px', fontSize: 13.5, fontWeight: 500,
                color: isActive ? '#C4607A' : 'rgba(255,255,255,0.55)',
                background: isActive ? 'rgba(196,96,122,0.1)' : 'transparent',
                textDecoration: 'none', position: 'relative', transition: 'color 0.15s',
                borderLeft: isActive ? '3px solid #C4607A' : '3px solid transparent',
              }}
            >
              <span style={{ fontSize: 15, width: 18, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', background: '#C4607A',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>JC</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Juliane Cost</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', cursor: 'pointer' }}>Sair</div>
        </div>
      </div>
    </aside>
  );
}
