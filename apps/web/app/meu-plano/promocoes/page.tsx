'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { T, fonts, shadow, gradient } from '../theme';
import { IconSearch, IconClose, IconBag, IconSparkles, iconForCategory } from '../icons';

interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  price_brl: number | null;
  affiliate_url: string | null;
  image_url: string | null;
  hair_types: string[] | null;
  is_ybera: boolean;
}

const CATEGORIES = [
  { key: 'all',           label: 'Todos'         },
  { key: 'limpeza',       label: 'Shampoo'       },
  { key: 'condicionador', label: 'Condicionador' },
  { key: 'mascara',       label: 'Máscara'       },
  { key: 'oleo',          label: 'Óleo'          },
  { key: 'protetor',      label: 'Protetor'      },
];

export default function LojaPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [profileHairType, setProfileHairType] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }
    const uid = session.user.id;

    const [pr, p] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('products').select('*').eq('active', true).order('is_ybera', { ascending: false }),
      supabase.from('profiles').select('hair_type').eq('id', uid).single(),
    ]);
    if (pr.data) setProducts(pr.data as ProductRow[]);
    if (p.data?.hair_type) setProfileHairType(p.data.hair_type);
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(p => {
      const matchSearch = !q ||
        p.name.toLowerCase().includes(q) ||
        (p.brand ?? '').toLowerCase().includes(q);
      const matchCat = cat === 'all' || (
        (p.category ?? '').toLowerCase().includes(cat) ||
        (cat === 'mascara' && p.name.toLowerCase().includes('máscara')) ||
        (cat === 'oleo' && (p.name.toLowerCase().includes('óleo') || p.name.toLowerCase().includes('oleo')))
      );
      return matchSearch && matchCat;
    });
  }, [products, search, cat]);

  const ybera = filtered.filter(p => p.is_ybera);
  const alternatives = filtered.filter(p => !p.is_ybera);

  if (loading) return null;

  return (
    <div>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ padding: '24px 24px 14px' }}>
          <div style={{
            fontSize: 28, fontWeight: 600, color: T.ink,
            fontFamily: fonts.display, letterSpacing: -0.5,
          }}>
            <em style={{ fontStyle: 'italic' }}>Promoções</em>
          </div>
          <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4 }}>
            Produtos selecionados pela Ju com desconto especial
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{
            background: T.surface, borderRadius: 14, padding: '11px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: shadow.card, border: `1px solid ${T.borderSoft}`,
          }}>
            <IconSearch size={16} color={T.inkSoft} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar produto…"
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 14, color: T.ink, fontFamily: fonts.ui,
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'transparent', border: 'none', color: T.inkSoft, cursor: 'pointer', padding: 0 }}>
                <IconClose size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Category pills */}
        <div style={{ padding: '0 16px 18px', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCat(c.key)} style={{
              flexShrink: 0, padding: '7px 14px', borderRadius: 99,
              border: 'none', cursor: 'pointer',
              background: cat === c.key ? gradient.heroSoft : T.surface,
              color: cat === c.key ? '#FFF' : T.ink,
              fontSize: 12.5, fontWeight: 600,
              boxShadow: cat === c.key ? '0 2px 8px rgba(190,24,93,0.25)' : shadow.card,
            }}>
              {c.label}
            </button>
          ))}
        </div>

        {/* Ybera Paris section */}
        {ybera.length > 0 && (
          <>
            <SectionLabel>
              ✨ Produtos Ybera Paris{' '}
              <span style={{ color: T.inkSoft, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                · recomendados pela Ju
              </span>
            </SectionLabel>
            <div style={{ padding: '0 16px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {ybera.map((p, i) => (
                <ProductCard
                  key={p.id} product={p} index={i}
                  isMatch={profileHairType ? (p.hair_types ?? []).some(h => h.toLowerCase().includes(profileHairType.toLowerCase())) : false}
                />
              ))}
            </div>
          </>
        )}

        {/* Alternatives */}
        {alternatives.length > 0 && (
          <>
            <SectionLabel>💚 Alternativas acessíveis</SectionLabel>
            <div style={{ padding: '0 16px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {alternatives.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} outlined />
              ))}
            </div>
          </>
        )}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 24px' }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>🛍️</div>
            <div style={{ fontSize: 14, color: T.inkSoft }}>
              {products.length === 0 ? 'Catálogo sendo preparado.' : 'Nenhum produto encontrado.'}
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
      <div style={{
        fontSize: 11, fontWeight: 700, color: T.ink,
        textTransform: 'uppercase', letterSpacing: 1.2,
      }}>{children}</div>
    </div>
  );
}

