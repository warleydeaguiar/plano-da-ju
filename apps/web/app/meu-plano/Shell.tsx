'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { T, fonts } from './theme';
import { IconHome, IconCalendar, IconList, IconChart, IconSparkles, IconWhatsApp } from './icons';
import InstallPrompt from './InstallPrompt';
import { previewCtx, previewHref } from './preview';
import { juWhatsappLink } from '../../lib/contact';

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
  const [needsPhoto, setNeedsPhoto] = useState(false);
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

      // Sem foto ainda? Antes FORÇAVA o onboarding (a cliente caía direto na tela
      // de foto e, se desse erro, ficava sem acesso ao plano). Agora deixa entrar
      // no plano e mostra um aviso pra adicionar a foto — feedback do time.
      const allowedHere = ALLOWED_WITHOUT_PHOTO.some(p => pathname.startsWith(p));
      if (!allowedHere) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: prof } = await (supabase.from('profiles') as any)
          .select('photo_url')
          .eq('id', session.user.id)
          .maybeSingle();
        setNeedsPhoto(!prof?.photo_url);
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
      {/* Aviso não-bloqueante pra adicionar foto (no lugar de forçar o onboarding) */}
      {needsPhoto && !hideNav && (
        <Link href={previewHref('/meu-plano/onboarding', pv)} style={{ textDecoration: 'none', display: 'block' }}>
          <div style={{
            background: `linear-gradient(135deg, ${T.pink}, ${T.pinkDeep})`, color: '#fff',
            padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, fontFamily: fonts.ui,
          }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>📸</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Falta sua foto pro plano ficar completo</div>
              <div style={{ fontSize: 12, opacity: 0.92, lineHeight: 1.35 }}>A Juliane usa a foto do seu cabelo pra deixar seu plano ainda mais certeiro. É rapidinho 💗</div>
            </div>
            <span style={{ background: 'rgba(255,255,255,0.22)', borderRadius: 20, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>Enviar →</span>
          </div>
        </Link>
      )}

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

      {/* Botão flutuante do WhatsApp da Ju — em (quase) todas as páginas, pra
          fomentar a conversa da cliente com a Juliane. Some só no onboarding/
          check-in (nav escondida). Aparece também no "ver como cliente". */}
      {!hideNav && (
        <a href={juWhatsappLink()} target="_blank" rel="noopener noreferrer"
          aria-label="Falar com a Juliane no WhatsApp"
          style={{
            position: 'fixed', right: 16, zIndex: 99,
            bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#25D366', color: '#fff', textDecoration: 'none',
            padding: '11px 16px 11px 13px', borderRadius: 999,
            boxShadow: '0 6px 20px rgba(37,211,102,0.45)', fontWeight: 800, fontSize: 13.5,
          }}>
          <IconWhatsApp size={22} color="#fff" /> Falar com a Ju
        </a>
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
