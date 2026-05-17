'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const ACCENT  = '#C4607A';
const ACCENT2 = '#9B4A6A';
const DARK    = '#1C1C1E';
const MID     = '#48484A';
const SUB     = '#8E8E93';
const SEP     = '#E5E5EA';
const SURFACE = '#FFFFFF';
const GREEN   = '#34C759';
const GOLD    = '#FF9500';
const BLUE    = '#007AFF';
const PURPLE  = '#5856D6';

type Tab = 'rotina' | 'produtos' | 'dicas';

interface HairPlanRow {
  week_number: number;
  focus: string;
  tasks: Array<{ day: number; title: string; description: string; done: boolean }>;
  products: string[];
  tips: string[];
  juliane_notes: string | null;
}
interface Profile {
  full_name: string | null;
  hair_type: string | null;
  porosity: string | null;
  chemical_history: string | null;
  main_problems: string[] | null;
  hair_length_cm: number | null;
  quiz_answers: Record<string, unknown> | null;
  plan_released_at: string | null;
  plan_status: string;
}
interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  price_brl: number | null;
  affiliate_url: string | null;
  image_url: string | null;
  is_iberaparis: boolean;
}

const TASK_COLOR: Record<string, string> = {
  hidrat: BLUE,
  lavag: PURPLE,
  shampoo: PURPLE,
  nutri: ACCENT,
  recon: '#5E5CE6',
  oleo: GOLD,
  óleo: GOLD,
  descan: SEP,
};

function colorForTask(title: string) {
  const t = title.toLowerCase();
  for (const key of Object.keys(TASK_COLOR)) if (t.includes(key)) return TASK_COLOR[key];
  return ACCENT;
}

function emojiForTask(title: string) {
  const t = title.toLowerCase();
  if (t.includes('hidrat')) return '💧';
  if (t.includes('lavag') || t.includes('shampoo')) return '🚿';
  if (t.includes('nutri')) return '🥥';
  if (t.includes('recon')) return '💪';
  if (t.includes('óleo') || t.includes('oleo')) return '✨';
  if (t.includes('descan')) return '😴';
  return '🌿';
}

