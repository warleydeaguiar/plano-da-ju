'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createBrowserClient } from '@supabase/ssr';
import { T, fonts, shadow, gradient } from '../theme';
import {
  IconCheck, IconBag, IconSparkles, IconInstagram, iconForTask, iconForCategory,
} from '../icons';
import { normalizeTasks } from '../plan-helpers';
import { PlanoLoading } from '../Loading';
import PlanFeedback from './PlanFeedback';
import { DICAS_UNIVERSAIS } from '@/lib/dicas-universais';

// Meta de seguidores da Ju no Instagram (prova social — atualizar quando mudar)
const IG_FOLLOWERS = 54421;
const IG_GOAL = 100000;

// Imagens específicas das 3 máscaras do Kit Cuidados Profundos (cronograma).
// O kit é 1 produto só no catálogo, então cada máscara aponta pra sua foto aqui.
// (galeria do kit na Ybera — CONFERIR a cor de cada uma no preview)
const KIT_MASK_BASE = 'https://lojaybera.fbitsstatic.net/img/p/kit-cuidados-profundos-ybera-fashion-gold-151333';
const KIT_MASK_IMAGES: Record<'hidratacao' | 'nutricao' | 'reconstrucao', string> = {
  hidratacao:   `${KIT_MASK_BASE}/337920-2.jpg?w=200&h=200`,  // azul · Cutícula
  nutricao:     `${KIT_MASK_BASE}/337920-3.jpg?w=200&h=200`,  // laranja · Córtex
  reconstrucao: `${KIT_MASK_BASE}/337920-4.jpg?w=200&h=200`,  // rosa · Médula
};

const noAccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Foto do produto pra uma tarefa (senão null → cai no ícone).
function taskImageUrl(title: string, description: string | undefined, products: ProductRow[]): string | null {
  const t = noAccent(`${title} ${description ?? ''}`);
  if (t.includes('mascara')) {
    if (t.includes('hidrata')) return KIT_MASK_IMAGES.hidratacao;
    if (t.includes('nutri')) return KIT_MASK_IMAGES.nutricao;
    if (t.includes('reconstr')) return KIT_MASK_IMAGES.reconstrucao;
  }
  const find = (kw: string) => products.find(p => noAccent(p.name ?? '').includes(kw))?.image_url ?? null;
  if (t.includes('shampoo')) return find('shampoo');
  if (t.includes('oleo') || t.includes('mirra')) return find('mirra');
  if (t.includes('100t') || t.includes('softgel') || t.includes('antiqueda') || t.includes('capsula')) return find('100t') || find('timetros');
  if (t.includes('leave')) return find('leave');
  if (t.includes('cronograma') || t.includes('cuidados profundos') || t.includes('kit')) return find('kit cuidados') || find('cuidados profundos');
  return null;
}

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
  plan_requested_at: string | null;
  plan_status: string;
  plan_feedback_rating: number | null;
  plan_revision_due_at: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recommended_products?: any;
  daily_rituals?: string[] | null;
  carta_ju?: string | null;
  photo_url?: string | null;
  photo_back_url?: string | null;
  photo_root_url?: string | null;
}
interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  affiliate_url: string | null;
  image_url: string | null;
  is_ybera: boolean;
  video_url?: string | null;   // vídeo da Juliane sobre o produto (YouTube Short)
  motivo?: string | null;   // por que foi indicado pra ELA (personalizado)
  combos?: Array<{ id: string; name: string; affiliate_url: string | null }>;  // opções de compra em combo
}

// Rótulos limpos pra valores crus do quiz (evita underscores tipo "sim_absorve"
// na tela, que passam impressão de texto gerado por máquina).
const POROSITY_LABELS: Record<string, string> = {
  alta: 'Alta', baixa: 'Baixa', media: 'Média', 'média': 'Média',
  sim_absorve: 'Alta', nao_demora: 'Baixa', nao_sei: 'A definir',
};
function pretty(v?: string | null): string {
  if (!v) return '';
  return v.split(',').map(s => s.trim().replace(/_/g, ' ')).filter(Boolean)
    .join(', ').replace(/^./, c => c.toUpperCase());
}
function porosityLabel(v?: string | null): string {
  if (!v) return '—';
  return POROSITY_LABELS[v.toLowerCase()] ?? pretty(v);
}

