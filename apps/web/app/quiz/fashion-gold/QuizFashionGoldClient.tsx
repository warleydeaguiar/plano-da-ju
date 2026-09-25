'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { newEventId, sendServerEvent } from '../../../lib/tracking-client'
import { sortearLado, rotuloVariante, type ExperimentoAtivo } from '@/lib/ab'
import RoletaFG from './RoletaFG'
import { LINK_YBERA_FASHION_GOLD } from '@/lib/contact'

// ─── Design tokens ──────────────────────────────────────────
const T = {
  ink: '#0a0a0a',
  bg: '#faf7f2',
  paper: '#ffffff',
  gold: '#c9a45c',
  goldDeep: '#8a6d2f',
  champagne: '#ede1c7',
  green: '#16a34a',
  greenDeep: '#15803d',
  ruby: '#c0392b',
  muted: '#6b6b6b',
  line: 'rgba(10,10,10,0.08)',
}

const fonts = {
  display: '"Playfair Display", "Cormorant Garamond", Georgia, serif',
  ui: '"Inter", -apple-system, system-ui, sans-serif',
}

declare global {
  interface Window { fbq?: (...args: unknown[]) => void }
}

// ─── Testimonial types ───────────────────────────────────────
type Testimonial = {
  id: string
  type: 'review' | 'toast' | 'winner'
  sort_order: number
  name: string
  city: string | null
  stars: number
  text: string | null
  photo_url: string | null
}

// ─── Default fallbacks (used if API is down) ─────────────────
const DEFAULT_REVIEWS: Testimonial[] = [
  { id: '1', type: 'review', sort_order: 1, name: 'Juliana M.', city: 'Goiânia/GO', stars: 5, text: 'Comprei a progressiva pela metade do preço! O grupo manda promoção todo dia, virei cliente fiel.', photo_url: null },
  { id: '2', type: 'review', sort_order: 2, name: 'Carolina F.', city: 'Florianópolis/SC', stars: 5, text: 'Ganhei o kit completo no sorteio de fevereiro 😍 Nunca tinha ganhado nada na vida. Recomendo demais.', photo_url: null },
  { id: '3', type: 'review', sort_order: 3, name: 'Patrícia L.', city: 'Manaus/AM', stars: 5, text: 'O atendimento da Juliane é impecável. Tira todas as dúvidas e ainda dá dicas de aplicação.', photo_url: null },
]
const DEFAULT_TOAST: Testimonial[] = [
  { id: 't1', type: 'toast', sort_order: 1, name: 'Fernanda', city: 'São Paulo, SP', stars: 5, text: null, photo_url: null },
  { id: 't2', type: 'toast', sort_order: 2, name: 'Camila', city: 'Belo Horizonte, MG', stars: 5, text: null, photo_url: null },
  { id: 't3', type: 'toast', sort_order: 3, name: 'Luciana', city: 'Curitiba, PR', stars: 5, text: null, photo_url: null },
  { id: 't4', type: 'toast', sort_order: 4, name: 'Patrícia', city: 'Rio de Janeiro, RJ', stars: 5, text: null, photo_url: null },
  { id: 't5', type: 'toast', sort_order: 5, name: 'Aline', city: 'Salvador, BA', stars: 5, text: null, photo_url: null },
  { id: 't6', type: 'toast', sort_order: 6, name: 'Renata', city: 'Fortaleza, CE', stars: 5, text: null, photo_url: null },
  { id: 't7', type: 'toast', sort_order: 7, name: 'Mariana', city: 'Porto Alegre, RS', stars: 5, text: null, photo_url: null },
]
const DEFAULT_WINNER: Testimonial = { id: 'w1', type: 'winner', sort_order: 1, name: 'Mariana S.', city: 'Recife/PE', stars: 5, text: null, photo_url: null }

// ─── Avatar ──────────────────────────────────────────────────
function Avatar({ url, name, size = 36 }: { url: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false)
  if (url && !err) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} onError={() => setErr(true)} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${T.champagne}, ${T.gold})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: T.ink, fontWeight: 600, fontFamily: fonts.ui, fontSize: size * 0.4,
    }}>{name[0]}</div>
  )
}

// ─── Progress bar ────────────────────────────────────────────
function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ height: 4, background: '#ececec', borderRadius: 999, overflow: 'hidden', flex: 1 }}>
      <div style={{
        width: `${(step / total) * 100}%`, height: '100%',
        background: `linear-gradient(90deg, ${T.ink} 0%, ${T.goldDeep} 100%)`,
        transition: 'width 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
      }} />
    </div>
  )
}

