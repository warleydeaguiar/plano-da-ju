'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createBrowserClient } from '@supabase/ssr';
import { T, fonts, shadow, gradient } from '../theme';
import {
  IconCheck, IconBag, IconSparkles, iconForTask, iconForCategory,
} from '../icons';
import { normalizeTasks } from '../plan-helpers';
import { PlanoLoading } from '../Loading';

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
  affiliate_url: string | null;
  image_url: string | null;
  is_ybera: boolean;
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
      supabase.from('profiles')
        .select('full_name,hair_type,porosity,chemical_history,main_problems,hair_length_cm,quiz_answers,plan_released_at,plan_status')
        .eq('id', uid).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('hair_plans')
        .select('week_number,focus,tasks,products,tips,juliane_notes')
        .eq('user_id', uid).order('week_number'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('products')
        .select('id,name,brand,category,affiliate_url,image_url,is_ybera')
        .eq('active', true).limit(8),
    ]);
    if (p.data)  setProfile(p.data as Profile);
    if (pl.data) {
      // Normaliza tasks: o banco tem 2 formatos (array de strings ou objetos) —
      // sem isto, semanas no formato antigo crashavam o render.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setPlans((pl.data as any[]).map(p => ({ ...p, tasks: normalizeTasks(p.tasks) })) as HairPlanRow[]);
    }
    if (pr.data) setProducts(pr.data as ProductRow[]);
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <PlanoLoading label="Carregando seu plano…" />;

  // ── Estado "preparando" — plano ainda não aprovado pela Juliane ─────────
  // Bloqueia a view do plano completo até admin aprovar (plan_status === 'ready').
  // Mostra um card claro: "Juliane está lendo suas respostas e preparando".
  const planReady = profile?.plan_status === 'ready';
  if (!planReady) {
    return <PreparingState profile={profile} />;
  }

  const currentPlan = plans.find(p => p.week_number === activeWeek);

  const chips: { label: string; tone: 'pink' | 'gold' | 'cream' }[] = [];
  if (profile?.hair_type) chips.push({ label: profile.hair_type, tone: 'pink' });
  if (profile?.porosity) chips.push({ label: `${profile.porosity} porosidade`, tone: 'gold' });
  const mainProblem = profile?.main_problems?.[0];
  if (mainProblem) chips.push({ label: mainProblem, tone: 'cream' });

  const releasedDate = profile?.plan_released_at
    ? new Date(profile.plan_released_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Hero with warm gradient */}
        <div style={{
          padding: '36px 24px 64px',
          background: gradient.hero,
          borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
          color: '#FFF', position: 'relative', overflow: 'hidden',
        }}>
          {/* Decorative orbs */}
          <div style={{ position: 'absolute', right: -50, top: -50, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', left: -30, bottom: -60, width: 140, height: 140, borderRadius: '50%', background: 'rgba(201,168,119,0.18)' }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 1.4,
              opacity: 0.85, textTransform: 'uppercase',
            }}>
              Seu plano personalizado
            </div>
            <h1 style={{
              fontSize: 30, fontWeight: 600, letterSpacing: -0.5,
              margin: '8px 0 6px',
              fontFamily: fonts.display, fontStyle: 'italic',
            }}>
              Cronograma <em style={{ fontWeight: 700 }}>Capilar</em>
            </h1>
            {releasedDate && (
              <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 4 }}>
                Criado para você em {releasedDate}
              </div>
            )}
            {chips.length > 0 && (
              <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {chips.map((c, i) => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.18)',
                    border: '1px solid rgba(255,255,255,0.22)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    borderRadius: 99, padding: '6px 13px',
                    fontSize: 12, fontWeight: 600,
                    textTransform: 'capitalize',
                  }}>{c.label}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Juliane verification card (overlaps hero) */}
        <div style={{
          margin: '-34px 16px 18px',
          background: T.surface, borderRadius: 18,
          padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 14,
          boxShadow: shadow.raised,
          position: 'relative', zIndex: 2,
          border: `1px solid ${T.borderSoft}`,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            overflow: 'hidden',
            border: `2.5px solid ${T.gold}`,
            boxShadow: '0 4px 12px rgba(190,24,93,0.18)',
            position: 'relative',
            flexShrink: 0,
          }}>
            <Image
              src="/images/ju-depois.png"
              alt="Juliane Cost"
              width={52} height={52}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 15.5, fontWeight: 700, color: T.ink,
              fontFamily: fonts.display, letterSpacing: -0.2,
            }}>
              Juliane Cost
            </div>
            <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 1 }}>
              Especialista capilar · Ybera Paris
            </div>
          </div>
          <div style={{
            background: T.greenSoft, color: T.green,
            borderRadius: 99, padding: '5px 11px',
            fontSize: 11, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: 5,
            flexShrink: 0,
          }}>
            <IconCheck size={12} stroke={2.5} />
            Revisado
          </div>
        </div>

        {/* Sub-tabs */}
        <div style={{
          margin: '0 16px 18px', display: 'flex',
          background: T.surface, borderRadius: 14, padding: 4,
          boxShadow: shadow.card, border: `1px solid ${T.borderSoft}`,
        }}>
          {(['rotina','produtos','dicas'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '9px 0', borderRadius: 10, border: 'none',
              background: tab === t ? gradient.heroSoft : 'transparent',
              color: tab === t ? '#FFF' : T.inkSoft,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              textTransform: 'capitalize',
              letterSpacing: 0.2,
              transition: 'all 0.18s',
              boxShadow: tab === t ? '0 2px 6px rgba(190,24,93,0.25)' : 'none',
            }}>{t}</button>
          ))}
        </div>

        {/* Diagnóstico (Rotina tab) */}
        {tab === 'rotina' && (
          <>
            <SectionLabel>Seu diagnóstico</SectionLabel>
            <div style={{
              margin: '0 16px 18px', background: T.surface, borderRadius: 16,
              padding: 18, boxShadow: shadow.card,
              border: `1px solid ${T.borderSoft}`,
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <DiagItem label="Tipo de cabelo"  value={profile?.hair_type ?? '—'}      tone="pink" />
                <DiagItem label="Porosidade"      value={profile?.porosity ?? '—'}       tone="gold" />
                <DiagItem label="Foco principal"  value={mainProblem ?? 'Manutenção'}    tone="cream" />
                <DiagItem label="Químicas"        value={profile?.chemical_history ?? 'Nenhuma'} />
                <DiagItem label="Comprimento"     value={profile?.hair_length_cm ? `${profile.hair_length_cm} cm` : '—'} />
                <DiagItem label="Lavagem ideal"   value={`A cada ${profile?.hair_type?.includes('oleoso') ? '2–3' : profile?.hair_type?.includes('crespo') ? '5–7' : '3–5'} dias`} />
              </div>
            </div>

            {/* Week selector */}
            <SectionLabel rightLabel={`${plans.length} semanas`}>
              Rotina semanal
            </SectionLabel>
            {plans.length > 0 && (
              <div style={{
                padding: '0 16px 14px', display: 'flex', gap: 6,
                overflowX: 'auto', scrollbarWidth: 'none',
              }}>
                {plans.map(p => (
                  <button key={p.week_number} onClick={() => setActiveWeek(p.week_number)} style={{
                    flexShrink: 0, padding: '7px 14px', borderRadius: 99,
                    border: `1.5px solid ${p.week_number === activeWeek ? T.pink : T.border}`,
                    background: p.week_number === activeWeek ? T.pink : T.surface,
                    color: p.week_number === activeWeek ? '#FFF' : T.ink,
                    fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  }}>Sem. {p.week_number}</button>
                ))}
              </div>
            )}

            {currentPlan && (
              <>
                {/* Focus banner */}
                <div style={{
                  margin: '0 16px 14px',
                  background: gradient.warm,
                  borderRadius: 16, padding: '16px 18px',
                  border: `1px solid ${T.border}`,
                }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: T.pinkDeep,
                    textTransform: 'uppercase', letterSpacing: 1.2,
                  }}>
                    Semana {currentPlan.week_number} · Foco
                  </div>
                  <div style={{
                    fontSize: 19, fontWeight: 600, color: T.ink, marginTop: 4,
                    fontFamily: fonts.display, letterSpacing: -0.3,
                  }}>
                    {currentPlan.focus}
                  </div>
                </div>

                {/* 7-day breakdown */}
                <div style={{
                  margin: '0 16px 16px', background: T.surface, borderRadius: 16,
                  overflow: 'hidden', boxShadow: shadow.card,
                  border: `1px solid ${T.borderSoft}`,
                }}>
                  {currentPlan.tasks.map((task, i) => {
                    const dayName = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'][task.day - 1] ?? `Dia ${task.day}`;
                    const TaskIcon = iconForTask(task.title);
                    return (
                      <div key={i} style={{
                        padding: '14px 18px',
                        display: 'flex', alignItems: 'center', gap: 14,
                        borderBottom: i < currentPlan.tasks.length - 1 ? `1px solid ${T.borderSoft}` : 'none',
                      }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: 11,
                          background: T.rose, color: T.pinkDeep,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                          border: `1px solid ${T.pinkSoft}`,
                        }}>
                          <TaskIcon size={20} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 11, color: T.inkSoft,
                            fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                          }}>{dayName}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginTop: 2 }}>
                            {task.title}
                          </div>
                          <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2, lineHeight: 1.45 }}>
                            {task.description}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Juliane's note */}
                {currentPlan.juliane_notes && (
                  <div style={{
                    margin: '0 16px 18px', background: gradient.gold,
                    borderRadius: 16, padding: '16px 18px',
                    border: `1px solid ${T.gold}55`,
                    position: 'relative',
                  }}>
                    <div style={{
                      fontSize: 10.5, fontWeight: 700, color: T.goldDeep,
                      textTransform: 'uppercase', letterSpacing: 1.2,
                      marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <IconSparkles size={13} color={T.goldDeep} />
                      Da Juliane para você
                    </div>
                    <div style={{
                      fontSize: 14, color: T.ink, lineHeight: 1.55,
                      fontFamily: fonts.display, fontStyle: 'italic',
                    }}>
                      &ldquo;{currentPlan.juliane_notes}&rdquo;
                    </div>
                  </div>
                )}
              </>
            )}
            {plans.length === 0 && profile?.plan_status !== 'ready' && (
              <EmptyState
                emoji="⏳"
                title="Seu plano está sendo preparado"
                description="A Juliane está personalizando seu cronograma. Em breve ficará pronto aqui!"
              />
            )}
          </>
        )}

        {/* Produtos tab */}
        {tab === 'produtos' && (
          <>
            <SectionLabel>Produtos recomendados</SectionLabel>
            <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {products.filter(p => p.is_ybera).map(p => <ProductCard key={p.id} product={p} essential />)}
              {products.filter(p => !p.is_ybera).map(p => <ProductCard key={p.id} product={p} />)}
              {products.length === 0 && (
                <EmptyState emoji="🛍️" title="Catálogo em breve" description="Os produtos recomendados serão exibidos aqui." />
              )}
            </div>
            {currentPlan?.products && currentPlan.products.length > 0 && (
              <>
                <SectionLabel>Para esta semana</SectionLabel>
                <div style={{
                  margin: '0 16px 18px', background: T.surface, borderRadius: 16,
                  padding: '14px 18px', boxShadow: shadow.card,
                  border: `1px solid ${T.borderSoft}`,
                }}>
                  {currentPlan.products.map((prod, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 0' }}>
                      <IconCheck size={16} color={T.pink} stroke={2.3} />
                      <span style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.45 }}>{prod}</span>
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
            <SectionLabel>Dicas da Juliane</SectionLabel>
            <div style={{ margin: '0 16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentPlan?.tips?.map((tip, i) => (
                <div key={i} style={{
                  background: T.surface, borderRadius: 14, padding: '14px 16px',
                  borderLeft: `3px solid ${T.pink}`,
                  boxShadow: shadow.card,
                  border: `1px solid ${T.borderSoft}`,
                }}>
                  <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.6 }}>{tip}</div>
                </div>
              ))}
              {(!currentPlan?.tips || currentPlan.tips.length === 0) && (
                <EmptyState emoji="💡" title="Dicas em breve" description="Adicionaremos dicas personalizadas para esta semana." />
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────
function SectionLabel({ children, rightLabel }: { children: React.ReactNode; rightLabel?: string }) {
  return (
    <div style={{ padding: '4px 24px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: T.inkSoft,
        textTransform: 'uppercase', letterSpacing: 1.2,
      }}>
        {children}
      </div>
      {rightLabel && (
        <div style={{ fontSize: 11.5, color: T.inkSoft, fontWeight: 500 }}>{rightLabel}</div>
      )}
    </div>
  );
}

function DiagItem({ label, value, tone }: { label: string; value: string; tone?: 'pink' | 'gold' | 'cream' }) {
  const toneColors = {
    pink:  { bg: T.pinkSoft, fg: T.pinkDeep },
    gold:  { bg: T.goldSoft, fg: T.goldDeep },
    cream: { bg: T.rose,     fg: T.pinkDeep },
  };
  const c = tone ? toneColors[tone] : null;
  return (
    <div>
      <div style={{
        fontSize: 10.5, fontWeight: 700, color: T.inkSoft,
        textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5,
      }}>
        {label}
      </div>
      {c ? (
        <div style={{
          display: 'inline-block',
          background: c.bg, color: c.fg,
          fontSize: 12.5, fontWeight: 700,
          borderRadius: 99, padding: '4px 11px',
          textTransform: 'capitalize',
        }}>{value}</div>
      ) : (
        <div style={{
          fontSize: 13.5, fontWeight: 600, color: T.ink,
          textTransform: 'capitalize',
        }}>{value}</div>
      )}
    </div>
  );
}

function ProductCard({ product, essential = false }: { product: ProductRow; essential?: boolean }) {
  const Icon = iconForCategory(product.category, product.name);
  return (
    <div style={{
      background: T.surface, borderRadius: 16, padding: 14,
      display: 'flex', gap: 14, alignItems: 'center',
      boxShadow: shadow.card,
      border: `1px solid ${T.borderSoft}`,
    }}>
      <div style={{
        width: 58, height: 58, borderRadius: 14,
        background: product.is_ybera ? gradient.heroSoft : gradient.gold,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: product.is_ybera ? '#FFF' : T.goldDeep,
        flexShrink: 0,
      }}>
        <Icon size={26} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10.5, fontWeight: 700, color: T.inkSoft,
          textTransform: 'uppercase', letterSpacing: 0.6,
        }}>
          {product.brand ?? 'Ybera Paris'}
        </div>
        <div style={{
          fontSize: 13.5, fontWeight: 700, color: T.ink,
          marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {product.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          {essential && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: T.green,
              background: T.greenSoft, borderRadius: 6, padding: '2px 7px',
            }}>Essencial</span>
          )}
        </div>
      </div>
      {product.affiliate_url && (
        <a href={product.affiliate_url} target="_blank" rel="noopener noreferrer" style={{
          background: gradient.heroSoft,
          color: '#FFF', fontSize: 12, fontWeight: 700,
          padding: '9px 13px', borderRadius: 11,
          textDecoration: 'none',
          flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', gap: 5,
          boxShadow: '0 2px 8px rgba(190,24,93,0.25)',
        }}>
          <IconBag size={13} stroke={2} /> Ver
        </a>
      )}
    </div>
  );
}

function EmptyState({ emoji, title, description }: { emoji: string; title: string; description: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 24px' }}>
      <div style={{ fontSize: 44, marginBottom: 10 }}>{emoji}</div>
      <div style={{
        fontSize: 17, fontWeight: 600, color: T.ink, marginBottom: 6,
        fontFamily: fonts.display,
      }}>{title}</div>
      <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.5 }}>{description}</div>
    </div>
  );
}

