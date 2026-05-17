'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

// ╔══════════════════════════════════════════════════════════╗
// ║  V2 — Página de oferta moderna feminina                  ║
// ╚══════════════════════════════════════════════════════════╝

const T = {
  bg:        '#FFFAF5',
  bgWarm:    '#FFF1E8',
  ink:       '#2A1E2C',
  inkSoft:   '#7C6B7E',
  inkMuted:  '#B5A6B7',
  pink:      '#EC4899',
  pinkDeep:  '#BE185D',
  pinkSoft:  '#FCE7F3',
  pinkBlush: '#FFD1E0',
  gold:      '#C9A877',
  goldDeep:  '#9C7B4F',
  champagne: '#F5E6D3',
  cream:     '#FFF7EE',
  rose:      '#FFE4EA',
  green:     '#22C55E',
  greenDeep: '#16A34A',
  red:       '#EF4444',
  border:    'rgba(196,140,150,0.18)',
};
const fonts = {
  display: '"Fraunces", "Cormorant Garamond", Georgia, serif',
  ui:      '"Plus Jakarta Sans", "Inter", -apple-system, system-ui, sans-serif',
};

type Step = 'offer' | 'card_form' | 'pix_qr' | 'pix_confirmed' | 'loading';
const LOADING_MESSAGES = [
  'Conectando com o servidor…',
  'Verificando seus dados…',
  'Gerando o QR Code PIX…',
  'Quase pronto!',
];

// Gera um session_id único por visita (rastreia o funil)
function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  const key = 'checkout_session_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `cs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

// Loga evento do funil sem bloquear o fluxo
async function logEvent(data: {
  event_type: string;
  email?: string;
  payment_type?: string;
  amount_cents?: number;
  order_id?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await fetch('/api/checkout/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: getSessionId(), ...data }),
    });
  } catch {}
}

// ─── Validators / detectors ──────────────────────────────────
function luhnCheck(num: string): boolean {
  const digits = num.replace(/\D/g, '');
  if (digits.length < 13) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function detectCardBrand(num: string): string {
  const n = num.replace(/\D/g, '');
  if (!n) return '';
  if (/^4/.test(n)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  if (/^(6011|65|64[4-9])/.test(n)) return 'discover';
  if (/^(636|438935|504175|451416|5067|509|627780|636297|636368)/.test(n)) return 'elo';
  if (/^(606282|3841)/.test(n)) return 'hipercard';
  return '';
}

function isValidExpiry(exp: string): boolean {
  const m = exp.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return false;
  const month = parseInt(m[1], 10);
  const year  = 2000 + parseInt(m[2], 10);
  if (month < 1 || month > 12) return false;
  const expiryDate = new Date(year, month, 0); // último dia do mês
  return expiryDate.getTime() >= Date.now();
}

function isValidCpf(cpf: string): boolean {
  const c = cpf.replace(/\D/g, '');
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i], 10) * (10 - i);
  let d1 = (sum * 10) % 11; if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(c[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i], 10) * (11 - i);
  let d2 = (sum * 10) % 11; if (d2 === 10) d2 = 0;
  return d2 === parseInt(c[10], 10);
}

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

// Countdown honesto: 24h a partir da PRIMEIRA visita (persiste em localStorage)
// Não reseta em refresh, não engana a usuária.
function useHonestCountdown(totalSeconds: number) {
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = 'offer_first_seen_at';
    let firstSeen = localStorage.getItem(key);
    if (!firstSeen) {
      firstSeen = String(Date.now());
      localStorage.setItem(key, firstSeen);
    }
    const startTs = parseInt(firstSeen, 10);
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startTs) / 1000);
      setSecondsLeft(Math.max(0, totalSeconds - elapsed));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [totalSeconds]);

  const hours = Math.floor(secondsLeft / 3600);
  const mins  = Math.floor((secondsLeft % 3600) / 60);
  const secs  = secondsLeft % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ─── Sparkles flutuantes no fundo ────────────────────────────
function FloatingPetals() {
  const petals = useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 4 + Math.random() * 7,
    delay: Math.random() * 8,
    duration: 14 + Math.random() * 10,
    type: i % 3,
    color: i % 2 === 0 ? T.pink : T.gold,
  })), []);
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
      {petals.map(p => (
        <div key={p.id} style={{
          position: 'absolute', left: `${p.x}%`, top: `${p.y}%`,
          width: p.size, height: p.size, color: p.color, opacity: 0.28,
          animation: `petalFloat ${p.duration}s ${p.delay}s ease-in-out infinite, petalSpin ${p.duration * 0.7}s linear infinite`,
        }}>
          {p.type === 0 ? (
            <svg viewBox="0 0 16 16" fill="currentColor" width="100%" height="100%">
              <path d="M8 0 L9.5 6.5 L16 8 L9.5 9.5 L8 16 L6.5 9.5 L0 8 L6.5 6.5 Z" />
            </svg>
          ) : p.type === 1 ? (
            <svg viewBox="0 0 16 16" fill="currentColor" width="100%" height="100%">
              <path d="M8 14s-6-3.5-6-8a3.5 3.5 0 0 1 6-2.5A3.5 3.5 0 0 1 14 6c0 4.5-6 8-6 8z" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" fill="currentColor" width="100%" height="100%">
              <circle cx="8" cy="8" r="3" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Stat bar com gradiente ──────────────────────────────────
function StatBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.inkSoft, marginBottom: 3, fontFamily: fonts.ui }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color: T.ink }}>{pct}%</span>
      </div>
      <div style={{ height: 7, background: 'rgba(196,140,150,0.13)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color, borderRadius: 99,
          transition: 'width 1.2s cubic-bezier(.2,.7,.3,1)',
          animation: 'statFill 1.4s cubic-bezier(.2,.7,.3,1)',
        }} />
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
      background: 'rgba(255,255,255,0.85)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      border: `1px solid ${T.border}`,
      borderRadius: 18,
      padding: '14px 14px',
      boxShadow: '0 8px 24px rgba(190,24,93,0.06)',
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 11, fontWeight: 700, color: '#fff',
        marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase',
        background: isAfter
          ? `linear-gradient(135deg, ${T.green}, ${T.greenDeep})`
          : `linear-gradient(135deg, ${T.red}, #DC2626)`,
        padding: '3px 10px', borderRadius: 99,
      }}>
        {isAfter ? '✨ Depois' : 'Antes'}
      </div>
      <div style={{
        fontSize: 13, color: T.ink, fontWeight: 700,
        marginBottom: 12, fontFamily: fonts.ui,
      }}>
        {name}
      </div>
      {stats.map((s, i) => (
        <StatBar key={i} label={s.label} pct={s.pct} color={isAfter
          ? `linear-gradient(90deg, ${T.green}, ${T.greenDeep})`
          : `linear-gradient(90deg, #FB7185, ${T.red})`
        } />
      ))}
    </div>
  );
}