// ─── CTA button ─────────────────────────────────────────────
interface CTAProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'dark' | 'outline'
  disabled?: boolean
  loading?: boolean
  icon?: React.ReactNode
}
function CTA({ children, onClick, variant = 'primary', disabled, loading, icon }: CTAProps) {
  const styles = {
    primary: {
      background: disabled ? '#cfcfcf' : `linear-gradient(180deg, #1f9e4a 0%, ${T.greenDeep} 100%)`,
      color: '#fff',
      boxShadow: disabled ? 'none' : '0 6px 18px rgba(22,163,74,0.25), inset 0 1px 0 rgba(255,255,255,0.2)',
    },
    dark: { background: T.ink, color: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,0.18)' },
    outline: { background: 'transparent', color: T.ink, border: `1.5px solid ${T.ink}` },
  }[variant]
  return (
    <button
      onClick={disabled || loading ? undefined : onClick}
      disabled={disabled || loading}
      style={{
        width: '100%', height: 56, borderRadius: 14, border: 'none',
        fontFamily: fonts.ui, fontSize: 16, fontWeight: 600, letterSpacing: 0.2,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        ...styles,
      }}
    >
      {loading ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
          Abrindo grupo…
        </span>
      ) : <>{icon}{children}</>}
    </button>
  )
}

// ─── Countdown ──────────────────────────────────────────────
function Countdown({ minutes = 14 }: { minutes?: number }) {
  const [secs, setSecs] = useState(minutes * 60 + 32)
  useEffect(() => {
    const t = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  const cell = (n: number, label: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ fontFamily: fonts.ui, fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 22, color: T.ink, background: T.paper, padding: '6px 10px', borderRadius: 8, minWidth: 44, textAlign: 'center', border: `1px solid ${T.line}`, boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.04)' }}>{String(n).padStart(2, '0')}</div>
      <div style={{ fontFamily: fonts.ui, fontSize: 9, letterSpacing: 1.5, color: T.muted, textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
      {cell(h, 'hrs')}<div style={{ fontWeight: 700, color: T.muted, fontSize: 18, marginTop: -10 }}>:</div>
      {cell(m, 'min')}<div style={{ fontWeight: 700, color: T.muted, fontSize: 18, marginTop: -10 }}>:</div>
      {cell(s, 'seg')}
    </div>
  )
}

// ─── Social toast ────────────────────────────────────────────
function SocialToast({ people }: { people: Testimonial[] }) {
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!people.length) return
    const cycle = () => {
      setVisible(false)
      timerRef.current = setTimeout(() => { setIdx(i => (i + 1) % people.length); setVisible(true) }, 400)
    }
    const t = setInterval(cycle, 5500)
    return () => { clearInterval(t); if (timerRef.current) clearTimeout(timerRef.current) }
  }, [people.length])

  if (!people.length) return null
  const p = people[idx]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
      background: T.paper, border: `1px solid ${T.line}`, borderRadius: 14,
      boxShadow: '0 8px 24px rgba(10,10,10,0.06)',
      opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(6px)',
      transition: 'opacity 0.35s ease, transform 0.35s ease',
    }}>
      <Avatar url={p.photo_url} name={p.name} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: fonts.ui, fontSize: 13, color: T.ink, lineHeight: 1.3 }}>
          <strong>{p.name}</strong> entrou no grupo
        </div>
        <div style={{ fontFamily: fonts.ui, fontSize: 11, color: T.muted }}>{p.city} · agora mesmo</div>
      </div>
      <div style={{ width: 8, height: 8, borderRadius: 999, background: T.green, boxShadow: `0 0 0 4px rgba(22,163,74,0.18)`, flexShrink: 0 }} />
    </div>
  )
}

// ─── Step shell (footer sempre visível) ─────────────────────
function StepShell({ step, total, children, footer }: {
  step: number; total: number; children: React.ReactNode; footer?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh', background: T.bg, fontFamily: fonts.ui, color: T.ink }}>
      {/* Header — só a barra de progresso (logo Ybera removida) */}
      <div style={{ padding: '28px 24px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Progress step={step} total={total} />
        </div>
      </div>
      {/* Body — padding-bottom deixa espaço para o footer fixo */}
      <div style={{ flex: 1, padding: '20px 24px', paddingBottom: footer ? '140px' : '24px', maxWidth: 480, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {children}
      </div>
      {/* Footer sticky — sempre visível */}
      {footer && (
        <div style={{
          position: 'sticky', bottom: 0, zIndex: 20,
          padding: '12px 24px 36px',
          background: T.bg,
          boxShadow: '0 -12px 24px rgba(250,247,242,0.95)',
          width: '100%', maxWidth: 480, margin: '0 auto', boxSizing: 'border-box',
        }}>
          {footer}
        </div>
      )}
    </div>
  )
}

// ─── Field ───────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string
}) {
  const filled = value.length > 0
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: 0.3 }}>{label}</div>
      <div style={{ background: T.paper, border: `1.5px solid ${filled ? T.gold : T.line}`, borderRadius: 14, padding: '0 14px', height: 52, display: 'flex', alignItems: 'center', transition: 'border-color 0.2s ease' }}>
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, fontFamily: fonts.ui, color: T.ink }} />
      </div>
    </label>
  )
}

// ═══════════════════════════════════════════════════════════
// TELA FINAL DA VARIANTE — desconto liberado + entrada no grupo
// ═══════════════════════════════════════════════════════════
/**
 * Fecha o ciclo que a roleta abriu: mostra o desconto que ela conquistou e
 * explica onde ele é entregue. O link com o preço fica no grupo, então este é
 * o único caminho adiante — e o botão vai para a distribuição de grupos.
 */
