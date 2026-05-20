'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';

const ACCENT = '#C4607A';

// ── Helpers ──────────────────────────────────────────────────────────────────

const HAIR_TYPE_LABEL: Record<string, string> = {
  liso: 'Liso', ondulado: 'Ondulado', cacheado: 'Cacheado', crespo: 'Crespo',
};
const POROSITY_LABEL: Record<string, string> = {
  baixa: 'Baixa porosidade', media: 'Média porosidade', alta: 'Alta porosidade',
};
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#C4607A,#9B4560)',
  'linear-gradient(135deg,#007AFF,#0056CC)',
  'linear-gradient(135deg,#AF52DE,#8B3DB8)',
  'linear-gradient(135deg,#FF9500,#CC7700)',
  'linear-gradient(135deg,#5AC8FA,#30A9D6)',
  'linear-gradient(135deg,#34C759,#28A745)',
];
function gradientForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase();
}
function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffH = (now.getTime() - d.getTime()) / 3600000;
  if (diffH < 24 && d.toDateString() === now.toDateString()) {
    return `Hoje ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `Ontem ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ── Stage config ─────────────────────────────────────────────────────────────
const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  awaiting_photo: { label: 'Aguardando foto',  color: '#FF9500', bg: 'rgba(255,149,0,0.10)' },
  processing:     { label: 'Processando IA',   color: '#007AFF', bg: 'rgba(0,122,255,0.10)' },
  needs_review:   { label: 'Para revisar',     color: ACCENT,    bg: 'rgba(196,96,122,0.10)' },
  approved:       { label: 'Aprovado',         color: '#34C759', bg: 'rgba(52,199,89,0.10)'  },
  no_subscription:{ label: 'Sem assinatura',   color: '#8A8A8E', bg: 'rgba(138,138,142,0.10)'},
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface PlanCard {
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  hair_type: string | null;
  porosity: string | null;
  main_problems: string[] | null;
  chemical_history: string | null;
  hair_length_cm: number | null;
  budget_range: string | null;
  quiz_answers: Record<string, unknown> | null;
  photo_url: string | null;
  approved: boolean;
  created_at: string;
  juliane_notes: string | null;
  stage?: 'awaiting_photo' | 'processing' | 'needs_review' | 'approved' | 'no_subscription';
  plan_status?: string;
  has_plan?: boolean;
  has_photo?: boolean;
}

interface PlanWeek {
  week_number: number;
  focus: string;
  tasks: Array<{ day?: number; title: string; description?: string } | string>;
  products: string[];
  tips: string[];
  approved_by_juliane: boolean;
  juliane_notes: string | null;
}

interface EditableTask {
  day: number | string;
  title: string;
  description: string;
}

interface EditablePlanWeek {
  week_number: number;
  focus: string;
  tasks: EditableTask[];
  products: string[];
  tips: string[];
  approved_by_juliane: boolean;
  juliane_notes: string | null;
}

interface CatalogProduct {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
}

// ── Filter / tab constants ────────────────────────────────────────────────────
const FILTER_TABS = [
  { key: 'pending'  as const, label: 'Pendentes' },
  { key: 'approved' as const, label: 'Aprovados' },
  { key: 'all'      as const, label: 'Todos'     },
];
const PLAN_TABS: Array<{ key: 'cronograma' | 'produtos' | 'dicas'; label: string }> = [
  { key: 'cronograma', label: 'Cronograma' },
  { key: 'produtos',   label: 'Produtos'   },
  { key: 'dicas',      label: 'Dicas'      },
];

// ── Quiz answer labels ────────────────────────────────────────────────────────
const Q: Record<string, Record<string, string>> = {
  tipo:        { liso:'Liso', ondulado:'Ondulado', cacheado:'Cacheado', crespo:'Crespo' },
  espessura:   { fino:'Fino', medio:'Médio', grosso:'Grosso' },
  oleosidade:  { muito_seco:'Muito seco', seco:'Seco', normal:'Normal', oleoso:'Oleoso', muito_oleoso:'Muito oleoso' },
  porosidade:  { nao_demora:'Baixa (não demora molhar)', rapido:'Alta (absorve rápido)', normal:'Média', outro:'Outro' },
  elasticidade:{ quebra:'Quebra muito', estica:'Estica e não volta', normais:'Normal', boa:'Boa elasticidade' },
  lavagem:     { todos_dias:'Todos os dias', '2_3_sem':'2–3x por semana', '1_sem':'1x por semana', quinzenal:'Quinzenal', mensal:'Mensal' },
  cortes:      { '1_2':'A cada 1–2 meses', '3_6':'A cada 3–6 meses', '6_mais':'Mais de 6 meses', nao_corto:'Não corta' },
  idade:       { '13_18':'13–18 anos', '19_30':'19–30 anos', '31_45':'31–45 anos', '46_mais':'46+ anos' },
  agua:        { '0':'Sem filtro', '1':'Com filtro', '2':'Tratamento completo' },
  como_plano:  { aproveitar:'Aproveitar ao máximo', resolver:'Resolver problemas específicos', manter:'Manter resultado', crescer:'Crescer o cabelo' },
  protetor:    { sim:'Sim', nao:'Não' },
  cronograma:  { sim:'Já faz cronograma', nao:'Não faz cronograma' },
  caspa:       { sim:'Tem caspa', nao:'Sem caspa' },
  sol_piscina: { sim:'Expõe frequentemente', nao:'Não expõe' },
  corte_quimico:{ sim:'Sim, planeja', nao:'Não planeja' },
  crescimento_desigual:{ sim:'Sim', nao:'Não' },
  incomoda: {
    frizz:'Frizz', volume:'Volume excessivo', queda:'Queda',
    ressecamento:'Ressecamento', oleosidade_p:'Oleosidade', pontas:'Pontas duplas',
    caspa:'Caspa', lentidao:'Crescimento lento', coloracao:'Cor desbotando',
    brilho:'Falta de brilho', porosidade:'Alta porosidade',
  },
  calor: {
    secador:'Secador', prancha:'Prancha', babyliss:'Babyliss/Modelador',
    escova_eletrica:'Escova elétrica', nao:'Não usa calor',
  },
  quimica: {
    tintura:'Tintura', mechas:'Mechas/Luzes', relaxamento:'Relaxamento',
    progressiva:'Progressiva', coloracao:'Coloração temporária',
    descoloracao:'Descoloração', nao:'Sem química',
  },
  areas: {
    raiz:'Raiz', meio:'Comprimento', pontas:'Pontas',
    couro:'Couro cabeludo', tudo:'Todo o cabelo',
  },
};

function qLabel(field: string, value: string): string {
  return Q[field]?.[value] ?? value;
}

function qArr(field: string, raw: unknown): string {
  if (!raw) return '—';
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map(v => qLabel(field, String(v))).join(', ') || '—';
}

function qVal(field: string, raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '—';
  return qLabel(field, String(raw));
}

// ── ClientProfile section component ──────────────────────────────────────────
function ProfileRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '1px solid #F5F5F7' }}>
      <span style={{ fontSize: 12, color: '#8A8A8E', minWidth: 130, flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: 12.5, color: accent ? ACCENT : '#2D1B2E', fontWeight: accent ? 600 : 400,
        lineHeight: 1.4,
      }}>
        {value || '—'}
      </span>
    </div>
  );
}