export default function PlanoPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('rotina');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plans, setPlans] = useState<HairPlanRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [activeWeek, setActiveWeek] = useState(1);
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }
    const uid = session.user.id;

    const [p, pl, pr] = await Promise.all([
      supabase.from('profiles').select('full_name,hair_type,porosity,chemical_history,main_problems,hair_length_cm,quiz_answers,plan_released_at,plan_status').eq('id', uid).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('hair_plans').select('week_number,focus,tasks,products,tips,juliane_notes').eq('user_id', uid).order('week_number'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('products').select('id,name,brand,category,price_brl,affiliate_url,image_url,is_iberaparis').eq('active', true).limit(8),
    ]);
    if (p.data)  setProfile(p.data as Profile);
    if (pl.data) setPlans(pl.data as HairPlanRow[]);
    if (pr.data) setProducts(pr.data as ProductRow[]);
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return null;

  const currentPlan = plans.find(p => p.week_number === activeWeek);

  // Hair profile chips
  const chips: { label: string; color: string }[] = [];
  if (profile?.hair_type) chips.push({ label: profile.hair_type, color: ACCENT });
  if (profile?.porosity) chips.push({ label: `${profile.porosity} porosidade`, color: BLUE });
  const mainProblem = profile?.main_problems?.[0];
  if (mainProblem) chips.push({ label: mainProblem, color: GOLD });

  const releasedDate = profile?.plan_released_at
    ? new Date(profile.plan_released_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Hero */}
        <div style={{
          margin: 0, padding: '32px 24px 56px',
          background: `linear-gradient(135deg, #8B3A6E, ${ACCENT})`,
          borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
          color: '#FFF', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, opacity: 0.8, textTransform: 'uppercase' }}>SEU PLANO PERSONALIZADO</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, margin: '4px 0 8px' }}>Cronograma Capilar</h1>
          {releasedDate && <div style={{ fontSize: 12.5, opacity: 0.85 }}>Criado para o seu perfil em {releasedDate}</div>}
          {chips.length > 0 && (
            <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {chips.map((c, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.18)', borderRadius: 12, padding: '5px 12px',
                  fontSize: 12, fontWeight: 600,
                }}>{c.label}</div>
              ))}
            </div>
          )}
        </div>

        {/* Juliane badge (overlapping hero) */}
        <div style={{
          margin: '-30px 16px 16px',
          background: SURFACE, borderRadius: 16,
          padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
          position: 'relative', zIndex: 2,
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: '50%',
            background: `linear-gradient(135deg, ${ACCENT2}, ${ACCENT})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, color: '#FFF',
          }}>👩‍⚕️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: DARK }}>Juliane Cost</div>
            <div style={{ fontSize: 12, color: SUB }}>Especialista Capilar</div>
          </div>
          <div style={{
            background: '#E8F8EE', color: GREEN,
            borderRadius: 20, padding: '5px 10px',
            fontSize: 11, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>✓ Revisado</div>
        </div>

        {/* Sub-tabs */}
        <div style={{ margin: '0 16px 16px', display: 'flex', background: SURFACE, borderRadius: 12, padding: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {(['rotina','produtos','dicas'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '8px 0', borderRadius: 9, border: 'none',
              background: tab === t ? ACCENT : 'transparent',
              color: tab === t ? '#FFF' : MID,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              textTransform: 'capitalize',
            }}>{t}</button>
          ))}
        </div>

        {/* Diagnóstico (sempre visível em Rotina) */}
        {tab === 'rotina' && (
          <>
            <div style={{ padding: '6px 24px 10px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>Seu Diagnóstico</div>
            </div>
            <div style={{
              margin: '0 16px 16px', background: SURFACE, borderRadius: 14,
              padding: 16,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <DiagItem label="Tipo de cabelo" value={profile?.hair_type ?? '—'} tone={ACCENT} />
                <DiagItem label="Porosidade" value={profile?.porosity ?? '—'} tone={BLUE} />
                <DiagItem label="Foco principal" value={mainProblem ?? 'Manutenção'} tone={GOLD} />
                <DiagItem label="Químicas" value={profile?.chemical_history ?? 'Nenhuma'} tone={PURPLE} />
                <DiagItem label="Comprimento" value={profile?.hair_length_cm ? `${profile.hair_length_cm} cm` : '—'} />
                <DiagItem label="Lavagem ideal" value={`A cada ${profile?.hair_type?.includes('oleoso') ? '2-3' : profile?.hair_type?.includes('crespo') ? '5-7' : '3-5'} dias`} />
              </div>
            </div>

            {/* Rotina Semanal — week selector */}
            <div style={{ padding: '6px 24px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>Rotina Semanal</div>
              <div style={{ fontSize: 12.5, color: SUB }}>{plans.length} semanas</div>
            </div>
            {plans.length > 0 && (
              <div style={{ padding: '0 16px 12px', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
                {plans.map(p => (
                  <button key={p.week_number} onClick={() => setActiveWeek(p.week_number)} style={{
                    flexShrink: 0, padding: '6px 12px', borderRadius: 18,
                    border: `1.5px solid ${p.week_number === activeWeek ? ACCENT : SEP}`,
                    background: p.week_number === activeWeek ? ACCENT : SURFACE,
                    color: p.week_number === activeWeek ? '#FFF' : DARK,
                    fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                  }}>Sem. {p.week_number}</button>
                ))}
              </div>
            )}
            {currentPlan && (
              <>
                {/* Focus banner */}
                <div style={{ margin: '0 16px 14px', background: SURFACE, borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    SEMANA {currentPlan.week_number} · FOCO
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: DARK, marginTop: 4 }}>{currentPlan.focus}</div>
                </div>

                {/* 7-day breakdown */}
                <div style={{ margin: '0 16px 14px', background: SURFACE, borderRadius: 14, padding: '4px 0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  {currentPlan.tasks.map((task, i) => {
                    const dayName = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'][task.day - 1] ?? `Dia ${task.day}`;
                    const color = colorForTask(task.title);
                    const emoji = emojiForTask(task.title);
                    return (
                      <div key={i} style={{
                        padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14,
                        borderBottom: i < currentPlan.tasks.length - 1 ? `0.5px solid ${SEP}` : 'none',
                      }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: `${color}22`, color, fontSize: 18,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>{emoji}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11.5, color: SUB, fontWeight: 600 }}>{dayName}</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: DARK, marginTop: 2 }}>{task.title}</div>
                          <div style={{ fontSize: 12.5, color: SUB, marginTop: 2, lineHeight: 1.4 }}>{task.description}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Juliane's note */}
                {currentPlan.juliane_notes && (
                  <div style={{
                    margin: '0 16px 16px', background: '#FDE8EE', borderRadius: 14,
                    padding: '14px 16px', borderLeft: `3px solid ${ACCENT}`,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                      💬 Da Juliane para você
                    </div>
                    <div style={{ fontSize: 13, color: DARK, lineHeight: 1.5, fontStyle: 'italic' }}>
                      &ldquo;{currentPlan.juliane_notes}&rdquo;
                    </div>
                  </div>
                )}
              </>
            )}
            {plans.length === 0 && profile?.plan_status !== 'ready' && (
              <div style={{ textAlign: 'center', padding: '40px 24px' }}>
                <div style={{ fontSize: 44, marginBottom: 10 }}>⏳</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: DARK, marginBottom: 6 }}>Seu plano está sendo preparado</div>
                <div style={{ fontSize: 13, color: SUB, lineHeight: 1.5 }}>A Juliane está personalizando seu cronograma. Em breve ficará pronto aqui!</div>
              </div>
            )}
          </>
        )}

        {/* Produtos tab */}
        {tab === 'produtos' && (
          <>
            <div style={{ padding: '6px 24px 10px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>✨ Produtos Recomendados</div>
            </div>
            <div style={{ margin: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
              {products.filter(p => p.is_iberaparis).map(p => (
                <ProductCard key={p.id} product={p} essential />
              ))}
              {products.filter(p => !p.is_iberaparis).map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
              {products.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ fontSize: 44, marginBottom: 10 }}>🛍️</div>
                  <div style={{ fontSize: 14, color: SUB }}>Produtos serão exibidos em breve.</div>
                </div>
              )}
            </div>
            {currentPlan?.products && currentPlan.products.length > 0 && (
              <>
                <div style={{ padding: '6px 24px 10px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>Para esta semana</div>
                </div>
                <div style={{ margin: '0 16px 16px', background: SURFACE, borderRadius: 14, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  {currentPlan.products.map((prod, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0' }}>
                      <span style={{ color: ACCENT, fontSize: 14, marginTop: 1 }}>✓</span>
                      <span style={{ fontSize: 13.5, color: DARK, lineHeight: 1.4 }}>{prod}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Dicas tab */}
        {tab === 'dicas' && (
          <>
            <div style={{ padding: '6px 24px 10px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>💡 Dicas da Juliane</div>
            </div>
            <div style={{ margin: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentPlan?.tips?.map((tip, i) => (
                <div key={i} style={{
                  background: SURFACE, borderRadius: 14, padding: '14px 16px',
                  borderLeft: `3px solid ${ACCENT}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}>
                  <div style={{ fontSize: 13.5, color: DARK, lineHeight: 1.55 }}>{tip}</div>
                </div>
              ))}
              {(!currentPlan?.tips || currentPlan.tips.length === 0) && (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ fontSize: 44, marginBottom: 10 }}>💡</div>
                  <div style={{ fontSize: 14, color: SUB }}>Dicas estarão disponíveis em breve.</div>
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

