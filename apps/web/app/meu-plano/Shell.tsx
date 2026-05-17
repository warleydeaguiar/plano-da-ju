'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { T, fonts } from './theme';
import { IconHome, IconCalendar, IconList, IconChart, IconBag } from './icons';

const TABS = [
  { href: '/meu-plano',           Icon: IconHome,     label: 'Início'    },
  { href: '/meu-plano/agenda',    Icon: IconCalendar, label: 'Agenda'    },
  { href: '/meu-plano/plano',     Icon: IconList,     label: 'Plano'     },
  { href: '/meu-plano/progresso', Icon: IconChart,    label: 'Progresso' },
  { href: '/meu-plano/loja',      Icon: IconBag,      label: 'Loja'      },
];

const HIDE_NAV_ON = ['/meu-plano/check-in'];

export default function MeuPlanoShell({ children }: { children: React.ReactNode }) {
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

  const hideNav = HIDE_NAV_ON.some(p => pathname.startsWith(p));

  if (!ready) {
    return (
      <div style={{
        minHeight: '100vh', background: T.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16, fontFamily: fonts.ui,
      }}>
        <div style={{
          width: 40, height: 40,
          border: `3px solid ${T.pinkSoft}`,
          borderTopColor: T.pink,
          borderRadius: '50%',
          animation: 'spin 0.9s linear infinite',
        }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg,
      fontFamily: fonts.ui,
      color: T.ink,
    }}>
      <div style={{ paddingBottom: hideNav ? 0 : 78 }}>
        {children}
      </div>

      {!hideNav && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          background: 'rgba(255,250,245,0.92)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderTop: `1px solid ${T.border}`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}>
          <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex' }}>
            {TABS.map(tab => {
              const active = tab.href === '/meu-plano'
                ? pathname === '/meu-plano'
                : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  style={{
                    flex: 1, padding: '10px 0 6px',
                    textDecoration: 'none', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    position: 'relative',
                  }}
                >
                  <tab.Icon size={22} color={active ? T.pink : T.inkSoft} stroke={active ? 2 : 1.7} />
                  <span style={{
                    fontSize: 10.5,
                    fontWeight: active ? 700 : 500,
                    color: active ? T.pinkDeep : T.inkSoft,
                    letterSpacing: 0.2,
                  }}>
                    {tab.label}
                  </span>
                  <div style={{
                    height: 2.5, width: 20, borderRadius: 2,
                    background: active ? T.pink : 'transparent',
                  }} />
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      <style jsx global>{`
        body { background: ${T.bg}; font-family: ${fonts.ui}; color: ${T.ink}; }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        button { font-family: ${fonts.ui}; }
      `}</style>
    </div>
  );
}