function ProfileGroup({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 2 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: '#8A8A8E',
        textTransform: 'uppercase', letterSpacing: 0.6,
        padding: '10px 0 4px',
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <span>{icon}</span> {title}
      </div>
      {children}
    </div>
  );
}

function ClientProfile({ card, expanded, onToggle }: {
  card: PlanCard;
  expanded: boolean;
  onToggle: () => void;
}) {
  const q = (card.quiz_answers ?? {}) as Record<string, unknown>;

  // Tags de resumo rápido sempre visíveis
  const summaryTags: string[] = [
    card.hair_type ? qLabel('tipo', card.hair_type) : null,
    q.espessura    ? qLabel('espessura', String(q.espessura)) : null,
    card.porosity  ? qLabel('porosidade', card.porosity) : null,
    q.oleosidade   ? qLabel('oleosidade', String(q.oleosidade)) : null,
    card.hair_length_cm ? `${card.hair_length_cm} cm` : null,
  ].filter(Boolean) as string[];

  const problems = Array.isArray(q.incomoda) ? q.incomoda.map(v => qLabel('incomoda', String(v))) : [];
  const chemicals = card.chemical_history
    ? card.chemical_history.split(',').map(c => qLabel('quimica', c.trim()))
    : Array.isArray(q.quimica) ? (q.quimica as string[]).map(v => qLabel('quimica', v)) : [];

  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      overflow: 'hidden',
    }}>
      {/* Header / Toggle */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', textAlign: 'left', border: 'none', background: 'none',
          padding: '14px 20px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: '#8A8A8E', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          📋 Perfil da Cliente
        </span>
        <div style={{ flex: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {summaryTags.map((t, i) => (
            <span key={i} style={{
              fontSize: 11, fontWeight: 500,
              padding: '2px 8px', borderRadius: 5,
              background: 'rgba(196,96,122,0.08)', color: ACCENT,
            }}>{t}</span>
          ))}
          {problems.slice(0, 3).map((p, i) => (
            <span key={i} style={{
              fontSize: 11, fontWeight: 500,
              padding: '2px 8px', borderRadius: 5,
              background: 'rgba(255,149,0,0.08)', color: '#CC7700',
            }}>{p}</span>
          ))}
        </div>
        <span style={{ fontSize: 14, color: '#8A8A8E', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
          ▾
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{
          borderTop: '1px solid #F2F2F7',
          padding: '4px 20px 16px',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px',
        }}>
          {/* Col 1 */}
          <div>
            <ProfileGroup title="Cabelo" icon="💇">
              <ProfileRow label="Tipo"         value={qVal('tipo', q.tipo ?? card.hair_type)} accent />
              <ProfileRow label="Espessura"    value={qVal('espessura', q.espessura)} />
              <ProfileRow label="Porosidade"   value={qVal('porosidade', q.porosidade ?? card.porosity)} />
              <ProfileRow label="Oleosidade"   value={qVal('oleosidade', q.oleosidade)} />
              <ProfileRow label="Comprimento"  value={card.hair_length_cm ? `${card.hair_length_cm} cm` : qVal('_', q.comprimento)} />
              <ProfileRow label="Cor"          value={String(q.cor ?? '—')} />
              <ProfileRow label="Elasticidade" value={qVal('elasticidade', q.elasticidade)} />
            </ProfileGroup>

            <ProfileGroup title="Química & Calor" icon="⚗️">
              <ProfileRow label="Histórico químico" value={chemicals.join(', ') || '—'} accent={chemicals.length > 0} />
              <ProfileRow label="Ferramentas de calor" value={qArr('calor', q.calor)} />
              <ProfileRow label="Usa protetor térmico" value={qVal('protetor', q.protetor)} />
              <ProfileRow label="Corte/química planejado" value={qVal('corte_quimico', q.corte_quimico)} />
            </ProfileGroup>

            <ProfileGroup title="Rotina Atual" icon="🔄">
              <ProfileRow label="Frequência de lavagem" value={qVal('lavagem', q.lavagem)} />
              <ProfileRow label="Tem cronograma" value={qVal('cronograma', q.cronograma)} />
              <ProfileRow label="Frequência de corte" value={qVal('cortes', q.cortes)} />
              <ProfileRow label="Qualidade da água" value={qVal('agua', q.agua)} />
              <ProfileRow label="Sol/piscina" value={qVal('sol_piscina', q.sol_piscina)} />
            </ProfileGroup>
          </div>

          {/* Col 2 */}
          <div>
            <ProfileGroup title="Problemas & Objetivos" icon="🎯">
              <ProfileRow
                label="O que incomoda"
                value={qArr('incomoda', q.incomoda ?? card.main_problems)}
                accent
              />
              <ProfileRow label="Áreas de atenção" value={qArr('areas', q.areas)} />
              <ProfileRow label="Tem caspa" value={qVal('caspa', q.caspa)} />
              <ProfileRow label="Crescimento desigual" value={qVal('crescimento_desigual', q.crescimento_desigual)} />
              <ProfileRow label="Como quer usar o plano" value={qVal('como_plano', q.como_plano)} />
            </ProfileGroup>

            <ProfileGroup title="Produtos Atuais" icon="🧴">
              {q.produtos_casa ? (
                <div style={{
                  fontSize: 12.5, color: '#2D1B2E', lineHeight: 1.5,
                  padding: '6px 0', borderBottom: '1px solid #F5F5F7',
                }}>
                  {String(q.produtos_casa)}
                </div>
              ) : (
                <ProfileRow label="Produtos em casa" value="—" />
              )}
              {card.budget_range && (
                <ProfileRow label="Orçamento" value={card.budget_range} />
              )}
            </ProfileGroup>

            <ProfileGroup title="Perfil" icon="👤">
              <ProfileRow label="Faixa etária" value={qVal('idade', q.idade)} />
              <ProfileRow label="E-mail" value={card.email} />
              {card.phone && <ProfileRow label="Telefone" value={card.phone} />}
            </ProfileGroup>

            {/* Foto se existir */}
            {card.photo_url && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8A8A8E', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                  📸 Foto enviada
                </div>
                <a href={card.photo_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block' }}>
                  <img
                    src={card.photo_url}
                    alt="Foto do cabelo"
                    style={{
                      width: 140, height: 140, objectFit: 'cover',
                      borderRadius: 10, border: '2px solid #F2F2F7',
                      display: 'block',
                    }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared input style ────────────────────────────────────────────────────────
const fieldBase: React.CSSProperties = {
  border: '1.5px solid #E5E5EA',
  borderRadius: 7,
  padding: '7px 10px',
  fontSize: 13,
  color: '#2D1B2E',
  background: '#FAFAFA',
  outline: 'none',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function PlanosClient({ initialCards }: { initialCards: PlanCard[] }) {
  const [cards, setCards]             = useState(initialCards);
  const [filterTab, setFilterTab]     = useState<'pending' | 'approved' | 'all'>('pending');
  const [planTab, setPlanTab]         = useState<'cronograma' | 'produtos' | 'dicas'>('cronograma');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    initialCards.find(c => !c.approved)?.user_id ?? initialCards[0]?.user_id ?? null,
  );
  const [weeks, setWeeks]             = useState<PlanWeek[] | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [obs, setObs]                 = useState('');
  const [activeWeek, setActiveWeek]   = useState(1);
  const [savingAction, setSavingAction] = useState<'approve' | 'reject' | null>(null);

  // Edit mode
  const [editMode, setEditMode]       = useState(false);
  const [editDraft, setEditDraft]     = useState<EditablePlanWeek | null>(null);
  const [savingEdit, setSavingEdit]   = useState(false);

  // Regenerate with AI
  const [regenerating, setRegenerating] = useState(false);
  const [regenMessage, setRegenMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);

  // Product catalog for autocomplete
  const [catalog, setCatalog]         = useState<CatalogProduct[]>([]);

  // Profile panel expanded state
  const [profileExpanded, setProfileExpanded] = useState(true);

  // Load catalog once
  useEffect(() => {
    fetch('/api/produtos')
      .then(r => r.json())
      .then((d: unknown) => setCatalog(Array.isArray(d) ? (d as CatalogProduct[]) : []))
      .catch(() => {});
  }, []);

  // Derived state
  const filtered = useMemo(() => {
    if (filterTab === 'pending')  return cards.filter(c => !c.approved);
    if (filterTab === 'approved') return cards.filter(c =>  c.approved);
    return cards;
  }, [cards, filterTab]);

  const counts = useMemo(() => ({
    pending:  cards.filter(c => !c.approved).length,
    approved: cards.filter(c =>  c.approved).length,
    all:      cards.length,
  }), [cards]);

  const selected = useMemo(
    () => cards.find(c => c.user_id === selectedUserId) ?? null,
    [cards, selectedUserId],
  );

  const currentWeek = useMemo(
    () => weeks?.find(w => w.week_number === activeWeek) ?? weeks?.[0],
    [weeks, activeWeek],
  );

  // Load detail when selection changes
  useEffect(() => {
    if (!selectedUserId) { setWeeks(null); return; }
    setLoadingDetail(true);
    setEditMode(false);
    setEditDraft(null);
    setRegenMessage(null);
    setShowRegenConfirm(false);
    setProfileExpanded(true);
    fetch(`/api/plans/${selectedUserId}`)
      .then(r => r.json())
      .then((d: { weeks: PlanWeek[] }) => {
        setWeeks(d.weeks ?? []);
        setActiveWeek(1);
        setObs(d.weeks?.[0]?.juliane_notes ?? '');
      })
      .catch(() => setWeeks([]))
      .finally(() => setLoadingDetail(false));
  }, [selectedUserId]);

  // ── Edit mode helpers ──────────────────────────────────────────────────────
  function enterEditMode() {
    if (!currentWeek) return;
    setEditDraft({
      ...currentWeek,
      focus: currentWeek.focus ?? '',
      tasks: (currentWeek.tasks ?? []).map((t, i) => {
        const obj = typeof t === 'string' ? { title: t } : t;
        return {
          day:         typeof obj.day === 'number' ? obj.day : i + 1,
          title:       typeof obj.title === 'string' ? obj.title : '',
          description: typeof obj.description === 'string' ? obj.description : '',
        };
      }),
      products: [...(currentWeek.products ?? [])],
      tips:     [...(currentWeek.tips     ?? [])],
    });
    setEditMode(true);
    setRegenMessage(null);
    setShowRegenConfirm(false);
  }

  function cancelEdit() {
    setEditMode(false);
    setEditDraft(null);
  }

  function handleWeekChange(wn: number) {
    if (editMode) { cancelEdit(); }
    setActiveWeek(wn);
    setObs(weeks?.find(w => w.week_number === wn)?.juliane_notes ?? '');
  }

  const updateFocus = useCallback((v: string) =>
    setEditDraft(d => d ? { ...d, focus: v } : d), []);

  const updateTask = useCallback((i: number, field: keyof EditableTask, v: string | number) =>
    setEditDraft(d => d ? { ...d, tasks: d.tasks.map((t, idx) => idx === i ? { ...t, [field]: v } : t) } : d), []);

  const addTask = useCallback(() =>
    setEditDraft(d => d ? { ...d, tasks: [...d.tasks, { day: d.tasks.length + 1, title: '', description: '' }] } : d), []);

  const removeTask = useCallback((i: number) =>
    setEditDraft(d => d ? { ...d, tasks: d.tasks.filter((_, idx) => idx !== i) } : d), []);

  const updateProduct = useCallback((i: number, v: string) =>
    setEditDraft(d => d ? { ...d, products: d.products.map((p, idx) => idx === i ? v : p) } : d), []);

  const addProduct = useCallback(() =>
    setEditDraft(d => d ? { ...d, products: [...d.products, ''] } : d), []);

  const removeProduct = useCallback((i: number) =>
    setEditDraft(d => d ? { ...d, products: d.products.filter((_, idx) => idx !== i) } : d), []);

  const updateTip = useCallback((i: number, v: string) =>
    setEditDraft(d => d ? { ...d, tips: d.tips.map((t, idx) => idx === i ? v : t) } : d), []);

  const addTip = useCallback(() =>
    setEditDraft(d => d ? { ...d, tips: [...d.tips, ''] } : d), []);

  const removeTip = useCallback((i: number) =>
    setEditDraft(d => d ? { ...d, tips: d.tips.filter((_, idx) => idx !== i) } : d), []);

  // ── Save edited week ───────────────────────────────────────────────────────
  async function saveEditedWeek() {
    if (!selectedUserId || !editDraft) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/plans/${selectedUserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:      'update_week',
          week_number: editDraft.week_number,
          focus:       editDraft.focus,
          tasks:       editDraft.tasks,
          products:    editDraft.products.filter(p => p.trim()),
          tips:        editDraft.tips.filter(t => t.trim()),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      // Normalize tasks: coerce day to number for PlanWeek compatibility
      const normalizedTasks = editDraft.tasks.map(t => ({
        day:         typeof t.day === 'string' ? Number(t.day) || undefined : t.day,
        title:       t.title,
        description: t.description || undefined,
      }));
      const saved: PlanWeek = {
        ...editDraft,
        tasks:    normalizedTasks,
        products: editDraft.products.filter(p => p.trim()),
        tips:     editDraft.tips.filter(t => t.trim()),
      };
      setWeeks(prev => prev ? prev.map(w => w.week_number === editDraft.week_number ? { ...w, ...saved } : w) : prev);
      setEditMode(false);
      setEditDraft(null);
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert('Erro ao salvar: ' + (e instanceof Error ? e.message : 'desconhecido'));
    } finally {
      setSavingEdit(false);
    }
  }

  // ── Regenerate plan with AI ────────────────────────────────────────────────
  async function regeneratePlan() {
    if (!selectedUserId) return;
    setRegenerating(true);
    setRegenMessage(null);
    setShowRegenConfirm(false);
    try {
      const res = await fetch(`/api/admin/profiles/${selectedUserId}/regenerate-plan`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ confirm: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Erro desconhecido');
      // Reload weeks
      const wRes  = await fetch(`/api/plans/${selectedUserId}`);
      const wData = await wRes.json();
      setWeeks(wData.weeks ?? []);
      setActiveWeek(1);
      setObs(wData.weeks?.[0]?.juliane_notes ?? '');
      setRegenMessage({ type: 'success', text: `✓ ${json.weeks_generated} semanas geradas com IA!` });
      setCards(prev => prev.map(c =>
        c.user_id === selectedUserId
          ? { ...c, approved: false, has_plan: true, stage: 'needs_review' as const }
          : c,
      ));
    } catch (e) {
      setRegenMessage({ type: 'error', text: 'Erro: ' + (e instanceof Error ? e.message : 'desconhecido') });
    } finally {
      setRegenerating(false);
    }
  }

  // ── Approve / Reject ───────────────────────────────────────────────────────
  async function actOnPlan(action: 'approve' | 'reject') {
    if (!selectedUserId) return;
    setSavingAction(action);
    try {
      const res = await fetch(`/api/plans/${selectedUserId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action, notes: obs, week_number: activeWeek }),
      });
      if (!res.ok) throw new Error(await res.text());
      setCards(prev => prev.map(c =>
        c.user_id === selectedUserId ? { ...c, approved: action === 'approve' } : c,
      ));
      setWeeks(prev => prev ? prev.map(w =>
        w.week_number === activeWeek ? { ...w, approved_by_juliane: action === 'approve', juliane_notes: obs } : w,
      ) : prev);
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert('Erro: ' + (e instanceof Error ? e.message : 'desconhecido'));
    } finally {
      setSavingAction(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#F5F5F7',
      fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
      color: '#2D1B2E',
    }}>
      <Sidebar />

      <div style={{ marginLeft: 220, flex: 1, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Page header */}
        <div style={{
          padding: '28px 32px 20px', background: '#F5F5F7',
          display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: '1px solid #E5E5EA', flexShrink: 0,
        }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, margin: 0 }}>Revisão de Planos</h1>
          <span style={{
            background:  counts.pending > 0 ? 'rgba(255,149,0,0.12)' : 'rgba(52,199,89,0.12)',
            color:       counts.pending > 0 ? '#FF9500' : '#34C759',
            fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
          }}>
            {counts.pending} {counts.pending === 1 ? 'pendente' : 'pendentes'}
          </span>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* ── Left list ───────────────────────────────────────────────── */}
          <div style={{
            width: 320, minWidth: 320, background: '#fff',
            borderRight: '1px solid #E5E5EA',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Filter tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #E5E5EA', padding: '0 16px', flexShrink: 0 }}>
              {FILTER_TABS.map(t => (
                <button key={t.key} onClick={() => setFilterTab(t.key)} style={{
                  fontSize: 12.5,
                  fontWeight: filterTab === t.key ? 600 : 500,
                  color:     filterTab === t.key ? ACCENT : '#8A8A8E',
                  padding: '12px 10px', cursor: 'pointer',
                  border: 'none', background: 'none',
                  borderBottom: filterTab === t.key ? `2px solid ${ACCENT}` : '2px solid transparent',
                  marginBottom: -1, whiteSpace: 'nowrap',
                }}>
                  {t.label} ({counts[t.key]})
                </button>
              ))}
            </div>

            {/* Cards */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filtered.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: '#8A8A8E', fontSize: 13 }}>
                  {filterTab === 'pending' ? 'Nenhum plano pendente 🎉'
                    : filterTab === 'approved' ? 'Sem planos aprovados ainda'
                    : 'Sem planos no sistema'}
                </div>
              ) : (
                filtered.map(p => {
                  const isActive = selectedUserId === p.user_id;
                  const stageCfg = p.stage ? STAGE_CONFIG[p.stage] : null;
                  return (
                    <div
                      key={p.user_id}
                      onClick={() => { setSelectedUserId(p.user_id); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '14px 16px', cursor: 'pointer',
                        borderBottom: '1px solid #F2F2F7',
                        background:  isActive ? 'rgba(196,96,122,0.06)' : 'white',
                        borderLeft:  isActive ? `3px solid ${ACCENT}` : '3px solid transparent',
                        paddingLeft: isActive ? 13 : 16,
                      }}
                    >
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%',
                        background: gradientForId(p.user_id),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
                      }}>
                        {initials(p.full_name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#2D1B2E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.full_name}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#8A8A8E', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {[
                            p.hair_type ? HAIR_TYPE_LABEL[p.hair_type] ?? p.hair_type : null,
                            p.porosity  ? POROSITY_LABEL[p.porosity]   ?? p.porosity  : null,
                          ].filter(Boolean).join(' · ') || 'Sem perfil capilar'}
                        </div>
                        {stageCfg && (
                          <span style={{
                            display: 'inline-block', marginTop: 4,
                            fontSize: 10.5, fontWeight: 600,
                            padding: '2px 7px', borderRadius: 5,
                            color: stageCfg.color, background: stageCfg.bg,
                          }}>
                            {stageCfg.label}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#AEAEB2', flexShrink: 0 }}>
                        {formatDate(p.created_at)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Right detail ────────────────────────────────────────────── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!selected ? (
              <div style={{ color: '#8A8A8E', fontSize: 14 }}>
                Selecione uma usuária na lista para ver o plano.
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>{selected.full_name}</div>
                    <div style={{ fontSize: 13, color: '#8A8A8E', marginTop: 3 }}>
                      {[
                        selected.hair_type ? HAIR_TYPE_LABEL[selected.hair_type] ?? selected.hair_type : null,
                        selected.porosity  ? POROSITY_LABEL[selected.porosity]   ?? selected.porosity  : null,
                        ...(selected.main_problems ?? []),
                      ].filter(Boolean).join(' · ') || 'Sem perfil capilar definido'}
                    </div>
                    <div style={{ fontSize: 12, color: '#AEAEB2', marginTop: 2 }}>{selected.email}</div>
                    {selected.stage && STAGE_CONFIG[selected.stage] && (
                      <span style={{
                        display: 'inline-block', marginTop: 8,
                        fontSize: 11.5, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                        color: STAGE_CONFIG[selected.stage].color,
                        background: STAGE_CONFIG[selected.stage].bg,
                      }}>
                        {STAGE_CONFIG[selected.stage].label}
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {/* WhatsApp */}
                    {selected.phone ? (
                      <a
                        href={`https://wa.me/55${selected.phone.replace(/\D/g, '').replace(/^55/, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`WhatsApp ${selected.phone}`}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          fontSize: 13, fontWeight: 600,
                          padding: '9px 16px', borderRadius: 9,
                          background: '#25D366', border: '1.5px solid #25D366',
                          color: '#fff', textDecoration: 'none',
                          boxShadow: '0 2px 8px rgba(37,211,102,0.25)',
                          transition: 'all 0.15s',
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        WhatsApp
                      </a>
                    ) : (
                      <span
                        title="Telefone não cadastrado"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          fontSize: 13, fontWeight: 600,
                          padding: '9px 16px', borderRadius: 9,
                          background: '#F2F2F7', border: '1.5px solid #E5E5EA',
                          color: '#AEAEB2', cursor: 'not-allowed',
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.4 }}>
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        Sem telefone
                      </span>
                    )}
                    <button
                      onClick={() => { setShowRegenConfirm(v => !v); setRegenMessage(null); }}
                      disabled={regenerating || editMode}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        fontSize: 13, fontWeight: 600,
                        padding: '9px 16px', borderRadius: 9, cursor: 'pointer',
                        background: regenerating ? '#F5F5F7' : ACCENT,
                        border: `1.5px solid ${ACCENT}`,
                        color: regenerating ? '#8A8A8E' : '#fff',
                        opacity: editMode ? 0.4 : 1,
                        boxShadow: regenerating ? 'none' : '0 2px 8px rgba(196,96,122,0.25)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {regenerating ? (
                        <>
                          <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                          Gerando…
                        </>
                      ) : '🤖 Gerar com IA'}
                    </button>
                    <button
                      onClick={editMode ? cancelEdit : enterEditMode}
                      disabled={regenerating || (!currentWeek && !editMode)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        fontSize: 13, fontWeight: 600,
                        padding: '9px 16px', borderRadius: 9, cursor: 'pointer',
                        background: editMode ? '#fff' : '#fff',
                        border: `1.5px solid ${editMode ? '#FF3B30' : '#C4607A'}`,
                        color: editMode ? '#FF3B30' : ACCENT,
                        opacity: (regenerating || (!currentWeek && !editMode)) ? 0.4 : 1,
                        transition: 'all 0.15s',
                      }}
                    >
                      {editMode ? '✕ Cancelar edição' : '✎ Editar plano'}
                    </button>
                  </div>
                </div>

                {/* Regen confirm banner */}
                {showRegenConfirm && (
                  <div style={{
                    background: 'rgba(255,149,0,0.07)',
                    border: '1px solid rgba(255,149,0,0.35)',
                    borderRadius: 10, padding: '14px 18px',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <span style={{ flex: 1, fontSize: 13, color: '#664400' }}>
                      ⚠️ <strong>Atenção:</strong> isso vai substituir{' '}
                      {weeks && weeks.length > 0 ? `todas as ${weeks.length} semanas` : 'o plano atual'}{' '}
                      com um novo plano gerado por IA. Essa ação não pode ser desfeita.
                    </span>
                    <button
                      onClick={() => setShowRegenConfirm(false)}
                      style={{ fontSize: 12, padding: '6px 12px', borderRadius: 7, border: '1.5px solid #E5E5EA', background: '#fff', cursor: 'pointer', color: '#2D1B2E' }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={regeneratePlan}
                      style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 7, border: 'none', background: ACCENT, color: '#fff', cursor: 'pointer' }}
                    >
                      Confirmar geração
                    </button>
                  </div>
                )}

                {/* Message banner */}
                {regenMessage && (
                  <div style={{
                    background: regenMessage.type === 'success' ? 'rgba(52,199,89,0.07)' : 'rgba(255,59,48,0.07)',
                    border: `1px solid ${regenMessage.type === 'success' ? 'rgba(52,199,89,0.35)' : 'rgba(255,59,48,0.35)'}`,
                    borderRadius: 10, padding: '12px 18px',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <span style={{ flex: 1, fontSize: 13, color: regenMessage.type === 'success' ? '#1a6a2e' : '#8B1A10' }}>
                      {regenMessage.text}
                    </span>
                    <button
                      onClick={() => setRegenMessage(null)}
                      style={{ fontSize: 13, border: 'none', background: 'none', cursor: 'pointer', color: '#8A8A8E', padding: '2px 6px' }}
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Profile panel */}
                <ClientProfile
                  card={selected}
                  expanded={profileExpanded}
                  onToggle={() => setProfileExpanded(v => !v)}
                />

                {/* Edit mode indicator */}
                {editMode && (
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: ACCENT,
                    background: 'rgba(196,96,122,0.07)',
                    border: `1px solid rgba(196,96,122,0.2)`,
                    borderRadius: 8, padding: '8px 14px',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    ✎ Modo de edição — Semana {editDraft?.week_number ?? activeWeek}
                    <span style={{ marginLeft: 4, fontWeight: 400, color: '#8A8A8E' }}>
                      · As alterações só são salvas ao clicar em "Salvar semana"
                    </span>
                  </div>
                )}

                {/* Week chips */}
                {weeks && weeks.length > 1 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {weeks.map(w => (
                      <button key={w.week_number} onClick={() => handleWeekChange(w.week_number)} style={{
                        fontSize: 12, fontWeight: 600,
                        padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
                        border: '1.5px solid',
                        borderColor: activeWeek === w.week_number ? ACCENT : '#E5E5EA',
                        background:  activeWeek === w.week_number ? ACCENT : '#fff',
                        color:       activeWeek === w.week_number ? '#fff' : '#2D1B2E',
                        opacity: editMode && w.week_number !== (editDraft?.week_number ?? activeWeek) ? 0.5 : 1,
                      }}>
                        Sem. {w.week_number}
                        {w.approved_by_juliane && <span style={{ marginLeft: 4, fontSize: 10 }}>✓</span>}
                      </button>
                    ))}
                  </div>
                )}

                {/* Plan content card */}
                <div style={{
                  background: '#fff', borderRadius: 12,
                  boxShadow: editMode ? `0 0 0 2px rgba(196,96,122,0.25)` : '0 1px 3px rgba(0,0,0,0.06)',
                  overflow: 'hidden',
                  transition: 'box-shadow 0.2s',
                }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: '#8A8A8E',
                    textTransform: 'uppercase', letterSpacing: 0.5,
                    padding: '14px 20px 10px', borderBottom: '1px solid #F2F2F7',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span>Plano gerado · Semana {currentWeek?.week_number ?? (editDraft?.week_number ?? '—')}</span>
                    {editMode && <span style={{ fontSize: 11, color: ACCENT, fontWeight: 600 }}>✎ editando</span>}
                  </div>

                  {/* Plan tabs */}
                  <div style={{ display: 'flex', borderBottom: '1px solid #F2F2F7', padding: '0 20px' }}>
                    {PLAN_TABS.map(t => (
                      <button key={t.key} onClick={() => setPlanTab(t.key)} style={{
                        fontSize: 12.5, fontWeight: planTab === t.key ? 600 : 500,
                        color: planTab === t.key ? ACCENT : '#8A8A8E',
                        padding: '10px 12px', cursor: 'pointer',
                        border: 'none', background: 'none',
                        borderBottom: planTab === t.key ? `2px solid ${ACCENT}` : '2px solid transparent',
                        marginBottom: -1,
                      }}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  {loadingDetail ? (
                    <div style={{ padding: 30, textAlign: 'center', color: '#8A8A8E' }}>Carregando…</div>
                  ) : regenerating ? (
                    <div style={{ padding: 40, textAlign: 'center' }}>
                      <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#2D1B2E' }}>Gerando plano com IA…</div>
                      <div style={{ fontSize: 13, color: '#8A8A8E', marginTop: 6 }}>Isso pode levar ~1 minuto. Aguarde.</div>
                    </div>
                  ) : !currentWeek && !editDraft ? (
                    /* Empty state */
                    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>
                        {selected.stage === 'awaiting_photo' ? '📸' : selected.stage === 'processing' ? '⚙️' : '📋'}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#2D1B2E', marginBottom: 6 }}>
                        {selected.stage === 'awaiting_photo' ? 'Aguardando foto do cabelo'
                          : selected.stage === 'processing' ? 'IA processando o plano'
                          : 'Nenhum plano gerado ainda'}
                      </div>
                      <div style={{ fontSize: 13, color: '#8A8A8E', marginBottom: 20, maxWidth: 300, margin: '0 auto 20px' }}>
                        {selected.stage === 'awaiting_photo' ? 'A cliente ainda não enviou a foto. Você pode gerar o plano com base somente no quiz.'
                          : selected.stage === 'processing' ? 'O plano está sendo gerado automaticamente. Aguarde ou force a geração.'
                          : 'Gere o plano com IA ou adicione manualmente as semanas.'}
                      </div>
                      <button
                        onClick={() => setShowRegenConfirm(true)}
                        disabled={regenerating}
                        style={{
                          fontSize: 13.5, fontWeight: 600, padding: '11px 24px', borderRadius: 10,
                          background: ACCENT, border: 'none', color: '#fff', cursor: 'pointer',
                          boxShadow: '0 2px 10px rgba(196,96,122,0.3)',
                        }}
                      >
                        🤖 Gerar plano com IA
                      </button>
                    </div>
                  ) : editMode && editDraft ? (
                    /* ── EDIT MODE ────────────────────────────────────── */
                    <>
                      {planTab === 'cronograma' && (
                        <div>
                          {/* Focus input */}
                          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F2F2F7' }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A8A8E', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                              Foco da semana
                            </label>
                            <input
                              value={editDraft.focus}
                              onChange={e => updateFocus(e.target.value)}
                              placeholder="Ex: Hidratação profunda e recuperação das pontas"
                              style={fieldBase}
                            />
                          </div>

                          {/* Tasks list */}
                          <div style={{ padding: '14px 20px 6px', borderBottom: '1px solid #F2F2F7' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8A8E', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                              Tarefas ({editDraft.tasks.length})
                            </div>
                            {editDraft.tasks.map((task, i) => (
                              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-start' }}>
                                {/* Day number */}
                                <input
                                  type="number"
                                  min={1} max={7}
                                  value={task.day}
                                  onChange={e => updateTask(i, 'day', Number(e.target.value))}
                                  style={{ ...fieldBase, width: 52, flexShrink: 0, textAlign: 'center', padding: '7px 6px' }}
                                  title="Dia"
                                />
                                <div style={{ flex: 1 }}>
                                  <input
                                    value={task.title}
                                    onChange={e => updateTask(i, 'title', e.target.value)}
                                    placeholder="Título da tarefa…"
                                    style={{ ...fieldBase, marginBottom: 5 }}
                                  />
                                  <input
                                    value={task.description}
                                    onChange={e => updateTask(i, 'description', e.target.value)}
                                    placeholder="Descrição opcional…"
                                    style={{ ...fieldBase, fontSize: 12 }}
                                  />
                                </div>
                                <button
                                  onClick={() => removeTask(i)}
                                  title="Remover tarefa"
                                  style={{
                                    width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #E5E5EA',
                                    background: '#fff', cursor: 'pointer', color: '#8A8A8E',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 14, flexShrink: 0, marginTop: 1,
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={addTask}
                              style={{
                                width: '100%', padding: '9px', borderRadius: 8,
                                border: '1.5px dashed #D1D1D6', background: 'none',
                                fontSize: 12.5, fontWeight: 600, color: '#8A8A8E',
                                cursor: 'pointer', marginBottom: 8,
                              }}
                            >
                              ＋ Adicionar tarefa
                            </button>
                          </div>
                        </div>
                      )}

                      {planTab === 'produtos' && (
                        <div style={{ padding: '14px 20px' }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8A8E', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                            Produtos recomendados ({editDraft.products.length})
                          </div>
                          {/* Datalist for autocomplete */}
                          <datalist id="planos-catalog">
                            {catalog.map(p => (
                              <option key={p.id} value={p.name}>
                                {p.brand ? `${p.brand} — ` : ''}{p.category ?? ''}
                              </option>
                            ))}
                          </datalist>

                          {editDraft.products.map((prod, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                              <input
                                list="planos-catalog"
                                value={prod}
                                onChange={e => updateProduct(i, e.target.value)}
                                placeholder="Nome do produto… (ou selecione do catálogo)"
                                style={fieldBase}
                              />
                              <button
                                onClick={() => removeProduct(i)}
                                style={{
                                  width: 32, height: 32, borderRadius: '50%', border: '1.5px solid #E5E5EA',
                                  background: '#fff', cursor: 'pointer', color: '#8A8A8E',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0,
                                }}
                              >×</button>
                            </div>
                          ))}
                          <button onClick={addProduct} style={{
                            width: '100%', padding: '9px', borderRadius: 8,
                            border: '1.5px dashed #D1D1D6', background: 'none',
                            fontSize: 12.5, fontWeight: 600, color: '#8A8A8E', cursor: 'pointer',
                          }}>
                            ＋ Adicionar produto
                          </button>
                          {catalog.length > 0 && (
                            <div style={{ fontSize: 11.5, color: '#AEAEB2', marginTop: 8 }}>
                              💡 {catalog.length} produtos no catálogo disponíveis no autocompletar
                            </div>
                          )}
                        </div>
                      )}

                      {planTab === 'dicas' && (
                        <div style={{ padding: '14px 20px' }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8A8E', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                            Dicas ({editDraft.tips.length})
                          </div>
                          {editDraft.tips.map((tip, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                              <textarea
                                value={tip}
                                onChange={e => updateTip(i, e.target.value)}
                                placeholder="Dica para a semana…"
                                rows={2}
                                style={{ ...fieldBase, resize: 'vertical', lineHeight: 1.5 }}
                              />
                              <button
                                onClick={() => removeTip(i)}
                                style={{
                                  width: 32, height: 32, borderRadius: '50%', border: '1.5px solid #E5E5EA',
                                  background: '#fff', cursor: 'pointer', color: '#8A8A8E',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0,
                                }}
                              >×</button>
                            </div>
                          ))}
                          <button onClick={addTip} style={{
                            width: '100%', padding: '9px', borderRadius: 8,
                            border: '1.5px dashed #D1D1D6', background: 'none',
                            fontSize: 12.5, fontWeight: 600, color: '#8A8A8E', cursor: 'pointer',
                          }}>
                            ＋ Adicionar dica
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    /* ── READ MODE ────────────────────────────────────── */
                    <>
                      {planTab === 'cronograma' && currentWeek && (
                        <>
                          <div style={{ padding: '16px 20px', fontWeight: 600, fontSize: 14 }}>
                            🎯 {currentWeek.focus}
                          </div>
                          {(currentWeek.tasks ?? []).map((t, i, arr) => {
                            const obj = typeof t === 'string' ? { title: t } : t;
                            const isLast = i === arr.length - 1;
                            return (
                              <div key={i} style={{
                                display: 'flex', alignItems: 'flex-start', gap: 14,
                                padding: '13px 20px',
                                borderBottom: isLast ? 'none' : '1px solid #F2F2F7',
                              }}>
                                <div style={{
                                  width: 26, height: 26, borderRadius: '50%',
                                  background: 'rgba(196,96,122,0.1)', color: ACCENT,
                                  fontSize: 12, fontWeight: 700,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                }}>
                                  {obj.day ?? i + 1}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>{obj.title}</div>
                                  {obj.description && (
                                    <div style={{ fontSize: 12, color: '#8A8A8E', marginTop: 2 }}>{obj.description}</div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                      {planTab === 'produtos' && (
                        (currentWeek?.products ?? []).length === 0 ? (
                          <div style={{ padding: 20, color: '#8A8A8E', fontSize: 13 }}>Sem produtos definidos para essa semana.</div>
                        ) : (
                          (currentWeek?.products ?? []).map((p, i, arr) => (
                            <div key={i} style={{
                              padding: '12px 20px',
                              borderBottom: i < arr.length - 1 ? '1px solid #F2F2F7' : 'none',
                              display: 'flex', gap: 10, alignItems: 'center',
                            }}>
                              <span style={{ color: ACCENT }}>✓</span>
                              <span style={{ fontSize: 13 }}>{p}</span>
                            </div>
                          ))
                        )
                      )}
                      {planTab === 'dicas' && (
                        (currentWeek?.tips ?? []).length === 0 ? (
                          <div style={{ padding: 20, color: '#8A8A8E', fontSize: 13 }}>Sem dicas para essa semana.</div>
                        ) : (
                          (currentWeek?.tips ?? []).map((t, i, arr) => (
                            <div key={i} style={{
                              padding: '12px 20px',
                              borderBottom: i < arr.length - 1 ? '1px solid #F2F2F7' : 'none',
                              display: 'flex', gap: 10, alignItems: 'flex-start',
                            }}>
                              <span style={{ width: 5, height: 5, borderRadius: 3, background: ACCENT, marginTop: 8, flexShrink: 0 }} />
                              <span style={{ fontSize: 13, lineHeight: 1.5 }}>{t}</span>
                            </div>
                          ))
                        )
                      )}
                    </>
                  )}
                </div>

                {/* Observations */}
                <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: '#8A8A8E',
                    textTransform: 'uppercase', letterSpacing: 0.5,
                    padding: '14px 20px 10px', borderBottom: '1px solid #F2F2F7',
                  }}>
                    Observações da Ju (Semana {activeWeek})
                  </div>
                  <textarea
                    value={obs}
                    onChange={e => setObs(e.target.value)}
                    placeholder="Adicione observações personalizadas para esta usuária..."
                    style={{
                      width: '100%', border: 'none', outline: 'none', resize: 'vertical',
                      fontFamily: 'inherit', fontSize: 13, color: '#2D1B2E',
                      padding: '16px 20px', minHeight: 90, background: 'transparent', lineHeight: 1.5,
                    }}
                  />
                </div>

                {/* Action buttons */}
                {editMode ? (
                  /* Edit mode actions */
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={cancelEdit}
                      disabled={savingEdit}
                      style={{
                        fontSize: 13.5, fontWeight: 600, padding: '10px 20px', borderRadius: 9,
                        cursor: 'pointer', background: 'transparent',
                        border: '1.5px solid #E5E5EA', color: '#8A8A8E',
                        opacity: savingEdit ? 0.5 : 1,
                      }}
                    >
                      Cancelar
                    </button>
                    <div style={{ flex: 1 }} />
                    <button
                      onClick={saveEditedWeek}
                      disabled={savingEdit}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        fontSize: 13.5, fontWeight: 600, padding: '10px 24px', borderRadius: 9,
                        cursor: savingEdit ? 'wait' : 'pointer',
                        background: '#007AFF', border: '1.5px solid #007AFF', color: '#fff',
                        boxShadow: '0 2px 8px rgba(0,122,255,0.3)',
                        opacity: savingEdit ? 0.7 : 1,
                      }}
                    >
                      {savingEdit ? 'Salvando…' : `✓ Salvar semana ${editDraft?.week_number ?? activeWeek}`}
                    </button>
                  </div>
                ) : (
                  /* Approve / Reject actions */
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={() => actOnPlan('reject')}
                      disabled={savingAction !== null}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        fontSize: 13.5, fontWeight: 600, padding: '10px 20px', borderRadius: 9,
                        cursor: savingAction !== null ? 'wait' : 'pointer',
                        background: 'transparent', border: '1.5px solid #FF3B30', color: '#FF3B30',
                        opacity: savingAction !== null ? 0.6 : 1,
                      }}
                    >
                      {savingAction === 'reject' ? 'Reprovando…' : '✗ Reprovar'}
                    </button>
                    <div style={{ flex: 1 }} />
                    <button
                      onClick={() => actOnPlan('approve')}
                      disabled={savingAction !== null || selected.approved}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        fontSize: 13.5, fontWeight: 600, padding: '10px 20px', borderRadius: 9,
                        cursor: savingAction !== null || selected.approved ? 'not-allowed' : 'pointer',
                        background:  selected.approved ? '#8A8A8E' : '#34C759',
                        border:      `1.5px solid ${selected.approved ? '#8A8A8E' : '#34C759'}`,
                        color: '#fff',
                        boxShadow:   selected.approved ? 'none' : '0 2px 8px rgba(52,199,89,0.3)',
                        opacity: savingAction !== null ? 0.6 : 1,
                      }}
                    >
                      {selected.approved ? '✓ Já aprovado'
                        : savingAction === 'approve' ? 'Aprovando…'
                        : '✓ Aprovar Plano'}
                    </button>
                  </div>
                )}

                {/* Spinning keyframe */}
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
