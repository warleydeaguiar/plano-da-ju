'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const ACCENT  = '#C4607A';
const ACCENT2 = '#9B4A6A';
const DARK    = '#1C1C1E';
const SUB     = '#8E8E93';
const SURFACE = '#FFFFFF';
const GREEN   = '#34C759';
const GOLD    = '#FF9500';
const PURPLE  = '#5856D6';

interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  price_brl: number | null;
  affiliate_url: string | null;
  image_url: string | null;
  hair_types: string[] | null;
  is_iberaparis: boolean;
}

const CATEGORIES = [
  { key: 'all',           label: 'Todos'        },
  { key: 'shampoo',       label: 'Shampoo'      },
  { key: 'condicionador', label: 'Condicionador'},
  { key: 'mascara',       label: 'Máscara'      },
  { key: 'oleo',          label: 'Óleo'         },
  { key: 'protetor',      label: 'Protetor'     },
];

function emojiFor(category: string | null, name?: string | null) {
  const ref = `${category ?? ''} ${name ?? ''}`.toLowerCase();
  if (ref.includes('shampoo') || ref.includes('limpeza') || ref.includes('co-wash')) return '🧴';
  if (ref.includes('condicionador'))                                                  return '💧';
  if (ref.includes('máscara') || ref.includes('mascara') || ref.includes('hidrat'))   return '💜';
  if (ref.includes('óleo') || ref.includes('oleo'))                                   return '✨';
  if (ref.includes('protetor') || ref.includes('térm'))                               return '☀️';
  if (ref.includes('recons') || ref.includes('queratina'))                            return '💪';
  if (ref.includes('nutri') || ref.includes('karit'))                                 return '🥥';
  return '🌿';
}

function gradientFor(idx: number) {
  const gradients = [
    `linear-gradient(135deg, ${ACCENT2}, ${ACCENT})`,
    `linear-gradient(135deg, #B19CD9, ${PURPLE})`,
    `linear-gradient(135deg, #FFB088, ${GOLD})`,
    `linear-gradient(135deg, #88D8A3, ${GREEN})`,
  ];
  return gradients[idx % gradients.length];
}

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
      (supabase as any).from('products').select('*').eq('active', true).order('is_iberaparis', { ascending: false }),
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
      const matchCat = cat === 'all' || (p.category ?? '').toLowerCase().includes(cat);
      return matchSearch && matchCat;
    });
  }, [products, search, cat]);

  const iberaparis = filtered.filter(p => p.is_iberaparis);
  const alternatives = filtered.filter(p => !p.is_iberaparis);

  if (loading) return null;

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ padding: '20px 20px 14px' }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5, color: DARK }}>Produtos</div>
          <div style={{ fontSize: 13, color: SUB, marginTop: 3 }}>Recomendados para você</div>
        </div>

        {/* Search */}
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{
            background: SURFACE, borderRadius: 12, padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <span style={{ fontSize: 14, color: SUB }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar produto…"
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 14, color: DARK,
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'transparent', border: 'none', color: SUB, cursor: 'pointer', fontSize: 12 }}>✕</button>
            )}
          </div>
        </div>

        {/* Category pills */}
        <div style={{ padding: '0 16px 16px', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCat(c.key)} style={{
              flexShrink: 0, padding: '6px 14px', borderRadius: 18,
              border: 'none', cursor: 'pointer',
              background: cat === c.key ? ACCENT : SURFACE,
              color: cat === c.key ? '#FFF' : DARK,
              fontSize: 12.5, fontWeight: 600,
              boxShadow: cat === c.key ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
            }}>
              {c.label}
            </button>
          ))}
        </div>

        {/* Iberaparis section */}
        {iberaparis.length > 0 && (
          <>
            <div style={{ padding: '6px 24px 10px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>
                ✨ Produtos Iberaparis <span style={{ color: SUB, fontWeight: 500 }}>· recomendados pela Ju</span>
              </div>
            </div>
            <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {iberaparis.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} isMatch={profileHairType ? (p.hair_types ?? []).some(h => h.toLowerCase().includes(profileHairType.toLowerCase())) : false} />
              ))}
            </div>
          </>
        )}

        {/* Alternatives */}
        {alternatives.length > 0 && (
          <>
            <div style={{ padding: '6px 24px 10px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>
                💚 Alternativas Acessíveis
              </div>
            </div>
            <div style={{ padding: '0 16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {alternatives.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} outlined />
              ))}
            </div>
          </>
        )}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 24px' }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>🛍️</div>
            <div style={{ fontSize: 14, color: SUB }}>
              {products.length === 0 ? 'Catálogo sendo preparado.' : 'Nenhum produto encontrado.'}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function ProductCard({ product, index, isMatch = false, outlined = false }: {
  product: ProductRow; index: number; isMatch?: boolean; outlined?: boolean;
}) {
  return (
    <div style={{
      background: SURFACE, borderRadius: 14, padding: 10, position: 'relative',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      {/* Image area */}
      <div style={{
        height: 90, borderRadius: 10,
        background: product.image_url ? `url(${product.image_url}) center/cover` : gradientFor(index),
        position: 'relative', marginBottom: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32,
      }}>
        {!product.image_url && emojiFor(product.category, product.name)}
        {product.affiliate_url && (
          <div style={{
            position: 'absolute', top: 6, right: 6,
            background: 'rgba(255,255,255,0.95)', color: DARK,
            fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4,
          }}>🔗 Afiliado</div>
        )}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {product.brand ?? '—'}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: DARK, marginTop: 2, lineHeight: 1.3, minHeight: 32, overflow: 'hidden' }}>
        {product.name}
      </div>
      {product.price_brl && (
        <div style={{ fontSize: 15, fontWeight: 800, color: DARK, marginTop: 6 }}>
          R$ {product.price_brl.toFixed(2).replace('.', ',')}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, minHeight: 18 }}>
        {isMatch && (
          <span style={{ fontSize: 9.5, fontWeight: 700, color: GREEN, background: '#E8F8EE', borderRadius: 5, padding: '2px 5px' }}>Para seu tipo</span>
        )}
        {!isMatch && product.is_iberaparis && (
          <span style={{ fontSize: 9.5, fontWeight: 700, color: GOLD, background: '#FFF3E0', borderRadius: 5, padding: '2px 5px' }}>Mais vendido</span>
        )}
        {outlined && (
          <span style={{ fontSize: 9.5, fontWeight: 700, color: PURPLE, background: '#EEF0FF', borderRadius: 5, padding: '2px 5px' }}>Econômico</span>
        )}
      </div>
      {product.affiliate_url ? (
        <a href={product.affiliate_url} target="_blank" rel="noopener noreferrer" style={{
          display: 'block', marginTop: 8, textAlign: 'center',
          background: outlined ? 'transparent' : `linear-gradient(135deg, ${ACCENT2}, ${ACCENT})`,
          color: outlined ? ACCENT : '#FFF',
          border: outlined ? `1.5px solid ${ACCENT}` : 'none',
          fontSize: 12, fontWeight: 700, padding: '7px 0', borderRadius: 8,
          textDecoration: 'none',
        }}>
          Ver produto →
        </a>
      ) : (
        <div style={{
          marginTop: 8, textAlign: 'center', background: '#F2F2F7',
          color: SUB, fontSize: 12, fontWeight: 600, padding: '7px 0', borderRadius: 8,
        }}>Sem link</div>
      )}
    </div>
  );
}
