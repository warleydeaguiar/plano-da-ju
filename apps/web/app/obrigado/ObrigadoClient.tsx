'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

// Paleta brand
const T = {
  bg:        '#FFFAF5',
  ink:       '#2A1E2C',
  inkSoft:   '#7C6B7E',
  inkMuted:  '#B5A6B7',
  pink:      '#EC4899',
  pinkDeep:  '#BE185D',
  pinkSoft:  '#FCE7F3',
  rose:      '#FFE4EA',
  cream:     '#FFF7EE',
  border:    'rgba(196,140,150,0.18)',
  cardBg:    'rgba(255,255,255,0.85)',
  red:       '#EF4444',
};
const fonts = {
  display: '"Fraunces", "Cormorant Garamond", Georgia, serif',
  ui:      '"Plus Jakarta Sans", "Inter", -apple-system, system-ui, sans-serif',
};

const pageBg = `
  radial-gradient(circle at 20% 0%, ${T.rose} 0%, transparent 45%),
  radial-gradient(circle at 80% 100%, ${T.cream} 0%, transparent 50%),
  ${T.bg}
`;

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.85)',
  backdropFilter: 'blur(12px)',
  border: `1.5px solid ${T.border}`,
  borderRadius: 14,
  padding: '14px 16px',
  fontSize: 15,
  color: T.ink,
  width: '100%',
  outline: 'none',
  fontFamily: fonts.ui,
  boxSizing: 'border-box',
};

const pinkBtnStyle: React.CSSProperties = {
  width: '100%',
  background: `linear-gradient(135deg, ${T.pink}, ${T.pinkDeep})`,
  border: 'none',
  borderRadius: 14,
  padding: 18,
  fontSize: 15,
  fontWeight: 800,
  color: '#FFF',
  cursor: 'pointer',
  fontFamily: fonts.ui,
};

