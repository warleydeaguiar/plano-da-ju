'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { enrichIdentity, newEventId, sendServerEvent } from '@/lib/tracking-client';
import { pixelMatchingPayload, pixelPhone } from '@/lib/pixel-pii';
import { installmentInfo, brlCents, MAX_INSTALLMENTS } from '@/lib/pricing';

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

// Timer de oferta: 15 minutos sempre frescos a partir do carregamento da página.
// Não persiste — toda visita/refresh reinicia do zero.
const OFFER_DURATION_SECS = 15 * 60; // 15 minutos

function useOfferCountdown() {
  const startMs = useRef(Date.now());
  const [secondsLeft, setSecondsLeft] = useState(OFFER_DURATION_SECS);

  useEffect(() => {
    startMs.current = Date.now(); // garante reset em cada montagem
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startMs.current) / 1000);
      setSecondsLeft(Math.max(0, OFFER_DURATION_SECS - elapsed));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ─── Cálculo de parcelas (cartão: até 3x COM juros 2,99% a.m.) ───
// À vista (1x) e PIX = R$34,90 sem juros. Fonte única em lib/pricing.
function installPerStr(n: number): string {
  const info = installmentInfo(n);
  return `${info.n}x de ${brlCents(info.perCents)}`;
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

// ─── Stat bar com label + descrição + barra ──────────────────
function StatBar({ label, desc, pct, color }: { label: string; desc: string; pct: number; color: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 1, fontFamily: fonts.ui }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.ink }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.ink, flexShrink: 0, marginLeft: 4 }}>{pct}%</span>
      </div>
      <div style={{ fontSize: 10, color: T.inkSoft, marginBottom: 4, fontFamily: fonts.ui }}>{desc}</div>
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