function GreenButton({ onClick, children, disabled, variant = 'green' }: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  variant?: 'green' | 'pink';
}) {
  const [pressed, setPressed] = useState(false);
  const grad = variant === 'green'
    ? `linear-gradient(135deg, ${T.green} 0%, ${T.greenDeep} 50%, ${T.green} 100%)`
    : `linear-gradient(135deg, ${T.pink} 0%, ${T.pinkDeep} 50%, ${T.pink} 100%)`;
  const shadowColor = variant === 'green' ? '34,197,94' : '236,72,153';
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
      style={{
        width: '100%',
        background: disabled ? '#A7F3D0' : grad,
        backgroundSize: '200% 200%',
        animation: disabled ? 'none' : 'gradientShift 3s ease infinite',
        color: '#fff',
        border: 'none', borderRadius: 14, padding: '20px',
        fontSize: 16, fontWeight: 700, fontFamily: fonts.ui,
        letterSpacing: 0.5,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 0.18s cubic-bezier(.2,.7,.3,1)',
        boxShadow: disabled
          ? 'none'
          : pressed
            ? `0 2px 8px rgba(${shadowColor},0.3), inset 0 2px 4px rgba(0,0,0,0.1)`
            : `0 10px 28px rgba(${shadowColor},0.36), 0 2px 6px rgba(${shadowColor},0.2)`,
        transform: pressed ? 'scale(0.98) translateY(1px)' : 'scale(1)',
        textTransform: variant === 'green' ? 'uppercase' : 'none',
      }}
    >
      {children}
    </button>
  );
}

