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
  amount_cents?: number | null;
};

const brl = (cents: number) =>
  `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

  // Relógio de 1s: sem ele o contador só andaria quando o polling (6s)
  // redesenhasse a tela, e pareceria travado.
  const [, setTic] = useState(0);
  useEffect(() => {
    if (data.status !== 'pending') return;
    const id = setInterval(() => setTic(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [data.status]);

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
    const expiraEm = data.expires_at ? new Date(data.expires_at).getTime() : 0;
    const faltam = expiraEm ? Math.max(0, Math.floor((expiraEm - Date.now()) / 1000)) : 0;
    const mm = String(Math.floor(faltam / 60)).padStart(2, '0');
    const ss = String(faltam % 60).padStart(2, '0');
    const acabando = faltam > 0 && faltam <= 300;

    return wrap(
      <>
        {/* Quem chega por aqui veio de um link no WhatsApp: a foto da Juliane
            responde "estou pagando para quem?" antes do QR Code. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', overflow: 'hidden',
            border: '3px solid #fff', boxShadow: `0 8px 20px ${T.pinkDeep}22`, flexShrink: 0,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/juliane-consultorio.jpg"
              alt="Juliane Cost, tricologista"
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                objectPosition: '43% 20%', transform: 'scale(1.9)', transformOrigin: '43% 28%',
              }}
            />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, lineHeight: 1.2 }}>Juliane Cost</div>
            <div style={{ fontSize: 11.5, color: T.inkSoft }}>Tricologista · +3.500 alunas</div>
          </div>
        </div>

        <h1 style={{ ...display, fontSize: 25, fontWeight: 600, color: T.ink, marginBottom: 6 }}>
          {data.name ? `${data.name}, falta` : 'Falta'} só o pagamento
        </h1>
        <p style={{ color: T.inkSoft, fontSize: 14, marginBottom: 16 }}>
          Escaneie o QR Code ou copie o código PIX abaixo.
        </p>

        {/* Valor + acesso imediato */}
        <div style={{
          background: 'rgba(255,255,255,0.9)', border: `1px solid ${T.border}`,
          borderRadius: 16, padding: '14px 18px', marginBottom: 16,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {data.amount_cents ? (
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 13, color: T.inkSoft }}>Valor do seu plano</span>
              <strong style={{ ...display, fontSize: 24, color: T.pinkDeep, letterSpacing: -0.5 }}>
                {brl(data.amount_cents)}
              </strong>
            </div>
          ) : null}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, background: '#E7F8F0',
            borderRadius: 10, padding: '9px 12px',
          }}>
            <span style={{ fontSize: 15 }}>⚡</span>
            <span style={{ fontSize: 12.5, color: T.greenDeep, fontWeight: 700, textAlign: 'left', lineHeight: 1.35 }}>
              Acesso imediato: assim que o PIX cair, seu plano libera na hora — automático, sem enviar comprovante.
            </span>
          </div>
        </div>

        {data.qr_code_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.qr_code_url} alt="QR Code PIX" style={{
            width: 220, height: 220, borderRadius: 18, marginBottom: 20,
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
          border: `1px solid ${T.border}`, marginBottom: 10,
        }}>
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            border: `2px solid ${T.green}`, borderTopColor: 'transparent',
            animation: 'spin 0.9s linear infinite', flexShrink: 0,
          }} />
          <p style={{ color: T.inkSoft, fontSize: 13, margin: 0 }}>Confirmação automática — deixe esta tela aberta</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>

        {/* Contagem regressiva do código */}
        {expiraEm > 0 && (
          <div style={{
            background: acabando ? '#FEF3C7' : 'rgba(255,255,255,0.7)',
            border: `1px solid ${acabando ? '#FDE68A' : T.border}`,
            borderRadius: 12, padding: '12px 16px', marginBottom: 16,
          }}>
            <div style={{
              fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 800,
              color: acabando ? '#92400E' : T.inkSoft, marginBottom: 4,
            }}>
              {acabando ? 'Este código está acabando' : 'Este código vale por'}
            </div>
            <div style={{
              fontSize: 30, fontWeight: 800, lineHeight: 1, letterSpacing: 1,
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              color: acabando ? '#B45309' : T.ink,
            }}>{mm}:{ss}</div>
            <div style={{ fontSize: 11.5, color: acabando ? '#92400E' : T.inkSoft, marginTop: 5 }}>
              Depois disso é preciso gerar outro código.
            </div>
          </div>
        )}

        {/* Passo a passo */}
        <div style={{
          background: 'rgba(255,255,255,0.7)', border: `1px solid ${T.border}`,
          borderRadius: 12, padding: '14px 16px', textAlign: 'left',
        }}>
          {[
            'Abra o app do seu banco e escolha PIX',
            'Toque em "Ler QR Code" ou "PIX copia e cola"',
            'Confirme o pagamento — seu acesso libera sozinho aqui',
          ].map((passo, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: i === 2 ? 0 : 9 }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%', background: T.rose,
                color: T.pinkDeep, fontSize: 11, fontWeight: 800, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
              }}>{i + 1}</span>
              <span style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.45 }}>{passo}</span>
            </div>
          ))}
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