function DiagItem({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: SUB, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>{label}</div>
      {tone ? (
        <div style={{ display: 'inline-block', background: `${tone}1A`, color: tone, fontSize: 12.5, fontWeight: 700, borderRadius: 8, padding: '3px 9px', textTransform: 'capitalize' }}>
          {value}
        </div>
      ) : (
        <div style={{ fontSize: 13.5, fontWeight: 600, color: DARK, textTransform: 'capitalize' }}>{value}</div>
      )}
    </div>
  );
}

function ProductCard({ product, essential = false }: { product: ProductRow; essential?: boolean }) {
  return (
    <div style={{ background: SURFACE, borderRadius: 14, padding: 14, display: 'flex', gap: 14, alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{
        width: 56, height: 56, borderRadius: 12,
        background: product.is_iberaparis ? `linear-gradient(135deg, ${ACCENT2}, ${ACCENT})` : `linear-gradient(135deg, #B19CD9, ${PURPLE})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26, flexShrink: 0,
      }}>
        {product.category?.includes('shampoo') ? '🧴' :
         product.category?.includes('masc') ? '💜' :
         product.category?.includes('óleo') || product.category?.includes('oleo') ? '✨' : '🌿'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: SUB, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {product.brand ?? 'Iberaparis'}
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: DARK, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {product.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          {product.price_brl && (
            <span style={{ fontSize: 14.5, fontWeight: 800, color: DARK }}>R$ {product.price_brl.toFixed(2).replace('.', ',')}</span>
          )}
          {essential && (
            <span style={{ fontSize: 10, fontWeight: 700, color: GREEN, background: '#E8F8EE', borderRadius: 6, padding: '2px 6px' }}>Essencial</span>
          )}
        </div>
      </div>
      {product.affiliate_url && (
        <a href={product.affiliate_url} target="_blank" rel="noopener noreferrer" style={{
          background: `linear-gradient(135deg, ${ACCENT2}, ${ACCENT})`,
          color: '#FFF', fontSize: 11.5, fontWeight: 700,
          padding: '8px 12px', borderRadius: 10, textDecoration: 'none',
          flexShrink: 0,
        }}>🛍️ Ver</a>
      )}
    </div>
  );
}