function StepDescontoLiberado({ nome, href }: { nome: string; href: string }) {
  const primeiro = (nome || '').trim().split(/\s+/)[0] ?? ''
  return (
    <StepShell step={4} total={4} footer={
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          <CTA onClick={() => {}}>Pegar minha progressiva com desconto</CTA>
        </a>
        <div style={{ textAlign: 'center', fontSize: 11, color: T.muted }}>
          Você vai para a loja oficial da Ybera com o preço promocional
        </div>
      </div>
    }>
      <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
        <div style={{ fontSize: 40, lineHeight: 1 }}>🎉</div>
        <h2 style={{
          fontFamily: 'Playfair Display, serif', fontWeight: 600, fontSize: 25,
          color: T.ink, margin: '12px 0 6px', lineHeight: 1.25,
        }}>
          {primeiro ? `${primeiro}, seu desconto está garantido!` : 'Seu desconto está garantido!'}
        </h2>
      </div>

      <div style={{
        textAlign: 'center', padding: '24px 18px', borderRadius: 20, margin: '4px 0 16px',
        background: 'linear-gradient(135deg,#FFF8EE,#F5E6D3)', border: `1px solid ${T.gold}`,
      }}>
        <div style={{ fontSize: 13, color: T.muted, textDecoration: 'line-through' }}>R$ 339,90</div>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 44, fontWeight: 700, color: T.ink, margin: '2px 0' }}>
          R$ 208,00
        </div>
        <div style={{
          display: 'inline-block', marginTop: 6, padding: '5px 14px', borderRadius: 99,
          background: T.ink, color: '#FFF8EE', fontSize: 12.5, fontWeight: 800, letterSpacing: 0.5,
        }}>
          48% OFF garantido
        </div>
      </div>

      <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.6, textAlign: 'center' }}>
        Aproveite agora — essa condição é por tempo limitado. 💛
      </div>

      {/* O grupo não some do funil: ele vira o segundo passo, com convite pelo
          WhatsApp. Dizer isso aqui evita que ela ache que o telefone foi pedido
          à toa. */}
      <div style={{
        marginTop: 14, padding: '13px 15px', borderRadius: 14,
        background: '#E9F9EE', border: '1px solid #A9E6BE',
        fontSize: 13, color: '#1F7A55', lineHeight: 1.5, textAlign: 'center',
      }}>
        Vou te mandar no WhatsApp o convite do meu grupo de ofertas — é por lá que
        eu aviso das próximas promoções da Ybera.
      </div>
    </StepShell>
  )
}

// ═══════════════════════════════════════════════════════════
// STEP 1-B — HERO COM ROLETA  (variante do teste A/B)
// ═══════════════════════════════════════════════════════════
/**
 * Mesma promessa do hero padrão, com duas diferenças: a arte da variante — que
 * mostra a comparação de preço com os valores BORRADOS — e a roleta no lugar do
 * botão "Continuar".
 *
 * A arte esconder o preço é o que dá sentido ao giro: a página inteira fala de
 * um valor que só existe no grupo, e a roleta é o momento em que ele aparece.
 * Revelar na imagem tiraria a razão de girar.
 *
 * O desconto é o mesmo da campanha para todo mundo; a roleta é a forma de
 * apresentá-lo, não um sorteio.
 */
function Step1Roleta({ onGirou }: { onGirou: () => void }) {
  const [revelado, setRevelado] = useState(false)
  return (
    <StepShell step={1} total={4} footer={
      revelado ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <CTA onClick={onGirou}>Quero garantir meu desconto</CTA>
          <div style={{ textAlign: 'center', fontSize: 11, color: T.muted }}>
            Falta só confirmar seus dados para liberar o link
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', fontSize: 11.5, color: T.muted }}>
          O preço do grupo está escondido — gire a roleta para revelar
        </div>
      )
    }>
      <div style={{ width: '100%', borderRadius: 22, overflow: 'hidden', border: `1px solid ${T.line}`, background: T.paper, marginBottom: 18 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/quiz/fashion-gold-hero-b.webp"
          alt="A progressiva mais famosa do Brasil entrou em promoção — preço exclusivo no grupo"
          width={1080} height={1080}
          fetchPriority="high" decoding="async"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </div>

      {revelado ? (
        <div style={{
          textAlign: 'center', padding: '22px 18px', borderRadius: 20,
          background: 'linear-gradient(135deg,#FFF8EE,#F5E6D3)', border: `1px solid ${T.gold}`,
        }}>
          <div style={{ fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: T.goldDeep, fontWeight: 800 }}>
            Desconto liberado
          </div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 40, fontWeight: 700, color: T.ink, margin: '6px 0 2px' }}>
            48% OFF
          </div>
          <div style={{ fontSize: 15, color: T.ink, fontWeight: 600 }}>
            A progressiva sai por <strong>R$ 208,00</strong>
          </div>
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 8, lineHeight: 1.5 }}>
            De R$ 339,90 no site oficial. Confirme os seus dados para liberar o link com esse valor.
          </div>
        </div>
      ) : (
        <RoletaFG onPremio={() => setRevelado(true)} />
      )}
    </StepShell>
  )
}

