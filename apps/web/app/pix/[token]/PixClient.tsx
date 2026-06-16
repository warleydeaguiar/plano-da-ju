'use client';

import { useCallback, useEffect, useState } from 'react';

const T = {
  bg: '#FFFAF5', rose: '#FFE4EC', ink: '#3D2B2E', inkSoft: '#7A6A6D',
  border: '#F0E0E4', pink: '#FB7185', pinkDeep: '#BE185D',
  green: '#10B981', greenDeep: '#059669',
};

type Status = 'loading' | 'pending' | 'paid' | 'expired' | 'no_order' | 'error';
type Data = {
  status: Status;
  name?: string;
  qr_code?: string | null;
  qr_code_url?: string | null;
  expires_at?: string | null;
};

export default function PixClient({ token }: { token: string }) {
  const [data, setData] = useState<Data>({ status: 'loading' });
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/pix/status/${token}`, { cache: 'no-store' });
      const j = await res.json();
      setData(j?.status ? j : { status: 'error' });
    } catch {
      setData({ status: 'error' });
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Polling enquanto pendente — detecta o pagamento e troca pra tela de sucesso
  useEffect(() => {
    if (data.status !== 'pending') return;
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, [data.status, load]);

  const wrap = (children: React.ReactNode) => (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{
        minHeight: '100vh',
        background: `radial-gradient(circle at 30% 0%, ${T.rose}, transparent 50%), ${T.bg}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      }}>
        <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>{children}</div>
      </div>
    </>
  );

  const display = { fontFamily: '"Fraunces", Georgia, serif' } as const;

  if (data.status === 'loading') {
    return wrap(
      <div style={{
        width: 36, height: 36, borderRadius: '50%', margin: '0 auto',
        border: `3px solid ${T.pink}`, borderTopColor: 'transparent',
        animation: 'spin 0.9s linear infinite',
      }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>,
    );
  }

  if (data.status === 'paid') {
    return wrap(
      <>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', margin: '0 auto 20px',
          background: `linear-gradient(135deg, ${T.green}, ${T.greenDeep})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, color: '#fff', boxShadow: `0 12px 28px ${T.green}44`,
        }}>✓</div>
        <h1 style={{ ...display, fontSize: 26, fontWeight: 600, color: T.ink, marginBottom: 8 }}>
          Pagamento confirmado!
        </h1>
        <p style={{ color: T.inkSoft, fontSize: 15, marginBottom: 24 }}>
          {data.name ? `${data.name}, seu` : 'Seu'} acesso ao Plano da Ju já está liberado. 💛
        </p>
        <a href="/meu-plano" style={{
          display: 'inline-block', textDecoration: 'none',
          background: `linear-gradient(135deg, ${T.pink}, ${T.pinkDeep})`,
          color: '#fff', borderRadius: 14, padding: '16px 28px', fontSize: 15, fontWeight: 700,
          boxShadow: `0 8px 20px ${T.pink}44`,
        }}>Acessar meu plano</a>
      </>,
    );
  }

  if (data.status === 'pending' && data.qr_code) {
    return wrap(
      <>
        <h1 style={{ ...display, fontSize: 25, fontWeight: 600, color: T.ink, marginBottom: 6 }}>
          {data.name ? `${data.name}, falta` : 'Falta'} só o pagamento
        </h1>
        <p style={{ color: T.inkSoft, fontSize: 14, marginBottom: 22 }}>
          Escaneie o QR Code ou copie o código PIX abaixo pra liberar seu plano.
        </p>
        {data.qr_code_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.qr_code_url} alt="QR Code PIX" style={{
            width: 220, height: 220, borderRadius: 18, marginBottom: 22,
            border: '4px solid #fff', boxShadow: `0 16px 36px ${T.pinkDeep}1A`,
          }} />
        )}
        <div style={{
          background: 'rgba(255,255,255,0.85)', borderRadius: 18, padding: 16,
          marginBottom: 18, border: `1px solid ${T.border}`,
        }}>
          <p style={{ color: T.inkSoft, fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Código PIX (copia e cola)</p>
          <p style={{ color: T.ink, fontSize: 11, wordBreak: 'break-all', lineHeight: 1.6, fontFamily: 'ui-monospace, monospace', margin: 0 }}>
            {data.qr_code.slice(0, 90)}…
          </p>
        </div>
        <button
          onClick={() => { navigator.clipboard.writeText(data.qr_code ?? ''); setCopied(true); setTimeout(() => setCopied(false), 2500); }}
          style={{
            width: '100%',
            background: copied
              ? `linear-gradient(135deg, ${T.green}, ${T.greenDeep})`
              : `linear-gradient(135deg, ${T.pink}, ${T.pinkDeep})`,
            border: 'none', borderRadius: 14, padding: 18, fontSize: 15, fontWeight: 700,
            color: '#fff', cursor: 'pointer', marginBottom: 16,
            boxShadow: copied ? `0 8px 20px ${T.green}44` : `0 8px 20px ${T.pink}44`,
            transition: 'all 0.25s',
          }}
        >
          {copied ? '✓ Código copiado!' : '📋 Copiar código PIX'}
        </button>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          background: 'rgba(255,255,255,0.7)', borderRadius: 12, padding: '12px 16px',
          border: `1px solid ${T.border}`,
        }}>
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            border: `2px solid ${T.green}`, borderTopColor: 'transparent',
            animation: 'spin 0.9s linear infinite', flexShrink: 0,
          }} />
          <p style={{ color: T.inkSoft, fontSize: 13, margin: 0 }}>Aguardando a confirmação do pagamento…</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </>,
    );
  }

  // expired / no_order / error / pending-sem-qr
  return wrap(
    <>
      <h1 style={{ ...display, fontSize: 24, fontWeight: 600, color: T.ink, marginBottom: 10 }}>
        Este PIX não está mais disponível
      </h1>
      <p style={{ color: T.inkSoft, fontSize: 15, marginBottom: 24 }}>
        {data.status === 'expired'
          ? 'O código expirou. Gere um novo PIX pra concluir sua inscrição no Plano da Ju.'
          : 'Não conseguimos carregar este pagamento. Gere um novo PIX pra continuar.'}
      </p>
      <a href="/oferta" style={{
        display: 'inline-block', textDecoration: 'none',
        background: `linear-gradient(135deg, ${T.pink}, ${T.pinkDeep})`,
        color: '#fff', borderRadius: 14, padding: '16px 28px', fontSize: 15, fontWeight: 700,
        boxShadow: `0 8px 20px ${T.pink}44`,
      }}>Gerar novo PIX</a>
    </>,
  );
}
