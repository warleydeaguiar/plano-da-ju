'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const T = {
  bg: '#FFFAF5', rose: '#FFE4EC', ink: '#3D2B2E', inkSoft: '#7A6A6D',
  border: '#F0E0E4', pink: '#FB7185', pinkDeep: '#BE185D',
};
const display = '"Fraunces", Georgia, serif';
const ui = '"Plus Jakarta Sans", -apple-system, system-ui, sans-serif';

// Login por MAGIC LINK: consome o token do link (#token_hash=...&type=magiclink),
// abre a sessão e manda direto pro plano — sem senha.
export default function EntrarPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'invalid'>('verifying');
  const done = useRef(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    (async () => {
      try {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const tokenHash = hash.get('token_hash');
        const type = hash.get('type') || 'magiclink';
        if (!tokenHash) {
          const { data } = await supabase.auth.getSession();
          if (data.session) { router.replace('/meu-plano'); return; }
          setStatus('invalid'); return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await supabase.auth.verifyOtp({ type: type as any, token_hash: tokenHash });
        if (error) { setStatus('invalid'); return; }
        router.replace('/meu-plano');
      } catch {
        setStatus('invalid');
      }
    })();
  }, [supabase, router]);

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{
        minHeight: '100vh', background: `radial-gradient(circle at 50% 0%, ${T.rose}, transparent 55%), ${T.bg}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', fontFamily: ui, textAlign: 'center',
      }}>
        <div style={{ fontSize: 28, fontWeight: 600, color: T.ink, fontFamily: display, marginBottom: 18 }}>
          Plano da <em style={{ fontStyle: 'italic', color: T.pinkDeep }}>Ju</em>
        </div>
        {status === 'verifying' ? (
          <>
            <div style={{ width: 44, height: 44, border: `3px solid ${T.border}`, borderTopColor: T.pinkDeep, borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 16 }} />
            <div style={{ fontSize: 15, color: T.inkSoft }}>Entrando…</div>
            <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
          </>
        ) : (
          <div style={{ maxWidth: 360 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: T.ink, fontFamily: display, marginBottom: 8 }}>Este link expirou</div>
            <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6, margin: '0 0 20px' }}>
              O link de acesso expira depois de um tempo ou já foi usado. Peça um novo pra entrar.
            </p>
            <a href="/esqueci-senha" style={{ display: 'inline-block', background: `linear-gradient(135deg, ${T.pink}, ${T.pinkDeep})`, color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 14, padding: '13px 22px', borderRadius: 14 }}>
              Receber novo link de acesso
            </a>
          </div>
        )}
      </div>
    </>
  );
}