// Junta TODOS os textos da nossa análise das fotos (avaliação + observações),
// sem repetir, pra mostrar tudo junto embaixo das fotos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectAnalysisTexts(rows: any[]): string[] {
  const out: string[] = [];
  for (const r of rows ?? []) {
    const candidates = [r?.avaliacao_texto, r?.raw_response?.analise_foto?.observacoes];
    for (const c of candidates) {
      const t = typeof c === 'string' ? c.trim() : '';
      if (t && !out.includes(t)) out.push(t);
    }
  }
  return out;
}

export default function PlanoPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('rotina');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plans, setPlans] = useState<HairPlanRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [analysisTexts, setAnalysisTexts] = useState<string[]>([]);
  const [activeWeek, setActiveWeek] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showIg, setShowIg] = useState(false);
  const [cartaOpen, setCartaOpen] = useState(true);   // carta da Ju pode minimizar
  const [userId, setUserId] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    try { setShowIg(localStorage.getItem('ig_followed') !== '1'); } catch { setShowIg(true); }
    try { setCartaOpen(localStorage.getItem('carta_ju_collapsed') !== '1'); } catch { /* mantém aberta */ }
  }, []);

  const toggleCarta = () => setCartaOpen(v => {
    const nv = !v;
    try { localStorage.setItem('carta_ju_collapsed', nv ? '0' : '1'); } catch { /* ok */ }
    return nv;
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const load = useCallback(async () => {
    // ── Modo PREVIEW (admin): ?preview_user=<id|email>&k=<segredo> — carrega o
    // plano de OUTRA cliente via API service-role e mostra a tela EXATA dela.
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const previewUser = params.get('preview_user');
    const previewToken = params.get('k');
    if (previewUser && previewToken) {
      setIsPreview(true);
      try {
        const res = await fetch(`/api/admin/plan-preview?user=${encodeURIComponent(previewUser)}&k=${encodeURIComponent(previewToken)}`);
        if (!res.ok) { setLoading(false); return; }
        const b = await res.json();
        setUserId(b.userId ?? null);
        if (b.profile) setProfile(b.profile as Profile);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (Array.isArray(b.plans)) setPlans((b.plans as any[]).map(p => ({ ...p, tasks: normalizeTasks(p.tasks) })) as HairPlanRow[]);
        if (Array.isArray(b.products)) setProducts(b.products as ProductRow[]);
        if (Array.isArray(b.analysisTexts)) setAnalysisTexts(b.analysisTexts as string[]);
      } catch { /* mostra o loading→vazio se falhar */ }
      setLoading(false);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }
    const uid = session.user.id;
    setUserId(uid);

    const [p, pl, pr] = await Promise.all([
      supabase.from('profiles')
        .select('full_name,hair_type,porosity,chemical_history,main_problems,hair_length_cm,quiz_answers,plan_released_at,plan_requested_at,plan_status,plan_feedback_rating,plan_revision_due_at,recommended_products,daily_rituals,carta_ju,photo_url,photo_back_url,photo_root_url')
        .eq('id', uid).single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('hair_plans')
        .select('week_number,focus,tasks,products,tips,juliane_notes')
        .eq('user_id', uid).order('week_number'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('products')
        .select('id,name,brand,category,affiliate_url,image_url,is_ybera,video_url')
        .eq('active', true).limit(8),
    ]);
    if (p.data)  setProfile(p.data as Profile);
    if (pl.data) {
      // Normaliza tasks: o banco tem 2 formatos (array de strings ou objetos) —
      // sem isto, semanas no formato antigo crashavam o render.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setPlans((pl.data as any[]).map(p => ({ ...p, tasks: normalizeTasks(p.tasks) })) as HairPlanRow[]);
    }
    // Produtos PERSONALIZADOS dela (recommended_products = produtos_indicados do
    // plano: âncora Ybera + alternativa + motivo). Se existir, mostra ESTES — não
    // o catálogo global. Fallback pro catálogo global quando não há indicação.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any[] = Array.isArray((p.data as any)?.recommended_products) ? (p.data as any).recommended_products : [];
    let personalized: ProductRow[] | null = null;
    if (rec.length) {
      const ids = [...new Set(rec.flatMap(r => [r?.produto_id, r?.alternativa_id]).filter(Boolean))];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: recProds } = await (supabase as any).from('products')
        .select('id,name,brand,category,affiliate_url,image_url,is_ybera,video_url').in('id', ids);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const byId = new Map<string, any>((recProds ?? []).map((x: any) => [x.id, x]));
      const list: ProductRow[] = [];
      for (const r of rec) {
        const main = byId.get(r?.produto_id);
        if (main && !list.find(x => x.id === main.id)) list.push({ ...main, motivo: r?.motivo ?? null });
        const alt = r?.alternativa_id ? byId.get(r.alternativa_id) : null;
        if (alt && !list.find(x => x.id === alt.id)) list.push({ ...alt, motivo: null });
      }
      // Anexa os COMBOS de cada produto-base (parent_product_id) como opção de compra.
      if (list.length) {
        const baseIds = list.map(x => x.id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: comboRows } = await (supabase as any).from('products')
          .select('id,name,affiliate_url,parent_product_id').eq('active', true).in('parent_product_id', baseIds);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const byParent = new Map<string, any[]>();
        for (const c of (comboRows ?? [])) {
          const arr = byParent.get(c.parent_product_id) ?? [];
          arr.push({ id: c.id, name: c.name, affiliate_url: c.affiliate_url });
          byParent.set(c.parent_product_id, arr);
        }
        for (const x of list) { const cs = byParent.get(x.id); if (cs?.length) x.combos = cs; }
        personalized = list;
      }
    }
    if (personalized) setProducts(personalized);
    else if (pr.data) setProducts(pr.data as ProductRow[]);

    // Análise do cabelo (fotos enviadas): junta todos os textos pra mostrar
    // embaixo das fotos. Pega as análises mais antigas (as das fotos iniciais).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: paRows } = await (supabase as any).from('photo_analyses')
      .select('avaliacao_texto,raw_response')
      .eq('user_id', uid).order('analyzed_at', { ascending: true }).limit(6);
    setAnalysisTexts(collectAnalysisTexts(paRows ?? []));

    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <PlanoLoading label="Carregando seu plano…" />;

  // ── Estado "preparando" — ENTREGA AUTOMÁTICA por tempo (sem aprovação manual).
  // O plano é liberado em plan_released_at (~30 min após gerar). Até lá, mostra a
  // contagem "fica pronto em até 24h" (prometemos 24h, entregamos em ~30 min).
  const releasedAtMs = profile?.plan_released_at ? new Date(profile.plan_released_at).getTime() : null;
  // "Entregue" EXIGE que o plano exista de fato (semanas geradas). Sem plano →
  // tela de preparação (nada de Revisado/avaliação/produtos/dicas). No preview o
  // admin vê o plano sem esperar a liberação de 30min — mas só se ele existir.
  const hasPlan = plans.length > 0;
  const delivered = hasPlan && (isPreview || (!!releasedAtMs && Date.now() >= releasedAtMs));
  if (!delivered) {
    return <PreparingState profile={profile} />;
  }
  // Entregue ANTES do prazo? (liberado antes de pedido + 24h)
  const requestedMs = profile?.plan_requested_at ? new Date(profile.plan_requested_at).getTime() : null;
  const aheadOfSchedule = !!requestedMs && !!releasedAtMs && releasedAtMs < requestedMs + 24 * 3600_000;

  const currentPlan = plans.find(p => p.week_number === activeWeek);

  const chips: { label: string; tone: 'pink' | 'gold' | 'cream' }[] = [];
  if (profile?.hair_type) chips.push({ label: profile.hair_type, tone: 'pink' });
  if (profile?.porosity) chips.push({ label: `${porosityLabel(profile.porosity)} porosidade`, tone: 'gold' });
  const mainProblem = profile?.main_problems?.[0] ? pretty(profile.main_problems[0]) : undefined;
  if (mainProblem) chips.push({ label: mainProblem, tone: 'cream' });

  const releasedDate = profile?.plan_released_at
    ? new Date(profile.plan_released_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div>
      {isPreview && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 50, background: '#2A1E2C', color: '#fff',
          fontSize: 12.5, fontWeight: 600, textAlign: 'center', padding: '8px 12px',
          fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
        }}>
          👁 Pré-visualização — visão do cliente{profile?.full_name ? ` · ${profile.full_name}` : ''} (somente leitura)
        </div>
      )}
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
            {(profile?.full_name || releasedDate) && (
              <div style={{ fontSize: 13, opacity: 0.92, marginTop: 5, fontWeight: 600 }}>
                {profile?.full_name ? `Feito para ${profile.full_name.split(' ')[0]}` : 'Feito para você'}
                {releasedDate ? ` · ${releasedDate}` : ''}
              </div>
            )}
            {aheadOfSchedule && (
              <div style={{
                marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 7,
                background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)',
                borderRadius: 99, padding: '7px 14px', fontSize: 12.5, fontWeight: 700,
              }}>
                ⚡ Ficou pronto antes do prazo — a Juliane caprichou no seu!
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

        {/* 💌 Mensagem da Ju para você — carta pessoal no TOPO do plano */}
        {profile?.carta_ju && profile.carta_ju.trim() && (
          <div style={{ margin: '0 16px 18px' }}>
            <div style={{
              background: 'linear-gradient(160deg, #FFF3F6 0%, #FFFBF7 100%)',
              borderRadius: 18, padding: cartaOpen ? '16px 18px 20px' : '14px 18px',
              border: `1px solid ${T.pinkBlush ?? '#F3D6DE'}`,
              boxShadow: shadow.card,
            }}>
              {/* Header clicável — minimiza/expande */}
              <button onClick={toggleCarta} style={{
                width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit',
                marginBottom: cartaOpen ? 12 : 0,
              }}>
                <span style={{ fontSize: 18 }}>💌</span>
                <span style={{
                  flex: 1, textAlign: 'left',
                  fontSize: 13, fontWeight: 800, color: T.pinkDeep,
                  textTransform: 'uppercase', letterSpacing: 0.8,
                }}>Mensagem da Ju para você</span>
                <span style={{ fontSize: 12, color: T.pinkDeep, fontWeight: 700 }}>
                  {cartaOpen ? 'ocultar ▾' : 'ver ▸'}
                </span>
              </button>

              {cartaOpen && (
                <>
                  <div style={{
                    whiteSpace: 'pre-line',
                    fontSize: 14.5, lineHeight: 1.65, color: T.ink,
                    fontFamily: fonts.display, letterSpacing: -0.1,
                  }}>
                    {profile.carta_ju.trim()}
                  </div>

                  {/* CTA — seguir a Juliane no Instagram (no fim da carta) + meta */}
                  <a
                    href="https://instagram.com/julianecost"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      marginTop: 16, textDecoration: 'none',
                      background: 'linear-gradient(105deg, #F58529 0%, #DD2A7B 55%, #8134AF 100%)',
                      color: '#fff', borderRadius: 13, padding: '11px 14px',
                      boxShadow: '0 6px 16px rgba(221,42,123,0.28)',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13.5 }}>
                      <IconInstagram size={17} />
                      Seguir a Juliane no Instagram
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.95)' }}>
                      {IG_FOLLOWERS.toLocaleString('pt-BR')} seguidores · ajude a Ju a chegar em {Math.round(IG_GOAL / 1000)} mil 💗
                    </span>
                  </a>
                </>
              )}
            </div>
          </div>
        )}

        {/* Banner — seguir a Juliane no Instagram (some ao clicar) */}
        {showIg && (
          <div style={{ margin: '0 16px 18px' }}>
            <a
              href="https://instagram.com/julianecost"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => { try { localStorage.setItem('ig_followed', '1'); } catch {} setShowIg(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none',
                background: 'linear-gradient(105deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)',
                borderRadius: 16, padding: '13px 15px',
                boxShadow: '0 6px 16px rgba(221,42,123,0.28)',
              }}
            >
              <div style={{
                width: 42, height: 42, borderRadius: '50%', background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}><IconInstagram size={26} color="#DD2A7B" /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 14.5, fontFamily: fonts.ui }}>
                  Siga a Juliane no Instagram
                </div>
                <div style={{ color: 'rgba(255,255,255,0.92)', fontSize: 12.5, marginTop: 2 }}>
                  Dicas, bastidores e novidades · @julianecost
                </div>
              </div>
              <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, flexShrink: 0 }}>→</div>
            </a>
          </div>
        )}

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
                <DiagItem label="Porosidade"      value={porosityLabel(profile?.porosity)} tone="gold" />
                <DiagItem label="Foco principal"  value={mainProblem ?? 'Manutenção'}    tone="cream" />
                <DiagItem label="Químicas"        value={pretty(profile?.chemical_history) || 'Nenhuma'} />
                <DiagItem label="Comprimento"     value={profile?.hair_length_cm ? `${profile.hair_length_cm} cm` : '—'} />
                <DiagItem label="Lavagem ideal"   value={`A cada ${profile?.hair_type?.includes('oleoso') ? '2–3' : profile?.hair_type?.includes('crespo') ? '5–7' : '3–5'} dias`} />
              </div>
            </div>

            {/* Análise do cabelo — fotos enviadas + TODA a nossa análise (junto) */}
            {(profile?.photo_url || profile?.photo_back_url || profile?.photo_root_url || analysisTexts.length > 0) && (
              <>
                <SectionLabel>Análise do seu cabelo</SectionLabel>
                <div style={{
                  margin: '0 16px 18px', background: T.surface, borderRadius: 16,
                  padding: 18, boxShadow: shadow.card, border: `1px solid ${T.borderSoft}`,
                }}>
                  {(profile?.photo_url || profile?.photo_back_url || profile?.photo_root_url) && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: analysisTexts.length > 0 ? 14 : 0 }}>
                      {[
                        { url: profile?.photo_url, label: 'Frente' },
                        { url: profile?.photo_back_url, label: 'Costas' },
                        { url: profile?.photo_root_url, label: 'Raiz' },
                      ].filter(p => !!p.url).map(p => (
                        <div key={p.label} style={{ flex: 1, textAlign: 'center' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url!} alt={p.label} loading="lazy" style={{
                            width: '100%', aspectRatio: '3/4', objectFit: 'cover',
                            borderRadius: 12, border: `1px solid ${T.borderSoft}`,
                          }} />
                          <div style={{ fontSize: 10.5, color: T.inkMuted, marginTop: 4, fontWeight: 600 }}>{p.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Toda a nossa análise dessas fotos, logo abaixo delas */}
                  {analysisTexts.length > 0 && (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', overflow: 'hidden',
                        border: `2px solid ${T.gold}`, flexShrink: 0, position: 'relative',
                      }}>
                        <Image src="/images/ju-depois.png" alt="Juliane" width={34} height={34}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {analysisTexts.map((t, i) => (
                          <div key={i} style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.55, fontFamily: fonts.display, fontStyle: 'italic' }}>
                            &ldquo;{t}&rdquo;
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Ritual de TODO DIA (óleo etc.) — vale pra todos os dias */}
            {profile?.daily_rituals && profile.daily_rituals.length > 0 && (
              <div style={{ margin: '0 16px 16px' }}>
                <SectionLabel>Todo dia</SectionLabel>
                <div style={{ background: T.surface, borderRadius: 14, padding: '12px 16px', border: `1px solid ${T.borderSoft}`, boxShadow: shadow.card, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {profile.daily_rituals.map((r, i) => (
                    <div key={i} style={{ fontSize: 13.5, color: T.ink, display: 'flex', alignItems: 'flex-start', gap: 8, lineHeight: 1.45 }}>
                      <span style={{ flexShrink: 0 }}>🫗</span><span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

                {/* Rotina por DIA — agrupada: um bloco por dia da semana (não um
                    card por tarefa). Ex.: "Segunda-feira" com Shampoo + Máscara + Óleo juntos. */}
                <div style={{ margin: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(() => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const byDay = new Map<number, any[]>();
                    for (const t of currentPlan.tasks) {
                      const arr = byDay.get(t.day) ?? [];
                      arr.push(t); byDay.set(t.day, arr);
                    }
                    const days = [...byDay.keys()].sort((a, b) => a - b);
                    const DAY_NAMES = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
                    return days.map(day => {
                      const tasks = byDay.get(day)!;
                      const dayName = DAY_NAMES[day - 1] ?? `Dia ${day}`;
                      return (
                        <div key={day} style={{
                          background: T.surface, borderRadius: 16, overflow: 'hidden',
                          boxShadow: shadow.card, border: `1px solid ${T.borderSoft}`,
                        }}>
                          {/* Cabeçalho do dia */}
                          <div style={{ padding: '11px 18px', background: T.pinkSoft, borderBottom: `1px solid ${T.borderSoft}` }}>
                            <div style={{ fontSize: 12.5, fontWeight: 800, color: T.pinkDeep, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                              {dayName}
                            </div>
                          </div>
                          {/* Tarefas do dia */}
                          {tasks.map((task, i) => {
                            const TaskIcon = iconForTask(task.title);
                            const imgUrl = taskImageUrl(task.title, task.description, products);
                            return (
                              <div key={i} style={{
                                padding: '13px 18px', display: 'flex', alignItems: 'flex-start', gap: 14,
                                borderBottom: i < tasks.length - 1 ? `1px solid ${T.borderSoft}` : 'none',
                              }}>
                                {/* Foto do produto (ícone fica atrás como fallback se a imagem falhar) */}
                                <div style={{
                                  position: 'relative', width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                                  background: '#FFF', border: `1px solid ${T.pinkSoft}`, overflow: 'hidden',
                                }}>
                                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.rose, color: T.pinkDeep }}>
                                    <TaskIcon size={20} />
                                  </div>
                                  {imgUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={imgUrl} alt="" loading="lazy"
                                      onError={e => { e.currentTarget.style.display = 'none'; }}
                                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#fff' }}
                                    />
                                  )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{task.title}</div>
                                  <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2, lineHeight: 1.45 }}>{task.description}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    });
                  })()}
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
              {products.filter(p => p.is_ybera).map(p => <ProductCard key={p.id} product={p} userId={userId} essential />)}
              {products.filter(p => !p.is_ybera).map(p => <ProductCard key={p.id} product={p} userId={userId} />)}
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

            {/* Dicas universais da Ju — valem pra todo dia, pra todas */}
            <SectionLabel>Dicas da Ju · pra todo dia</SectionLabel>
            <div style={{ margin: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {DICAS_UNIVERSAIS.map((d, i) => (
                <div key={i} style={{
                  background: T.surface, borderRadius: 14, padding: '14px 16px',
                  boxShadow: shadow.card, border: `1px solid ${T.borderSoft}`,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 17 }}>{d.emoji}</span> {d.titulo}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {d.itens.map((it, j) => (
                      <li key={j} style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.55 }}>{it}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Avaliação + pedido de ajuste do plano (avaliação é ÚNICA) */}
        <PlanFeedback
          alreadySubmitted={profile?.plan_feedback_rating != null || profile?.plan_status === 'revision_requested'}
          revisionPending={profile?.plan_status === 'revision_requested'}
          revisionDueAt={profile?.plan_revision_due_at ?? null}
        />

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

// Extrai o ID do vídeo de um link do YouTube (shorts / watch / youtu.be / embed).
function ytId(url?: string | null): string | null {
  if (!url) return null;
  const m = String(url).match(/(?:shorts\/|watch\?v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

function ProductCard({ product, userId, essential = false }: { product: ProductRow; userId?: string | null; essential?: boolean }) {
  const Icon = iconForCategory(product.category, product.name);
  const [playing, setPlaying] = useState(false);
  const videoId = ytId(product.video_url);
  const trackClick = () => {
    try {
      const payload = JSON.stringify({ product_id: product.id, product_name: product.name, is_ybera: product.is_ybera, user_id: userId ?? null });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/meu-plano/product-click', new Blob([payload], { type: 'application/json' }));
      else fetch('/api/meu-plano/product-click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
    } catch { /* analytics best-effort */ }
  };
  return (
    <div style={{
      background: T.surface, borderRadius: 16,
      boxShadow: shadow.card, border: `1px solid ${T.borderSoft}`, overflow: 'hidden',
    }}>
    <div style={{ padding: 14, display: 'flex', gap: 14, alignItems: 'center' }}>
      <div style={{
        width: 58, height: 58, borderRadius: 14,
        background: product.image_url ? '#FFF' : (product.is_ybera ? gradient.heroSoft : gradient.gold),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: product.is_ybera ? '#FFF' : T.goldDeep,
        flexShrink: 0, overflow: 'hidden',
        border: product.image_url ? `1px solid ${T.borderSoft}` : 'none',
      }}>
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <Icon size={26} />
        )}
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
        {product.motivo && (
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 3, lineHeight: 1.35 }}>
            {product.motivo}
          </div>
        )}
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
        <a href={product.affiliate_url} target="_blank" rel="noopener noreferrer" onClick={trackClick} style={{
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
    {videoId && (
      <div style={{ borderTop: `1px solid ${T.borderSoft}`, background: '#FFF6F9', padding: '11px 14px' }}>
        {!playing ? (
          <button onClick={() => setPlaying(true)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
          }}>
            <div style={{ position: 'relative', width: 60, height: 60, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: '#000' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.pinkDeep, fontSize: 12, paddingLeft: 2 }}>▶</div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.pinkDeep }}>🎬 A Juliane explica esse produto</div>
              <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>Toque para assistir o vídeo dela</div>
            </div>
          </button>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 230, maxWidth: '100%', aspectRatio: '9 / 16', borderRadius: 14, overflow: 'hidden', background: '#000' }}>
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`}
                title="Vídeo da Juliane"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                style={{ width: '100%', height: '100%', border: 0 }}
              />
            </div>
          </div>
        )}
      </div>
    )}
    {product.combos && product.combos.length > 0 && (
      <div style={{ borderTop: `1px solid ${T.borderSoft}`, background: '#FBF7F2', padding: '9px 14px' }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: T.goldDeep, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>
          📦 Compre em combo e economize
        </div>
        {product.combos.map(cb => (
          <div key={cb.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '3px 0' }}>
            <span style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.3 }}>{cb.name}</span>
            {cb.affiliate_url && (
              <a href={cb.affiliate_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, fontWeight: 700, color: T.pinkDeep, textDecoration: 'none', flexShrink: 0 }}>Ver ↗</a>
            )}
          </div>
        ))}
      </div>
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

// ── Preparando: contagem regressiva até a entrega (auto, sem aprovação) ────
function PreparingState({ profile }: { profile: Profile | null }) {
  const firstName = profile?.full_name?.split(' ')[0] ?? '';
  // Falta a FOTO? (não enviou ainda) — é o passo que trava o plano.
  const awaitingPhoto = profile?.plan_status === 'pending_photo';
  const requestedMs = profile?.plan_requested_at ? new Date(profile.plan_requested_at).getTime() : null;
  const releasedMs  = profile?.plan_released_at  ? new Date(profile.plan_released_at).getTime()  : null;
  // Depois que a foto chega, o plano fica pronto em até 2 HORAS.
  const deadlineMs  = requestedMs ? requestedMs + 2 * 3600_000 : null;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  // Assim que liberar (released_at), recarrega pra mostrar o plano.
  useEffect(() => {
    if (releasedMs && Date.now() >= releasedMs) window.location.reload();
  }, [now, releasedMs]);

  const remainingMs = deadlineMs ? Math.max(0, deadlineMs - now) : null;
  const hh = remainingMs != null ? Math.floor(remainingMs / 3600_000) : null;
  const mm = remainingMs != null ? Math.floor((remainingMs % 3600_000) / 60_000) : null;
  const ss = remainingMs != null ? Math.floor((remainingMs % 60_000) / 1000) : null;
  const pad = (n: number) => String(n).padStart(2, '0');

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
              {awaitingPhoto ? 'Falta 1 passo' : 'Em preparação'}
            </h1>
            <div style={{ fontSize: 13, opacity: 0.92, marginTop: 4, lineHeight: 1.5 }}>
              {awaitingPhoto
                ? `${firstName ? firstName + ', envie' : 'Envie'} as fotos do seu cabelo pra Juliane montar o seu plano.`
                : `${firstName ? firstName + ', a' : 'A'} Juliane está montando o seu plano agora.`}
            </div>
          </div>
        </div>

        {awaitingPhoto ? (
          /* ── MODO: falta a foto ─────────────────────────────────── */
          <div style={{
            margin: '-34px 16px 18px',
            background: T.surface, borderRadius: 20,
            padding: '22px 18px',
            boxShadow: shadow.raised,
            position: 'relative', zIndex: 2,
            border: `1px solid ${T.borderSoft}`,
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, fontFamily: fonts.display, marginBottom: 6 }}>
              📸 Envie 3 fotos do seu cabelo
            </div>
            <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.55, marginBottom: 16 }}>
              A Juliane precisa <strong>ver o seu cabelo</strong> pra montar um plano ainda mais assertivo pra você.
              Ainda <strong>não recebemos as suas fotos</strong> — é o único passo que falta! 💛
            </div>
            {/* 3 slots pendentes */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
              {['Frente', 'Costas', 'Raiz'].map(lbl => (
                <div key={lbl} style={{
                  flex: 1, textAlign: 'center',
                  border: `1.5px dashed ${T.pink}66`, borderRadius: 14,
                  padding: '14px 6px', background: T.pinkSoft,
                }}>
                  <div style={{ fontSize: 22 }}>⏳</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.pinkDeep, marginTop: 4 }}>{lbl}</div>
                  <div style={{ fontSize: 10, color: T.inkMuted, marginTop: 2 }}>pendente</div>
                </div>
              ))}
            </div>
            <a href="/meu-plano/onboarding" style={{
              display: 'block', width: '100%',
              background: gradient.hero, color: '#fff',
              borderRadius: 14, padding: 15, textAlign: 'center',
              fontSize: 15, fontWeight: 700, textDecoration: 'none',
              fontFamily: fonts.ui, boxShadow: '0 6px 16px rgba(190,24,93,0.28)',
            }}>
              📸 Enviar minhas fotos agora
            </a>
          </div>
        ) : (
          /* ── MODO: foto recebida, preparando (cronômetro 2h) ────── */
          <>
            <div style={{
              margin: '-34px 16px 18px',
              background: T.surface, borderRadius: 20,
              padding: '20px 18px',
              boxShadow: shadow.raised,
              position: 'relative', zIndex: 2,
              border: `1px solid ${T.borderSoft}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%', overflow: 'hidden',
                  border: `2.5px solid ${T.gold}`, boxShadow: '0 4px 12px rgba(190,24,93,0.18)',
                  position: 'relative', flexShrink: 0,
                }}>
                  <Image src="/images/ju-depois.png" alt="Juliane Cost" width={52} height={52}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 700, color: T.ink, fontFamily: fonts.display }}>
                    Juliane Cost
                  </div>
                  <div style={{ fontSize: 12, color: T.pinkDeep, marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.pink, display: 'inline-block', animation: 'pulse 1.6s ease-in-out infinite' }} />
                    trabalhando no seu plano…
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <PrepStep done title="Fotos recebidas" description="A Juliane já recebeu suas fotos e as respostas do quiz." />
                <PrepStep active title="Analisando o seu cabelo" description="Cruzando seu tipo de cabelo, química, problemas e as fotos enviadas." />
                <PrepStep title="Montando seu cronograma personalizado" description="Lavagens, hidratações, reconstruções e produtos pra você." />
                <PrepStep title="Plano liberado no app" description="Você recebe um e-mail e o cronograma aparece aqui na hora." />
              </div>
            </div>

            {/* Cronômetro — pronto em até 2 horas */}
            <div style={{
              margin: '0 16px 18px',
              background: gradient.warm,
              border: `1px solid ${T.gold}55`,
              borderRadius: 16, padding: '18px 16px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 12.5, color: T.ink, fontWeight: 600, marginBottom: 8 }}>
                ⏳ Seu plano fica pronto em até <strong>2 horas</strong>
              </div>
              {remainingMs != null && (
                <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontFamily: fonts.display, fontWeight: 800, color: T.pinkDeep, fontSize: 30, letterSpacing: 1 }}>
                  <span>{pad(hh!)}</span><span style={{ opacity: 0.4 }}>:</span>
                  <span>{pad(mm!)}</span><span style={{ opacity: 0.4 }}>:</span>
                  <span>{pad(ss!)}</span>
                </div>
              )}
              <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 8, lineHeight: 1.5 }}>
                Quase sempre entregamos <strong>muito antes</strong> 💛
              </div>
            </div>
          </>
        )}

        {/* Enquanto espera: FOCO em entrar no grupo VIP de promoções */}
        <div style={{ padding: '0 16px 30px' }}>
          <div style={{
            background: T.surface, border: `1px solid ${T.borderSoft}`,
            borderRadius: 16, padding: '18px', boxShadow: shadow.card,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, fontFamily: fonts.display, marginBottom: 6 }}>
              💚 Enquanto seu plano não fica pronto…
            </div>
            <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.55, marginBottom: 14 }}>
              Entra no nosso <strong>grupo VIP de promoções</strong> no WhatsApp — as ofertas com desconto
              nos produtos que a Ju usa saem <strong>primeiro por lá</strong>. Não fica de fora!
            </div>
            <a href="/g/entrar" target="_blank" rel="noopener noreferrer" style={{
              display: 'block', width: '100%',
              background: '#25D366', color: '#fff',
              borderRadius: 14, padding: 15, textAlign: 'center',
              fontSize: 15, fontWeight: 700, textDecoration: 'none',
              fontFamily: fonts.ui, boxShadow: '0 6px 16px rgba(37,211,102,0.28)',
            }}>
              Entrar no grupo VIP de promoções
            </a>
          </div>
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
