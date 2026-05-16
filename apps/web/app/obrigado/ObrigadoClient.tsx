'use client';

import { useState, useEffect } from 'react';

// Mesma paleta da Oferta — brand unificado
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
  green:     '#22C55E',
  greenDeep: '#16A34A',
  red:       '#EF4444',
  border:    'rgba(196,140,150,0.18)',
  cardBg:    'rgba(255,255,255,0.85)',
};
const fonts = {
  display: '"Fraunces", "Cormorant Garamond", Georgia, serif',
  ui:      '"Plus Jakarta Sans", "Inter", -apple-system, system-ui, sans-serif',
};

// Plano "pronto" em 3 minutos (antes era 41min — desonesto pois Claude gera em segundos)
const READY_SECONDS = 180;

type Step = 'set_password' | 'setting_password' | 'upload_photo' | 'generating' | 'countdown';

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

const appBtnStyle: React.CSSProperties = {
  background: T.cardBg,
  backdropFilter: 'blur(12px)',
  border: `1.5px solid ${T.border}`,
  borderRadius: 14,
  padding: 16,
  fontSize: 14,
  fontWeight: 700,
  color: T.ink,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  width: '100%',
  fontFamily: fonts.ui,
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

const pageBg = `
  radial-gradient(circle at 20% 0%, ${T.rose} 0%, transparent 45%),
  radial-gradient(circle at 80% 100%, ${T.cream} 0%, transparent 50%),
  ${T.bg}
`;

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

async function compressImage(file: File, maxPx = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve(dataUrl.split(',')[1]);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// Loga evento do funil (mesmo helper da Oferta)
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

export default function ObrigadoClient() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [purchasedAt, setPurchasedAt] = useState(0);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');

  const [diagnostico, setDiagnostico] = useState('');
  const [mensagemJuliane, setMensagemJuliane] = useState('');
  const [tipoCabelo, setTipoCabelo] = useState('');

  const [secondsLeft, setSecondsLeft] = useState(READY_SECONDS);
  const [planReady, setPlanReady] = useState(false);

  const [step, setStep] = useState<Step>('set_password');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('purchase_data');
    const ts = stored ? (JSON.parse(stored).purchasedAt ?? Date.now()) : Date.now();
    const data = stored ? JSON.parse(stored) : {};
    setEmail(data.email ?? '');
    setName(data.name ?? '');
    setPurchasedAt(ts);
    const elapsed = Math.floor((Date.now() - ts) / 1000);
    const remaining = Math.max(0, READY_SECONDS - elapsed);
    setSecondsLeft(remaining);
    if (remaining === 0) setPlanReady(true);

    // Pixel Meta — Purchase com Advanced Matching
    // Só dispara se purchase_data existe E nunca foi disparado antes para esse ts.
    try {
      const purchaseFlagKey = `pixel_purchase_fired_${ts}`;
      if (
        typeof window !== 'undefined' &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).fbq &&
        stored &&
        !localStorage.getItem(purchaseFlagKey)
      ) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let userData: any = null;
        try {
          const ans = JSON.parse(localStorage.getItem('quiz_answers') ?? '{}');
          const em = (ans.email ?? data.email ?? '').toString().toLowerCase().trim();
          const phoneDigits = (ans.phone ?? '').toString().replace(/\D/g, '');
          const phoneE164 = phoneDigits.length === 10 || phoneDigits.length === 11 ? '55' + phoneDigits : phoneDigits;
          const fullName = (ans.name ?? data.name ?? '').toString().toLowerCase().trim().split(/\s+/);
          userData = {
            em: em || undefined,
            ph: phoneE164 || undefined,
            fn: fullName[0] || undefined,
            ln: fullName.slice(1).join(' ') || undefined,
            country: 'br',
          };
        } catch {}

        if (userData?.em || userData?.ph) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).fbq('init', '921783859786853', userData);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).fbq('track', 'Purchase', {
          content_name: 'Plano Capilar Personalizado',
          value: 34.90,
          currency: 'BRL',
        });
        localStorage.setItem(purchaseFlagKey, '1');
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (step !== 'countdown' || planReady) return;
    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) { setPlanReady(true); clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step, planReady]);

  async function handleSetPassword() {
    if (submitting) return;
    setError('');
    if (password.length < 8) { setError('A senha deve ter pelo menos 8 caracteres'); return; }
    if (password !== confirmPassword) { setError('As senhas não coincidem'); return; }
    setSubmitting(true);
    setStep('setting_password');
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await logEvent({ event_type: 'password_set', email });
      setStep('upload_photo');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao definir senha');
      setStep('set_password');
    } finally {
      setSubmitting(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleUploadPhoto() {
    if (!photoFile || submitting) return;
    setError('');
    setSubmitting(true);
    setStep('generating');
    try {
      const base64 = await compressImage(photoFile, 1024);
      const res = await fetch('/api/plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, photo_base64: base64, photo_mime_type: 'image/jpeg' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDiagnostico(data.diagnostico ?? '');
      setMensagemJuliane(data.mensagem_juliane ?? '');
      setTipoCabelo(data.tipo_cabelo ?? '');
      await logEvent({ event_type: 'photo_uploaded', email });
      setStep('countdown');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar foto');
      setStep('upload_photo');
    } finally {
      setSubmitting(false);
    }
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  if (step === 'setting_password') return <LoadingScreen message="Criando sua conta…" />;
  if (step === 'generating') return <LoadingScreen message={'A Juliane está analisando seu cabelo e montando seu plano personalizado…'} />;

  // ── Step 1: Set password ──
  if (step === 'set_password') {
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
              Agora crie sua senha para acessar o app do Plano da Ju.
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
              />
              <input
                type="password"
                placeholder="Confirme a senha"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSetPassword()}
                style={inputStyle}
                autoComplete="new-password"
              />
            </div>
          </div>

          {error && <p style={{ color: T.red, fontSize: 13, marginBottom: 16, textAlign: 'center', padding: '12px 16px', background: '#FEF2F2', borderRadius: 12 }}>{error}</p>}

          <button
            onClick={handleSetPassword}
            disabled={submitting || !password || !confirmPassword}
            style={{
              ...pinkBtnStyle,
              opacity: submitting || !password || !confirmPassword ? 0.5 : 1,
              cursor: submitting || !password || !confirmPassword ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? '⏳ Criando…' : 'Criar senha e continuar →'}
          </button>

          <p style={{ textAlign: 'center', color: T.inkMuted, fontSize: 11, marginTop: 16, lineHeight: 1.6 }}>
            Use essa senha para entrar no app Plano da Ju
          </p>
        </div>
      </div>
    );
  }

  // ── Step 2: Upload photo ──
  if (step === 'upload_photo') {
    return (
      <div style={{ minHeight: '100vh', background: pageBg, padding: '40px 24px', fontFamily: fonts.ui }}>
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 56, marginBottom: 14 }}>📸</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: T.ink, marginBottom: 8, letterSpacing: -0.5, fontFamily: fonts.display }}>
              Agora envie uma foto do seu cabelo
            </h1>
            <p style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.6 }}>
              A Juliane vai analisar sua foto e criar um plano 100% personalizado para você.
            </p>
          </div>

          <label htmlFor="photo-input" style={{ display: 'block', cursor: 'pointer', marginBottom: 12 }}>
            <div style={{
              background: T.cardBg, backdropFilter: 'blur(12px)', borderRadius: 20,
              border: `2px dashed ${photoPreview ? T.pink : T.border}`,
              aspectRatio: '4/3', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative',
            }}>
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="Prévia" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <>
                  <div style={{ fontSize: 52, marginBottom: 10 }}>📷</div>
                  <p style={{ color: T.ink, fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>Toque para escolher foto</p>
                  <p style={{ color: T.inkSoft, fontSize: 12, margin: 0 }}>Câmera ou galeria</p>
                </>
              )}
            </div>
          </label>
          <input
            id="photo-input"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          {photoPreview && (
            <button
              onClick={() => { setPhotoFile(null); setPhotoPreview(''); }}
              style={{ width: '100%', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, fontSize: 13, color: T.inkSoft, cursor: 'pointer', marginBottom: 12 }}
            >
              Trocar foto
            </button>
          )}

          {error && <p style={{ color: T.red, fontSize: 13, marginBottom: 12, textAlign: 'center', padding: '12px 16px', background: '#FEF2F2', borderRadius: 12 }}>{error}</p>}

          <button
            onClick={handleUploadPhoto}
            disabled={!photoFile || submitting}
            style={{
              ...pinkBtnStyle,
              marginBottom: 16,
              opacity: !photoFile || submitting ? 0.5 : 1,
              cursor: !photoFile || submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? '⏳ Enviando…' : '✨ Enviar para a Juliane analisar'}
          </button>

          <div style={{ background: T.cardBg, backdropFilter: 'blur(12px)', border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
            <div style={{ fontSize: 12, color: T.inkSoft, lineHeight: 1.6 }}>
              <strong style={{ color: T.ink }}>Dica:</strong> foto com a cabeça inteira, boa iluminação e cabelo solto. Sem filtros!
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 3: Countdown / plano pronto ──
  return (
    <div style={{ minHeight: '100vh', background: pageBg, padding: '48px 24px 40px', fontFamily: fonts.ui }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
        {planReady ? (
          <>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎊</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, marginBottom: 8, letterSpacing: -0.5, fontFamily: fonts.display }}>
              Seu plano ficou pronto!
            </h1>
            <p style={{ color: T.inkSoft, fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              Baixe o app para ver seu cronograma completo de 52 semanas.
            </p>

            {mensagemJuliane && (
              <div style={{ background: T.cardBg, backdropFilter: 'blur(12px)', borderRadius: 20, padding: 20, marginBottom: 16, border: `1px solid ${T.pinkSoft}`, textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 26 }}>👩‍🦱</span>
                  <span style={{ color: T.pinkDeep, fontSize: 13, fontWeight: 700 }}>Mensagem da Juliane</span>
                </div>
                <p style={{ color: T.ink, fontSize: 14, lineHeight: 1.7, fontStyle: 'italic', margin: 0 }}>
                  &ldquo;{mensagemJuliane}&rdquo;
                </p>
              </div>
            )}

            {diagnostico && (
              <div style={{ background: T.cardBg, backdropFilter: 'blur(12px)', borderRadius: 20, padding: 20, marginBottom: 24, border: `1px solid ${T.border}`, textAlign: 'left' }}>
                <p style={{ color: T.inkSoft, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Diagnóstico do seu cabelo
                </p>
                <p style={{ color: T.ink, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{diagnostico}</p>
                {tipoCabelo && (
                  <div style={{ marginTop: 12, display: 'inline-block', background: T.pinkSoft, borderRadius: 10, padding: '4px 12px' }}>
                    <span style={{ color: T.pinkDeep, fontSize: 13, fontWeight: 700 }}>Tipo: {tipoCabelo}</span>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button style={appBtnStyle}><span style={{ fontSize: 20 }}>🍎</span> Baixar na App Store</button>
              <button style={appBtnStyle}><span style={{ fontSize: 20 }}>🤖</span> Baixar no Google Play</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 56, marginBottom: 16 }}>⏳</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: T.ink, marginBottom: 8, letterSpacing: -0.5, fontFamily: fonts.display }}>
              Foto recebida!
            </h1>
            <p style={{ color: T.inkSoft, fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
              A Juliane está analisando seu perfil e montando seu plano personalizado.
            </p>

            <div style={{ background: T.cardBg, backdropFilter: 'blur(12px)', borderRadius: 20, padding: '28px 20px', marginBottom: 28, border: `1px solid ${T.pinkSoft}` }}>
              <div style={{ fontSize: 11, color: T.pinkDeep, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, fontWeight: 700 }}>
                Seu plano estará pronto em
              </div>
              <div style={{ fontSize: 56, fontWeight: 800, fontFamily: 'ui-monospace, monospace', color: T.ink, letterSpacing: 6, marginBottom: 10 }}>
                {mm}:{ss}
              </div>
              <div style={{ fontSize: 12, color: T.inkSoft }}>
                A Juliane está analisando seu perfil e foto
              </div>
            </div>

            <p style={{ color: T.inkSoft, fontSize: 13, marginBottom: 16 }}>
              Enquanto aguarda, baixe o app:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button style={appBtnStyle}><span style={{ fontSize: 20 }}>🍎</span> Baixar na App Store</button>
              <button style={appBtnStyle}><span style={{ fontSize: 20 }}>🤖</span> Baixar no Google Play</button>
            </div>

            <p style={{ color: T.inkMuted, fontSize: 11, marginTop: 24, lineHeight: 1.6 }}>
              Você também receberá um e-mail quando o plano estiver pronto.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
