'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const T = {
  bg: '#FFFAF5', rose: '#FFE4EC', ink: '#3D2B2E', inkSoft: '#7A6A6D',
  border: '#F0E0E4', pink: '#FB7185', pinkDeep: '#BE185D', green: '#10B981',
};
const display = '"Fraunces", Georgia, serif';
const ui = '"Plus Jakarta Sans", -apple-system, system-ui, sans-serif';

type Status = 'verifying' | 'ready' | 'invalid' | 'done';

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('verifying');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const verified = useRef(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  useEffect(() => {
    if (verified.current) return;
    verified.current = true;
    (async () => {
      try {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const tokenHash = hash.get('token_hash');
        const type = hash.get('type') || 'recovery';
        // Caso o link já traga uma sessão (#access_token), o supabase-ssr detecta sozinho.
        if (!tokenHash) {
          const { data } = await supabase.auth.getSession();
          setStatus(data.session ? 'ready' : 'invalid');
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: vErr } = await supabase.auth.verifyOtp({ type: type as any, token_hash: tokenHash });
        setStatus(vErr ? 'invalid' : 'ready');
      } catch {
        setStatus('invalid');
      }
    })();
  }, [supabase]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('A senha deve ter pelo menos 8 caracteres.'); return; }
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    setSaving(true);
    try {
      const { error: uErr } = await supabase.auth.updateUser({ password });
      if (uErr) throw uErr;
      setStatus('done');
      setTimeout(() => router.push('/meu-plano'), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a senha.');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '14px 16px', fontSize: 15, border: `1.5px solid ${T.border}`,
    borderRadius: 14, background: '#fff', color: T.ink, outline: 'none', boxSizing: 'border-box', fontFamily: ui,
  };

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500;1,9..144,600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{
        minHeight: '100vh', background: `radial-gradient(circle at 50% 0%, ${T.rose}, transparent 55%), ${T.bg}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', fontFamily: ui,
      }}>
        <div style={{ maxWidth: 400, width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 28, fontWeight: 600, color: T.ink, fontFamily: display, letterSpacing: -0.5 }}>
              Plano da <em style={{ fontStyle: 'italic', color: T.pinkDeep }}>Ju</em>
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: 20, padding: 26, border: `1px solid ${T.border}`, boxShadow: `0 12px 32px ${T.pinkDeep}12` }}>
            {children}
          </div>
        </div>
      </div>
    </>
  );

  if (status === 'verifying') {
    return <Shell><div style={{ textAlign: 'center', padding: '12px 0' }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', margin: '0 auto', border: `3px solid ${T.pink}`, borderTopColor: 'transparent', animation: 'spin .9s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <p style={{ fontSize: 13, color: T.inkSoft, marginTop: 14 }}>Validando o link…</p>
    </div></Shell>;
  }

  if (status === 'invalid') {
    return <Shell>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: T.ink, fontFamily: display, margin: '0 0 8px' }}>Link inválido ou expirado</h1>
      <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6, margin: '0 0 20px' }}>
        Este link de redefinição não é mais válido (eles expiram em 1 hora). Peça um novo para continuar.
      </p>
      <a href="/esqueci-senha" style={{ display: 'block', textAlign: 'center', background: `linear-gradient(135deg, ${T.pink}, ${T.pinkDeep})`, color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 15, padding: 15, borderRadius: 14 }}>Pedir novo link</a>
    </Shell>;
  }

  if (status === 'done') {
    return <Shell><div style={{ textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px', background: `linear-gradient(135deg, ${T.green}, #059669)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#fff' }}>✓</div>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: T.ink, fontFamily: display, margin: '0 0 8px' }}>Senha redefinida!</h1>
      <p style={{ fontSize: 14, color: T.inkSoft, margin: 0 }}>Entrando no seu plano…</p>
    </div></Shell>;
  }

  return <Shell>
    <h1 style={{ fontSize: 20, fontWeight: 600, color: T.ink, fontFamily: display, margin: '0 0 6px' }}>Criar nova senha</h1>
    <p style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.6, margin: '0 0 18px' }}>Escolha uma senha com pelo menos 8 caracteres.</p>
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <input type="password" placeholder="Nova senha" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} required autoComplete="new-password" />
      <input type="password" placeholder="Confirmar nova senha" value={confirm} onChange={e => setConfirm(e.target.value)} style={inputStyle} required autoComplete="new-password" />
      {error && <p style={{ color: '#B91C1C', fontSize: 13, margin: 0, padding: '10px 14px', background: '#FEF2F2', borderRadius: 10 }}>{error}</p>}
      <button type="submit" disabled={saving || !password || !confirm} style={{
        background: saving ? '#E8A6B6' : `linear-gradient(135deg, ${T.pink}, ${T.pinkDeep})`,
        border: 'none', borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 700, color: '#fff',
        cursor: saving ? 'not-allowed' : 'pointer', fontFamily: ui, boxShadow: saving ? 'none' : `0 8px 20px ${T.pink}44`,
      }}>{saving ? 'Salvando…' : 'Salvar nova senha'}</button>
    </form>
  </Shell>;
}
