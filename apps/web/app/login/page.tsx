'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const T = {
  bg: '#FFFAF5', rose: '#FFE4EC', ink: '#3D2B2E', inkSoft: '#7A6A6D',
  border: '#F0E0E4', pink: '#FB7185', pinkDeep: '#BE185D', gold: '#C9A45C',
};
const display = '"Fraunces", Georgia, serif';
const ui = '"Plus Jakarta Sans", -apple-system, system-ui, sans-serif';

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [magicMsg, setMagicMsg] = useState('');
  const [magicBusy, setMagicBusy] = useState(false);

  async function sendMagicLink() {
    if (!email || !email.includes('@')) { setError('Coloque seu e-mail acima pra receber o link.'); return; }
    setError(''); setMagicBusy(true);
    try {
      await fetch('/api/auth/magic-link', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch { /* resposta é sempre genérica */ }
    setMagicMsg('Pronto! Se houver conta com esse e-mail, enviamos um link de acesso. Confira sua caixa de entrada 💛');
    setMagicBusy(false);
  }

  useEffect(() => {
    const q = searchParams.get('email');
    if (q) setEmail(decodeURIComponent(q).toLowerCase().trim());
  }, [searchParams]);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      router.push('/meu-plano');
    } catch (err) {
      setError(err instanceof Error && !/invalid login/i.test(err.message) ? err.message : 'E-mail ou senha incorretos');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '14px 16px', fontSize: 15,
    border: `1.5px solid ${T.border}`, borderRadius: 14, background: '#fff',
    color: T.ink, outline: 'none', boxSizing: 'border-box', fontFamily: ui,
  };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500;1,9..144,600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{
        minHeight: '100vh', background: `radial-gradient(circle at 50% 0%, ${T.rose}, transparent 55%), ${T.bg}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '24px 20px', fontFamily: ui,
      }}>
        <div style={{ maxWidth: 400, width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 30, fontWeight: 600, color: T.ink, fontFamily: display, letterSpacing: -0.5 }}>
              Plano da <em style={{ fontStyle: 'italic', color: T.pinkDeep }}>Ju</em>
            </div>
            <p style={{ fontSize: 14, color: T.inkSoft, margin: '6px 0 0' }}>Acesse o seu plano personalizado</p>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: 20, padding: 26, border: `1px solid ${T.border}`, boxShadow: `0 12px 32px ${T.pinkDeep}12` }}>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <input type="email" placeholder="Seu e-mail" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} required autoComplete="email" />
              <input type="password" placeholder="Sua senha" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} required autoComplete="current-password" />

              {error && (
                <p style={{ color: '#B91C1C', fontSize: 13, margin: 0, padding: '10px 14px', background: '#FEF2F2', borderRadius: 10 }}>{error}</p>
              )}

              <button type="submit" disabled={loading || !email || !password} style={{
                background: loading ? '#E8A6B6' : `linear-gradient(135deg, ${T.pink}, ${T.pinkDeep})`,
                border: 'none', borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 700, color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4, fontFamily: ui,
                boxShadow: loading ? 'none' : `0 8px 20px ${T.pink}44`,
              }}>
                {loading ? 'Entrando…' : 'Entrar no meu plano'}
              </button>
            </form>

            {/* Entrar sem senha — magic link no e-mail (self-service) */}
            <button type="button" onClick={sendMagicLink} disabled={magicBusy} style={{
              width: '100%', marginTop: 12, background: '#fff', border: `1.5px solid ${T.pink}`,
              borderRadius: 14, padding: 14, fontSize: 14.5, fontWeight: 700, color: T.pinkDeep,
              cursor: magicBusy ? 'default' : 'pointer', fontFamily: ui,
            }}>
              {magicBusy ? 'Enviando…' : '✨ Entrar sem senha — receber link no e-mail'}
            </button>
            {magicMsg && (
              <p style={{ fontSize: 13, color: '#0F7A4A', margin: '10px 0 0', padding: '10px 14px', background: '#ECFDF3', borderRadius: 10, lineHeight: 1.5 }}>{magicMsg}</p>
            )}

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <a href="/esqueci-senha" style={{ color: T.inkSoft, fontSize: 13, textDecoration: 'none', borderBottom: `1px solid ${T.border}`, paddingBottom: 1 }}>
                Esqueci minha senha
              </a>
            </div>
          </div>

          <div style={{ marginTop: 22, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: T.inkSoft, margin: '0 0 6px' }}>Ainda não tem acesso?</p>
            <a href="/quiz" style={{ color: T.pinkDeep, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
              Fazer o quiz e criar meu plano →
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: T.bg }} />}>
      <LoginInner />
    </Suspense>
  );
}
