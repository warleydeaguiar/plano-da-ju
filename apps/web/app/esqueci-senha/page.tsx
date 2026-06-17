'use client';

import { useState } from 'react';

const T = {
  bg: '#FFFAF5', rose: '#FFE4EC', ink: '#3D2B2E', inkSoft: '#7A6A6D',
  border: '#F0E0E4', pink: '#FB7185', pinkDeep: '#BE185D', green: '#10B981',
};
const display = '"Fraunces", Georgia, serif';
const ui = '"Plus Jakarta Sans", -apple-system, system-ui, sans-serif';

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/auth/request-reset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch { /* resposta é sempre genérica de qualquer forma */ }
    setSent(true);
    setLoading(false);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '14px 16px', fontSize: 15, border: `1.5px solid ${T.border}`,
    borderRadius: 14, background: '#fff', color: T.ink, outline: 'none', boxSizing: 'border-box', fontFamily: ui,
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
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 28, fontWeight: 600, color: T.ink, fontFamily: display, letterSpacing: -0.5 }}>
              Plano da <em style={{ fontStyle: 'italic', color: T.pinkDeep }}>Ju</em>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: 20, padding: 26, border: `1px solid ${T.border}`, boxShadow: `0 12px 32px ${T.pinkDeep}12` }}>
            {sent ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px', background: `linear-gradient(135deg, ${T.green}, #059669)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#fff' }}>✓</div>
                <h1 style={{ fontSize: 20, fontWeight: 600, color: T.ink, fontFamily: display, margin: '0 0 8px' }}>Verifique seu e-mail</h1>
                <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6, margin: 0 }}>
                  Se houver uma conta com esse e-mail, enviamos um link para você redefinir a senha. O link expira em 1 hora.
                </p>
                <a href="/login" style={{ display: 'inline-block', marginTop: 22, color: T.pinkDeep, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>← Voltar para o login</a>
              </div>
            ) : (
              <>
                <h1 style={{ fontSize: 20, fontWeight: 600, color: T.ink, fontFamily: display, margin: '0 0 6px' }}>Esqueceu a senha?</h1>
                <p style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.6, margin: '0 0 18px' }}>
                  Sem problema. Coloque o e-mail da sua conta e a gente envia um link para você criar uma nova senha.
                </p>
                <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                  <input type="email" placeholder="Seu e-mail" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} required autoComplete="email" />
                  <button type="submit" disabled={loading || !email} style={{
                    background: loading ? '#E8A6B6' : `linear-gradient(135deg, ${T.pink}, ${T.pinkDeep})`,
                    border: 'none', borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 700, color: '#fff',
                    cursor: loading ? 'not-allowed' : 'pointer', fontFamily: ui,
                    boxShadow: loading ? 'none' : `0 8px 20px ${T.pink}44`,
                  }}>{loading ? 'Enviando…' : 'Enviar link de redefinição'}</button>
                </form>
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <a href="/login" style={{ color: T.inkSoft, fontSize: 13, textDecoration: 'none' }}>← Voltar para o login</a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
