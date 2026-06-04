'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { T, fonts, shadow, gradient } from '../theme';
import { IconBag, IconSparkles, IconWhatsApp, iconForCategory } from '../icons';
import { PlanoLoading } from '../Loading';

interface Promotion {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cta_url: string | null;
  discount_label: string | null;
  ends_at: string | null;
}
interface Recommendation {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  affiliate_url: string | null;
  reason: string | null;
  alternative: { id: string; name: string; brand: string | null; affiliate_url: string | null } | null;
}

const GROUP_URL = 'https://planodaju.julianecost.com/g/entrar';

function endsLabel(iso: string | null): string | null {
  if (!iso) return null;
  const end = new Date(iso);
  const ms = end.getTime() - Date.now();
  if (ms <= 0) return null;
  const days = Math.ceil(ms / 86_400_000);
  if (days <= 1) return 'Acaba hoje';
  if (days === 2) return 'Acaba amanhã';
  return `Até ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
}

export default function PromocoesPage() {
  const router = useRouter();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recFallback, setRecFallback] = useState(false);
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }
    try {
      const res = await fetch('/api/meu-plano/promocoes', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const txt = await res.text();
      const data = JSON.parse(txt);
      setPromotions(Array.isArray(data.promotions) ? data.promotions : []);
      setRecommendations(Array.isArray(data.recommendations) ? data.recommendations : []);
      setRecFallback(!!data.recommendationsFallback);
    } catch {
      // mantém vazio — mostra estados vazios
    }
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <PlanoLoading label="Carregando promoções…" />;

  return (
    <div>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ padding: '24px 24px 14px' }}>
          <div style={{ fontSize: 28, fontWeight: 600, color: T.ink, fontFamily: fonts.display, letterSpacing: -0.5 }}>
            <em style={{ fontStyle: 'italic' }}>Promoções</em>
          </div>
          <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4 }}>
            Ofertas do momento e produtos escolhidos pra você
          </div>
        </div>

        {/* Convite — grupo VIP de promoções no WhatsApp */}
        <div style={{ padding: '0 16px 16px' }}>
          <a
            href={GROUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none',
              background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
              borderRadius: 16, padding: '14px 16px',
              boxShadow: '0 6px 16px rgba(18,140,126,0.28)',
            }}
          >
            <div style={{
              width: 42, height: 42, borderRadius: '50%', background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}><IconWhatsApp size={28} color="#25D366" /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, fontFamily: fonts.ui }}>
                Grupo VIP de promoções
              </div>
              <div style={{ color: 'rgba(255,255,255,0.92)', fontSize: 12.5, marginTop: 2, lineHeight: 1.35 }}>
                Descontos exclusivos no WhatsApp — você recebe primeiro 💚
              </div>
            </div>
            <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, flexShrink: 0 }}>→</div>
          </a>
        </div>

        {/* ── Seção 1: Promoções ativas (temporárias) ── */}
        <SectionLabel>🔥 Promoções da semana</SectionLabel>
        {promotions.length > 0 ? (
          <div style={{ padding: '0 16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {promotions.map(p => <PromoCard key={p.id} promo={p} />)}
          </div>
        ) : (
          <div style={{ padding: '0 16px 22px' }}>
            <div style={{
              background: T.surface, border: `1px dashed ${T.border}`, borderRadius: 16,
              padding: '20px 18px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 30, marginBottom: 6 }}>🎁</div>
              <div style={{ fontSize: 13.5, color: T.ink, fontWeight: 600 }}>Sem promoção ativa agora</div>
              <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4, lineHeight: 1.5 }}>
                As promoções com desconto saem primeiro no grupo do WhatsApp. Entra lá pra não perder!
              </div>
              <a href={GROUP_URL} target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12,
                background: '#25D366', color: '#fff', textDecoration: 'none',
                fontSize: 13, fontWeight: 700, padding: '9px 16px', borderRadius: 10,
              }}>
                <IconWhatsApp size={16} color="#fff" /> Entrar no grupo
              </a>
            </div>
          </div>
        )}

        {/* ── Seção 2: Indicados pra você (do plano) ── */}
        <SectionLabel>✨ Indicados pra você</SectionLabel>
        <div style={{ padding: '0 24px 8px', marginTop: -4 }}>
          <div style={{ fontSize: 12, color: T.inkSoft, lineHeight: 1.5 }}>
            {recFallback
              ? 'Produtos que combinam com o seu tipo de cabelo. Seu plano vai refinar isso.'
              : 'A Juliane escolheu estes produtos com base no seu plano personalizado.'}
          </div>
        </div>
        {recommendations.length > 0 ? (
          <div style={{ padding: '12px 16px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {recommendations.map((r, i) => <RecCard key={r.id} rec={r} index={i} />)}
          </div>
        ) : (
          <div style={{ padding: '12px 16px 28px' }}>
            <div style={{
              background: T.surface, border: `1px dashed ${T.border}`, borderRadius: 16,
              padding: '20px 18px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 30, marginBottom: 6 }}>💇‍♀️</div>
              <div style={{ fontSize: 13.5, color: T.ink, fontWeight: 600 }}>Suas indicações estão a caminho</div>
              <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4, lineHeight: 1.5 }}>
                Assim que seu plano ficar pronto, a Juliane lista aqui os produtos ideais pro seu caso.
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '4px 24px 10px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.ink, textTransform: 'uppercase', letterSpacing: 1.2 }}>
        {children}
      </div>
    </div>
  );
}

function PromoCard({ promo }: { promo: Promotion }) {
  const ends = endsLabel(promo.ends_at);
  const href = promo.cta_url || GROUP_URL;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block', textDecoration: 'none',
        background: T.surface, borderRadius: 16, overflow: 'hidden',
        boxShadow: shadow.card, border: `1px solid ${T.borderSoft}`,
      }}
    >
      {promo.image_url && (
        <div style={{ width: '100%', height: 150, background: `url(${promo.image_url}) center/cover` }} />
      )}
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          {promo.discount_label && (
            <span style={{
              fontSize: 11, fontWeight: 800, color: '#fff',
              background: gradient.heroSoft, padding: '3px 9px', borderRadius: 6,
            }}>{promo.discount_label}</span>
          )}
          {ends && (
            <span style={{ fontSize: 11, fontWeight: 700, color: T.pinkDeep, background: T.pinkSoft, padding: '3px 9px', borderRadius: 6 }}>
              ⏳ {ends}
            </span>
          )}
        </div>
        <div style={{ fontSize: 15.5, fontWeight: 700, color: T.ink, fontFamily: fonts.display, lineHeight: 1.25 }}>
          {promo.title}
        </div>
        {promo.description && (
          <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 5, lineHeight: 1.5 }}>{promo.description}</div>
        )}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12,
          background: gradient.heroSoft, color: '#fff', fontSize: 13.5, fontWeight: 700,
          padding: '10px 0', borderRadius: 11, boxShadow: '0 4px 12px rgba(190,24,93,0.22)',
        }}>
          <IconBag size={15} stroke={2} /> Aproveitar oferta
        </div>
      </div>
    </a>
  );
}

function RecCard({ rec, index }: { rec: Recommendation; index: number }) {
  const Icon = iconForCategory(rec.category, rec.name);
  const gradients = [
    gradient.heroSoft,
    `linear-gradient(135deg, ${T.gold}, ${T.goldDeep})`,
    `linear-gradient(135deg, ${T.pinkBlush}, ${T.pink})`,
    `linear-gradient(135deg, ${T.champagne}, ${T.gold})`,
  ];
  const bg = rec.image_url ? `url(${rec.image_url}) center/cover` : gradients[index % gradients.length];
  return (
    <div style={{
      background: T.surface, borderRadius: 16, padding: 10, position: 'relative',
      boxShadow: shadow.card, border: `1px solid ${T.borderSoft}`,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        height: 96, borderRadius: 12, background: bg, position: 'relative', marginBottom: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF',
      }}>
        {!rec.image_url && <Icon size={36} color="#FFF" stroke={1.6} />}
        <div style={{
          position: 'absolute', top: 6, right: 6,
          background: 'rgba(255,255,255,0.95)', color: T.pinkDeep,
          fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 5,
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>
          <IconSparkles size={10} stroke={2} /> Pra você
        </div>
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {rec.brand ?? '—'}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, marginTop: 2, lineHeight: 1.3 }}>
        {rec.name}
      </div>
      {rec.reason && (
        <div style={{
          fontSize: 11, color: T.inkSoft, marginTop: 6, lineHeight: 1.4,
          background: T.cream, borderRadius: 8, padding: '6px 8px',
        }}>
          💡 {rec.reason}
        </div>
      )}
      <div style={{ flex: 1 }} />
      {rec.affiliate_url ? (
        <a href={rec.affiliate_url} target="_blank" rel="noopener noreferrer" style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5,
          marginTop: 10, background: gradient.heroSoft, color: '#FFF',
          fontSize: 12, fontWeight: 700, padding: '8px 0', borderRadius: 10,
          textDecoration: 'none', boxShadow: '0 2px 6px rgba(190,24,93,0.20)',
        }}>
          <IconBag size={13} stroke={2} /> Ver produto
        </a>
      ) : (
        <div style={{
          marginTop: 10, textAlign: 'center', background: T.cream,
          color: T.inkSoft, fontSize: 12, fontWeight: 600, padding: '7px 0', borderRadius: 10,
        }}>Em breve</div>
      )}
      {rec.alternative && (
        <div style={{ marginTop: 8, fontSize: 10.5, color: T.inkSoft, lineHeight: 1.4 }}>
          Quer gastar menos?{' '}
          {rec.alternative.affiliate_url ? (
            <a href={rec.alternative.affiliate_url} target="_blank" rel="noopener noreferrer"
              style={{ color: T.pinkDeep, fontWeight: 700, textDecoration: 'none' }}>
              {rec.alternative.name} →
            </a>
          ) : (
            <span style={{ color: T.ink, fontWeight: 700 }}>{rec.alternative.name}</span>
          )}
        </div>
      )}
    </div>
  );
}
