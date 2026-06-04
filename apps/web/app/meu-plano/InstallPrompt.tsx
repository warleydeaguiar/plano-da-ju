'use client';

import { useEffect, useState } from 'react';
import { T, fonts, gradient } from './theme';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BIPEvent = any;

const DISMISS_KEY = 'pwa_install_dismissed_at';
const DISMISS_DAYS = 14; // não insistir por 2 semanas após dispensar

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<'android-native' | 'ios' | 'android-manual' | null>(null);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return; // já instalado
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) || '0');
      if (at && Date.now() - at < DISMISS_DAYS * 86400000) return;
    } catch { /* noop */ }

    const ua = navigator.userAgent || '';
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isAndroid = /android/i.test(ua);

    // Android/Chrome: captura o prompt nativo
    const onBIP = (e: BIPEvent) => {
      e.preventDefault();
      setDeferred(e);
      setPlatform('android-native');
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onBIP);

    // Sem prompt nativo: mostra instruções depois de alguns segundos (não logo de cara)
    const t = setTimeout(() => {
      setShow(prev => {
        if (prev) return prev; // BIP já mostrou
        if (isIOS) { setPlatform('ios'); return true; }
        if (isAndroid) { setPlatform('android-manual'); return true; }
        return false; // desktop: não mostra
      });
    }, 6000);

    return () => { window.removeEventListener('beforeinstallprompt', onBIP); clearTimeout(t); };
  }, []);

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* noop */ }
    setShow(false);
  }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch { /* noop */ }
    setDeferred(null);
    setShow(false);
  }

  if (!show || !platform) return null;

  return (
    <div style={{
      position: 'fixed', left: 12, right: 12, zIndex: 200,
      bottom: 'calc(86px + env(safe-area-inset-bottom, 0px))',
      maxWidth: 456, margin: '0 auto',
      background: T.surface, borderRadius: 18,
      boxShadow: '0 12px 32px rgba(42,30,44,0.22)',
      border: `1px solid ${T.borderSoft}`,
      padding: 16, fontFamily: fonts.ui,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: gradient.heroSoft, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>📲</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>
            Tenha o Plano da Ju na tela inicial
          </div>
          <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 3, lineHeight: 1.45 }}>
            {platform === 'ios'
              ? <>Toque em <strong>Compartilhar</strong> <span style={{ fontSize: 14 }}>􀈂</span> (o quadradinho com a setinha ↑) e depois em <strong>“Adicionar à Tela de Início”</strong>.</>
              : platform === 'android-manual'
                ? <>Toque no menu <strong>⋮</strong> do navegador e depois em <strong>“Instalar app”</strong> / <strong>“Adicionar à tela inicial”</strong>.</>
                : <>Acesso rápido, sem precisar abrir o navegador. É grátis e ocupa quase nada.</>}
          </div>
        </div>
        <button onClick={dismiss} aria-label="Fechar" style={{
          background: 'transparent', border: 'none', color: T.inkMuted,
          fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: 2, flexShrink: 0,
        }}>×</button>
      </div>

      {platform === 'android-native' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={install} style={{
            flex: 1, padding: 12, borderRadius: 12, border: 'none',
            background: `linear-gradient(135deg, ${T.pink}, ${T.pinkDeep})`, color: '#fff',
            fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: fonts.ui,
            boxShadow: '0 6px 16px rgba(190,24,93,0.28)',
          }}>
            Instalar app
          </button>
          <button onClick={dismiss} style={{
            padding: '12px 16px', borderRadius: 12, border: `1px solid ${T.border}`,
            background: 'transparent', color: T.inkSoft, fontSize: 13, cursor: 'pointer', fontFamily: fonts.ui,
          }}>
            Agora não
          </button>
        </div>
      )}
    </div>
  );
}
