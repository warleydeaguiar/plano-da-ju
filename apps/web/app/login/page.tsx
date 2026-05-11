'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const BG = '#F5EFF9';
const DARK = '#2D1B2E';
const PINK = '#C4607A';
const MID = '#6B5370';
const BORDER = '#EDE6F2';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      setError(err instanceof Error ? err.message : 'E-mail ou senha incorretos');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    fontSize: 15,
    border: `1.5px solid ${BORDER}`,
    borderRadius: 14,
    background: '#FFF',
    color: DARK,
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' }}>
      <div style={{ maxWidth: 400, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💇‍♀️</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: DARK, margin: '0 0 6px' }}>Plano da Ju</h1>
          <p style={{ fontSize: 14, color: MID, margin: 0 }}>Acesse seu plano personalizado</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input
            type="email"
            placeholder="Seu e-mail"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
            required
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Sua senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
            required
            autoComplete="current-password"
          />

          {error && (
            <p style={{ color: '#C0392B', fontSize: 13, margin: 0, padding: '10px 14px', background: '#FDE8EE', borderRadius: 10 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            style={{ background: loading ? '#D4A0AC' : PINK, border: 'none', borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 800, color: '#FFF', cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4 }}
          >
            {loading ? 'Entrando…' : 'Entrar no meu plano →'}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: MID, margin: '0 0 8px' }}>Ainda não tem acesso?</p>
          <a href="/quiz" style={{ color: PINK, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
            Fazer o quiz e criar meu plano →
          </a>
        </div>
      </div>
    </div>
  );
}
