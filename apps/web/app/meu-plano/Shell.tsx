'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { T, fonts } from './theme';
import { IconHome, IconCalendar, IconList, IconChart, IconSparkles } from './icons';
import InstallPrompt from './InstallPrompt';
import { previewCtx, previewHref } from './preview';

const TABS = [
  { href: '/meu-plano',           Icon: IconHome,     label: 'Início'    },
  { href: '/meu-plano/agenda',    Icon: IconCalendar, label: 'Agenda'    },
  { href: '/meu-plano/plano',     Icon: IconList,     label: 'Plano'     },
  { href: '/meu-plano/progresso', Icon: IconChart,    label: 'Progresso' },
  { href: '/meu-plano/promocoes', Icon: IconSparkles, label: 'Promoções' },
];

const HIDE_NAV_ON = ['/meu-plano/check-in', '/meu-plano/onboarding'];

// Rotas que não exigem foto enviada (onboarding, perfil pra ela poder consertar conta)
const ALLOWED_WITHOUT_PHOTO = ['/meu-plano/onboarding', '/meu-plano/perfil'];

export default function MeuPlanoShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const pv = previewCtx();  // modo "ver como cliente" (admin) — preserva na navegação

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  useEffect(() => {
    (async () => {
      // Modo PREVIEW do admin (?preview_user=&k=): não exige login nem foto —
      // a própria página carrega os dados via API service-role (read-only).
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
      if (params.get('preview_user') && params.get('k')) { setReady(true); return; }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      // Gate: se ainda não enviou foto → força onboarding
      // (exceto se já estiver na onboarding ou /perfil)
      const allowedHere = ALLOWED_WITHOUT_PHOTO.some(p => pathname.startsWith(p));
      if (!allowedHere) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: prof } = await (supabase.from('profiles') as any)
          .select('photo_url')
          .eq('id', session.user.id)
          .maybeSingle();
        if (!prof?.photo_url) {
          router.replace('/meu-plano/onboarding');
          return;
        }
      }

      setReady(true);
    })();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

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
                  href={previewHref(tab.href, pv)}
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

      {!hideNav && <InstallPrompt />}

      <style jsx global>{`
        body { background: ${T.bg}; font-family: ${fonts.ui}; color: ${T.ink}; }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        button { font-family: ${fonts.ui}; }
      `}</style>
    </div>
  );
}
