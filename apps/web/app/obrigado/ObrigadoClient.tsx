'use client';

import { useState, useEffect } from 'react';

const PINK = '#C4607A';
const BG = '#1C0020';
const CARD_BG = '#2A0A30';
const READY_MINUTES = 41;

type Step = 'set_password' | 'setting_password' | 'upload_photo' | 'generating' | 'countdown';

const inputStyle: React.CSSProperties = {
  background: '#1C0020',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 12,
  padding: '14px 16px',
  fontSize: 15,
  color: '#FFF',
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
};

const appBtnStyle: React.CSSProperties = {
  background: '#FFF',
  border: 'none',
  borderRadius: 14,
  padding: 16,
  fontSize: 14,
  fontWeight: 700,
  color: '#1C0020',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  width: '100%',
};

function LoadingScreen({ message }: { message: string }) {
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 }}>
      <div style={{ fontSize: 48, animation: 'spin 2s linear infinite' }}>✨</div>
      <p style={{ color: '#FFF', fontSize: 16, textAlign: 'center', lineHeight: 1.6, maxWidth: 300 }}>{message}</p>
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

  const [secondsLeft, setSecondsLeft] = useState(READY_MINUTES * 60);
  const [planReady, setPlanReady] = useState(false);

  const [step, setStep] = useState<Step>('set_password');
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('purchase_data');
    const ts = stored ? (JSON.parse(stored).purchasedAt ?? Date.now()) : Date.now();
    const data = stored ? JSON.parse(stored) : {};
    setEmail(data.email ?? '');
    setName(data.name ?? '');
    setPurchasedAt(ts);
    const elapsed = Math.floor((Date.now() - ts) / 1000);
    const remaining = Math.max(0, READY_MINUTES * 60 - elapsed);
    setSecondsLeft(remaining);
    if (remaining === 0) setPlanReady(true);

    // Pixel Meta — Purchase com Advanced Matching
    // Só dispara se purchase_data existe E nunca foi disparado antes para esse ts.
    // purchase_data só é gravado quando o pagamento é CONFIRMADO (card: após API retornar ok; pix: após polling confirmar).
    try {
      const purchaseFlagKey = `pixel_purchase_fired_${ts}`;
      if (
        typeof window !== 'undefined' &&
        (window as any).fbq &&
        stored &&
        !localStorage.getItem(purchaseFlagKey)
      ) {
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
          (window as any).fbq('init', '921783859786853', userData);
        }
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
    setError('');
    if (password.length < 8) { setError('A senha deve ter pelo menos 8 caracteres'); return; }
    if (password !== confirmPassword) { setError('As senhas não coincidem'); return; }
    setStep('setting_password');
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep('upload_photo');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao definir senha');
      setStep('set_password');
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleUploadPhoto() {
    if (!photoFile) return;
    setError('');
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
      setStep('countdown');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar foto');
      setStep('upload_photo');
    }
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  if (step === 'setting_password') return <LoadingScreen message="Criando sua conta…" />;
  if (step === 'generating') return <LoadingScreen message={'A Juliane está analisando seu cabelo e montando seu plano personalizado…\n\nIsso pode levar alguns minutinhos ✨'} />;

  // ── Step 1: Set password ──
  if (step === 'set_password') {
    return (
      <div style={{ minHeight: '100vh', background: BG, padding: '48px 24px 40px' }}>
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>🎉</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#FFF', marginBottom: 10, letterSpacing: -0.5 }}>
              Compra confirmada{name ? `, ${name.split(' ')[0]}` : ''}!
            </h1>
            <p style={{ fontSize: 14, color: '#8E8E93', lineHeight: 1.7 }}>
              Agora crie sua senha para acessar o app do Plano da Ju.
            </p>
          </div>

          <div style={{ background: CARD_BG, borderRadius: 20, padding: 24, marginBottom: 20 }}>
            <p style={{ color: '#8E8E93', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Seu e-mail de acesso</p>
            <p style={{ color: '#FFF', fontSize: 15, fontWeight: 600, marginBottom: 24 }}>{email}</p>

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

          {error && <p style={{ color: '#FF453A', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>{error}</p>}

          <button
            onClick={handleSetPassword}
            disabled={!password || !confirmPassword}
            style={{
              width: '100%', background: password && confirmPassword ? PINK : '#4A3050',
              border: 'none', borderRadius: 14, padding: 18, fontSize: 15, fontWeight: 800,
              color: '#FFF', cursor: password && confirmPassword ? 'pointer' : 'not-allowed',
            }}
          >
            Criar senha e continuar →
          </button>

          <p style={{ textAlign: 'center', color: '#48484A', fontSize: 11, marginTop: 16, lineHeight: 1.6 }}>
            Use essa senha para entrar no app Plano da Ju
          </p>
        </div>
      </div>
    );
  }

  // ── Step 2: Upload photo ──
  if (step === 'upload_photo') {
    return (
      <div style={{ minHeight: '100vh', background: BG, padding: '40px 24px' }}>
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 56, marginBottom: 14 }}>📸</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#FFF', marginBottom: 8, letterSpacing: -0.5 }}>
              Agora envie uma foto do seu cabelo
            </h1>
            <p style={{ fontSize: 13, color: '#8E8E93', lineHeight: 1.6 }}>
              A Juliane vai analisar sua foto e criar um plano 100% personalizado para você.
            </p>
          </div>

          <label htmlFor="photo-input" style={{ display: 'block', cursor: 'pointer', marginBottom: 12 }}>
            <div style={{
              background: CARD_BG, borderRadius: 20,
              border: `2px dashed ${photoPreview ? PINK : 'rgba(255,255,255,0.18)'}`,
              aspectRatio: '4/3', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative',
            }}>
              {photoPreview ? (
                <img src={photoPreview} alt="Prévia" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <>
                  <div style={{ fontSize: 52, marginBottom: 10 }}>📷</div>
                  <p style={{ color: '#FFF', fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>Toque para escolher foto</p>
                  <p style={{ color: '#8E8E93', fontSize: 12, margin: 0 }}>Câmera ou galeria</p>
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
              style={{ width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: 12, fontSize: 13, color: '#8E8E93', cursor: 'pointer', marginBottom: 12 }}
            >
              Trocar foto
            </button>
          )}

          {error && <p style={{ color: '#FF453A', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</p>}

          <button
            onClick={handleUploadPhoto}
            disabled={!photoFile}
            style={{
              width: '100%', background: photoFile ? PINK : '#3A2040',
              border: 'none', borderRadius: 14, padding: 18, fontSize: 15, fontWeight: 800,
              color: '#FFF', cursor: photoFile ? 'pointer' : 'not-allowed', marginBottom: 16,
            }}
          >
            ✨ Enviar para a Juliane analisar
          </button>

          <div style={{ background: CARD_BG, borderRadius: 14, padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
            <div style={{ fontSize: 12, color: '#8E8E93', lineHeight: 1.6 }}>
              <strong style={{ color: '#FFF' }}>Dica:</strong> foto com a cabeça inteira, boa iluminação e cabelo solto. Sem filtros!
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 3: Countdown ──
  return (
    <div style={{ minHeight: '100vh', background: BG, padding: '48px 24px 40px' }}>
      <div style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
        {planReady ? (
          <>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎊</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#FFF', marginBottom: 8, letterSpacing: -0.5 }}>
              Seu plano ficou pronto!
            </h1>
            <p style={{ color: '#8E8E93', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              Baixe o app para ver seu cronograma completo de 52 semanas.
            </p>

            {mensagemJuliane && (
              <div style={{ background: CARD_BG, borderRadius: 20, padding: 20, marginBottom: 16, border: '1px solid rgba(196,96,122,0.3)', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 26 }}>👩‍🦱</span>
                  <span style={{ color: PINK, fontSize: 13, fontWeight: 700 }}>Mensagem da Juliane</span>
                </div>
                <p style={{ color: '#FFF', fontSize: 14, lineHeight: 1.7, fontStyle: 'italic', margin: 0 }}>
                  &ldquo;{mensagemJuliane}&rdquo;
                </p>
              </div>
            )}

            {diagnostico && (
              <div style={{ background: CARD_BG, borderRadius: 20, padding: 20, marginBottom: 24, textAlign: 'left' }}>
                <p style={{ color: '#8E8E93', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Diagnóstico do seu cabelo
                </p>
                <p style={{ color: '#FFF', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{diagnostico}</p>
                {tipoCabelo && (
                  <div style={{ marginTop: 12, display: 'inline-block', background: 'rgba(196,96,122,0.2)', borderRadius: 10, padding: '4px 12px' }}>
                    <span style={{ color: PINK, fontSize: 13, fontWeight: 700 }}>Tipo: {tipoCabelo}</span>
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
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#FFF', marginBottom: 8, letterSpacing: -0.5 }}>
              Foto recebida!
            </h1>
            <p style={{ color: '#8E8E93', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
              A Juliane está analisando seu perfil e montando seu plano personalizado.
            </p>

            <div style={{ background: CARD_BG, borderRadius: 20, padding: '28px 20px', marginBottom: 28, border: '1px solid rgba(196,96,122,0.3)' }}>
              <div style={{ fontSize: 11, color: PINK, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                Seu plano estará pronto em
              </div>
              <div style={{ fontSize: 56, fontWeight: 800, fontFamily: 'monospace', color: '#FFF', letterSpacing: 6, marginBottom: 10 }}>
                {mm}:{ss}
              </div>
              <div style={{ fontSize: 12, color: '#8E8E93' }}>
                A Juliane está analisando seu perfil e foto
              </div>
            </div>

            <p style={{ color: '#8E8E93', fontSize: 13, marginBottom: 16 }}>
              Enquanto aguarda, baixe o app:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button style={appBtnStyle}><span style={{ fontSize: 20 }}>🍎</span> Baixar na App Store</button>
              <button style={appBtnStyle}><span style={{ fontSize: 20 }}>🤖</span> Baixar no Google Play</button>
            </div>

            <p style={{ color: '#48484A', fontSize: 11, marginTop: 24, lineHeight: 1.6 }}>
              Você também receberá um e-mail quando o plano estiver pronto.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
