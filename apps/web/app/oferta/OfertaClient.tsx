'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const PINK = '#C4607A';
const BG = '#1C0020';
const CARD_BG = '#2A0A30';

const benefits = [
  { icon: '📋', title: 'Cronograma de 52 semanas', sub: 'O que fazer cada semana, em ordem certa' },
  { icon: '🧴', title: 'Lista de produtos personalizada', sub: 'Só o que funciona para o seu tipo de cabelo' },
  { icon: '📊', title: 'Check-ins inteligentes diários', sub: 'O app aprende com você e ajusta as recomendações' },
  { icon: '📸', title: 'Análise de fotos com IA', sub: 'Veja a evolução do seu cabelo semana a semana' },
  { icon: '💆‍♀️', title: 'Plano revisado pela Juliane', sub: 'Aprovado pela especialista antes de chegar pra você' },
  { icon: '🎯', title: 'Resultado em 90 dias', sub: 'Método testado em mais de 3.500 mulheres' },
];

const testimonials = [
  { name: 'Larissa M.', text: 'Meu cabelo cresceu 4cm em 3 meses e o frizz acabou!', rating: 5 },
  { name: 'Carla S.', text: 'Nunca tive cabelo tão hidratado. Valeu cada centavo.', rating: 5 },
  { name: 'Ana P.', text: 'Em 6 semanas meu cabelo parou de quebrar. Incrível!', rating: 5 },
];

type Step = 'offer' | 'card_form' | 'pix_qr' | 'loading';

