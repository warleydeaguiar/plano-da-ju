'use client';

// Oferta do funil EUA (brasileiras morando nos Estados Unidos).
// Página própria e enxuta — de propósito: nos EUA não existe PIX nem parcelamento
// em 3x, então reaproveitar a oferta brasileira (2.000 linhas de PIX/roleta/cupom)
// só traria coisa que não se aplica. Pagamento em US$ via Stripe Checkout.
import { useState, useEffect } from 'react';
import { PLAN_USD_CENTS, PLAN_USD_ANCHOR_CENTS, usd } from '@/lib/pricing';

const T = {
  bg: '#FFFAF5', surface: '#FFFFFF', cream: '#FFF7EE',
  ink: '#2A1E2C', inkSoft: '#7C6B7E', inkMuted: '#B5A6B7',
  pink: '#EC4899', pinkDeep: '#BE185D', pinkSoft: '#FCE7F3', rose: '#FFE4EA',
  gold: '#C9A877', green: '#22A06B', greenDeep: '#15803d',
  border: 'rgba(196,140,150,0.18)', red: '#DC2626',
};
const fonts = {
  display: '"Fraunces", "Cormorant Garamond", Georgia, serif',
  ui: '"Plus Jakarta Sans", "Inter", -apple-system, system-ui, sans-serif',
};

const DORES = [
  { emoji: '🚿', titulo: 'A água daí resseca o seu cabelo', texto: 'A água americana é dura — cheia de cálcio, magnésio e cloro. Ela deixa um resíduo que vai deixando o fio opaco, áspero e embaraçado. Não é o seu cabelo que piorou: é a água. E tem como neutralizar.' },
  { emoji: '🛒', titulo: 'Você não sabe o que comprar', texto: 'A prateleira é gigante, as marcas são outras e o que você usava no Brasil não existe aí. Produto barato tem de monte — o problema é acertar qual serve pro SEU fio.' },
  { emoji: '💸', titulo: 'Já gastou comprando errado', texto: 'Comprar no escuro sai caro: você leva três, usa um, e o cabelo continua igual. O plano diz exatamente o que pegar, com opção mais em conta.' },
];

const DEPOIMENTOS = [
  { nome: 'Camila', cidade: 'Orlando, FL', texto: 'Me mudei e meu cabelo virou palha. Produto barato aí tem de monte, mas eu não sabia o que comprar — e ninguém fala da água. Depois do plano mudou tudo. Agora as americanas e as latinas do trabalho vivem me perguntando qual produto eu uso.' },
  { nome: 'Fernanda', cidade: 'Boston, MA', texto: 'Passei um ano comprando errado no Target e jogando dinheiro fora. A Ju me disse exatamente o que pegar e como resolver a questão da água. Meu cabelo voltou a ter brilho.' },
  { nome: 'Patrícia', cidade: 'Newark, NJ', texto: 'Achei que era o clima. Era a água mesmo. Segui o cronograma com produto que eu acho no mercado aqui e em três semanas já vi diferença nas pontas.' },
];

const INCLUI = [
  'Cronograma capilar completo de 12 semanas, montado pro seu fio',
  'Lista de produtos que você acha fácil aí — mercado, farmácia ou Amazon',
  'O passo a passo pra neutralizar a água dura americana',
  'Análise das suas fotos feita pela Juliane',
  'Acesso ao app na hora, com tudo organizado por dia',
];