function CompareCard({ side, stats }: {
  side: 'antes' | 'depois';
  stats: { label: string; desc: string; pct: number }[];
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
        marginBottom: 12, letterSpacing: 0.5, textTransform: 'uppercase',
        background: isAfter
          ? `linear-gradient(135deg, ${T.green}, ${T.greenDeep})`
          : `linear-gradient(135deg, ${T.red}, #DC2626)`,
        padding: '3px 10px', borderRadius: 99,
      }}>
        {isAfter ? '✨ Depois' : 'Antes'}
      </div>
      {stats.map((s, i) => (
        <StatBar key={i} label={s.label} desc={s.desc} pct={s.pct} color={isAfter
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
            <div style={{ fontSize: 11, color: T.inkMuted, textDecoration: 'line-through', marginBottom: 1, fontFamily: fonts.ui }}>R$ 99,90</div>
            <div style={{
              fontFamily: fonts.display, fontSize: 26, fontWeight: 700,
              background: `linear-gradient(135deg, ${T.pinkDeep}, ${T.pink})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              lineHeight: 1.05, letterSpacing: -0.5,
            }}>{installPerStr(MAX_INSTALLMENTS)}</div>
            <div style={{ fontSize: 9, color: T.inkSoft, marginTop: 3, fontFamily: fonts.ui }}>
              com juros · ou à vista <strong style={{ color: T.ink }}>R$34,90</strong>
            </div>
          </div>
        </div>
        <div style={{
          fontSize: 12, color: T.inkSoft, textAlign: 'center', marginBottom: 14,
          fontFamily: fonts.ui,
          padding: '8px 12px', background: T.cream, borderRadius: 99,
          border: `1px solid ${T.border}`,
        }}>
          ⚡ PIX à vista · 💳 Cartão em até 3x
        </div>
        <GreenButton onClick={onBuy} variant="green">Quero meu plano agora →</GreenButton>
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

  // Sempre que a etapa muda (ex.: offer → checkout), volta pro TOPO. Antes o
  // checkout abria NO MEIO da página (a posição de scroll de onde a pessoa
  // clicou era preservada), confundindo e fazendo muita gente nem ver o topo
  // do formulário — contribuindo pro CPF não preenchido.
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [step]);

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
  const [addressNumber, setAddressNumber] = useState('');
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
  const [installments, setInstallments] = useState(1);
  const [cardPollCount, setCardPollCount] = useState(0);

  // Detalhes do cartão (validação inline)
  const [cardBrand, setCardBrand] = useState<string>('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [cepAddress, setCepAddress] = useState<{ city: string; state: string; street: string; neighborhood: string } | null>(null);
  // Fallback manual de endereço — usado quando o ViaCEP não acha o CEP, pra não
  // travar a venda no cartão (o endereço importa pro antifraude, então pedimos
  // pra digitar em vez de bloquear).
  const [manualStreet, setManualStreet] = useState('');
  const [manualCity, setManualCity] = useState('');
  const [manualState, setManualState] = useState('');
  const [cardOrderId, setCardOrderId] = useState('');
  const [cardPolling, setCardPolling] = useState(false);

  // Timer: 15 min frescos a cada visita
  const countdown = useOfferCountdown();

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
          localStorage.setItem('purchase_data', JSON.stringify({ email, name, purchasedAt: Date.now(), orderId: pixOrderId }));
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

  // ── Polling do cartão (order ainda processando) ──
  useEffect(() => {
    if (!cardPolling || !cardOrderId) return;
    if (cardPollCount >= 60) {
      // 3 minutos (60 × 3s) — assume que o webhook vai chegar; redireciona
      try {
        localStorage.setItem('purchase_data', JSON.stringify({ email, name, purchasedAt: Date.now(), orderId: cardOrderId }));
      } catch {}
      router.push('/obrigado?pending=1');
      return;
    }
    const timer = setTimeout(async () => {
      setCardPollCount(c => c + 1);
      try {
        const res = await fetch(
          `/api/checkout/card/status?order_id=${encodeURIComponent(cardOrderId)}&email=${encodeURIComponent(email)}`
        );
        const data = await res.json();
        if (data.paid) {
          localStorage.setItem('purchase_data', JSON.stringify({ email, name, purchasedAt: Date.now(), orderId: cardOrderId }));
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
  }, [cardPolling, cardOrderId, email, name, router, installments, cardPollCount]);

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
    // CPF é OBRIGATÓRIO (exigência da PagarMe). Antes só validávamos quando já
    // tinha 11 dígitos, então o campo vazio não mostrava nada — muita gente
    // travava sem entender. Agora sinaliza vazio/incompleto/inválido.
    const cpfClean = cpf.replace(/\D/g, '');
    if (cpfClean.length === 0) {
      errs.cpf = 'CPF é obrigatório';
    } else if (cpfClean.length < 11) {
      errs.cpf = 'CPF incompleto';
    } else if (!isValidCpf(cpf)) {
      errs.cpf = 'CPF inválido';
    }
    // CEP só é erro se não achou E a pessoa não preencheu o endereço manual
    if (cep.replace(/\D/g, '').length === 8 && cepStatus === 'error' && !(manualCity.trim() && manualState.trim())) {
      errs.cep = 'CEP não encontrado — preencha cidade e UF abaixo';
    }
    if (addressNumber.length === 0) {
      errs.addressNumber = 'Informe o número';
    }
    return errs;
  }, [cardNumber, cardName, cardExpiry, cardCvv, cpf, cep, cepStatus, addressNumber, manualCity, manualState]);

  // Endereço efetivo: ViaCEP quando resolve, senão o que a pessoa digitou manualmente.
  const effAddress = useMemo(() => {
    if (cepStatus === 'ok' && cepAddress) return cepAddress;
    return { city: manualCity.trim(), state: manualState.trim(), street: manualStreet.trim(), neighborhood: '' };
  }, [cepStatus, cepAddress, manualCity, manualState, manualStreet]);

  const addressOk = useMemo(() => (
    cep.replace(/\D/g, '').length === 8 &&
    effAddress.city.length > 0 &&
    effAddress.state.length >= 2 &&
    addressNumber.trim().length > 0
  ), [cep, effAddress, addressNumber]);

  const isCardComplete = useMemo(() => (
    luhnCheck(cardNumber.replace(/\s/g, '')) &&
    cardName.trim().length >= 3 &&
    isValidExpiry(cardExpiry) &&
    cardCvv.length >= 3 &&
    isValidCpf(cpf) &&
    addressOk
  ), [cardNumber, cardName, cardExpiry, cardCvv, cpf, addressOk]);

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
          setCepAddress({
            city: data.localidade,
            state: data.uf,
            street: data.logradouro || '',
            neighborhood: data.bairro || '',
          });
        }
      })
      .catch(() => setCepStatus('error'));
  }, [cep]);

  async function handlePix() {
    if (isSubmitting) return;
    // Validação de bloqueio — registra a venda perdida por dados faltando
    const missing: string[] = [];
    if (!name.trim()) missing.push('nome completo');
    if (!email.includes('@')) missing.push('email');
    if (!isValidCpf(cpf)) missing.push('CPF');
    if (missing.length) {
      logEvent({
        event_type: 'checkout_error', email, payment_type: 'pix',
        metadata: {
          route: 'frontend/checkout', kind: 'block',
          message: `Bloqueio no PIX — faltou: ${missing.join(', ')}`,
          missing_fields: missing,
        },
      });
      setError(`Falta preencher: ${missing.join(', ')}`);
      return;
    }
    setIsSubmitting(true);
    setError('');
    setLoadingMsg(LOADING_MESSAGES[0]);
    setStep('loading');
    // Reforça a identidade de tracking com a PII do checkout (Advanced Matching)
    enrichIdentity({ email, cpf: cpf.replace(/\D/g, ''), phone: (quizAnswers?.phone ?? '').toString().replace(/\D/g, '') });
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
      logEvent({
        event_type: 'checkout_error', email, payment_type: 'card',
        metadata: { route: 'frontend/checkout', kind: 'block', message: 'Chave de pagamento não configurada (PagarMe publishable key ausente)' },
      });
      return;
    }
    if (!isCardComplete) {
      // Lista exatamente o que faltou — é a venda perdida que queremos monitorar
      const missing: string[] = [];
      if (!luhnCheck(cardNumber.replace(/\s/g, ''))) missing.push('número do cartão');
      if (cardName.trim().length < 3) missing.push('nome no cartão');
      if (!isValidExpiry(cardExpiry)) missing.push('validade');
      if (cardCvv.length < 3) missing.push('CVV');
      if (!isValidCpf(cpf)) missing.push('CPF');
      if (cep.replace(/\D/g, '').length !== 8) missing.push('CEP');
      else if (!effAddress.city || effAddress.state.length < 2) missing.push('cidade/UF do endereço');
      if (addressNumber.trim().length === 0) missing.push('número do endereço');
      logEvent({
        event_type: 'checkout_error', email, payment_type: 'card',
        metadata: {
          route: 'frontend/checkout', kind: 'block',
          message: `Bloqueio no cartão — faltou: ${missing.join(', ') || 'campos inválidos'}`,
          missing_fields: missing,
        },
      });
      // Mensagem específica: nomeia o que faltou (igual ao PIX).
      // Antes era genérica ("Preencha todos os campos") — cliente clicava
      // várias vezes sem saber QUAL campo estava faltando (ex.: só o CPF).
      setError(`Falta preencher: ${missing.join(', ') || 'confira os campos'}`);
      // Marca todos como tocados pra mostrar erros
      setTouched({ number: true, name: true, expiry: true, cvv: true, cpf: true, cep: true, addressNumber: true });
      return;
    }
    setIsSubmitting(true);
    setStep('loading');
    // Reforça a identidade de tracking com a PII do checkout (Advanced Matching)
    enrichIdentity({ email, cpf: cpf.replace(/\D/g, ''), phone: (quizAnswers?.phone ?? '').toString().replace(/\D/g, '') });
    // Rastreia em qual etapa o erro aconteceu (pro log de erros)
    let stage: 'tokenization' | 'checkout' = 'tokenization';
    try {
      const cleanCpf = cpf.replace(/\D/g, '');
      const cleanCep = cep.replace(/\D/g, '');
      // Endereço REAL — ViaCEP quando resolve, senão o que a cliente digitou.
      // SEM defaults falsos de SP (mascarar endereço prejudica o antifraude).
      const billingCity  = effAddress.city;
      const billingState = effAddress.state;
      const billingStreet = effAddress.street;
      const billingNeighborhood = effAddress.neighborhood;

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
              line_1: (() => {
                const parts = [
                  billingStreet,
                  addressNumber.trim(),
                  billingNeighborhood,
                ].filter(Boolean);
                return parts.length > 0
                  ? parts.join(', ')
                  : `CEP ${cep}, número ${addressNumber.trim() || 's/n'}`;
              })(),
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
      stage = 'checkout';
      const res = await fetch('/api/checkout/card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email, cpf: cleanCpf,
          phone: (quizAnswers?.phone ?? '').toString().replace(/\D/g, ''),
          card_token: tokenData.id,
          quiz_answers: quizAnswers,
          session_id: getSessionId(),
          installments,
          billing_address: {
            city: billingCity,
            state: billingState,
            cep: cleanCep,
            line_1: (() => {
              const parts = [
                billingStreet,
                addressNumber.trim(),
                billingNeighborhood,
              ].filter(Boolean);
              return parts.length > 0
                ? parts.join(', ')
                : `CEP ${cep}, número ${addressNumber.trim() || 's/n'}`;
            })(),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Cobrança aprovada imediatamente?
      if (data.paid) {
        localStorage.setItem('purchase_data', JSON.stringify({ email, name, purchasedAt: Date.now(), orderId: data.order_id }));
        await logEvent({ event_type: 'payment_confirmed', email, payment_type: 'card', amount_cents: 3490 });
        router.push('/obrigado');
      } else {
        // Order criado mas cobrança ainda pendente — inicia polling
        setCardOrderId(data.order_id);
        setCardPollCount(0);
        setCardPolling(true);
        setLoadingMsg('Confirmando seu pagamento…');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar cartão';
      // Reporta o erro pro log (tokenização do cartão acontece no browser e
      // de outra forma nunca chegaria ao servidor)
      logEvent({
        event_type: 'checkout_error',
        email,
        payment_type: 'card',
        metadata: { route: `frontend/card/${stage}`, message: msg, installments },
      });
      setError(msg);
      setStep('card_form');
    } finally {
      setIsSubmitting(false);
    }
  }

  const onBuy = () => {
    // Log evento de checkout iniciado
    logEvent({ event_type: 'checkout_initiated', email, payment_type: payType, amount_cents: 3490 });

    // Pixel Meta — InitiateCheckout com Advanced Matching
    // eventID compartilhado entre Pixel e CAPI → deduplicação no Meta.
    const ans: any = quizAnswers;
    const icEmail = (ans.email ?? email ?? '').toString();
    const icRawPhone = (ans.phone ?? '').toString();
    const icRawName = (ans.name ?? name ?? '').toString();
    const icPhoneE164 = pixelPhone(icRawPhone); // só dígitos com DDI, ou undefined
    const icEventId = newEventId();
    try {
      if (typeof window !== 'undefined' && (window as any).fbq) {
        // Advanced Matching normalizado (sem acentos, sobrenome único, etc.)
        const matching = pixelMatchingPayload({ email: icEmail, phone: icRawPhone, fullName: icRawName });
        if (matching.em || matching.ph) {
          ;(window as any).fbq('init', '921783859786853', matching);
        }
        ;(window as any).fbq('track', 'InitiateCheckout', {
          content_name: 'Plano Capilar Personalizado',
          value: 34.90,
          currency: 'BRL',
        }, { eventID: icEventId });
      }
    } catch {}

    // Espelha o InitiateCheckout no CAPI server-side (mesmo eventID → dedup)
    sendServerEvent('InitiateCheckout', {
      eventId: icEventId,
      value: 34.90,
      currency: 'BRL',
      email: icEmail || undefined,
      phone: icPhoneE164 || undefined,
      contentName: 'Plano Capilar Personalizado',
    });
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

  // ── Checkout (Hotmart-style single-page) ──
  if (step === 'card_form') {
    const inputS: React.CSSProperties = {
      background: '#fff', border: '1.5px solid #E2D9EB', borderRadius: 10,
      padding: '13px 15px', fontSize: 15, color: T.ink, width: '100%',
      outline: 'none', fontFamily: fonts.ui, boxSizing: 'border-box',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    };
    const labelS: React.CSSProperties = {
      fontSize: 12, color: T.inkSoft, fontWeight: 600,
      display: 'block', marginBottom: 5, fontFamily: fonts.ui,
    };
    const sectionCard: React.CSSProperties = {
      background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.07)',
      padding: '20px', marginBottom: 14,
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    };
    const sectionTitle: React.CSSProperties = {
      fontSize: 11, fontWeight: 700, color: T.inkSoft,
      textTransform: 'uppercase', letterSpacing: 0.8,
      marginBottom: 16, fontFamily: fonts.ui,
    };

    // Cartão: até 3x. 1x à vista (sem juros), 2x/3x COM juros (2,99% a.m.)
    const INSTALLMENTS = [1, 2, 3].map(n => ({
      n,
      label: installPerStr(n) + (n === 1 ? ' (à vista)' : ' com juros'),
    }));
    const installAmt = installPerStr(installments);

    return (
      <>
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <style>{fontStyles + `
          .co-input:focus { border-color: ${T.pink} !important; box-shadow: 0 0 0 3px ${T.pink}20; }
          .co-select:focus { border-color: ${T.pink} !important; outline: none; }
        `}</style>

        {/* Urgency bar */}
        <div style={{
          background: `linear-gradient(90deg, ${T.pinkDeep}, ${T.pink})`,
          color: '#fff', textAlign: 'center', padding: '10px 16px',
          fontSize: 13, fontWeight: 700, fontFamily: fonts.ui, letterSpacing: 0.2,
        }}>
          ⏱ Oferta especial · {countdown} restantes
        </div>

        <div style={{ minHeight: '100vh', background: '#F4F0F7', fontFamily: fonts.ui, paddingBottom: 48 }}>
          <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>

            {/* Back */}
            <button onClick={() => setStep('offer')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: T.inkSoft, fontSize: 13, fontWeight: 600,
              padding: '14px 0', display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              ‹ Voltar para a oferta
            </button>

            {/* ── Product header ── */}
            <div style={{ ...sectionCard, marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                {/* Foto da Juliane */}
                {images['plano_capilar_juliane_bio'] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={images['plano_capilar_juliane_bio']}
                    alt="Juliane Cost"
                    style={{ width: 78, height: 104, borderRadius: 12, flexShrink: 0, objectFit: 'contain', background: T.cream, border: `2px solid ${T.pinkSoft}` }}
                  />
                ) : (
                  <div style={{
                    width: 78, height: 104, borderRadius: 12, flexShrink: 0,
                    background: `linear-gradient(135deg, ${T.pink}, ${T.pinkDeep})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                  }}>🌿</div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, lineHeight: 1.3 }}>
                    Plano Capilar Personalizado
                  </div>
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>Tricologista Juliane Cost</div>
                  <div style={{ marginTop: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{
                        fontSize: 19, fontWeight: 800, fontFamily: fonts.display,
                        background: `linear-gradient(135deg, ${T.pinkDeep}, ${T.pink})`,
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                        lineHeight: 1,
                      }}>{installPerStr(MAX_INSTALLMENTS)}</span>
                      <span style={{ fontSize: 10, color: T.inkSoft, fontFamily: fonts.ui }}>com juros</span>
                    </div>
                    <div style={{ fontSize: 10, color: T.inkSoft, marginTop: 2 }}>ou à vista R$34,90</div>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F0EAF5', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {['✓ Garantia 7 dias', '✓ Acesso ao app na hora', '✓ Suporte WhatsApp'].map(t => (
                  <span key={t} style={{ fontSize: 11, color: T.greenDeep, fontWeight: 600 }}>{t}</span>
                ))}
              </div>
            </div>

            {/* ── Dados pessoais ── */}
            <div style={sectionCard}>
              <div style={sectionTitle}>Seus dados</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={labelS}>Nome completo</label>
                  <input
                    className="co-input" style={inputS}
                    placeholder="Seu nome completo"
                    value={name} onChange={e => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelS}>E-mail</label>
                  <input
                    className="co-input" style={inputS} type="email"
                    placeholder="Seu melhor e-mail"
                    value={email} onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelS}>
                    CPF <span style={{ color: T.red }}>*</span>
                    <span style={{ fontWeight: 400, fontSize: 11, color: T.inkSoft, marginLeft: 6 }}>obrigatório</span>
                  </label>
                  <input
                    className="co-input"
                    style={{ ...inputS, ...(touched.cpf && cardErrors.cpf ? { borderColor: T.red } : {}) }}
                    placeholder="000.000.000-00"
                    value={cpf} onChange={e => setCpf(formatCpf(e.target.value))}
                    onBlur={() => setTouched(t => ({ ...t, cpf: true }))}
                    maxLength={14} inputMode="numeric"
                    required
                  />
                  {touched.cpf && cardErrors.cpf && (
                    <p style={{ color: T.red, fontSize: 12, marginTop: 4 }}>{cardErrors.cpf}</p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Forma de pagamento ── */}
            <div style={sectionCard}>
              <div style={sectionTitle}>Forma de pagamento</div>

              {/* PIX option */}
              <button
                onClick={() => setPayType('pix')}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px',
                  border: `2px solid ${payType === 'pix' ? T.pink : '#E2D9EB'}`,
                  borderRadius: 12, marginBottom: 10, cursor: 'pointer',
                  background: payType === 'pix' ? T.pinkSoft : '#FAFAFA',
                  transition: 'all 0.2s', textAlign: 'left',
                  boxShadow: payType === 'pix' ? `0 4px 14px ${T.pink}20` : 'none',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${payType === 'pix' ? T.pink : '#C5BAD4'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {payType === 'pix' && <div style={{ width: 10, height: 10, borderRadius: '50%', background: T.pink }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>⚡ PIX</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: T.greenDeep,
                      background: T.green + '20', padding: '2px 8px', borderRadius: 99,
                    }}>MAIS RÁPIDO</span>
                  </div>
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                    Aprovação instantânea · R$34,90 à vista
                  </div>
                </div>
              </button>

              {/* Card option */}
              <button
                onClick={() => setPayType('card')}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px',
                  border: `2px solid ${payType === 'card' ? T.pink : '#E2D9EB'}`,
                  borderRadius: 12, cursor: 'pointer',
                  background: payType === 'card' ? T.pinkSoft : '#FAFAFA',
                  transition: 'all 0.2s', textAlign: 'left',
                  boxShadow: payType === 'card' ? `0 4px 14px ${T.pink}20` : 'none',
                  marginBottom: payType === 'card' ? 12 : 0,
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${payType === 'card' ? T.pink : '#C5BAD4'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {payType === 'card' && <div style={{ width: 10, height: 10, borderRadius: '50%', background: T.pink }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>💳 Cartão de crédito</span>
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                    Em até 3x — escolha as parcelas abaixo
                  </div>
                </div>
              </button>

              {/* Card fields (expandable) */}
              {payType === 'card' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={labelS}>Nome no cartão</label>
                    <input
                      className="co-input" style={inputS}
                      placeholder="Como aparece no cartão"
                      value={cardName} onChange={e => setCardName(e.target.value)}
                      onBlur={() => setTouched(t => ({ ...t, name: true }))}
                      autoComplete="cc-name"
                    />
                    {touched.name && cardErrors.name && <p style={{ color: T.red, fontSize: 12, marginTop: 3 }}>{cardErrors.name}</p>}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <label style={labelS}>Número do cartão</label>
                    <input
                      className="co-input"
                      style={{ ...inputS, paddingRight: cardBrand ? 60 : 15 }}
                      placeholder="0000 0000 0000 0000"
                      value={cardNumber} onChange={e => setCardNumber(formatCard(e.target.value))}
                      onBlur={() => setTouched(t => ({ ...t, number: true }))}
                      maxLength={19} inputMode="numeric" autoComplete="cc-number"
                    />
                    {cardBrand && (
                      <span style={{
                        position: 'absolute', right: 12, bottom: 13,
                        fontSize: 10, fontWeight: 800, color: T.inkSoft,
                        textTransform: 'uppercase', background: T.pinkSoft,
                        padding: '3px 7px', borderRadius: 5,
                      }}>{cardBrand}</span>
                    )}
                    {touched.number && cardErrors.number && <p style={{ color: T.red, fontSize: 12, marginTop: 3 }}>{cardErrors.number}</p>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={labelS}>Validade</label>
                      <input
                        className="co-input" style={inputS} placeholder="MM/AA"
                        value={cardExpiry} onChange={e => setCardExpiry(formatExpiry(e.target.value))}
                        onBlur={() => setTouched(t => ({ ...t, expiry: true }))}
                        maxLength={5} inputMode="numeric" autoComplete="cc-exp"
                      />
                      {touched.expiry && cardErrors.expiry && <p style={{ color: T.red, fontSize: 12, marginTop: 3 }}>{cardErrors.expiry}</p>}
                    </div>
                    <div>
                      <label style={labelS}>CVV</label>
                      <input
                        className="co-input" style={inputS} placeholder="3 ou 4 dígitos"
                        value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        onBlur={() => setTouched(t => ({ ...t, cvv: true }))}
                        maxLength={4} inputMode="numeric" autoComplete="cc-csc"
                      />
                      {touched.cvv && cardErrors.cvv && <p style={{ color: T.red, fontSize: 12, marginTop: 3 }}>{cardErrors.cvv}</p>}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                    <div>
                      <label style={labelS}>CEP (endereço de cobrança)</label>
                      <input
                        className="co-input" style={inputS} placeholder="00000-000"
                        value={cep} onChange={e => setCep(formatCep(e.target.value))}
                        onBlur={() => setTouched(t => ({ ...t, cep: true }))}
                        maxLength={9} inputMode="numeric"
                      />
                      {cepStatus === 'ok' && cepAddress && (
                        <p style={{ color: T.greenDeep, fontSize: 11, marginTop: 3, fontWeight: 600 }}>✓ {cepAddress.city} / {cepAddress.state}</p>
                      )}
                      {cepStatus === 'loading' && <p style={{ color: T.inkSoft, fontSize: 11, marginTop: 3 }}>Buscando…</p>}
                      {touched.cep && cardErrors.cep && <p style={{ color: T.red, fontSize: 12, marginTop: 3 }}>{cardErrors.cep}</p>}
                    </div>
                    <div>
                      <label style={labelS}>Número</label>
                      <input
                        className="co-input" style={inputS} placeholder="123"
                        value={addressNumber}
                        onChange={e => setAddressNumber(e.target.value.replace(/[^0-9A-Za-z]/g, '').slice(0, 10))}
                        onBlur={() => setTouched(t => ({ ...t, addressNumber: true }))}
                        inputMode="numeric"
                      />
                      {touched.addressNumber && cardErrors.addressNumber && <p style={{ color: T.red, fontSize: 12, marginTop: 3 }}>{cardErrors.addressNumber}</p>}
                    </div>
                  </div>

                  {/* Fallback manual — aparece se o ViaCEP não achou o CEP, pra não travar a venda */}
                  {cepStatus === 'error' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <p style={{ fontSize: 11.5, color: T.inkSoft, margin: '0 0 6px' }}>
                          Não localizamos esse CEP automaticamente. Preencha o endereço de cobrança:
                        </p>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={labelS}>Rua / logradouro</label>
                        <input className="co-input" style={inputS} placeholder="Rua, avenida…"
                          value={manualStreet} onChange={e => setManualStreet(e.target.value.slice(0, 120))} />
                      </div>
                      <div>
                        <label style={labelS}>Cidade</label>
                        <input className="co-input" style={inputS} placeholder="Cidade"
                          value={manualCity} onChange={e => setManualCity(e.target.value.slice(0, 60))} />
                      </div>
                      <div>
                        <label style={labelS}>UF</label>
                        <input className="co-input" style={inputS} placeholder="SP" maxLength={2}
                          value={manualState} onChange={e => setManualState(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))} />
                      </div>
                    </div>
                  )}

                  <div>
                    <label style={labelS}>Parcelas</label>
                    <select
                      className="co-select"
                      style={{ ...inputS, cursor: 'pointer', appearance: 'none' }}
                      value={installments}
                      onChange={e => setInstallments(parseInt(e.target.value, 10))}
                    >
                      {INSTALLMENTS.map(i => (
                        <option key={i.n} value={i.n}>{i.label}</option>
                      ))}
                    </select>
                    <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 4 }}>
                      Plano de 90 dias — renova automaticamente nas mesmas condições.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Resumo ── */}
            <div style={{ ...sectionCard, marginBottom: 14 }}>
              <div style={sectionTitle}>Resumo do pedido</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: T.inkSoft }}>Plano Capilar Personalizado</span>
                <span style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}>R$34,90</span>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                paddingTop: 10, borderTop: '1px solid #F0EAF5',
              }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>Total</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: T.pinkDeep, fontFamily: fonts.display }}>
                    {payType === 'card' && installments > 1 ? installAmt : 'R$34,90'}
                  </div>
                  {payType === 'card' && installments > 1 && (
                    <div style={{ fontSize: 11, color: T.inkSoft }}>
                      com juros · total {brlCents(installmentInfo(installments).totalCents)} · renova a cada 90 dias
                    </div>
                  )}
                  {payType === 'pix' && (
                    <div style={{ fontSize: 11, color: T.greenDeep, fontWeight: 600 }}>⚡ Aprovação instantânea</div>
                  )}
                </div>
              </div>
              {/* Aviso discreto: plano de 90 dias com renovação */}
              <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 10, paddingTop: 10, borderTop: '1px solid #F0EAF5', lineHeight: 1.4 }}>
                Acesso por 90 dias. Depois renova automaticamente por mais 90 dias nas mesmas condições — você pode cancelar quando quiser.
              </div>
            </div>

            {/* Error */}
            {error && (
              <p style={{ color: T.red, fontSize: 13, padding: '12px 16px', background: '#FEF2F2', borderRadius: 12, border: '1px solid #FECACA', marginBottom: 12 }}>
                {error}
              </p>
            )}

            {/* CTA */}
            <GreenButton
              onClick={payType === 'card' ? handleCard : handlePix}
              // Para CARTÃO mantém clicável: o handler valida e registra o
              // bloqueio (capta vendas perdidas) mostrando o que faltou.
              // Para PIX exige CPF válido — pedido explícito de UX.
              disabled={isSubmitting || (payType === 'pix' && !isValidCpf(cpf))}
            >
              {isSubmitting
                ? '⏳ Processando…'
                : payType === 'pix'
                  ? '🔒 Gerar PIX — R$34,90'
                  : `🔒 Pagar ${installAmt}`}
            </GreenButton>

            {/* Hint: explica por que o botão PIX está desabilitado.
                Sem isso o cliente via um botão "morto" e não sabia o motivo
                (origem de vários bloqueios "faltou: CPF" no PIX). */}
            {payType === 'pix' && !isSubmitting && !isValidCpf(cpf) && (
              <p style={{ textAlign: 'center', marginTop: 10, fontSize: 12.5, color: T.pinkDeep, fontWeight: 600, fontFamily: fonts.ui }}>
                {cpf.replace(/\D/g, '').length === 0
                  ? '☝ Preencha seu CPF acima para liberar o PIX'
                  : '☝ Confira o CPF — ainda está incompleto ou inválido'}
              </p>
            )}

            {/* Trust row */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
              {['🔒 SSL 256-bit', '🛡 Anti-fraude', '💳 PagarMe', '✅ Garantia 7 dias'].map(t => (
                <span key={t} style={{ fontSize: 11, color: T.inkSoft, fontFamily: fonts.ui }}>{t}</span>
              ))}
            </div>
            <p style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: T.inkMuted, fontFamily: fonts.ui }}>
              Seus dados são criptografados e nunca compartilhados
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
            <CompareCard side="antes" stats={[
              { label: 'Comprimento do cabelo', desc: 'Pequeno',  pct: 25 },
              { label: 'Frizz',                 desc: 'Alto',     pct: 90 },
              { label: 'Hidratação',            desc: 'Baixo',    pct: 25 },
              { label: 'Pontas',                desc: 'Ralas',    pct: 25 },
            ]} />
            <CompareCard side="depois" stats={[
              { label: 'Comprimento',  desc: 'Grande',   pct: 90  },
              { label: 'Frizz',        desc: 'Pouco',    pct: 5   },
              { label: 'Hidratação',   desc: 'Elevado',  pct: 100 },
              { label: 'Pontas',       desc: 'Cheias',   pct: 88  },
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
              { q: 'Quando eu adquirir o plano, ele já estará disponível?', a: 'Você acessa o app imediatamente após o pagamento. Pra eu montar seu plano personalizado, você precisa enviar uma foto do seu cabelo no app (é a primeira coisa que aparece quando entra). A partir daí, em até 3 dias úteis eu analiso sua foto + suas respostas e libero o plano completo. Você é avisada por e-mail quando estiver pronto.' },
              { q: 'Os produtos indicados são difíceis de encontrar?', a: 'Não! Eu tenho parceria com as marcas de produtos de cabelo e por isso tenho preços abaixo do mercado para vocês.' },
              { q: 'E se eu tiver dúvidas ao longo do processo?', a: 'Você terá suporte diário através do WhatsApp, vou ficar disponível para falar com você e te ajudar.' },
              { q: 'Quando posso começar a ver resultados?', a: 'Cada cabelo tem seu ritmo, mas a maioria começa a notar mudanças significativas já nas primeiras semanas, especialmente com a combinação de rotina de cuidados e os produtos certos.' },
              { q: 'Você usa Mega Hair?', a: 'Não, no meu insta tem diversos videos mostrando meu cabelo desde a raiz.' },
              { q: 'O que é Tricologia?', a: 'A tricologia é uma área focada no estudo, tratamento e prevenção de problemas que possam afetar o cabelo.\n\nAtravés de uma consulta preliminar, o tricologista é capaz de examinar e identificar as possíveis causas de adversidades capilares, trazendo ao paciente soluções para resolvê-las.' },
            ].map((f, i) => (
              <div key={i} style={{ borderBottom: i < 5 ? `1px solid ${T.border}` : 'none' }}>
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
                    whiteSpace: 'pre-line',
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
