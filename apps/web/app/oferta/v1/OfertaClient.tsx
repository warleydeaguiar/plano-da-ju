'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

// ─── Design tokens ───────────────────────────────────────────
const T = {
  bg: '#FFFFFF',
  ink: '#0E0E0E',
  inkSoft: '#6B7280',
  inkMid: '#374151',
  border: '#E5E7EB',
  pink: '#EC4899',
  pinkDeep: '#DB2777',
  pinkSoft: '#FCE7F3',
  pinkBg: '#FDF2F8',
  green: '#22C55E',
  greenDeep: '#16A34A',
  red: '#EF4444',
  yellow: '#FACC15',
  shadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)',
};
const fontUi = '"Plus Jakarta Sans", "Inter", -apple-system, system-ui, sans-serif';

type Step = 'offer' | 'card_form' | 'pix_qr' | 'loading';

const LOADING_MESSAGES = [
  'Conectando com o servidor…',
  'Verificando seus dados…',
  'Gerando o QR Code PIX…',
  'Quase pronto!',
];

// ─── Helpers de formatação ───────────────────────────────────
function formatCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
function formatCard(v: string) {
  return v.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19);
}
function formatExpiry(v: string) {
  return v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2').slice(0, 5);
}
function formatCep(v: string) {
  return v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
}

// ─── Hook countdown ──────────────────────────────────────────
function useCountdown(initialSeconds: number) {
  const [s, setS] = useState(initialSeconds);
  useEffect(() => {
    if (s <= 0) return;
    const id = setInterval(() => setS(v => Math.max(0, v - 1)), 1000);
    return () => clearInterval(id);
  }, [s]);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

// ─── Componentes auxiliares ──────────────────────────────────
function StatBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.inkSoft, marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color: T.ink }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99 }} />
      </div>
    </div>
  );
}

function CompareCard({ side, name, stats }: {
  side: 'antes' | 'depois';
  name: string;
  stats: { label: string; pct: number }[];
}) {
  const isAfter = side === 'depois';
  return (
    <div style={{
      background: '#fff', border: `1px solid ${T.border}`, borderRadius: 14,
      padding: '14px 14px', boxShadow: T.shadow,
    }}>
      <div style={{
        fontSize: 12, fontWeight: 800, color: isAfter ? T.green : T.red,
        marginBottom: 8, letterSpacing: 0.4,
      }}>
        {isAfter ? 'Depois' : 'Antes'}
      </div>
      <div style={{ fontSize: 13, color: T.ink, fontWeight: 700, marginBottom: 10 }}>
        {name}
      </div>
      {stats.map((s, i) => (
        <StatBar key={i} label={s.label} pct={s.pct} color={isAfter ? T.green : '#FB7185'} />
      ))}
    </div>
  );
}

function GreenButton({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', background: disabled ? '#A7F3D0' : T.green,
        color: '#fff', border: 'none', borderRadius: 12, padding: '18px',
        fontSize: 16, fontWeight: 700, fontFamily: fontUi,
        cursor: disabled ? 'default' : 'pointer',
        boxShadow: disabled ? 'none' : '0 4px 12px rgba(34,197,94,0.3)',
        letterSpacing: 0.4,
      }}
    >{children}</button>
  );
}

function PinkBanner({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: T.pink, color: '#fff', padding: '10px 16px',
      borderRadius: 10, textAlign: 'center', fontSize: 14, fontWeight: 700,
      marginBottom: 0,
    }}>{children}</div>
  );
}