// ═══════════════════════════════════════════════════════════
// STEP 1 — HERO
// ═══════════════════════════════════════════════════════════
function Step1({ onNext, toastPeople }: { onNext: () => void; toastPeople: Testimonial[] }) {
  return (
    <StepShell step={1} total={7} footer={
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <CTA onClick={onNext}>Continuar</CTA>
        <div style={{ textAlign: 'center', fontSize: 11, color: T.muted }}>Grátis · Desconto adicional · Desconto exclusivo pra quem está no grupo</div>
      </div>
    }>
      {/* Hero (a imagem já traz selo, título e chamada — não repetimos em texto) */}
      <div style={{ width: '100%', borderRadius: 22, overflow: 'hidden', border: `1px solid ${T.line}`, background: T.paper }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {/* WebP no lugar do PNG (2,2 MB → 233 KB). width/height evitam o "pulo"
            do layout enquanto carrega; fetchPriority alta porque é a imagem da
            1ª dobra. Trocada em 24/09/2026 pela arte da comparação de preço. */}
        <img
          src="/quiz/fashion-gold-hero.webp"
          alt="Progressiva Fashion Gold: R$ 339,90 no site oficial e R$ 208,00 no grupo de promoções da Juliane"
          width={941}
          height={1672}
          fetchPriority="high"
          decoding="async"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </div>

      <div style={{ marginTop: 22, padding: 14, background: T.paper, borderRadius: 16, border: `1px solid ${T.line}` }}>
        <div style={{ fontSize: 10, letterSpacing: 2, textAlign: 'center', color: T.ruby, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>⏱ AS VAGAS SE ENCERRAM EM</div>
        <Countdown minutes={14} />
      </div>

      <div style={{ marginTop: 14, padding: '12px 14px', background: '#fff5f3', border: '1px solid #fbcdc4', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 999, background: T.ruby, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>5</div>
        <div style={{ flex: 1, fontSize: 12.5, color: T.ink, lineHeight: 1.4 }}>
          Restam apenas <strong>5 vagas</strong> no grupo VIP de hoje.
          <div style={{ height: 4, marginTop: 6, background: '#fbcdc4', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: '92%', height: '100%', background: T.ruby }} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}><SocialToast people={toastPeople} /></div>
    </StepShell>
  )
}

// ═══════════════════════════════════════════════════════════
// STEP 2 — HOW IT WORKS
// ═══════════════════════════════════════════════════════════
function Step2({ onNext }: { onNext: () => void }) {
  const items = [
    { n: '01', t: 'Você entra no grupo', d: 'Acesso instantâneo ao WhatsApp VIP com todas as ofertas em primeira mão.' },
    { n: '02', t: 'Recebe link com preço exclusivo', d: 'Descontos abaixo do site oficial — apenas para membros do grupo.' },
    { n: '03', t: 'Compra direto no site oficial', d: 'Mesma garantia da Ybera Paris, com frete e devolução tradicionais.' },
  ]
  return (
    <StepShell step={2} total={7} footer={<CTA onClick={onNext}>Continuar</CTA>}>
      <div style={{ paddingTop: 8 }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: T.goldDeep, fontWeight: 600, textTransform: 'uppercase' }}>Como funciona</div>
        <h2 style={{ fontFamily: fonts.display, fontWeight: 500, fontSize: 30, lineHeight: 1.1, margin: '6px 0 22px', letterSpacing: -0.4 }}>
          Como funciona o <em style={{ color: T.goldDeep }}>grupo VIP</em>?
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {items.map(it => (
            <div key={it.n} style={{ padding: 16, background: T.paper, borderRadius: 16, border: `1px solid ${T.line}`, display: 'flex', gap: 14 }}>
              <div style={{ fontFamily: fonts.display, fontSize: 28, color: T.gold, fontWeight: 500, lineHeight: 1, flexShrink: 0, width: 36 }}>{it.n}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{it.t}</div>
                <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.5 }}>{it.d}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, padding: 14, background: `linear-gradient(180deg, ${T.champagne}55 0%, transparent 100%)`, borderRadius: 14, border: `1px solid ${T.gold}33`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 22 }}>🛡️</div>
          <div style={{ fontSize: 12, color: T.ink, lineHeight: 1.4 }}>Compras feitas no <strong>site oficial</strong> da Ybera Paris. Mesma garantia, com desconto exclusivo do grupo.</div>
        </div>
      </div>
    </StepShell>
  )
}

// ═══════════════════════════════════════════════════════════
// STEP 3 — RAFFLE
// ═══════════════════════════════════════════════════════════
function Step3({ onNext, winner }: { onNext: () => void; winner: Testimonial }) {
  const prizes = [
    { tier: '1º prêmio', label: 'Kit Completo Fashion Gold', val: 'R$ 1.298', accent: T.gold, big: true, img: '/quiz/progressiva.webp' },
    { tier: '2º prêmio', label: 'Combo Progressiva + Manutenção', val: 'R$ 689', accent: T.goldDeep, big: false, img: '/quiz/progressiva.webp' },
    { tier: '3º prêmio', label: 'Óleo de Mirra 90ml', val: 'R$ 189', accent: T.muted, big: false, img: '' },
  ]
  return (
    <StepShell step={3} total={7} footer={<CTA onClick={onNext}>Quero participar dos sorteios</CTA>}>
      <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: T.goldDeep, fontWeight: 600, textTransform: 'uppercase' }}>Bônus exclusivo</div>
        <h2 style={{ fontFamily: fonts.display, fontWeight: 500, fontSize: 28, lineHeight: 1.1, margin: '6px 0 14px', letterSpacing: -0.4 }}>
          E ainda concorre a <em style={{ color: T.goldDeep }}>kits completos</em> todo mês
        </h2>
        <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.5, marginBottom: 20 }}>Membros do grupo participam <strong>automaticamente</strong> dos sorteios mensais.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {prizes.map(p => {
            const thumb = p.big ? 60 : 48
            return (
            <div key={p.tier} style={{ padding: p.big ? '16px' : '12px 14px', borderRadius: 14, background: p.big ? T.ink : T.paper, color: p.big ? '#fff' : T.ink, border: p.big ? 'none' : `1px solid ${T.line}`, display: 'flex', alignItems: 'center', gap: 12, position: 'relative', overflow: 'hidden' }}>
              {p.big && <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(120% 120% at 100% 0%, ${T.gold}33 0%, transparent 50%)`, pointerEvents: 'none' }} />}
              <div style={{ fontFamily: fonts.display, fontSize: p.big ? 20 : 16, color: p.accent, fontWeight: 500, width: 26, flexShrink: 0, position: 'relative', textAlign: 'center' }}>
                {p.tier.split('º')[0]}<span style={{ fontSize: 10, verticalAlign: 'super' }}>º</span>
              </div>
              {/* Capa do produto */}
              <div style={{ width: thumb, height: thumb, flexShrink: 0, borderRadius: 12, background: p.big ? 'rgba(255,255,255,0.06)' : T.bg, border: `1px solid ${p.big ? 'rgba(255,255,255,0.12)' : T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                {p.img
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={p.img} alt={p.label} style={{ width: '100%', height: '100%', objectFit: 'contain', mixBlendMode: p.big ? 'normal' : 'multiply' }} />
                  : <span style={{ fontSize: 22 }}>🧴</span>}
              </div>
              <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
                <div style={{ fontSize: p.big ? 15 : 13.5, fontWeight: 600, marginBottom: 2 }}>{p.label}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>Avaliado em {p.val}</div>
              </div>
              {p.big && <div style={{ fontSize: 22, position: 'relative' }}>🏆</div>}
            </div>
          )})}
        </div>
        {/* Last winner */}
        <div style={{ marginTop: 18, padding: '12px 14px', background: T.paper, borderRadius: 12, border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar url={winner.photo_url} name={winner.name} size={40} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 2 }}>Último ganhador · Abril/26</div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{winner.name} — {winner.city}</div>
          </div>
          <div style={{ fontSize: 10, padding: '4px 8px', borderRadius: 999, background: T.green, color: '#fff', fontWeight: 600, letterSpacing: 0.5 }}>VERIFICADO</div>
        </div>
      </div>
    </StepShell>
  )
}