export default function OfertaEuaClient() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pré-preenche com o que veio do quiz.
  useEffect(() => {
    try {
      const qa = JSON.parse(localStorage.getItem('quiz_answers') || '{}');
      if (qa?.name && typeof qa.name === 'string') setName(qa.name);
      if (qa?.email && typeof qa.email === 'string') setEmail(qa.email);
    } catch { /* segue vazio */ }
  }, []);

  const valid = name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  async function comprar() {
    if (!valid || loading) return;
    setError(''); setLoading(true);
    try {
      let quizAnswers = {};
      let sessionId = '';
      try {
        quizAnswers = JSON.parse(localStorage.getItem('quiz_answers') || '{}');
        sessionId = localStorage.getItem('checkout_session_id') || '';
      } catch { /* ok */ }
      const res = await fetch('/api/checkout/stripe/usa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), session_id: sessionId, quiz_answers: quizAnswers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || 'Não consegui abrir o pagamento.');
      window.location.href = data.url;   // Stripe Checkout (Apple/Google Pay inclusos)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado. Tente de novo.');
      setLoading(false);
    }
  }

  const card: React.CSSProperties = {
    background: T.surface, borderRadius: 18, padding: '18px 18px',
    border: `1px solid ${T.border}`, boxShadow: '0 6px 18px rgba(190,24,93,0.06)',
  };

  return (
    <div style={{ minHeight: '100svh', background: T.bg, fontFamily: fonts.ui, color: T.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '28px 20px 48px' }}>
        {/* Cabeçalho */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ display: 'inline-block', background: T.ink, color: '#fff', borderRadius: 999, padding: '6px 14px', fontSize: 11, fontWeight: 700, letterSpacing: 1.2, marginBottom: 14 }}>
            🇧🇷 PARA BRASILEIRAS NOS 🇺🇸 EUA
          </div>
          <h1 style={{ fontFamily: fonts.display, fontSize: 30, fontWeight: 600, lineHeight: 1.15, letterSpacing: -0.5 }}>
            Seu plano capilar feito pra <em style={{ color: T.pinkDeep }}>quem mora fora</em>
          </h1>
          <p style={{ fontSize: 14.5, color: T.inkSoft, lineHeight: 1.6, marginTop: 12 }}>
            Com os produtos que você encontra <strong>aí nos Estados Unidos</strong> — e a solução
            pra água dura que está acabando com o seu cabelo.
          </p>
        </div>

        {/* Dores */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
          {DORES.map(d => (
            <div key={d.titulo} style={card}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{d.emoji}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>{d.titulo}</div>
                  <div style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.55 }}>{d.texto}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* O que inclui */}
        <div style={{ ...card, background: `linear-gradient(135deg, ${T.rose}, ${T.cream})`, marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: T.pinkDeep, marginBottom: 12 }}>O QUE VOCÊ RECEBE</div>
          {INCLUI.map(i => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0' }}>
              <span style={{ color: T.green, fontWeight: 800, flexShrink: 0 }}>✓</span>
              <span style={{ fontSize: 13.5, lineHeight: 1.5 }}>{i}</span>
            </div>
          ))}
        </div>

        {/* Depoimentos */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: T.inkSoft, marginBottom: 10 }}>
            BRASILEIRAS QUE JÁ FIZERAM
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DEPOIMENTOS.map(d => (
              <div key={d.nome} style={card}>
                <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.6, marginBottom: 8 }}>&ldquo;{d.texto}&rdquo;</div>
                <div style={{ fontSize: 12, color: T.pinkDeep, fontWeight: 700 }}>{d.nome} — <span style={{ color: T.inkSoft, fontWeight: 500 }}>{d.cidade}</span></div>
              </div>
            ))}
          </div>
        </div>

        {/* Preço + checkout */}
        <div style={{ ...card, padding: '22px 18px' }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: T.inkMuted, textDecoration: 'line-through' }}>{usd(PLAN_USD_ANCHOR_CENTS)}</div>
            <div style={{ fontFamily: fonts.display, fontSize: 44, fontWeight: 700, color: T.pinkDeep, lineHeight: 1.05 }}>
              {usd(PLAN_USD_CENTS)}
            </div>
            <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 4 }}>pagamento único · acesso imediato</div>
          </div>

          <label style={{ display: 'block', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Seu nome</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Como prefere ser chamada"
              style={{ width: '100%', height: 50, borderRadius: 12, border: `1.5px solid ${T.border}`, padding: '0 14px', fontSize: 15, fontFamily: fonts.ui, outline: 'none' }} />
          </label>
          <label style={{ display: 'block', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Seu e-mail</div>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="seu@email.com"
              style={{ width: '100%', height: 50, borderRadius: 12, border: `1.5px solid ${T.border}`, padding: '0 14px', fontSize: 15, fontFamily: fonts.ui, outline: 'none' }} />
          </label>

          {error && (
            <p style={{ color: T.red, fontSize: 13, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>{error}</p>
          )}

          <button onClick={comprar} disabled={!valid || loading}
            style={{
              width: '100%', height: 56, borderRadius: 14, border: 'none', cursor: (!valid || loading) ? 'not-allowed' : 'pointer',
              background: (!valid || loading) ? '#CFCFCF' : `linear-gradient(180deg, #1f9e4a 0%, ${T.greenDeep} 100%)`,
              color: '#fff', fontSize: 16, fontWeight: 800, fontFamily: fonts.ui,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
            {loading ? (
              <>
                <span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                Abrindo pagamento…
              </>
            ) : `🔒 Quero meu plano — ${usd(PLAN_USD_CENTS)}`}
          </button>
          {!valid && (
            <p style={{ fontSize: 12, color: T.pinkDeep, textAlign: 'center', marginTop: 8, fontWeight: 600 }}>
              ☝️ Preencha seu nome e e-mail para continuar
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 14, fontSize: 11, color: T.inkSoft, flexWrap: 'wrap' }}>
            <span>🔒 Pagamento seguro</span><span>💳 Apple Pay & Google Pay</span><span>✅ Garantia de 7 dias</span>
          </div>
          <p style={{ fontSize: 11, color: T.inkMuted, textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
            Cobrado em dólar (USD). Seus dados são criptografados e nunca compartilhados.
          </p>
        </div>
      </div>
    </div>
  );
}