function CheckItem({ children, color = T.green }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
      <div style={{ flexShrink: 0, marginTop: 1 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
      <div style={{ flex: 1, fontSize: 14, color: T.ink, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

function CrossItem({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
      <div style={{ flexShrink: 0, marginTop: 1 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </div>
      <div style={{ flex: 1, fontSize: 14, color: T.ink, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

// ─── Card de oferta (usado 2x na página) ─────────────────────
function OfferCard({ countdown, name, onBuy }: { countdown: string; name: string; onBuy: () => void }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        background: T.pink, color: '#fff', padding: '8px 14px',
        textAlign: 'center', fontSize: 13, fontWeight: 700,
        borderTopLeftRadius: 12, borderTopRightRadius: 12,
      }}>
        Seu desconto está reservado por: {countdown}
      </div>
      <div style={{
        background: T.pinkDeep, color: '#fff', padding: '6px 14px',
        textAlign: 'center', fontSize: 12, fontWeight: 600,
        letterSpacing: 0.5,
      }}>
        Oferta de Black Friday
      </div>
      <div style={{
        background: '#fff', border: `1px solid ${T.border}`, borderTop: 'none',
        borderBottomLeftRadius: 12, borderBottomRightRadius: 12, padding: '20px 18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.ink, lineHeight: 1.25 }}>
              Plano Capilar Personalizado para {name || 'você'}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: T.inkSoft, textDecoration: 'line-through' }}>R$ 59,90</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.pinkDeep, lineHeight: 1 }}>R$ 34,9</div>
            <div style={{ fontSize: 9, color: T.inkSoft, marginTop: 2 }}>pagamento único</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: T.inkSoft, textAlign: 'center', marginBottom: 12 }}>
          Pagamento único no Pix ou Cartão de Crédito
        </div>
        <GreenButton onClick={onBuy}>COMPRAR AGORA</GreenButton>
      </div>
    </div>
  );
}

// ╔═══════════════════════════════════════════════════════════╗
// ║                Main component                             ║
// ╚═══════════════════════════════════════════════════════════╝
export default function OfertaClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('offer');
  const [error, setError] = useState('');
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, unknown>>({});

  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cpf, setCpf] = useState('');
  const [cep, setCep] = useState('');

  const [pixQrCode, setPixQrCode] = useState('');
  const [pixQrCodeUrl, setPixQrCodeUrl] = useState('');
  const [pixCopied, setPixCopied] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [payType, setPayType] = useState<'card' | 'pix'>('card');
  const [images, setImages] = useState<Record<string, string>>({});

  const countdown = useCountdown(597);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('quiz_answers');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setQuizAnswers(parsed);
          if (parsed.name) setName(parsed.name);
          if (parsed.email) setEmail(parsed.email);
        } catch {}
      }
    }
    // Carrega imagens dinâmicas (editáveis no admin)
    fetch('/api/quiz/images')
      .then(r => r.json())
      .then((data: Record<string, string>) => {
        if (data && typeof data === 'object') setImages(data);
      })
      .catch(() => {});
  }, []);

  const isCardComplete = useMemo(() => (
    cardNumber.replace(/\s/g, '').length >= 13 &&
    cardName.trim().length >= 3 &&
    /^\d{2}\/\d{2}$/.test(cardExpiry) &&
    cardCvv.length >= 3 &&
    cpf.replace(/\D/g, '').length === 11 &&
    cep.replace(/\D/g, '').length === 8
  ), [cardNumber, cardName, cardExpiry, cardCvv, cpf, cep]);

  async function handlePix() {
    setError('');
    setLoadingMsg(LOADING_MESSAGES[0]);
    setStep('loading');
    let msgIdx = 0;
    const interval = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, LOADING_MESSAGES.length - 1);
      setLoadingMsg(LOADING_MESSAGES[msgIdx]);
    }, 2000);
    try {
      const res = await fetch('/api/checkout/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, cpf: cpf.replace(/\D/g, ''), quiz_answers: quizAnswers }),
      });
      const data = await res.json();
      clearInterval(interval);
      if (!res.ok) throw new Error(data.error);
      setPixQrCode(data.pix_qr_code);
      setPixQrCodeUrl(data.pix_qr_code_url);
      setStep('pix_qr');
    } catch (err) {
      clearInterval(interval);
      setError(err instanceof Error ? err.message : 'Erro ao gerar PIX');
      setStep('offer');
    }
  }

  async function handleCard() {
    setError('');
    const publishableKey = process.env.NEXT_PUBLIC_PAGARME_PUBLISHABLE_KEY;
    if (!publishableKey) {
      setError('Chave de pagamento não configurada. Contate o suporte.');
      return;
    }
    if (!isCardComplete) {
      setError('Preencha todos os campos do cartão, CPF e CEP.');
      return;
    }
    setStep('loading');
    try {
      const cleanCpf = cpf.replace(/\D/g, '');
      const cleanCep = cep.replace(/\D/g, '');
      const tokenRes = await fetch(`https://api.pagar.me/core/v5/tokens?appId=${publishableKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'card',
          card: {
            number: cardNumber.replace(/\s/g, ''),
            holder_name: cardName.trim(),
            holder_document: cleanCpf,
            exp_month: parseInt(cardExpiry.split('/')[0], 10),
            exp_year: parseInt('20' + cardExpiry.split('/')[1], 10),
            cvv: cardCvv,
            billing_address: {
              line_1: 'Endereço cadastrado', zip_code: cleanCep,
              city: 'São Paulo', state: 'SP', country: 'BR',
            },
          },
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        throw new Error(tokenData?.errors?.[0]?.message ?? tokenData?.message ?? 'Erro ao validar cartão');
      }
      const res = await fetch('/api/checkout/card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email, cpf: cleanCpf,
          card_token: tokenData.id, quiz_answers: quizAnswers,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem('purchase_data', JSON.stringify({ email, name, purchasedAt: Date.now() }));
      router.push('/obrigado');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar cartão');
      setStep('card_form');
    }
  }

  const onBuy = () => setStep('card_form');

  // ── Loading ──
  if (step === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20, padding: 24, fontFamily: fontUi }}>
        <div style={{ width: 56, height: 56, border: `4px solid ${T.pinkSoft}`, borderTopColor: T.pink, borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: T.ink, fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{loadingMsg}</p>
          <p style={{ color: T.inkSoft, fontSize: 13 }}>Isso pode levar alguns segundos…</p>
        </div>
      </div>
    );
  }

  // ── PIX QR Code ──
  if (step === 'pix_qr') {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px', fontFamily: fontUi }}>
        <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.ink, marginBottom: 8 }}>Pague via PIX</h1>
          <p style={{ color: T.inkSoft, fontSize: 14, marginBottom: 24 }}>Escaneie o QR Code ou copie o código abaixo</p>
          {pixQrCodeUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pixQrCodeUrl} alt="QR Code PIX" style={{ width: 220, height: 220, borderRadius: 16, marginBottom: 24, border: `4px solid ${T.border}` }} />
          )}
          <div style={{ background: '#F9FAFB', borderRadius: 14, padding: 16, marginBottom: 20, border: `1px solid ${T.border}` }}>
            <p style={{ color: T.inkSoft, fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Código PIX (copia e cola)</p>
            <p style={{ color: T.ink, fontSize: 11, wordBreak: 'break-all', lineHeight: 1.6, fontFamily: 'monospace' }}>
              {pixQrCode.slice(0, 80)}…
            </p>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(pixQrCode); setPixCopied(true); }}
            style={{ width: '100%', background: pixCopied ? T.green : T.pink, border: 'none', borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer', marginBottom: 16, fontFamily: fontUi }}
          >
            {pixCopied ? '✓ Código copiado!' : '📋 Copiar código PIX'}
          </button>
          <p style={{ color: T.inkSoft, fontSize: 12, lineHeight: 1.6 }}>
            Após o pagamento ser confirmado, você receberá um e-mail com acesso ao app.
          </p>
        </div>
      </div>
    );
  }

  // ── Card Form ──
  if (step === 'card_form') {
    const inputStyle: React.CSSProperties = {
      background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12,
      padding: '14px 16px', fontSize: 15, color: T.ink, width: '100%',
      outline: 'none', fontFamily: fontUi, boxSizing: 'border-box',
    };
    return (
      <div style={{ minHeight: '100vh', background: T.bg, padding: '24px', fontFamily: fontUi }}>
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <button onClick={() => setStep('offer')} style={{ background: 'none', border: 'none', color: T.inkSoft, fontSize: 15, cursor: 'pointer', marginBottom: 20, padding: 0 }}>
            ‹ Voltar
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
            {(['card', 'pix'] as const).map(type => (
              <button key={type} onClick={() => setPayType(type)} style={{
                background: payType === type ? T.pink : '#fff',
                color: payType === type ? '#fff' : T.ink,
                border: `1px solid ${payType === type ? T.pink : T.border}`,
                borderRadius: 12, padding: '12px', cursor: 'pointer', textAlign: 'center',
                fontSize: 14, fontWeight: 700, fontFamily: fontUi,
              }}>
                {type === 'card' ? '💳 Cartão' : '📱 PIX'}
              </button>
            ))}
          </div>

          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.ink, marginBottom: 6 }}>
            {payType === 'card' ? 'Dados do cartão' : 'Pagar com PIX'}
          </h1>
          <p style={{ color: T.inkSoft, fontSize: 14, marginBottom: 24 }}>R$ 34,90 — pagamento único</p>

          {payType === 'card' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input style={inputStyle} placeholder="Nome no cartão" value={cardName} onChange={e => setCardName(e.target.value)} autoComplete="cc-name" />
              <input style={inputStyle} placeholder="Número do cartão" value={cardNumber} onChange={e => setCardNumber(formatCard(e.target.value))} maxLength={19} inputMode="numeric" autoComplete="cc-number" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <input style={inputStyle} placeholder="MM/AA" value={cardExpiry} onChange={e => setCardExpiry(formatExpiry(e.target.value))} maxLength={5} inputMode="numeric" autoComplete="cc-exp" />
                <input style={inputStyle} placeholder="CVV" value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4} inputMode="numeric" autoComplete="cc-csc" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
                <input style={inputStyle} placeholder="CPF" value={cpf} onChange={e => setCpf(formatCpf(e.target.value))} maxLength={14} inputMode="numeric" />
                <input style={inputStyle} placeholder="CEP" value={cep} onChange={e => setCep(formatCep(e.target.value))} maxLength={9} inputMode="numeric" />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input style={inputStyle} placeholder="Seu nome completo" value={name} onChange={e => setName(e.target.value)} />
              <input style={inputStyle} type="email" placeholder="Seu e-mail" value={email} onChange={e => setEmail(e.target.value)} />
              <input style={inputStyle} placeholder="CPF" value={cpf} onChange={e => setCpf(formatCpf(e.target.value))} maxLength={14} inputMode="numeric" />
            </div>
          )}

          {error && (
            <p style={{ color: T.red, fontSize: 13, marginTop: 12, padding: '10px 14px', background: '#FEF2F2', borderRadius: 10 }}>{error}</p>
          )}

          <div style={{ marginTop: 20 }}>
            <GreenButton
              onClick={payType === 'card' ? handleCard : handlePix}
              disabled={payType === 'card' ? !isCardComplete : cpf.replace(/\D/g, '').length < 11}
            >
              🔒 {payType === 'card' ? 'PAGAR R$ 34,90' : 'GERAR PIX — R$ 34,90'}
            </GreenButton>
          </div>
          <p style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: T.inkSoft }}>
            🔒 Pagamento seguro via PagarMe · Seus dados não são armazenados
          </p>
        </div>
      </div>
    );
  }

  // ── Main Offer Page ──
  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.ink, fontFamily: fontUi }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 40px' }}>
        {/* Voltar */}
        <button onClick={() => router.back()} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.ink, padding: 0, marginBottom: 16 }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 4l-7 7 7 7" />
          </svg>
        </button>

        {/* Antes/Depois comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <CompareCard
            side="antes"
            name="Comprimento de cabelo"
            stats={[
              { label: 'Pequeno', pct: 25 },
              { label: 'Alto', pct: 90 },
              { label: 'Frizz', pct: 75 },
              { label: 'Hidratação', pct: 35 },
              { label: 'Pontas', pct: 25 },
            ]}
          />
          <CompareCard
            side="depois"
            name="Comprimento"
            stats={[
              { label: 'Grande', pct: 90 },
              { label: 'Alto', pct: 90 },
              { label: 'Frizz', pct: 100 },
              { label: 'Hidratação', pct: 100 },
              { label: 'Pontas', pct: 98 },
            ]}
          />
        </div>

        {/* Plano completo + Acesso ao grupo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <div style={{ background: T.pinkBg, borderRadius: 12, padding: '14px 14px', border: `1px solid ${T.pinkSoft}` }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.pinkDeep, marginBottom: 6 }}>
              Plano completo profissional
            </div>
            <div style={{ fontSize: 11, color: T.inkSoft, lineHeight: 1.45 }}>
              Rotina capilar, indicação de produtos, análise de cabelo, tirar dúvidas pelo WhatsApp
            </div>
          </div>
          <div style={{ background: T.pinkBg, borderRadius: 12, padding: '14px 14px', border: `1px solid ${T.pinkSoft}` }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.pinkDeep, marginBottom: 6 }}>
              Acesso ao grupo de promoções
            </div>
            <div style={{ fontSize: 11, color: T.inkSoft, lineHeight: 1.45 }}>
              Um grupo fechado onde mando os produtos que eu indico
            </div>
          </div>
        </div>

        {/* Headline */}
        <div style={{ fontSize: 16, color: T.ink, fontWeight: 700, textAlign: 'center', marginBottom: 18 }}>
          {name || 'Você'} seu plano personalizado está pronto!
        </div>

        {/* First offer card */}
        <OfferCard countdown={countdown} name={name} onBuy={onBuy} />

        {/* Social proof */}
        <div style={{ fontSize: 16, color: T.ink, lineHeight: 1.45, fontWeight: 700, textAlign: 'center', marginBottom: 22 }}>
          Mulheres como você obtiveram excelentes resultados utilizando o nosso{' '}
          <span style={{ color: T.pinkDeep }}>Plano Capilar Personalizado da Tricologista Ju Cost</span>
        </div>

        {/* A vida antes */}
        <div style={{ fontSize: 16, color: T.pinkDeep, fontWeight: 800, marginBottom: 12 }}>
          A vida antes de ter um plano personalizado para seu cabelo:
        </div>
        <div style={{ marginBottom: 22 }}>
          <CrossItem>Baixa autoestima</CrossItem>
          <CrossItem>Cabelo quebradiço</CrossItem>
          <CrossItem>Ressecamento dos fios</CrossItem>
          <CrossItem>Desidratada</CrossItem>
          <CrossItem>Falhas no cabelo</CrossItem>
        </div>

        {/* Brilho Intenso etc */}
        <div style={{ marginBottom: 22 }}>
          <CheckItem><strong>Brilho Intenso:</strong> fios que refletem luz e tem aparência saudável.</CheckItem>
          <CheckItem><strong>Hidratação visível:</strong> toque macio e sedoso.</CheckItem>
          <CheckItem><strong>Sem frizz:</strong> alinhamento dos fios e aparência disciplinada.</CheckItem>
          <CheckItem><strong>Crescimento saudável:</strong> fios que crescem regularmente e com vitalidade.</CheckItem>
          <CheckItem><strong>Longo comprimento</strong></CheckItem>
          <CheckItem><strong>Crescimento acelerado e correção de falhas</strong></CheckItem>
        </div>

        {/* Para quem é */}
        <div style={{ fontSize: 18, color: T.ink, fontWeight: 800, textAlign: 'center', marginBottom: 14 }}>
          Para quem é?
        </div>
        <div style={{ marginBottom: 22 }}>
          <CheckItem color={T.pink}>Para todas as mulheres que querem ter um cabelo lindo e começar a ver resultados <strong>EM MENOS DE 90 DIAS</strong>.</CheckItem>
          <CheckItem color={T.pink}>Para quem deseja seguir uma nova rotina de cuidados que seja acessível</CheckItem>
          <CheckItem color={T.pink}>Para quem já se sente frustrada com produtos de cabelo que não funcionam</CheckItem>
          <CheckItem color={T.pink}>Para todas que <strong>NÃO querem gastar dinheiro com produtos caros que não funcionam</strong></CheckItem>
        </div>

        {/* Second offer card */}
        <OfferCard countdown={countdown} name={name} onBuy={onBuy} />

        {/* O que você vai ter */}
        <div style={{ fontSize: 18, color: T.ink, fontWeight: 800, textAlign: 'center', marginBottom: 14 }}>
          O que você vai ter:
        </div>
        <div style={{ marginBottom: 22 }}>
          <CheckItem color={T.pink}>Plano capilar para você seguir nos próximos 90 dias com base nos produtos que você já tem</CheckItem>
          <CheckItem color={T.pink}>Lista de compras prática para sempre ter os produtos necessários em casa</CheckItem>
          <CheckItem color={T.pink}>Checklist semanal de Hábitos para seu cabelo</CheckItem>
          <CheckItem color={T.pink}>Acesso a um grupo exclusivo de descontos em produtos para cabelo</CheckItem>
          <CheckItem color={T.pink}>Dicas de cuidados e rotina capilar</CheckItem>
        </div>

        {/* 3 testimonial photos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 28 }}>
          {[
            images['oferta_resultado_1'] || '/images/resultado-antes1.png',
            images['oferta_resultado_2'] || '/images/resultado-antes2.png',
            images['oferta_resultado_3'] || '/images/resultado-antes3.png',
          ].map((src, i) => (
            <div key={i} style={{ borderRadius: 10, overflow: 'hidden', aspectRatio: '3/4', background: '#F3F4F6' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Resultado ${i+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
        </div>

        {/* Perguntas Frequentes */}
        <div style={{ fontSize: 18, color: T.ink, fontWeight: 800, textAlign: 'center', marginBottom: 14 }}>
          Perguntas Frequentes
        </div>
        <div style={{ marginBottom: 28 }}>
          {[
            {
              q: 'Quando eu adquirir o plano, ele já está disponível?',
              a: 'Sim, todo o conteúdo do plano é liberado imediatamente, porém, a parte personalizada será entregue em até 3 dias pois precisa ler cada resposta para fazer algo feito para você.',
            },
            { q: 'Os produtos indicados são difíceis de encontrar?', a: 'Não. Indicamos produtos acessíveis e que você encontra em qualquer farmácia ou loja de cosméticos.' },
            { q: 'Quando posso começar a ver resultados?', a: 'Os primeiros resultados aparecem em até 4 semanas seguindo o plano corretamente. Em 90 dias você verá a transformação completa.' },
            { q: 'Você usa Mega Hair?', a: 'Não. Todo o trabalho é feito com seu cabelo natural, focado em recuperação e fortalecimento dos fios.' },
            { q: 'O que é Tricologia?', a: 'É a ciência que estuda os cabelos e o couro cabeludo. A Juliane é tricologista formada e atende mulheres com problemas capilares há anos.' },
          ].map((f, i) => (
            <div key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left', padding: '14px 0', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontFamily: fontUi }}
              >
                <span style={{ fontSize: 14, fontWeight: 700, color: T.ink, flex: 1 }}>{i + 1}- {f.q}</span>
                <span style={{ fontSize: 18, color: T.pinkDeep, fontWeight: 700, flexShrink: 0 }}>{openFaq === i ? '−' : '+'}</span>
              </button>
              {openFaq === i && (
                <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.6, paddingBottom: 14 }}>
                  {f.a}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Garantia 7 dias */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 14 }}>
          <div style={{
            width: 110, height: 110, position: 'relative',
            background: 'radial-gradient(circle, #FACC15, #CA8A04)',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(202,138,4,0.3)', marginBottom: 12,
          }}>
            <div style={{ position: 'absolute', inset: 4, borderRadius: '50%', border: '2px dashed #92400E' }} />
            <div style={{ textAlign: 'center', color: '#92400E', fontWeight: 800 }}>
              <div style={{ fontSize: 11, letterSpacing: 0.5 }}>GARANTIA</div>
              <div style={{ fontSize: 28, lineHeight: 1, margin: '2px 0' }}>7</div>
              <div style={{ fontSize: 11, letterSpacing: 0.5 }}>DIAS</div>
              <div style={{ fontSize: 8, letterSpacing: 0.5, marginTop: 2 }}>SETE DIAS</div>
            </div>
          </div>
        </div>
        <div style={{ background: T.pink, color: '#fff', padding: '14px 18px', borderRadius: 12, marginBottom: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>
            Sem Riscos: Resultados ou seu dinheiro de volta em 7 dias.
          </div>
          <div style={{ fontSize: 11, opacity: 0.95, lineHeight: 1.5 }}>
            ★★★★★
          </div>
        </div>
        <div style={{ fontSize: 12, color: T.inkSoft, lineHeight: 1.6, marginBottom: 24, textAlign: 'left' }}>
          Nós acreditamos tanto no nosso transformador do <strong style={{ color: T.ink }}>Plano Capilar Personalizado da Tricologista</strong> que oferecemos garantia.
          <br /><br />
          Você terá <strong style={{ color: T.ink }}>100% do seu dinheiro</strong>, sem complicações e sem perguntas.
          <br /><br />
          E em compensação nós, podemos somente continuar te ajudando a ver os seus resultados e o seu cabelo se transforma. Aproveite essa oportunidade que está aqui agora!
        </div>

        {/* Payment methods */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginBottom: 24 }}>
          {['VISA', 'MC', 'ELO', 'AMEX', 'HIPER', 'PIX'].map(m => (
            <div key={m} style={{
              background: '#fff', border: `1px solid ${T.border}`, borderRadius: 8,
              padding: '10px 4px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: T.inkMid,
            }}>{m}</div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ fontSize: 12, color: T.inkSoft, lineHeight: 1.6, paddingTop: 20, borderTop: `1px solid ${T.border}` }}>
          <div style={{ marginBottom: 4 }}>Segunda à Sexta-feira:</div>
          <div style={{ marginBottom: 12 }}>das 9h às 17h30</div>
          <div style={{ marginBottom: 12 }}>📞 31 9744-5597</div>
          <div style={{ marginBottom: 4 }}>
            julianecost.com | Avenida Quinze de Novembro, 609, Jardim Petrópolis, Belim - MS CEP: 32855-122
          </div>
          <div style={{ marginBottom: 12 }}>CNPJ: 20.227.193/0001-18</div>
          <div style={{ fontSize: 11 }}>© 2025 julianecost.com — Todos os direitos reservados.</div>
        </div>
      </div>
    </div>
  );
}