function LoadingScreen({ message }: { message: string }) {
  return (
    <div style={{
      minHeight: '100vh', background: pageBg,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 20, padding: 24, fontFamily: fonts.ui,
    }}>
      <div style={{
        width: 64, height: 64, border: `4px solid ${T.pinkSoft}`,
        borderTopColor: T.pink, borderRadius: '50%', animation: 'spin 0.9s linear infinite',
      }} />
      <p style={{ color: T.ink, fontSize: 16, textAlign: 'center', lineHeight: 1.6, maxWidth: 320, fontFamily: fonts.display, fontWeight: 600 }}>{message}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// Loga evento do funil
async function logEvent(data: { event_type: string; email?: string; metadata?: Record<string, unknown> }) {
  if (typeof window === 'undefined') return;
  try {
    const sessionId = sessionStorage.getItem('checkout_session_id') ?? `cs_${Date.now()}_dummy`;
    await fetch('/api/checkout/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, ...data }),
    });
  } catch {}
}

type Step = 'set_password' | 'submitting' | 'logging_in' | 'need_email';

export default function ObrigadoClient() {
  const router = useRouter();
  const params = useSearchParams();
  const pixelFiredRef = useRef(false);

  const [email, setEmail]               = useState('');
  const [emailInput, setEmailInput]     = useState('');
  const [name, setName]                 = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep]                 = useState<Step>('set_password');
  const [error, setError]               = useState('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // ── Resolve email: query > localStorage > pede ao user ───────
  useEffect(() => {
    const queryEmail = params.get('email');
    let resolvedEmail = '';
    let resolvedName  = '';

    if (queryEmail) {
      resolvedEmail = decodeURIComponent(queryEmail).toLowerCase().trim();
    }

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('purchase_data');
      if (stored) {
        try {
          const data = JSON.parse(stored);
          if (!resolvedEmail && data.email) resolvedEmail = String(data.email).toLowerCase().trim();
          if (data.name) resolvedName = String(data.name);
        } catch {}
      }
    }

    if (resolvedEmail) {
      setEmail(resolvedEmail);
      setName(resolvedName);
    } else {
      // Cross-device fallback: cliente pagou no celular, abriu no desktop
      setStep('need_email');
    }

    // Meta Purchase Pixel — com Advanced Matching, dedup com server CAPI
    if (pixelFiredRef.current) return;
    pixelFiredRef.current = true;
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('purchase_data') : null;
      const data = stored ? JSON.parse(stored) : {};
      const ts = data.purchasedAt ?? Date.now();
      const purchaseFlagKey = `pixel_purchase_fired_${ts}`;
      if (
        typeof window !== 'undefined' &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).fbq &&
        !localStorage.getItem(purchaseFlagKey) &&
        resolvedEmail
      ) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let userData: any = null;
        try {
          const ans = JSON.parse(localStorage.getItem('quiz_answers') ?? '{}');
          const phoneDigits = (ans.phone ?? '').toString().replace(/\D/g, '');
          const phoneE164 = phoneDigits.length === 10 || phoneDigits.length === 11
            ? '55' + phoneDigits : phoneDigits;
          const fullName = (ans.name ?? resolvedName ?? '').toString().toLowerCase().trim().split(/\s+/);
          userData = {
            em: resolvedEmail,
            ph: phoneE164 || undefined,
            fn: fullName[0] || undefined,
            ln: fullName.slice(1).join(' ') || undefined,
            country: 'br',
          };
        } catch {}

        if (userData?.em) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).fbq('init', '921783859786853', userData);
        }
        // eventID dedupa com o CAPI server-side (que usa order_id)
        const eventId = data.orderId ?? data.order_id ?? `pdj_${ts}`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).fbq('track', 'Purchase', {
          content_name: 'Plano Capilar Personalizado',
          value: data.amount ?? 34.90,
          currency: 'BRL',
        }, { eventID: String(eventId) });
        localStorage.setItem(purchaseFlagKey, '1');
      }
    } catch {}
  }, [params]);

  // ── Submit: confirma email + cria senha + autologin + redirect ─
  async function handleSubmit() {
    setError('');
    const effectiveEmail = (email || emailInput).toLowerCase().trim();
    if (!effectiveEmail || !/^[^@]+@[^@]+\.[^@]+$/.test(effectiveEmail)) {
      setError('Informe um e-mail válido');
      return;
    }
    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    setStep('submitting');
    try {
      // 1) Cria/atualiza senha no Supabase Auth (via service role no server)
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: effectiveEmail, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao criar senha');

      await logEvent({ event_type: 'password_set', email: effectiveEmail });

      // 2) Autologin com a senha que ela acabou de criar
      setStep('logging_in');
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: effectiveEmail,
        password,
      });
      if (authError) {
        // Se autologin falhar (improvável), redireciona pro login com email
        router.push(`/login?email=${encodeURIComponent(effectiveEmail)}`);
        return;
      }

      // 3) Limpa localStorage de checkout (evita re-fire de pixel)
      try {
        localStorage.removeItem('purchase_data');
      } catch {}

      await logEvent({ event_type: 'autologin_success', email: effectiveEmail });

      // 4) Redireciona pro app — banner de foto aparece automaticamente lá
      router.push('/meu-plano');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
      setStep(email ? 'set_password' : 'need_email');
    }
  }

  // ── Render: loading screens ─────────────────────────────────
  if (step === 'submitting')  return <LoadingScreen message="Criando sua conta…" />;
  if (step === 'logging_in')  return <LoadingScreen message="Entrando no seu plano…" />;

  // ── Render: precisa do email (cross-device) ──────────────────
  if (step === 'need_email') {
    return (
      <div style={{ minHeight: '100vh', background: pageBg, padding: '48px 24px 40px', fontFamily: fonts.ui }}>
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>🎉</div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: T.ink, marginBottom: 10, letterSpacing: -0.5, fontFamily: fonts.display }}>
              Compra confirmada!
            </h1>
            <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.7 }}>
              Confirme o e-mail que você usou na compra e crie sua senha para acessar o app.
            </p>
          </div>

          <div style={{ background: T.cardBg, backdropFilter: 'blur(12px)', border: `1px solid ${T.border}`, borderRadius: 20, padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="email"
                placeholder="Seu e-mail da compra"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                style={inputStyle}
                autoComplete="email"
              />
              <input
                type="password"
                placeholder="Crie uma senha (mín. 8 caracteres)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={inputStyle}
                autoComplete="new-password"
              />
              <input
                type="password"
                placeholder="Confirme a senha"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                style={inputStyle}
                autoComplete="new-password"
              />
            </div>
          </div>

          {error && <p style={{ color: T.red, fontSize: 13, marginBottom: 16, textAlign: 'center', padding: '12px 16px', background: '#FEF2F2', borderRadius: 12 }}>{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={!emailInput || !password || !confirmPassword}
            style={{
              ...pinkBtnStyle,
              opacity: (!emailInput || !password || !confirmPassword) ? 0.5 : 1,
              cursor: (!emailInput || !password || !confirmPassword) ? 'not-allowed' : 'pointer',
            }}
          >
            Criar senha e acessar meu plano →
          </button>
        </div>
      </div>
    );
  }

  // ── Render: set password (tem email do localStorage/query) ───
  return (
    <div style={{ minHeight: '100vh', background: pageBg, padding: '48px 24px 40px', fontFamily: fonts.ui }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>🎉</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.ink, marginBottom: 10, letterSpacing: -0.5, fontFamily: fonts.display }}>
            Compra confirmada{name ? `, ${name.split(' ')[0]}` : ''}!
          </h1>
          <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.7 }}>
            Crie sua senha agora e já entre no seu plano personalizado.
          </p>
        </div>

        <div style={{ background: T.cardBg, backdropFilter: 'blur(12px)', border: `1px solid ${T.border}`, borderRadius: 20, padding: 24, marginBottom: 20 }}>
          <p style={{ color: T.inkSoft, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Seu e-mail de acesso</p>
          <p style={{ color: T.ink, fontSize: 15, fontWeight: 600, marginBottom: 24, wordBreak: 'break-all' }}>{email}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="password"
              placeholder="Crie uma senha (mín. 8 caracteres)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={inputStyle}
              autoComplete="new-password"
              autoFocus
            />
            <input
              type="password"
              placeholder="Confirme a senha"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              style={inputStyle}
              autoComplete="new-password"
            />
          </div>
        </div>

        {error && <p style={{ color: T.red, fontSize: 13, marginBottom: 16, textAlign: 'center', padding: '12px 16px', background: '#FEF2F2', borderRadius: 12 }}>{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!password || !confirmPassword}
          style={{
            ...pinkBtnStyle,
            opacity: (!password || !confirmPassword) ? 0.5 : 1,
            cursor: (!password || !confirmPassword) ? 'not-allowed' : 'pointer',
          }}
        >
          Criar senha e acessar meu plano →
        </button>

        <p style={{ textAlign: 'center', color: T.inkMuted, fontSize: 11, marginTop: 16, lineHeight: 1.6 }}>
          Use essa senha sempre que entrar no app Plano da Ju
        </p>
      </div>
    </div>
  );
}
