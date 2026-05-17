'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';

const BG = '#F5EFF9';
const PINK = '#C4607A';
const MID = '#6B5370';
const BORDER = '#EDE6F2';
const CARD = '#FFFFFF';

const TABS = [
  { href: '/meu-plano',           icon: '🏠', label: 'Início'    },
  { href: '/meu-plano/agenda',    icon: '📅', label: 'Agenda'    },
  { href: '/meu-plano/plano',     icon: '📋', label: 'Plano'     },
  { href: '/meu-plano/progresso', icon: '📊', label: 'Progresso' },
  { href: '/meu-plano/loja',      icon: '🛍️', label: 'Loja'      },
];

const TITLES: Record<string, string> = {
  '/meu-plano':           'Início — Plano da Ju',
  '/meu-plano/agenda':    'Agenda — Plano da Ju',
  '/meu-plano/plano':     'Meu Plano — Plano da Ju',
  '/meu-plano/progresso': 'Progresso — Plano da Ju',
  '/meu-plano/loja':      'Produtos — Plano da Ju',
  '/meu-plano/check-in':  'Check-in — Plano da Ju',
};

const HIDE_NAV_ON = ['/meu-plano/check-in'];

export default function MeuPlanoLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login');
      else setReady(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Set per-route document title
  useEffect(() => {
    const t = TITLES[pathname];
    if (t) document.title = t;
  }, [pathname]);

  const hideNav = HIDE_NAV_ON.some(p => pathname.startsWith(p));

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${BORDER}`, borderTopColor: PINK, borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <div style={{ paddingBottom: hideNav ? 0 : 76 }}>
        {children}
      </div>

      {!hideNav && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderTop: `1px solid ${BORDER}`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}>
          <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex' }}>
            {TABS.map(tab => {
              const active = tab.href === '/meu-plano'
                ? pathname === '/meu-plano'
                : pathname.startsWith(tab.href);
              return (
                <Link key={tab.href} href={tab.href} style={{
                  flex: 1, padding: '10px 0 8px',
                  textDecoration: 'none', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                }}>
                  <span style={{ fontSize: 20, opacity: active ? 1 : 0.6 }}>{tab.icon}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: active ? PINK : MID }}>
                    {tab.label}
                  </span>
                  {active && <div style={{ width: 22, height: 2.5, background: PINK, borderRadius: 2 }} />}
                  {!active && <div style={{ height: 2.5 }} />}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
      <style jsx global>{`
        body { background: ${BG}; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}

// Avoid TS unused warning for CARD/MID in some lint configs
void [CARD, MID, BORDER, PINK];