function CheckItem({ children, color = T.green }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
      <div style={{
        flexShrink: 0, marginTop: 1, width: 24, height: 24, borderRadius: '50%',
        background: color === T.green ? `linear-gradient(135deg, ${T.green}, ${T.greenDeep})` : `linear-gradient(135deg, ${T.pink}, ${T.pinkDeep})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 3px 8px ${color}55`,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
      <div style={{ flex: 1, fontSize: 14.5, color: T.ink, lineHeight: 1.55, fontFamily: fonts.ui }}>{children}</div>
    </div>
  );
}

function CrossItem({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
      <div style={{
        flexShrink: 0, marginTop: 1, width: 24, height: 24, borderRadius: '50%',
        background: `linear-gradient(135deg, ${T.red}, #DC2626)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 3px 8px rgba(239,68,68,0.4)',
      }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </div>
      <div style={{ flex: 1, fontSize: 14.5, color: T.ink, lineHeight: 1.55, fontFamily: fonts.ui }}>{children}</div>
    </div>
  );
}

// ─── Card de oferta ──────────────────────────────────────────
function OfferCard({ countdown, name, onBuy }: { countdown: string; name: string; onBuy: () => void }) {
  return (
    <div style={{
      marginBottom: 28, position: 'relative',
      animation: 'cardIn 0.6s cubic-bezier(.2,.85,.25,1)',
    }}>
      <div style={{
        background: `linear-gradient(135deg, ${T.pink}, ${T.pinkDeep})`,
        color: '#fff', padding: '10px 16px',
        textAlign: 'center', fontSize: 13, fontWeight: 700,
        borderTopLeftRadius: 18, borderTopRightRadius: 18,
        fontFamily: fonts.ui, letterSpacing: 0.3,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        <span style={{ fontSize: 14 }}>⏱</span>
        Seu desconto está reservado por: <span style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: 1, fontSize: 14 }}>{countdown}</span>
      </div>
      <div style={{
        background: T.pinkDeep, color: '#fff', padding: '7px 14px',
        textAlign: 'center', fontSize: 11, fontWeight: 700,
        letterSpacing: 2, textTransform: 'uppercase',
        fontFamily: fonts.ui,
      }}>
        ✨ Oferta Especial
      </div>
      <div style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: `1px solid ${T.border}`, borderTop: 'none',
        borderBottomLeftRadius: 18, borderBottomRightRadius: 18,
        padding: '22px 20px',
        boxShadow: '0 14px 36px rgba(190,24,93,0.12)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 18 }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 18, fontFamily: fonts.display, fontWeight: 600, color: T.ink,
              lineHeight: 1.2, letterSpacing: -0.3,
            }}>
              Plano Capilar Personalizado para <em style={{ color: T.pinkDeep }}>{name || 'você'}</em>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: T.inkMuted, textDecoration: 'line-through', marginBottom: 2, fontFamily: fonts.ui }}>R$ 59,90</div>
            <div style={{
              fontFamily: fonts.display, fontSize: 32, fontWeight: 700,
              background: `linear-gradient(135deg, ${T.pinkDeep}, ${T.pink})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              lineHeight: 1, letterSpacing: -1,
            }}>R$ 34,90</div>
            <div style={{ fontSize: 9, color: T.inkSoft, marginTop: 3, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', fontFamily: fonts.ui }}>pagamento único</div>
          </div>
        </div>
        <div style={{
          fontSize: 12, color: T.inkSoft, textAlign: 'center', marginBottom: 14,
          fontFamily: fonts.ui,
          padding: '8px 12px', background: T.cream, borderRadius: 99,
          border: `1px solid ${T.border}`,
        }}>
          💳 Pagamento único no Pix ou Cartão de Crédito
        </div>
        <GreenButton onClick={onBuy} variant="green">Comprar agora</GreenButton>
      </div>
    </div>
  );
}

// ╔═══════════════════════════════════════════════════════════╗
// ║              Main component                              ║
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
  const [pixOrderId, setPixOrderId] = useState('');
  const [pixExpiresAt, setPixExpiresAt] = useState<number>(0); // unix ms
  const [pixCopied, setPixCopied] = useState(false);
  const [pixPollCount, setPixPollCount] = useState(0);
  const [pixExpired, setPixExpired] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [payType, setPayType] = useState<'card' | 'pix'>('pix');
  const [images, setImages] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detalhes do cartão (validação inline)
  const [cardBrand, setCardBrand] = useState<string>('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [cepAddress, setCepAddress] = useState<{ city: string; state: string } | null>(null);
  const [cardSubscriptionId, setCardSubscriptionId] = useState('');
  const [cardPolling, setCardPolling] = useState(false);

  // 24 horas (em vez de 9:57 fake que reseta a cada refresh)
  const countdown = useHonestCountdown(24 * 60 * 60);

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
      logEvent({ event_type: 'offer_viewed' });

      // ── Recovery: se havia PIX pendente, volta direto pra tela do QR ──
      try {
        const pending = localStorage.getItem('pix_pending');
        if (pending) {
          const p = JSON.parse(pending);
          // Só recupera se ainda dentro de 1h
          if (p.expiresAt && p.expiresAt > Date.now() && p.orderId) {
            setPixOrderId(p.orderId);
            setPixQrCode(p.qrCode ?? '');
            setPixQrCodeUrl(p.qrCodeUrl ?? '');
            setPixExpiresAt(p.expiresAt);
            if (p.email) setEmail(p.email);
            if (p.name) setName(p.name);
            setStep('pix_qr');
          } else {
            localStorage.removeItem('pix_pending');
          }
        }
      } catch {}
    }
    fetch('/api/quiz/images')
      .then(r => r.json())
      .then((data: Record<string, string>) => {
        if (data && typeof data === 'object') setImages(data);
      })
      .catch(() => {});
  }, []);

  // ── Polling do PIX — verifica a cada 5s até expirar (até 1h) ──
  useEffect(() => {
    if (step !== 'pix_qr' || !pixOrderId) return;
    if (pixExpiresAt && Date.now() >= pixExpiresAt) {
      setPixExpired(true);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/checkout/pix/status?order_id=${encodeURIComponent(pixOrderId)}&email=${encodeURIComponent(email)}`
        );
        const data = await res.json();
        if (data.paid) {
          localStorage.setItem('purchase_data', JSON.stringify({ email, name, purchasedAt: Date.now() }));
          localStorage.removeItem('pix_pending');
          setStep('pix_confirmed');
          setTimeout(() => router.push('/obrigado'), 2000);
        } else {
          setPixPollCount(c => c + 1);
        }
      } catch {
        setPixPollCount(c => c + 1);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [step, pixOrderId, pixPollCount, pixExpiresAt, email, name, router]);

  // ── Polling do cartão (caso assinatura demore a virar 'active') ──
  useEffect(() => {
    if (!cardPolling || !cardSubscriptionId) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/checkout/card/status?subscription_id=${encodeURIComponent(cardSubscriptionId)}&email=${encodeURIComponent(email)}`
        );
        const data = await res.json();
        if (data.paid) {
          localStorage.setItem('purchase_data', JSON.stringify({ email, name, purchasedAt: Date.now() }));
          await logEvent({ event_type: 'payment_confirmed', email, payment_type: 'card', amount_cents: 3490 });
          router.push('/obrigado');
        } else if (data.failed) {
          setCardPolling(false);
          setError('Não foi possível cobrar seu cartão. Verifique os dados ou tente outro método.');
          setStep('card_form');
        }
      } catch {}
    }, 3000);
    return () => clearTimeout(timer);
  }, [cardPolling, cardSubscriptionId, email, name, router]);

  // Validação granular do cartão (usada nos hints e no botão)
  const cardErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    const numClean = cardNumber.replace(/\s/g, '');
    if (numClean.length > 0 && (numClean.length < 13 || !luhnCheck(numClean))) {
      errs.number = 'Número do cartão inválido';
    }
    if (cardName.trim().length > 0 && cardName.trim().length < 3) {
      errs.name = 'Nome muito curto';
    }
    if (cardExpiry.length > 0 && !isValidExpiry(cardExpiry)) {
      errs.expiry = 'Data expirada ou inválida';
    }
    if (cardCvv.length > 0 && cardCvv.length < 3) {
      errs.cvv = 'CVV inválido';
    }
    const cpfClean = cpf.replace(/\D/g, '');
    if (cpfClean.length > 0 && cpfClean.length === 11 && !isValidCpf(cpf)) {
      errs.cpf = 'CPF inválido';
    }
    if (cep.replace(/\D/g, '').length > 0 && cep.replace(/\D/g, '').length === 8 && cepStatus === 'error') {
      errs.cep = 'CEP não encontrado';
    }
    return errs;
  }, [cardNumber, cardName, cardExpiry, cardCvv, cpf, cep, cepStatus]);

  const isCardComplete = useMemo(() => (
    luhnCheck(cardNumber.replace(/\s/g, '')) &&
    cardName.trim().length >= 3 &&
    isValidExpiry(cardExpiry) &&
    cardCvv.length >= 3 &&
    isValidCpf(cpf) &&
    cep.replace(/\D/g, '').length === 8 &&
    cepStatus === 'ok'
  ), [cardNumber, cardName, cardExpiry, cardCvv, cpf, cep, cepStatus]);

  // Detecta brand do cartão enquanto digita
  useEffect(() => {
    setCardBrand(detectCardBrand(cardNumber));
  }, [cardNumber]);

  // Resolve CEP via ViaCEP quando preenchido
  useEffect(() => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) {
      setCepStatus('idle');
      setCepAddress(null);
      return;
    }
    setCepStatus('loading');
    fetch(`https://viacep.com.br/ws/${clean}/json/`)
      .then(r => r.json())
      .then(data => {
        if (data?.erro) {
          setCepStatus('error');
          setCepAddress(null);
        } else {
          setCepStatus('ok');
          setCepAddress({ city: data.localidade, state: data.uf });
        }
      })
      .catch(() => setCepStatus('error'));
  }, [cep]);

  async function handlePix() {
    if (isSubmitting) return;
    setIsSubmitting(true);
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
        body: JSON.stringify({
          name,
          email,
          cpf: cpf.replace(/\D/g, ''),
          phone: (quizAnswers?.phone ?? '').toString().replace(/\D/g, ''),
          quiz_answers: quizAnswers,
          session_id: getSessionId(),
        }),
      });
      const data = await res.json();
      clearInterval(interval);
      if (!res.ok) throw new Error(data.error);

      const expiresAtMs = data.expires_at ? new Date(data.expires_at).getTime() : Date.now() + 3600_000;

      setPixQrCode(data.pix_qr_code);
      setPixQrCodeUrl(data.pix_qr_code_url);
      setPixOrderId(data.order_id);
      setPixExpiresAt(expiresAtMs);
      setPixPollCount(0);
      setPixExpired(false);

      // Persiste para recovery em refresh/close tab
      try {
        localStorage.setItem('pix_pending', JSON.stringify({
          orderId: data.order_id,
          qrCode: data.pix_qr_code,
          qrCodeUrl: data.pix_qr_code_url,
          expiresAt: expiresAtMs,
          email, name,
        }));
      } catch {}

      setStep('pix_qr');
    } catch (err) {
      clearInterval(interval);
      setError(err instanceof Error ? err.message : 'Erro ao gerar PIX');
      setStep('card_form');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCard() {
    if (isSubmitting) return;
    setError('');
    const publishableKey = process.env.NEXT_PUBLIC_PAGARME_PUBLISHABLE_KEY;
    if (!publishableKey) {
      setError('Chave de pagamento não configurada. Contate o suporte.');
      return;
    }
    if (!isCardComplete) {
      setError('Preencha todos os campos corretamente.');
      // Marca todos como tocados pra mostrar erros
      setTouched({ number: true, name: true, expiry: true, cvv: true, cpf: true, cep: true });
      return;
    }
    setIsSubmitting(true);
    setStep('loading');
    try {
      const cleanCpf = cpf.replace(/\D/g, '');
      const cleanCep = cep.replace(/\D/g, '');
      // Endereço REAL vindo do ViaCEP (não mais hardcoded SP)
      const billingCity  = cepAddress?.city  ?? 'São Paulo';
      const billingState = cepAddress?.state ?? 'SP';

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
              line_1: 'Endereço cadastrado',
              zip_code: cleanCep,
              city: billingCity,
              state: billingState,
              country: 'BR',
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
          phone: (quizAnswers?.phone ?? '').toString().replace(/\D/g, ''),
          card_token: tokenData.id,
          quiz_answers: quizAnswers,
          session_id: getSessionId(),
          billing_address: { city: billingCity, state: billingState, cep: cleanCep },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Cobrança aprovada imediatamente?
      if (data.paid) {
        localStorage.setItem('purchase_data', JSON.stringify({ email, name, purchasedAt: Date.now() }));
        await logEvent({ event_type: 'payment_confirmed', email, payment_type: 'card', amount_cents: 3490 });
        router.push('/obrigado');
      } else {
        // Assinatura criada mas cobrança ainda pendente — inicia polling
        setCardSubscriptionId(data.subscription_id);
        setCardPolling(true);
        setLoadingMsg('Confirmando seu pagamento…');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar cartão');
      setStep('card_form');
    } finally {
      setIsSubmitting(false);
    }
  }

  const onBuy = () => {
    // Log evento de checkout iniciado
    logEvent({ event_type: 'checkout_initiated', email, payment_type: payType, amount_cents: 3490 });

    // Pixel Meta — InitiateCheckout com Advanced Matching
    try {
      if (typeof window !== 'undefined' && (window as any).fbq) {
        const ans: any = quizAnswers;
        const em = (ans.email ?? email ?? '').toString().toLowerCase().trim();
        const phoneDigits = (ans.phone ?? '').toString().replace(/\D/g, '');
        const phoneE164 = phoneDigits.length === 10 || phoneDigits.length === 11 ? '55' + phoneDigits : phoneDigits;
        const fullName = (ans.name ?? name ?? '').toString().toLowerCase().trim().split(/\s+/);
        const firstName = fullName[0] ?? '';
        const lastName  = fullName.slice(1).join(' ');
        if (em || phoneE164) {
          ;(window as any).fbq('init', '921783859786853', {
            em: em || undefined,
            ph: phoneE164 || undefined,
            fn: firstName || undefined,
            ln: lastName || undefined,
            country: 'br',
          });
        }
        ;(window as any).fbq('track', 'InitiateCheckout', {
          content_name: 'Plano Capilar Personalizado',
          value: 34.90,
          currency: 'BRL',
        });
      }
    } catch {}
    setStep('card_form');
  };

  const fontStyles = `
    @keyframes cardIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
    @keyframes statFill { from { width: 0; } }
    @keyframes gradientShift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
    @keyframes petalFloat {
      0%, 100% { transform: translateY(0) translateX(0) rotate(0deg); }
      25% { transform: translateY(-25px) translateX(15px) rotate(90deg); }
      50% { transform: translateY(-8px) translateX(-12px) rotate(180deg); }
      75% { transform: translateY(15px) translateX(8px) rotate(270deg); }
    }
    @keyframes petalSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  `;

  // ── Loading ──
  if (step === 'loading') {
    return (
      <>
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <style>{fontStyles}</style>
        <div style={{
          minHeight: '100vh',
          background: `radial-gradient(circle at 50% 30%, ${T.rose}, ${T.bg})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
          gap: 24, padding: 24, fontFamily: fonts.ui,
        }}>
          <div style={{
            width: 64, height: 64, border: `4px solid ${T.pinkSoft}`,
            borderTopColor: T.pink, borderRadius: '50%', animation: 'spin 0.9s linear infinite',
          }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{
              color: T.ink, fontSize: 18, fontWeight: 700, marginBottom: 6,
              fontFamily: fonts.display,
            }}>
              {loadingMsg}
            </p>
            <p style={{ color: T.inkSoft, fontSize: 13 }}>Isso pode levar alguns segundos…</p>
          </div>
        </div>
      </>
    );
  }

  // ── PIX Confirmado ──
  if (step === 'pix_confirmed') {
    return (
      <>
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <style>{fontStyles}</style>
        <div style={{
          minHeight: '100vh', background: `radial-gradient(circle at 50% 30%, #D1FAE5, ${T.bg})`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 20, padding: 24, fontFamily: fonts.ui,
        }}>
          <div style={{ fontSize: 72 }}>✅</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: T.ink, textAlign: 'center', fontFamily: fonts.display }}>
            Pagamento confirmado!
          </h1>
          <p style={{ color: T.inkSoft, fontSize: 15, textAlign: 'center' }}>Redirecionando você…</p>
        </div>
      </>
    );
  }

  // ── PIX QR Code ──
  if (step === 'pix_qr') {
    const isExpired = pixExpired || (pixExpiresAt > 0 && Date.now() >= pixExpiresAt);
    const secondsLeft = Math.max(0, Math.floor((pixExpiresAt - Date.now()) / 1000));
    const mmExp = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
    const ssExp = String(secondsLeft % 60).padStart(2, '0');
    return (
      <>
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <style>{fontStyles}</style>
        <div style={{
          minHeight: '100vh',
          background: `radial-gradient(circle at 30% 0%, ${T.rose}, transparent 50%), ${T.bg}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '40px 24px', fontFamily: fonts.ui,
        }}>
          <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
            <h1 style={{
              fontSize: 26, fontWeight: 600, color: T.ink, marginBottom: 8,
              fontFamily: fonts.display, letterSpacing: -0.4,
            }}>Pague via PIX</h1>
            <p style={{ color: T.inkSoft, fontSize: 14, marginBottom: 24 }}>Escaneie o QR Code ou copie o código abaixo</p>
            {pixQrCodeUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pixQrCodeUrl} alt="QR Code PIX" style={{
                width: 220, height: 220, borderRadius: 18, marginBottom: 24,
                border: `4px solid #fff`, boxShadow: `0 16px 36px ${T.pinkDeep}1A`,
              }} />
            )}
            <div style={{
              background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
              borderRadius: 18, padding: 16, marginBottom: 20, border: `1px solid ${T.border}`,
            }}>
              <p style={{ color: T.inkSoft, fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Código PIX (copia e cola)</p>
              <p style={{ color: T.ink, fontSize: 11, wordBreak: 'break-all', lineHeight: 1.6, fontFamily: 'ui-monospace, monospace' }}>
                {pixQrCode.slice(0, 80)}…
              </p>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(pixQrCode); setPixCopied(true); }}
              style={{
                width: '100%',
                background: pixCopied
                  ? `linear-gradient(135deg, ${T.green}, ${T.greenDeep})`
                  : `linear-gradient(135deg, ${T.pink}, ${T.pinkDeep})`,
                border: 'none', borderRadius: 14, padding: 18, fontSize: 15, fontWeight: 700,
                color: '#fff', cursor: 'pointer', marginBottom: 16, fontFamily: fonts.ui,
                boxShadow: pixCopied ? `0 8px 20px ${T.green}44` : `0 8px 20px ${T.pink}44`,
                transition: 'all 0.25s',
              }}
            >
              {pixCopied ? '✓ Código copiado!' : '📋 Copiar código PIX'}
            </button>

            {/* Status: polling + countdown real */}
            {!isExpired ? (
              <>
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
                  <p style={{ color: T.inkSoft, fontSize: 13, margin: 0 }}>
                    Aguardando confirmação do pagamento…
                  </p>
                </div>
                {pixExpiresAt > 0 && (
                  <p style={{ color: T.inkSoft, fontSize: 12, margin: 0 }}>
                    ⏱ Este PIX expira em <strong style={{ color: T.ink, fontFamily: 'ui-monospace, monospace' }}>{mmExp}:{ssExp}</strong>
                  </p>
                )}
              </>
            ) : (
              <div style={{
                background: '#FEF3C7', borderRadius: 12, padding: '12px 16px',
                border: '1px solid #FDE68A',
              }}>
                <p style={{ color: '#92400E', fontSize: 13, margin: 0 }}>
                  ⏳ O PIX expirou. <button onClick={() => {
                    localStorage.removeItem('pix_pending');
                    setPixOrderId(''); setPixQrCode(''); setPixQrCodeUrl('');
                    setPixExpiresAt(0); setPixExpired(false);
                    setStep('card_form');
                  }} style={{ color: T.pinkDeep, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: 0 }}>Gerar novo PIX</button>
                </p>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // ── Card Form ──
  if (step === 'card_form') {
    const inputStyle = (focused: boolean): React.CSSProperties => ({
      background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
      border: `1.5px solid ${focused ? T.pink : T.border}`, borderRadius: 14,
      padding: '16px 18px', fontSize: 15, color: T.ink, width: '100%',
      outline: 'none', fontFamily: fonts.ui, boxSizing: 'border-box',
      boxShadow: focused
        ? `0 0 0 4px ${T.pink}22, 0 4px 12px rgba(190,24,93,0.06)`
        : '0 2px 8px rgba(190,24,93,0.04)',
      transition: 'all 0.25s',
    });
    const focusableInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => {
      const [f, setF] = [false, () => {}]; // not actually using state for simplicity
      return <input {...props} style={{ ...inputStyle(false) }} onFocus={(e) => { e.currentTarget.style.borderColor = T.pink; e.currentTarget.style.boxShadow = `0 0 0 4px ${T.pink}22, 0 4px 12px rgba(190,24,93,0.06)`; }} onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = '0 2px 8px rgba(190,24,93,0.04)'; }} />;
    };
    return (
      <>
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <style>{fontStyles}</style>
        <div style={{
          minHeight: '100vh',
          background: `radial-gradient(circle at 30% 0%, ${T.rose}, transparent 50%), ${T.bg}`,
          padding: '24px', fontFamily: fonts.ui,
        }}>
          <div style={{ maxWidth: 420, margin: '0 auto' }}>
            <button onClick={() => setStep('offer')} style={{
              background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(12px)',
              border: `1px solid ${T.border}`, borderRadius: 99,
              color: T.ink, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', marginBottom: 20, padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              ‹ Voltar
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 22 }}>
              {(['card', 'pix'] as const).map(type => (
                <button key={type} onClick={() => setPayType(type)} style={{
                  background: payType === type
                    ? `linear-gradient(135deg, ${T.pink}, ${T.pinkDeep})`
                    : 'rgba(255,255,255,0.85)',
                  backdropFilter: 'blur(12px)',
                  color: payType === type ? '#fff' : T.ink,
                  border: `1.5px solid ${payType === type ? 'transparent' : T.border}`,
                  borderRadius: 14, padding: '14px', cursor: 'pointer', textAlign: 'center',
                  fontSize: 14, fontWeight: 700, fontFamily: fonts.ui,
                  boxShadow: payType === type ? `0 8px 20px ${T.pink}33` : '0 2px 6px rgba(0,0,0,0.04)',
                  transition: 'all 0.22s',
                }}>
                  {type === 'card' ? '💳 Cartão' : '📱 PIX'}
                </button>
              ))}
            </div>

            <h1 style={{
              fontSize: 26, fontWeight: 600, color: T.ink, marginBottom: 6,
              fontFamily: fonts.display, letterSpacing: -0.4,
            }}>
              {payType === 'card' ? 'Dados do cartão' : 'Pagar com PIX'}
            </h1>
            <p style={{ color: T.inkSoft, fontSize: 14, marginBottom: 24 }}>R$ 34,90 — pagamento único</p>

            {payType === 'card' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <input
                    style={inputStyle(false)} placeholder="Nome no cartão" value={cardName}
                    onChange={e => setCardName(e.target.value)}
                    onBlur={() => setTouched(t => ({ ...t, name: true }))}
                    autoComplete="cc-name"
                  />
                  {touched.name && cardErrors.name && (
                    <p style={{ color: T.red, fontSize: 12, marginTop: 4, marginLeft: 4 }}>{cardErrors.name}</p>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...inputStyle(false), paddingRight: cardBrand ? 60 : 18 }}
                    placeholder="Número do cartão" value={cardNumber}
                    onChange={e => setCardNumber(formatCard(e.target.value))}
                    onBlur={() => setTouched(t => ({ ...t, number: true }))}
                    maxLength={19} inputMode="numeric" autoComplete="cc-number"
                  />
                  {cardBrand && (
                    <span style={{
                      position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                      fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: 'uppercase',
                      background: T.pinkSoft, padding: '4px 8px', borderRadius: 6, letterSpacing: 0.5,
                    }}>{cardBrand}</span>
                  )}
                  {touched.number && cardErrors.number && (
                    <p style={{ color: T.red, fontSize: 12, marginTop: 4, marginLeft: 4 }}>{cardErrors.number}</p>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <input
                      style={inputStyle(false)} placeholder="MM/AA" value={cardExpiry}
                      onChange={e => setCardExpiry(formatExpiry(e.target.value))}
                      onBlur={() => setTouched(t => ({ ...t, expiry: true }))}
                      maxLength={5} inputMode="numeric" autoComplete="cc-exp"
                    />
                    {touched.expiry && cardErrors.expiry && (
                      <p style={{ color: T.red, fontSize: 12, marginTop: 4, marginLeft: 4 }}>{cardErrors.expiry}</p>
                    )}
                  </div>
                  <div>
                    <input
                      style={inputStyle(false)} placeholder="CVV" value={cardCvv}
                      onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      onBlur={() => setTouched(t => ({ ...t, cvv: true }))}
                      maxLength={4} inputMode="numeric" autoComplete="cc-csc"
                    />
                    {touched.cvv && cardErrors.cvv && (
                      <p style={{ color: T.red, fontSize: 12, marginTop: 4, marginLeft: 4 }}>{cardErrors.cvv}</p>
                    )}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
                  <div>
                    <input
                      style={inputStyle(false)} placeholder="CPF" value={cpf}
                      onChange={e => setCpf(formatCpf(e.target.value))}
                      onBlur={() => setTouched(t => ({ ...t, cpf: true }))}
                      maxLength={14} inputMode="numeric"
                    />
                    {touched.cpf && cardErrors.cpf && (
                      <p style={{ color: T.red, fontSize: 12, marginTop: 4, marginLeft: 4 }}>{cardErrors.cpf}</p>
                    )}
                  </div>
                  <div>
                    <input
                      style={inputStyle(false)} placeholder="CEP" value={cep}
                      onChange={e => setCep(formatCep(e.target.value))}
                      onBlur={() => setTouched(t => ({ ...t, cep: true }))}
                      maxLength={9} inputMode="numeric"
                    />
                    {cepStatus === 'ok' && cepAddress && (
                      <p style={{ color: T.green, fontSize: 11, marginTop: 4, marginLeft: 4 }}>
                        ✓ {cepAddress.city}/{cepAddress.state}
                      </p>
                    )}
                    {cepStatus === 'loading' && (
                      <p style={{ color: T.inkSoft, fontSize: 11, marginTop: 4, marginLeft: 4 }}>Buscando…</p>
                    )}
                    {touched.cep && cardErrors.cep && (
                      <p style={{ color: T.red, fontSize: 12, marginTop: 4, marginLeft: 4 }}>{cardErrors.cep}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input style={inputStyle(false)} placeholder="Seu nome completo" value={name} onChange={e => setName(e.target.value)} />
                <input style={inputStyle(false)} type="email" placeholder="Seu e-mail" value={email} onChange={e => setEmail(e.target.value)} />
                <input style={inputStyle(false)} placeholder="CPF" value={cpf} onChange={e => setCpf(formatCpf(e.target.value))} maxLength={14} inputMode="numeric" />
              </div>
            )}

            {error && (
              <p style={{ color: T.red, fontSize: 13, marginTop: 12, padding: '12px 16px', background: '#FEF2F2', borderRadius: 12, border: '1px solid #FECACA' }}>{error}</p>
            )}

            <div style={{ marginTop: 20 }}>
              <GreenButton
                onClick={payType === 'card' ? handleCard : handlePix}
                disabled={
                  isSubmitting ||
                  (payType === 'card'
                    ? !isCardComplete
                    : !isValidCpf(cpf) || !name.trim() || !email.includes('@'))
                }
              >
                {isSubmitting ? '⏳ Processando…' : `🔒 ${payType === 'card' ? 'Pagar R$ 34,90' : 'Gerar PIX — R$ 34,90'}`}
              </GreenButton>
            </div>
            {/* Trust badges */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 14, marginTop: 14, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 11, color: T.inkSoft, display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: fonts.ui }}>
                🔒 SSL 256-bit
              </span>
              <span style={{ fontSize: 11, color: T.inkSoft, display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: fonts.ui }}>
                🛡 Anti-fraude
              </span>
              <span style={{ fontSize: 11, color: T.inkSoft, display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: fonts.ui }}>
                💳 PagarMe
              </span>
            </div>
            <p style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: T.inkSoft, fontFamily: fonts.ui }}>
              Garantia de 7 dias · Seus dados nunca são compartilhados
            </p>
          </div>
        </div>
      </>
    );
  }

  // ── Main Offer Page ──
  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{fontStyles}</style>
      <div style={{
        minHeight: '100vh', position: 'relative',
        background: `
          radial-gradient(circle at 20% 0%, ${T.rose} 0%, transparent 45%),
          radial-gradient(circle at 80% 100%, ${T.champagne} 0%, transparent 50%),
          ${T.bg}
        `,
        color: T.ink, fontFamily: fonts.ui,
        overflowX: 'hidden',
      }}>
        <FloatingPetals />
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 18px 40px', position: 'relative', zIndex: 1 }}>
          {/* Voltar */}
          <button onClick={() => router.back()} style={{
            background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(12px)',
            border: `1px solid ${T.border}`, borderRadius: '50%',
            cursor: 'pointer', color: T.ink, padding: 0, marginBottom: 18,
            width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 4l-7 7 7 7" />
            </svg>
          </button>

          {/* Antes/Depois */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18, animation: 'cardIn 0.6s cubic-bezier(.2,.85,.25,1)' }}>
            <CompareCard side="antes" name="Comprimento de cabelo" stats={[
              { label: 'Pequeno', pct: 25 }, { label: 'Alto', pct: 90 },
              { label: 'Frizz', pct: 75 }, { label: 'Hidratação', pct: 35 }, { label: 'Pontas', pct: 25 },
            ]} />
            <CompareCard side="depois" name="Comprimento" stats={[
              { label: 'Grande', pct: 90 }, { label: 'Alto', pct: 90 },
              { label: 'Frizz', pct: 100 }, { label: 'Hidratação', pct: 100 }, { label: 'Pontas', pct: 98 },
            ]} />
          </div>

          {/* Plano completo + grupo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 22 }}>
            {[
              { title: 'Plano completo profissional', desc: 'Rotina capilar, indicação de produtos, análise de cabelo, tirar dúvidas pelo WhatsApp', icon: '✨' },
              { title: 'Acesso ao grupo de promoções', desc: 'Um grupo fechado onde mando os produtos que eu indico', icon: '💝' },
            ].map((c, i) => (
              <div key={i} style={{
                background: `linear-gradient(135deg, ${T.rose}, ${T.cream})`,
                borderRadius: 18, padding: '16px 16px',
                border: `1px solid ${T.pinkSoft}`,
                boxShadow: '0 6px 16px rgba(190,24,93,0.06)',
                animation: `cardIn 0.55s ${i * 80}ms both cubic-bezier(.2,.85,.25,1)`,
              }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{c.icon}</div>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: T.pinkDeep, marginBottom: 6,
                  fontFamily: fonts.ui, lineHeight: 1.3,
                }}>
                  {c.title}
                </div>
                <div style={{ fontSize: 11, color: T.inkSoft, lineHeight: 1.5, fontFamily: fonts.ui }}>
                  {c.desc}
                </div>
              </div>
            ))}
          </div>

          {/* Headline */}
          <div style={{
            fontSize: 24, fontFamily: fonts.display, color: T.ink, fontWeight: 600,
            textAlign: 'center', marginBottom: 22, lineHeight: 1.25, letterSpacing: -0.3,
          }}>
            <em style={{ color: T.pinkDeep }}>{name || 'Você'}</em>, seu plano personalizado está pronto! ✨
          </div>

          {/* First offer */}
          <OfferCard countdown={countdown} name={name} onBuy={onBuy} />

          {/* Social proof */}
          <div style={{
            fontSize: 18, fontFamily: fonts.display, color: T.ink,
            lineHeight: 1.4, fontWeight: 500, textAlign: 'center', marginBottom: 26,
            letterSpacing: -0.2,
          }}>
            Mulheres como você obtiveram excelentes resultados utilizando o nosso{' '}
            <em style={{
              fontWeight: 600,
              background: `linear-gradient(135deg, ${T.pinkDeep}, ${T.gold})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              Plano Capilar Personalizado da Tricologista Ju Cost
            </em>
          </div>

          {/* A vida antes */}
          <div style={{
            fontSize: 19, fontFamily: fonts.display, color: T.pinkDeep,
            fontWeight: 600, marginBottom: 14, letterSpacing: -0.2,
          }}>
            A vida antes de ter um plano personalizado para seu cabelo:
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(12px)',
            border: `1px solid ${T.border}`, borderRadius: 18, padding: '18px 18px',
            marginBottom: 24,
          }}>
            <CrossItem>Baixa autoestima</CrossItem>
            <CrossItem>Cabelo quebradiço</CrossItem>
            <CrossItem>Ressecamento dos fios</CrossItem>
            <CrossItem>Desidratada</CrossItem>
            <CrossItem><span style={{ marginBottom: 0 }}>Falhas no cabelo</span></CrossItem>
          </div>

          {/* Brilho Intenso etc */}
          <div style={{
            background: `linear-gradient(135deg, ${T.cream}, #fff)`,
            border: `1px solid ${T.pinkSoft}`, borderRadius: 18, padding: '18px 18px',
            marginBottom: 26,
          }}>
            <CheckItem><strong>Brilho Intenso:</strong> fios que refletem luz e tem aparência saudável.</CheckItem>
            <CheckItem><strong>Hidratação visível:</strong> toque macio e sedoso.</CheckItem>
            <CheckItem><strong>Sem frizz:</strong> alinhamento dos fios e aparência disciplinada.</CheckItem>
            <CheckItem><strong>Crescimento saudável:</strong> fios que crescem regularmente e com vitalidade.</CheckItem>
            <CheckItem><strong>Longo comprimento</strong></CheckItem>
            <CheckItem><strong>Crescimento acelerado e correção de falhas</strong></CheckItem>
          </div>

          {/* Para quem é */}
          <div style={{
            fontSize: 22, fontFamily: fonts.display, color: T.ink,
            fontWeight: 600, textAlign: 'center', marginBottom: 16, letterSpacing: -0.3,
          }}>
            Para quem é?
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(12px)',
            border: `1px solid ${T.border}`, borderRadius: 18, padding: '18px 18px',
            marginBottom: 26,
          }}>
            <CheckItem color={T.pink}>Para todas as mulheres que querem ter um cabelo lindo e começar a ver resultados <strong>EM MENOS DE 90 DIAS</strong>.</CheckItem>
            <CheckItem color={T.pink}>Para quem deseja seguir uma nova rotina de cuidados que seja acessível</CheckItem>
            <CheckItem color={T.pink}>Para quem já se sente frustrada com produtos de cabelo que não funcionam</CheckItem>
            <CheckItem color={T.pink}>Para todas que <strong>NÃO querem gastar dinheiro com produtos caros que não funcionam</strong></CheckItem>
          </div>

          {/* Second offer */}
          <OfferCard countdown={countdown} name={name} onBuy={onBuy} />

          {/* O que você vai ter */}
          <div style={{
            fontSize: 22, fontFamily: fonts.display, color: T.ink,
            fontWeight: 600, textAlign: 'center', marginBottom: 16, letterSpacing: -0.3,
          }}>
            O que você vai ter:
          </div>
          <div style={{
            background: `linear-gradient(135deg, ${T.cream}, #fff)`,
            border: `1px solid ${T.pinkSoft}`, borderRadius: 18, padding: '18px 18px',
            marginBottom: 26,
          }}>
            <CheckItem color={T.pink}>Plano capilar para você seguir nos próximos 90 dias com base nos produtos que você já tem</CheckItem>
            <CheckItem color={T.pink}>Lista de compras prática para sempre ter os produtos necessários em casa</CheckItem>
            <CheckItem color={T.pink}>Checklist semanal de Hábitos para seu cabelo</CheckItem>
            <CheckItem color={T.pink}>Acesso a um grupo exclusivo de descontos em produtos para cabelo</CheckItem>
            <CheckItem color={T.pink}>Dicas de cuidados e rotina capilar</CheckItem>
          </div>

          {/* 3 testimonial photos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 32 }}>
            {[
              images['oferta_resultado_1'] || '/images/resultado-antes1.png',
              images['oferta_resultado_2'] || '/images/resultado-antes2.png',
              images['oferta_resultado_3'] || '/images/resultado-antes3.png',
            ].map((src, i) => (
              <div key={i} style={{
                borderRadius: 16, overflow: 'hidden', aspectRatio: '3/4', background: '#F3F4F6',
                boxShadow: '0 8px 20px rgba(190,24,93,0.1)',
                border: `2px solid #fff`,
                animation: `cardIn 0.5s ${i * 80}ms both cubic-bezier(.2,.85,.25,1)`,
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Resultado ${i+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>

          {/* Perguntas Frequentes */}
          <div style={{
            fontSize: 22, fontFamily: fonts.display, color: T.ink,
            fontWeight: 600, textAlign: 'center', marginBottom: 18, letterSpacing: -0.3,
          }}>
            Perguntas Frequentes
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(12px)',
            border: `1px solid ${T.border}`, borderRadius: 18,
            marginBottom: 32, overflow: 'hidden',
          }}>
            {[
              { q: 'Quando eu adquirir o plano, ele já está disponível?', a: 'Sim, todo o conteúdo do plano é liberado imediatamente, porém, a parte personalizada será entregue em até 3 dias pois precisa ler cada resposta para fazer algo feito para você.' },
              { q: 'Os produtos indicados são difíceis de encontrar?', a: 'Não. Indicamos produtos acessíveis e que você encontra em qualquer farmácia ou loja de cosméticos.' },
              { q: 'Quando posso começar a ver resultados?', a: 'Os primeiros resultados aparecem em até 4 semanas seguindo o plano corretamente. Em 90 dias você verá a transformação completa.' },
              { q: 'Você usa Mega Hair?', a: 'Não. Todo o trabalho é feito com seu cabelo natural, focado em recuperação e fortalecimento dos fios.' },
              { q: 'O que é Tricologia?', a: 'É a ciência que estuda os cabelos e o couro cabeludo. A Juliane é tricologista formada e atende mulheres com problemas capilares há anos.' },
            ].map((f, i) => (
              <div key={i} style={{ borderBottom: i < 4 ? `1px solid ${T.border}` : 'none' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: '100%', background: 'transparent', border: 'none',
                    textAlign: 'left', padding: '16px 18px', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                    fontFamily: fonts.ui,
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.ink, flex: 1 }}>{i + 1}. {f.q}</span>
                  <span style={{
                    fontSize: 22, color: T.pinkDeep, fontWeight: 300, flexShrink: 0,
                    transition: 'transform 0.3s', transform: openFaq === i ? 'rotate(45deg)' : 'rotate(0deg)',
                    width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>+</span>
                </button>
                {openFaq === i && (
                  <div style={{
                    fontSize: 13, color: T.inkSoft, lineHeight: 1.65,
                    padding: '0 18px 16px', fontFamily: fonts.ui,
                    animation: 'cardIn 0.35s cubic-bezier(.2,.7,.3,1)',
                  }}>
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Garantia 7 dias */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 }}>
            <div style={{
              width: 130, height: 130, position: 'relative',
              background: `radial-gradient(circle at 30% 25%, #FBBF24, ${T.gold} 60%, ${T.goldDeep})`,
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 14px 32px rgba(202,138,4,0.4), inset 0 -4px 8px rgba(0,0,0,0.2), inset 0 4px 6px rgba(255,255,255,0.4)',
              marginBottom: 14, animation: 'cardIn 0.7s cubic-bezier(.2,.85,.25,1)',
            }}>
              <div style={{
                position: 'absolute', inset: 8, borderRadius: '50%',
                border: '2px dashed rgba(146,64,14,0.5)',
              }} />
              <div style={{ textAlign: 'center', color: '#7C2D12', fontWeight: 800, fontFamily: fonts.ui }}>
                <div style={{ fontSize: 11, letterSpacing: 1 }}>GARANTIA</div>
                <div style={{ fontSize: 36, lineHeight: 1, margin: '4px 0', fontFamily: fonts.display, fontWeight: 700 }}>7</div>
                <div style={{ fontSize: 11, letterSpacing: 1 }}>DIAS</div>
              </div>
            </div>
          </div>
          <div style={{
            background: `linear-gradient(135deg, ${T.pink}, ${T.pinkDeep})`,
            color: '#fff', padding: '18px 22px', borderRadius: 16,
            marginBottom: 14, textAlign: 'center',
            boxShadow: `0 12px 28px ${T.pinkDeep}33`,
          }}>
            <div style={{ fontSize: 16, fontFamily: fonts.display, fontWeight: 600, marginBottom: 6, letterSpacing: -0.2 }}>
              Sem Riscos: Resultados ou seu dinheiro de volta em 7 dias.
            </div>
            <div style={{ fontSize: 14, opacity: 0.95, letterSpacing: 2 }}>
              ★★★★★
            </div>
          </div>
          <div style={{
            fontSize: 13, color: T.inkSoft, lineHeight: 1.7,
            marginBottom: 28, fontFamily: fonts.ui,
            background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(12px)',
            padding: '16px 18px', borderRadius: 16, border: `1px solid ${T.border}`,
          }}>
            Nós acreditamos tanto no nosso transformador do <strong style={{ color: T.ink }}>Plano Capilar Personalizado da Tricologista</strong> que oferecemos garantia.
            <br /><br />
            Você terá <strong style={{ color: T.ink }}>100% do seu dinheiro</strong>, sem complicações e sem perguntas.
            <br /><br />
            E em compensação nós, podemos somente continuar te ajudando a ver os seus resultados e o seu cabelo se transforma. Aproveite essa oportunidade que está aqui agora!
          </div>

          {/* Payment methods */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 28 }}>
            {['VISA', 'MC', 'ELO', 'AMEX', 'HIPER', 'PIX'].map(m => (
              <div key={m} style={{
                background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
                border: `1px solid ${T.border}`, borderRadius: 10,
                padding: '12px 4px', textAlign: 'center', fontSize: 10, fontWeight: 800,
                color: T.ink, fontFamily: fonts.ui, letterSpacing: 0.3,
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              }}>{m}</div>
            ))}
          </div>

          {/* Footer */}
          <div style={{
            fontSize: 12, color: T.inkSoft, lineHeight: 1.7,
            paddingTop: 24, borderTop: `1px solid ${T.border}`, fontFamily: fonts.ui,
          }}>
            <div style={{ marginBottom: 4, fontWeight: 700, color: T.ink }}>Segunda à Sexta-feira:</div>
            <div style={{ marginBottom: 12 }}>das 9h às 17h30</div>
            <div style={{ marginBottom: 12 }}>📞 31 9744-5597</div>
            <div style={{ marginBottom: 4 }}>
              julianecost.com | Avenida Quinze de Novembro, 609, Jardim Petrópolis, Contagem — MG · CEP 32.185-122
            </div>
            <div style={{ marginBottom: 12 }}>CNPJ: 20.227.193/0001-18</div>
            <div style={{ fontSize: 11, color: T.inkMuted }}>© 2026 julianecost.com — Todos os direitos reservados.</div>
          </div>
        </div>
      </div>
    </>
  );
}