function ProductCard({ product, index, isMatch = false, outlined = false }: {
  product: ProductRow; index: number; isMatch?: boolean; outlined?: boolean;
}) {
  const Icon = iconForCategory(product.category, product.name);
  const gradients = [
    gradient.heroSoft,
    `linear-gradient(135deg, ${T.gold}, ${T.goldDeep})`,
    `linear-gradient(135deg, ${T.pinkBlush}, ${T.pink})`,
    `linear-gradient(135deg, ${T.champagne}, ${T.gold})`,
  ];
  const bg = product.image_url ? `url(${product.image_url}) center/cover` : gradients[index % gradients.length];

  return (
    <div style={{
      background: T.surface, borderRadius: 16, padding: 10, position: 'relative',
      boxShadow: shadow.card,
      border: `1px solid ${T.borderSoft}`,
    }}>
      {/* Image area */}
      <div style={{
        height: 96, borderRadius: 12,
        background: bg,
        position: 'relative', marginBottom: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#FFF',
      }}>
        {!product.image_url && <Icon size={36} color="#FFF" stroke={1.6} />}
        {product.is_ybera && (
          <div style={{
            position: 'absolute', top: 6, right: 6,
            background: 'rgba(255,255,255,0.95)', color: T.pinkDeep,
            fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 5,
            display: 'inline-flex', alignItems: 'center', gap: 3,
          }}>
            <IconSparkles size={10} stroke={2} /> Desconto Ju
          </div>
        )}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {product.brand ?? '—'}
      </div>
      <div style={{
        fontSize: 12.5, fontWeight: 700, color: T.ink, marginTop: 2,
        lineHeight: 1.3, minHeight: 32, overflow: 'hidden',
      }}>
        {product.name}
      </div>
      {product.price_brl && (
        <div style={{
          fontSize: 16, fontWeight: 800, color: T.ink, marginTop: 6,
          fontFamily: fonts.display,
        }}>
          R$ {product.price_brl.toFixed(2).replace('.', ',')}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, minHeight: 18 }}>
        {isMatch && (
          <span style={{
            fontSize: 9.5, fontWeight: 700, color: T.green,
            background: T.greenSoft, borderRadius: 5, padding: '2px 6px',
          }}>Para seu tipo</span>
        )}
        {!isMatch && product.is_ybera && (
          <span style={{
            fontSize: 9.5, fontWeight: 700, color: T.goldDeep,
            background: T.goldSoft, borderRadius: 5, padding: '2px 6px',
          }}>Mais vendido</span>
        )}
        {outlined && (
          <span style={{
            fontSize: 9.5, fontWeight: 700, color: T.inkSoft,
            background: T.cream, borderRadius: 5, padding: '2px 6px',
          }}>Econômico</span>
        )}
      </div>
      {product.affiliate_url ? (
        <a href={product.affiliate_url} target="_blank" rel="noopener noreferrer" style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5,
          marginTop: 8, textAlign: 'center',
          background: outlined ? 'transparent' : gradient.heroSoft,
          color: outlined ? T.pinkDeep : '#FFF',
          border: outlined ? `1.5px solid ${T.pink}` : 'none',
          fontSize: 12, fontWeight: 700, padding: '8px 0', borderRadius: 10,
          textDecoration: 'none',
          boxShadow: outlined ? 'none' : '0 2px 6px rgba(190,24,93,0.20)',
        }}>
          <IconBag size={13} stroke={2} />
          Ver produto
        </a>
      ) : (
        <div style={{
          marginTop: 8, textAlign: 'center', background: T.cream,
          color: T.inkSoft, fontSize: 12, fontWeight: 600, padding: '7px 0', borderRadius: 10,
        }}>Sem link</div>
      )}
    </div>
  );
}