export default function OfertaClient() {
  const router = useRouter();
  const [payType, setPayType] = useState<'card' | 'pix'>('card');
  const [step, setStep] = useState<Step>('offer');
  const [error, setError] = useState('');

  // Lead data from quiz
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, unknown>>({});

  // Card form
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // PIX data
  const [pixQrCode, setPixQrCode] = useState('');
  const [pixQrCodeUrl, setPixQrCodeUrl] = useState('');
  const [pixCopied, setPixCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('quiz_answers');
      if (stored) {
        const parsed = JSON.parse(stored);
        setQuizAnswers(parsed);
        if (parsed.name) setName(parsed.name);
        if (parsed.email) setEmail(parsed.email);
      }
    }
  }, []);

  const formatCard = (v: string) =>
    v.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19);

  const formatExpiry = (v: string) =>
    v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2').slice(0, 5);

  async function handlePix() {
    setError('');
    setStep('loading');
    try {
      const res = await fetch('/api/checkout/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, quiz_answers: quizAnswers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPixQrCode(data.pix_qr_code);
      setPixQrCodeUrl(data.pix_qr_code_url);
      setStep('pix_qr');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar PIX');
      setStep('offer');
    }
  }

  async function handleCard() {
    setError('');
    setStep('loading');
    try {
      // Tokenizar o cartão via PagarMe.js (simplificado — em produção usar @pagarme/pagarme-js)
      const tokenRes = await fetch('https://api.pagar.me/core/v5/tokens?appId=' + process.env.NEXT_PUBLIC_PAGARME_PUBLISHABLE_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'card',
          card: {
            number: cardNumber.replace(/\s/g, ''),
            holder_name: cardName,
            exp_month: parseInt(cardExpiry.split('/')[0]),
            exp_year: parseInt('20' + cardExpiry.split('/')[1]),
            cvv: cardCvv,
            billing_address: {
              line_1: 'Não informado',
              zip_code: '00000000',
              city: 'São Paulo',
              state: 'SP',
              country: 'BR',
            },
          },
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error('Erro ao tokenizar cartão');

      const res = await fetch('/api/checkout/card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          card_token: tokenData.id,
          quiz_answers: quizAnswers,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.removeItem('quiz_answers');
      router.push('/obrigado');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar cartão');
      setStep('card_form');
    }
  }

  const handleBuy = () => {
    if (payType === 'pix') return handlePix();
    setStep('card_form');
  };

  // ── Loading ──
  if (step === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 40 }}>⏳</div>
        <p style={{ color: '#FFF', fontSize: 16 }}>Processando seu pagamento…</p>
      </div>
    );
  }

  // ── PIX QR Code ──
  if (step === 'pix_qr') {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px' }}>
        <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#FFF', marginBottom: 8 }}>Pague via PIX</h1>
          <p style={{ color: '#8E8E93', fontSize: 14, marginBottom: 24 }}>Escaneie o QR Code ou copie o código abaixo</p>

          {pixQrCodeUrl && (
            <img src={pixQrCodeUrl} alt="QR Code PIX" style={{ width: 220, height: 220, borderRadius: 16, marginBottom: 24, border: '4px solid #FFF' }} />
          )}

          <div style={{ background: CARD_BG, borderRadius: 14, padding: 16, marginBottom: 20 }}>
            <p style={{ color: '#8E8E93', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Código PIX (copia e cola)</p>
            <p style={{ color: '#FFF', fontSize: 11, wordBreak: 'break-all', lineHeight: 1.6, fontFamily: 'monospace' }}>
              {pixQrCode.slice(0, 80)}…
            </p>
          </div>

          <button
            onClick={() => { navigator.clipboard.writeText(pixQrCode); setPixCopied(true); }}
            style={{ width: '100%', background: pixCopied ? '#34C759' : PINK, border: 'none', borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 700, color: '#FFF', cursor: 'pointer', marginBottom: 16 }}
          >
            {pixCopied ? '✓ Código copiado!' : '📋 Copiar código PIX'}
          </button>

          <p style={{ color: '#8E8E93', fontSize: 12, lineHeight: 1.6 }}>
            Após o pagamento ser confirmado, você receberá um e-mail com acesso ao app. O QR Code expira em 1 hora.
          </p>
        </div>
      </div>
    );
  }

  // ── Card Form ──
  if (step === 'card_form') {
    const inputStyle = {
      background: CARD_BG, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12,
      padding: '14px 16px', fontSize: 15, color: '#FFF', width: '100%', outline: 'none',
    };
    return (
      <div style={{ minHeight: '100vh', background: BG, padding: '32px 24px' }}>
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <button onClick={() => setStep('offer')} style={{ background: 'none', border: 'none', color: '#8E8E93', fontSize: 16, cursor: 'pointer', marginBottom: 20 }}>
            ‹ Voltar
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#FFF', marginBottom: 6 }}>Dados do cartão</h1>
          <p style={{ color: '#8E8E93', fontSize: 13, marginBottom: 24 }}>R$ 34,90/ano · renovação automática</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input style={inputStyle} placeholder="Nome no cartão" value={cardName} onChange={e => setCardName(e.target.value)} />
            <input style={inputStyle} placeholder="Número do cartão" value={cardNumber}
              onChange={e => setCardNumber(formatCard(e.target.value))} maxLength={19} inputMode="numeric" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input style={inputStyle} placeholder="Validade MM/AA" value={cardExpiry}
                onChange={e => setCardExpiry(formatExpiry(e.target.value))} maxLength={5} inputMode="numeric" />
              <input style={inputStyle} placeholder="CVV" value={cardCvv}
                onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4} inputMode="numeric" />
            </div>
          </div>

          {error && <p style={{ color: '#FF453A', fontSize: 13, marginTop: 12 }}>{error}</p>}

          <button
            onClick={handleCard}
            disabled={!cardNumber || !cardName || !cardExpiry || !cardCvv}
            style={{ width: '100%', marginTop: 24, background: PINK, border: 'none', borderRadius: 14, padding: 18, fontSize: 15, fontWeight: 800, color: '#FFF', cursor: 'pointer' }}
          >
            🔒 Pagar R$ 34,90/ano
          </button>
          <p style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: '#48484A' }}>
            🔒 Pagamento seguro via PagarMe · Seus dados não são armazenados
          </p>
        </div>
      </div>
    );
  }

  // ── Main Offer Page ──
  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#FFF' }}>
      <div style={{ background: 'linear-gradient(160deg,#3D1040,#6B2060 45%,#C4607A)', padding: '40px 24px 32px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '4px 16px', fontSize: 12, marginBottom: 16 }}>
          🎉 Seu diagnóstico está pronto!
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 12px', lineHeight: 1.3, letterSpacing: -0.5 }}>
          A Juliane analisou seu perfil e preparou seu plano personalizado
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: 1.6 }}>
          Baseado nas suas respostas, identificamos o protocolo ideal para recuperar seu cabelo em 90 dias.
        </p>
      </div>

      <div style={{ padding: '24px 20px', maxWidth: 480, margin: '0 auto' }}>

        <h2 style={{ fontSize: 11, fontWeight: 700, marginBottom: 16, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1 }}>
          O QUE ESTÁ INCLUÍDO
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {benefits.map((b, i) => (
            <div key={i} style={{ background: CARD_BG, borderRadius: 14, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>{b.icon}</span>
              <div><div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{b.title}</div>
                <div style={{ fontSize: 12, color: '#8E8E93', lineHeight: 1.4 }}>{b.sub}</div></div>
              <span style={{ color: '#34C759', fontSize: 18, marginLeft: 'auto', flexShrink: 0 }}>✓</span>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 11, fontWeight: 700, marginBottom: 14, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1 }}>
          QUEM JÁ TRANSFORMOU O CABELO
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {testimonials.map((t, i) => (
            <div key={i} style={{ background: CARD_BG, borderRadius: 14, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 14, color: '#FFD60A', marginBottom: 6 }}>{'★'.repeat(t.rating)}</div>
              <p style={{ fontSize: 13, color: '#FFF', margin: '0 0 8px', lineHeight: 1.5, fontStyle: 'italic' }}>"{t.text}"</p>
              <span style={{ fontSize: 11, color: '#8E8E93' }}>— {t.name}</span>
            </div>
          ))}
        </div>

        {/* Pricing */}
        <div style={{ background: 'linear-gradient(135deg,#3D1040,#8B3A6E)', borderRadius: 20, padding: '24px 20px', border: '1px solid rgba(196,96,122,0.3)', marginBottom: 20 }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', textDecoration: 'line-through', marginBottom: 4 }}>De R$ 99,00/ano</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 1 }}>OFERTA ESPECIAL — 65% OFF</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {(['card', 'pix'] as const).map(type => (
              <button key={type} onClick={() => setPayType(type)} style={{
                background: payType === type ? 'rgba(255,255,255,0.18)' : 'transparent',
                border: `2px solid ${payType === type ? '#FFF' : 'rgba(255,255,255,0.3)'}`,
                borderRadius: 14, padding: '14px 10px', cursor: 'pointer', textAlign: 'center', color: '#FFF',
              }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{type === 'card' ? '💳' : '📱'}</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{type === 'card' ? 'R$ 34,90' : 'R$ 49,90'}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{type === 'card' ? '/ano · renova auto' : '/ano · pagamento único'}</div>
                {type === 'card' && payType === 'card' && (
                  <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, background: '#FFD60A', color: '#1C0020', borderRadius: 8, padding: '3px 8px', display: 'inline-block' }}>MELHOR OFERTA</div>
                )}
              </button>
            ))}
          </div>

          {error && <p style={{ color: '#FF453A', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</p>}

          <button onClick={handleBuy} style={{ width: '100%', background: PINK, border: 'none', borderRadius: 14, padding: '18px', fontSize: 15, fontWeight: 800, color: '#FFF', cursor: 'pointer', letterSpacing: 0.5 }}>
            🔒 {payType === 'card' ? 'ASSINAR NO CARTÃO — R$ 34,90/ano' : 'GERAR PIX — R$ 49,90/ano'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
            🔒 Pagamento seguro via PagarMe · Acesso imediato ao app
          </div>
        </div>

        <div style={{ background: CARD_BG, borderRadius: 14, padding: '16px', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🛡️</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Garantia de 7 dias</div>
          <div style={{ fontSize: 12, color: '#8E8E93', lineHeight: 1.5 }}>Se não gostar por qualquer motivo, devolvemos 100% do seu dinheiro. Sem perguntas.</div>
        </div>
      </div>
    </div>
  );
}
