'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { T, fonts, shadow, gradient } from '../theme';
import { IconBag, IconSparkles, IconWhatsApp } from '../icons';
import { PlanoLoading } from '../Loading';
import { previewCtx, fetchPreviewBundle } from '../preview';
import GroupInvite, { GROUP_URL } from '../GroupInvite';

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
  combos?: Array<{ id: string; name: string; brand: string | null; affiliate_url: string | null }> | null;
}


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
    // Preview (admin): monta as recomendações personalizadas a partir do bundle.
    const pv = previewCtx();
    if (pv) {
      const b = await fetchPreviewBundle(pv);
      if (b) {
        const rec: Array<{ produto_id?: string; alternativa_id?: string; motivo?: string }> =
          Array.isArray(b.profile?.recommended_products) ? b.profile.recommended_products : [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const byId = new Map<string, any>(((b.products ?? []) as any[]).map(p => [p.id, p]));
        const recs = rec.map(r => {
          const main = r.produto_id ? byId.get(r.produto_id) : null;
          if (!main) return null;
          const alt = r.alternativa_id ? byId.get(r.alternativa_id) : null;
          return {
            id: main.id, name: main.name, brand: main.brand, category: main.category,
            image_url: main.image_url, affiliate_url: main.affiliate_url, reason: r.motivo ?? null,
            alternative: alt ? { id: alt.id, name: alt.name, brand: alt.brand, affiliate_url: alt.affiliate_url } : null,
            combos: main.combos ?? null,
          } as Recommendation;
        }).filter(Boolean) as Recommendation[];
        setRecommendations(recs);
      }
      setLoading(false);
      return;
    }
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

        {/* Convite — grupo VIP de promoções no WhatsApp (componente compartilhado) */}
        <div style={{ padding: '0 16px 16px' }}>
          <GroupInvite />
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
          <div style={{ padding: '12px 16px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
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

function ProductThumb({ url, name, size = 60 }: { url: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  // <img> real (com onError) em vez de background CSS: a URL da Ybera tem query
  // string dupla (…?w=420&h=420&v=…?w=&h=) que quebrava o parsing do url() inline,
  // caindo sempre no ícone genérico. Com <img>, carrega a foto; se falhar, ícone.
  if (url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: 12, flexShrink: 0, objectFit: 'cover', border: `1px solid ${T.borderSoft}`, background: T.cream }}
      />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: 12, flexShrink: 0, background: gradient.heroSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <IconBag size={size * 0.4} color="#fff" stroke={1.6} />
    </div>
  );
}

function RecCard({ rec }: { rec: Recommendation; index: number }) {
  return (
    <div style={{
      background: T.surface, borderRadius: 16, padding: 14, position: 'relative',
      boxShadow: shadow.card, border: `1px solid ${T.borderSoft}`,
    }}>
      {/* Tag: indicação principal */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 10,
        background: T.pinkSoft, color: T.pinkDeep, fontSize: 10, fontWeight: 800,
        textTransform: 'uppercase', letterSpacing: 0.5, padding: '3px 8px', borderRadius: 6,
      }}>
        <IconSparkles size={11} stroke={2} /> Indicação principal
      </div>

      {/* Principal */}
      <div style={{ display: 'flex', gap: 12 }}>
        <ProductThumb url={rec.image_url} name={rec.name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {rec.brand ?? 'Ybera'}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginTop: 2, lineHeight: 1.25 }}>
            {rec.name}
          </div>
          {rec.affiliate_url && (
            <a href={rec.affiliate_url} target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8,
              background: gradient.heroSoft, color: '#FFF', fontSize: 12.5, fontWeight: 700,
              padding: '7px 14px', borderRadius: 10, textDecoration: 'none',
              boxShadow: '0 2px 6px rgba(190,24,93,0.20)',
            }}>
              <IconBag size={13} stroke={2} /> Ver produto
            </a>
          )}
        </div>
      </div>

      {rec.reason && (
        <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 10, lineHeight: 1.45, background: T.cream, borderRadius: 10, padding: '8px 10px' }}>
          💡 {rec.reason}
        </div>
      )}

      {/* Combos / kits do mesmo produto */}
      {rec.combos && rec.combos.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${T.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: T.pinkDeep, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            🎁 Sai em combo (mais em conta)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rec.combos.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: T.ink, lineHeight: 1.25 }}>{c.name}</div>
                {c.affiliate_url && (
                  <a href={c.affiliate_url} target="_blank" rel="noopener noreferrer" style={{
                    flexShrink: 0, border: `1.5px solid ${T.pink}`, color: T.pinkDeep,
                    fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 10, textDecoration: 'none',
                  }}>Ver →</a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alternativa mais barata */}
      {rec.alternative && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${T.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: T.gold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            💰 Opção mais econômica
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                {rec.alternative.brand ?? 'Outra marca'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, lineHeight: 1.25 }}>{rec.alternative.name}</div>
            </div>
            {rec.alternative.affiliate_url && (
              <a href={rec.alternative.affiliate_url} target="_blank" rel="noopener noreferrer" style={{
                flexShrink: 0, border: `1.5px solid ${T.gold}`, color: T.goldDeep,
                fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 10, textDecoration: 'none',
              }}>
                Ver →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