// ── Preparando: plano ainda não aprovado pela Juliane ─────────────────────
function PreparingState({ profile }: { profile: Profile | null }) {
  const firstName = profile?.full_name?.split(' ')[0] ?? '';
  return (
    <div>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        {/* Hero compacto */}
        <div style={{
          padding: '36px 24px 56px',
          background: gradient.hero,
          borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
          color: '#FFF', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', right: -50, top: -50, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', left: -30, bottom: -60, width: 140, height: 140, borderRadius: '50%', background: 'rgba(201,168,119,0.18)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 1.4,
              opacity: 0.85, textTransform: 'uppercase',
            }}>
              Seu plano personalizado
            </div>
            <h1 style={{
              fontSize: 28, fontWeight: 600, letterSpacing: -0.5,
              margin: '8px 0 6px',
              fontFamily: fonts.display,
            }}>
              Em preparação
            </h1>
            <div style={{ fontSize: 13, opacity: 0.92, marginTop: 4, lineHeight: 1.5 }}>
              {firstName ? `${firstName}, a` : 'A'} Juliane está analisando suas respostas agora.
            </div>
          </div>
        </div>

        {/* Card overlapping hero — status + steps */}
        <div style={{
          margin: '-34px 16px 18px',
          background: T.surface, borderRadius: 20,
          padding: '20px 18px',
          boxShadow: shadow.raised,
          position: 'relative', zIndex: 2,
          border: `1px solid ${T.borderSoft}`,
        }}>
          {/* Ju avatar + status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              overflow: 'hidden',
              border: `2.5px solid ${T.gold}`,
              boxShadow: '0 4px 12px rgba(190,24,93,0.18)',
              position: 'relative', flexShrink: 0,
            }}>
              <Image
                src="/images/ju-depois.png"
                alt="Juliane Cost"
                width={52} height={52}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 15.5, fontWeight: 700, color: T.ink,
                fontFamily: fonts.display,
              }}>
                Juliane Cost
              </div>
              <div style={{
                fontSize: 12, color: T.pinkDeep, marginTop: 2,
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontWeight: 600,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: T.pink, display: 'inline-block',
                  animation: 'pulse 1.6s ease-in-out infinite',
                }} />
                trabalhando no seu plano…
              </div>
            </div>
          </div>

          {/* Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <PrepStep
              done
              title="Foto recebida"
              description="A Juliane já recebeu sua foto e suas respostas do quiz."
            />
            <PrepStep
              active
              title="Lendo suas respostas e analisando o cabelo"
              description="Cruzando seu tipo de cabelo, química, problemas e a foto enviada."
            />
            <PrepStep
              title="Montando seu cronograma personalizado"
              description="Lavagens, hidratações, reconstruções e produtos pra você."
            />
            <PrepStep
              title="Plano liberado no app"
              description="Você vai receber um e-mail e o cronograma aparece aqui na hora."
            />
          </div>
        </div>

        {/* Aviso prazo */}
        <div style={{
          margin: '0 16px 18px',
          background: gradient.warm,
          border: `1px solid ${T.gold}55`,
          borderRadius: 14, padding: '14px 16px',
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>⏳</span>
          <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.55 }}>
            Plano fica pronto em até <strong>3 dias úteis</strong>. Você pode
            seguir usando o app normalmente enquanto isso —
            registre suas lavagens, hidratações e veja as dicas da Juliane.
          </div>
        </div>

        {/* CTA explorar app enquanto espera */}
        <div style={{ padding: '0 16px 30px' }}>
          <a href="/meu-plano" style={{
            display: 'block', width: '100%',
            background: T.surface, color: T.pinkDeep,
            border: `1.5px solid ${T.pink}`,
            borderRadius: 14, padding: 14, textAlign: 'center',
            fontSize: 14, fontWeight: 700, textDecoration: 'none',
            fontFamily: fonts.ui,
          }}>
            Explorar o app
          </a>
        </div>

        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }`}</style>
      </div>
    </div>
  );
}

function PrepStep({ done, active, title, description }: { done?: boolean; active?: boolean; title: string; description: string }) {
  const bg = done ? T.greenSoft : active ? T.pinkSoft : '#F5F1F2';
  const fg = done ? T.green : active ? T.pinkDeep : T.inkMuted;
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: bg, color: fg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontSize: 16, fontWeight: 700,
      }}>
        {done ? <IconCheck size={16} stroke={2.5} /> : active ? (
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: T.pink,
            animation: 'pulse 1.4s ease-in-out infinite',
          }} />
        ) : '·'}
      </div>
      <div style={{ flex: 1, paddingTop: 2 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 700,
          color: active ? T.pinkDeep : done ? T.ink : T.inkSoft,
          fontFamily: fonts.display,
        }}>{title}</div>
        <div style={{
          fontSize: 12, color: T.inkSoft, marginTop: 2, lineHeight: 1.5,
        }}>{description}</div>
      </div>
    </div>
  );
}