// ═══════════════════════════════════════════════════════════
// STEP 4 — TESTIMONIALS
// ═══════════════════════════════════════════════════════════
function Step4({ onNext, reviews }: { onNext: () => void; reviews: Testimonial[] }) {
  return (
    <StepShell step={4} total={7} footer={<CTA onClick={onNext}>Quero meu acesso</CTA>}>
      <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: T.goldDeep, fontWeight: 600, textTransform: 'uppercase' }}>Avaliações</div>
        <h2 style={{ fontFamily: fonts.display, fontWeight: 500, fontSize: 28, lineHeight: 1.1, margin: '6px 0 14px', letterSpacing: -0.4 }}>
          O que dizem as <em style={{ color: T.goldDeep }}>+12 mil membras</em>
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, marginBottom: 16, background: T.ink, color: '#fff', borderRadius: 14 }}>
          <div>
            <div style={{ fontFamily: fonts.display, fontSize: 36, fontWeight: 500, lineHeight: 1, color: T.gold }}>4,9</div>
            <div style={{ fontSize: 10, letterSpacing: 1.5, opacity: 0.7, marginTop: 2 }}>DE 5 ESTRELAS</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 2, color: T.gold, fontSize: 16 }}>{[1,2,3,4,5].map(i => <span key={i}>★</span>)}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Baseado em 8.421 avaliações verificadas</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reviews.map((r, i) => (
            <div key={r.id ?? i} style={{ padding: 14, background: T.paper, borderRadius: 14, border: `1px solid ${T.line}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Avatar url={r.photo_url} name={r.name} size={36} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 10.5, color: T.muted }}>{r.city}</div>
                </div>
                <div style={{ display: 'flex', gap: 1, color: T.gold, fontSize: 12 }}>
                  {Array.from({ length: r.stars }).map((_, j) => <span key={j}>★</span>)}
                </div>
              </div>
              <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.5 }}>"{r.text}"</div>
            </div>
          ))}
        </div>
      </div>
    </StepShell>
  )
}

// ═══════════════════════════════════════════════════════════
// STEP 5 — PHONE
// ═══════════════════════════════════════════════════════════
function Step5({ onNext, phone, setPhone, toastPeople }: { onNext: () => void; phone: string; setPhone: (v: string) => void; toastPeople: Testimonial[] }) {
  const digits = phone.replace(/\D/g, '').slice(0, 11)
  const display = digits.length > 6 ? `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}` : digits.length > 2 ? `(${digits.slice(0,2)}) ${digits.slice(2)}` : digits
  const valid = digits.length >= 10
  return (
    <StepShell step={5} total={7} footer={
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <CTA onClick={onNext} disabled={!valid}>Continuar</CTA>
        <div style={{ textAlign: 'center', fontSize: 10.5, color: T.muted }}>🔒 Seus dados estão protegidos. Não fazemos spam.</div>
      </div>
    }>
      <div style={{ paddingTop: 8 }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: T.goldDeep, fontWeight: 600, textTransform: 'uppercase' }}>WhatsApp</div>
        <h2 style={{ fontFamily: fonts.display, fontWeight: 500, fontSize: 28, lineHeight: 1.1, margin: '6px 0 12px', letterSpacing: -0.4 }}>
          Qual é o seu <em style={{ color: T.goldDeep }}>WhatsApp</em>?
        </h2>
        <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.5, marginBottom: 24 }}>Vamos enviar o link do grupo VIP direto no seu celular em até 60 segundos.</p>
        <label style={{ display: 'block' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, letterSpacing: 0.3 }}>Celular com DDD</div>
          <div style={{ display: 'flex', alignItems: 'center', background: T.paper, border: `1.5px solid ${valid ? T.green : T.line}`, borderRadius: 14, padding: '0 14px', height: 56, transition: 'border-color 0.2s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 10, marginRight: 10, borderRight: `1px solid ${T.line}`, height: 28 }}>
              <span style={{ fontSize: 18 }}>🇧🇷</span>
              <span style={{ fontWeight: 600, fontSize: 15 }}>+55</span>
            </div>
            <input autoFocus type="tel" value={display} onChange={e => setPhone(e.target.value)} placeholder="(11) 98765-4321"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, fontFamily: fonts.ui, color: T.ink }} />
            {valid && <svg width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="11" fill={T.green} /><path d="M6 11.5l3.5 3.5L16 8" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </div>
        </label>
        <div style={{ marginTop: 22, padding: 14, background: T.paper, border: `1px solid ${T.line}`, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex' }}>
            {toastPeople.slice(0, 3).map((p, i) => (
              <div key={p.id ?? i} style={{ marginLeft: i > 0 ? -10 : 0, border: '2px solid #fff', borderRadius: '50%', display: 'flex' }}>
                <Avatar url={p.photo_url} name={p.name} size={28} />
              </div>
            ))}
            <div style={{ width: 28, height: 28, borderRadius: 999, background: T.ink, color: '#fff', border: '2px solid #fff', marginLeft: -10, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>+240</div>
          </div>
          <div style={{ flex: 1, fontSize: 12, color: T.ink, lineHeight: 1.4 }}><strong>247 pessoas</strong> entraram nas últimas 24h</div>
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.muted, marginBottom: 6 }}>
            <span>VAGAS PREENCHIDAS HOJE</span>
            <span style={{ color: T.ruby, fontWeight: 600 }}>95% · 5 restantes</span>
          </div>
          <div style={{ height: 6, background: '#ececec', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: '95%', height: '100%', background: `linear-gradient(90deg, ${T.green}, ${T.ruby})` }} />
          </div>
        </div>
      </div>
    </StepShell>
  )
}

// ═══════════════════════════════════════════════════════════
// STEP 6 — NAME (uma info por página)
// ═══════════════════════════════════════════════════════════
function Step6({ onNext, name, setName }: { onNext: () => void; name: string; setName: (v: string) => void }) {
  const valid = name.trim().length >= 2
  return (
    <StepShell step={6} total={7} footer={
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <CTA onClick={onNext} disabled={!valid}>Continuar</CTA>
        <div style={{ textAlign: 'center', fontSize: 10.5, color: T.muted }}>🔒 Seus dados estão protegidos. Não fazemos spam.</div>
      </div>
    }>
      <div style={{ paddingTop: 8 }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: T.goldDeep, fontWeight: 600, textTransform: 'uppercase' }}>Quase lá</div>
        <h2 style={{ fontFamily: fonts.display, fontWeight: 500, fontSize: 28, lineHeight: 1.1, margin: '6px 0 12px', letterSpacing: -0.4 }}>
          Como podemos te <em style={{ color: T.goldDeep }}>chamar</em>?
        </h2>
        <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.5, marginBottom: 22 }}>Personalizamos as ofertas e mensagens com seu nome.</p>
        <Field label="Seu nome" placeholder="Como prefere ser chamada" value={name} onChange={setName} />
      </div>
    </StepShell>
  )
}

// ═══════════════════════════════════════════════════════════
// STEP 7 — EMAIL → entra no grupo do WhatsApp
// ═══════════════════════════════════════════════════════════
function Step7({ onSubmit, email, setEmail, loading }: {
  onSubmit: () => void; email: string; setEmail: (v: string) => void; loading: boolean
}) {
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
  return (
    <StepShell step={7} total={7} footer={
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <CTA onClick={onSubmit} disabled={!valid} loading={loading} icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm0 18.15h-.01a8.2 8.2 0 01-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.18 8.18 0 01-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.83 2.42a8.183 8.183 0 012.41 5.83c0 4.54-3.7 8.24-8.25 8.24z" />
          </svg>
        }>
          Entrar no grupo do WhatsApp
        </CTA>
        <div style={{ textAlign: 'center', fontSize: 10.5, color: T.muted }}>Ao continuar você concorda com os termos e a política de privacidade.</div>
      </div>
    }>
      <div style={{ paddingTop: 8 }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: T.goldDeep, fontWeight: 600, textTransform: 'uppercase' }}>Último passo</div>
        <h2 style={{ fontFamily: fonts.display, fontWeight: 500, fontSize: 28, lineHeight: 1.1, margin: '6px 0 12px', letterSpacing: -0.4 }}>
          Qual é o seu <em style={{ color: T.goldDeep }}>melhor e-mail</em>?
        </h2>
        <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.5, marginBottom: 22 }}>É por onde enviamos as promoções e o aviso dos sorteios.</p>
        <Field label="E-mail" placeholder="seu@email.com" type="email" value={email} onChange={setEmail} />
      </div>
    </StepShell>
  )
}

// ═══════════════════════════════════════════════════════════
// QUIZ ROOT
// ═══════════════════════════════════════════════════════════
export default function QuizFashionGoldClient({ experimentos = [] }: { experimentos?: ExperimentoAtivo[] }) {
  const searchParams = useSearchParams()
  const [step, setStep] = useState(1)
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  // Testimonials from DB (fallback to hardcoded while loading)
  const [reviews, setReviews] = useState<Testimonial[]>(DEFAULT_REVIEWS)
  const [toastPeople, setToastPeople] = useState<Testimonial[]>(DEFAULT_TOAST)
  const [winner, setWinner] = useState<Testimonial>(DEFAULT_WINNER)

  // Session id estável por visita (pra contar pessoas únicas e o funil por etapa).
  const sessionId = useMemo(() => {
    if (typeof window === 'undefined') return ''
    try {
      const k = 'fg_session_id'
      let s = sessionStorage.getItem(k)
      if (!s) { s = (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`); sessionStorage.setItem(k, s) }
      return s
    } catch { return `${Date.now()}-${Math.random().toString(36).slice(2)}` }
  }, [])

  /**
   * Lado do teste A/B desta visita.
   *
   * O rótulo (`flag_key:control` ou `flag_key:variant`) acompanha view, etapas
   * e lead — é por ele que o painel /experimentos separa os dois grupos. Sem
   * experimento rodando fica null e nada muda.
   */
  const experimento = experimentos[0] ?? null
  const lado = useMemo(
    () => (experimento && sessionId ? sortearLado(sessionId, experimento) : 'control'),
    [experimento, sessionId],
  )
  const abVariant = experimento ? rotuloVariante(experimento, lado) : null
  const mostraRoleta = lado === 'variant' && !!experimento

  // Rastrear view na montagem (com session_id → dá pra contar pessoas únicas)
  useEffect(() => {
    fetch('/api/quiz/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quiz_slug: 'fashion-gold',
        session_id: sessionId,
        ab_variant: abVariant,
        utm_source: searchParams.get('utm_source'),
        utm_campaign: searchParams.get('utm_campaign'),
      }),
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Funil por ETAPA: dispara "viewed" a cada passo (pra medir onde a pessoa para).
  useEffect(() => {
    if (!sessionId) return
    const ids: Record<number, string> = { 1: 'hero', 2: 'como_funciona', 3: 'sorteios', 4: 'depoimentos', 5: 'telefone', 6: 'nome', 7: 'email' }
    fetch('/api/quiz/step-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, quiz_slug: 'fashion-gold', ab_variant: abVariant, step_index: step, step_id: ids[step] ?? `step_${step}`, event_type: 'viewed' }),
    }).catch(() => {})
  }, [step, sessionId])

  useEffect(() => {
    fetch('/api/quiz/testimonials?slug=fashion-gold')
      .then(r => r.json())
      .then((data: Testimonial[]) => {
        if (!Array.isArray(data)) return
        const r = data.filter(t => t.type === 'review')
        const toast = data.filter(t => t.type === 'toast')
        const w = data.find(t => t.type === 'winner')
        if (r.length) setReviews(r)
        if (toast.length) setToastPeople(toast)
        if (w) setWinner(w)
      })
      .catch(() => { /* keep defaults */ })
  }, [])

  // Na variante da roleta o caminho é mais curto: quem girou já viu a oferta na
  // arte e quer o desconto — as telas de "como funciona", sorteios e
  // depoimentos só atrasam. Vai direto para os dados.
  const next = () => setStep(s => (mostraRoleta && s === 1 ? 5 : s + 1))

  // A pessoa vai DIRETO para a distribuição de grupos (/g/entrar), que escolhe
  // um grupo com vaga e redireciona para o convite.
  //
  // Antes ela era mandada para o wa.me do nosso número, com uma mensagem
  // pronta, para abrir a janela de 24 h. Só que isso dependia de ela apertar
  // "enviar" — e a maioria não apertava; a conversa não começava e a mensagem
  // automática nunca chegava. Agora a confirmação vai por template (que não
  // precisa de janela aberta) e ela entra no grupo em um toque a menos.
  // Destino depois dos dados: a loja da Ybera, com o código de afiliada.
  //
  // Por muito tempo a página de obrigado mandava para o grupo de WhatsApp, e a
  // maior parte das pessoas não entrava — o caminho terminava no vazio. Agora a
  // oferta vem primeiro; o convite do grupo sai depois por WhatsApp (com
  // confirmação) e por e-mail.
  const destinoFinal = () => LINK_YBERA_FASHION_GOLD


  // Dispara o Lead (Pixel + CAPI com MESMO eventID → dedup) e SÓ DEPOIS navega
  // pra fora (wa.me). O redirect externo imediato abortava a requisição do Pixel
  // antes dela sair — por isso esperamos o pixel escoar antes de sair da página.
  // O CAPI já é resiliente (sendBeacon), mas o delay garante o Pixel também.
  const fireLeadAndRedirect = () => {
    const leadEventId = newEventId()
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'Lead', { content_name: 'Quiz Fashion Gold', content_category: 'fashion-gold', currency: 'BRL' }, { eventID: leadEventId })
    }
    sendServerEvent('Lead', { eventId: leadEventId, email, phone, contentName: 'Quiz Fashion Gold', contentCategory: 'fashion-gold', currency: 'BRL' })
    if (mostraRoleta) {
      // Variante: em vez de sair da página, mostra o desconto conquistado e o
      // convite para o grupo — é lá que o link com o preço é entregue.
      window.setTimeout(() => { setStep(8); setLoading(false) }, 500)
      return
    }
    const dest = destinoFinal()
    // mantém o spinner; navega após o pixel ter tempo de sair
    window.setTimeout(() => { window.location.href = dest }, 700)
  }

  const handleSubmit = async () => {
    if (loading) return
    setLoading(true)
    try {
      await fetch('/api/quiz/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quiz_slug: 'fashion-gold',
          ab_variant: abVariant,
          session_id: sessionId,
          name, email, phone,
          utm_source: searchParams.get('utm_source'),
          utm_medium: searchParams.get('utm_medium'),
          utm_campaign: searchParams.get('utm_campaign'),
          utm_content: searchParams.get('utm_content'),
          utm_term: searchParams.get('utm_term'),
        }),
      })
    } catch {
      // erro de rede ao salvar o lead não impede o Lead/redirect
    }
    // Lead dispara exatamente 1x, com ou sem erro no save acima.
    fireLeadAndRedirect()
    // não limpa o loading de propósito: a navegação ocorre em ~700ms e o spinner
    // evita duplo clique / duplo Lead.
  }

  return (
    <>
      {/* Marcador de diagnóstico: diz, em produção, quantos experimentos o
          servidor entregou e de que lado esta visita caiu. Sem isto, "a roleta
          não apareceu" não distingue sorteio do lado control de experimento que
          não chegou. */}
      <div data-ab-exp={experimentos.length} data-ab-lado={abVariant ?? 'sem-experimento'} hidden />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: ${T.bg}; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      {step === 1 && (mostraRoleta
        ? <Step1Roleta onGirou={next} />
        : <Step1 onNext={next} toastPeople={toastPeople} />)}
      {step === 2 && <Step2 onNext={next} />}
      {step === 3 && <Step3 onNext={next} winner={winner} />}
      {step === 4 && <Step4 onNext={next} reviews={reviews} />}
      {step === 5 && <Step5 onNext={next} phone={phone} setPhone={setPhone} toastPeople={toastPeople} />}
      {step === 6 && <Step6 onNext={next} name={name} setName={setName} />}
      {step === 7 && <Step7 onSubmit={handleSubmit} email={email} setEmail={setEmail} loading={loading} />}
      {step === 8 && <StepDescontoLiberado nome={name} href={destinoFinal()} />}
    </>
  )
}
