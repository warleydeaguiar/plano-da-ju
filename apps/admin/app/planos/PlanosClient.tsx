'use client';

import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';

const ACCENT = '#C4607A';

const HAIR_TYPE_LABEL: Record<string, string> = {
  liso: 'Liso',
  ondulado: 'Ondulado',
  cacheado: 'Cacheado',
  crespo: 'Crespo',
};

const POROSITY_LABEL: Record<string, string> = {
  baixa: 'Baixa porosidade',
  media: 'Média porosidade',
  alta: 'Alta porosidade',
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
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `Ontem ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

interface PlanCard {
  user_id: string;
  full_name: string;
  email: string;
  hair_type: string | null;
  porosity: string | null;
  main_problems: string[] | null;
  approved: boolean;
  created_at: string;
  juliane_notes: string | null;
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

const FILTER_TABS = [
  { key: 'pending' as const, label: 'Pendentes' },
  { key: 'approved' as const, label: 'Aprovados' },
  { key: 'all' as const, label: 'Todos' },
];

const PLAN_TABS: Array<{ key: 'cronograma' | 'produtos' | 'dicas'; label: string }> = [
  { key: 'cronograma', label: 'Cronograma' },
  { key: 'produtos', label: 'Produtos' },
  { key: 'dicas', label: 'Dicas' },
];

export default function PlanosClient({ initialCards }: { initialCards: PlanCard[] }) {
  const [cards, setCards] = useState(initialCards);
  const [filterTab, setFilterTab] = useState<'pending' | 'approved' | 'all'>(
    'pending',
  );
  const [planTab, setPlanTab] = useState<'cronograma' | 'produtos' | 'dicas'>(
    'cronograma',
  );
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    initialCards.find(c => !c.approved)?.user_id ?? initialCards[0]?.user_id ?? null,
  );

  const [weeks, setWeeks] = useState<PlanWeek[] | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [obs, setObs] = useState('');
  const [activeWeek, setActiveWeek] = useState(1);
  const [savingAction, setSavingAction] = useState<'approve' | 'reject' | null>(null);

  const filtered = useMemo(() => {
    if (filterTab === 'pending') return cards.filter(c => !c.approved);
    if (filterTab === 'approved') return cards.filter(c => c.approved);
    return cards;
  }, [cards, filterTab]);

  const counts = useMemo(
    () => ({
      pending: cards.filter(c => !c.approved).length,
      approved: cards.filter(c => c.approved).length,
      all: cards.length,
    }),
    [cards],
  );

  const selected = useMemo(
    () => cards.find(c => c.user_id === selectedUserId) ?? null,
    [cards, selectedUserId],
  );

  // Load detail when selection changes
  useEffect(() => {
    if (!selectedUserId) {
      setWeeks(null);
      return;
    }
    setLoadingDetail(true);
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

  const currentWeek = useMemo(
    () => weeks?.find(w => w.week_number === activeWeek) ?? weeks?.[0],
    [weeks, activeWeek],
  );

  async function actOnPlan(action: 'approve' | 'reject') {
    if (!selectedUserId) return;
    setSavingAction(action);
    try {
      const res = await fetch(`/api/plans/${selectedUserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes: obs }),
      });
      if (!res.ok) throw new Error(await res.text());
      // Atualiza estado local
      setCards(prev =>
        prev.map(c =>
          c.user_id === selectedUserId
            ? { ...c, approved: action === 'approve' }
            : c,
        ),
      );
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert('Erro: ' + (e instanceof Error ? e.message : 'desconhecido'));
    } finally {
      setSavingAction(null);
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: '#F5F5F7',
        fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
        color: '#2D1B2E',
      }}
    >
      <Sidebar />

      <div
        style={{
          marginLeft: 220,
          flex: 1,
          height: '100vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '28px 32px 20px',
            background: '#F5F5F7',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderBottom: '1px solid #E5E5EA',
            flexShrink: 0,
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, margin: 0 }}>
            Revisão de Planos
          </h1>
          <span
            style={{
              background: counts.pending > 0 ? 'rgba(255,149,0,0.12)' : 'rgba(52,199,89,0.12)',
              color: counts.pending > 0 ? '#FF9500' : '#34C759',
              fontSize: 12,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 20,
            }}
          >
            {counts.pending} {counts.pending === 1 ? 'pendente' : 'pendentes'}
          </span>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* List panel */}
          <div
            style={{
              width: 320,
              minWidth: 320,
              background: '#fff',
              borderRight: '1px solid #E5E5EA',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid #E5E5EA',
                padding: '0 16px',
                flexShrink: 0,
              }}
            >
              {FILTER_TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setFilterTab(t.key)}
                  style={{
                    fontSize: 12.5,
                    fontWeight: filterTab === t.key ? 600 : 500,
                    color: filterTab === t.key ? ACCENT : '#8A8A8E',
                    padding: '12px 10px',
                    cursor: 'pointer',
                    border: 'none',
                    background: 'none',
                    borderBottom:
                      filterTab === t.key
                        ? `2px solid ${ACCENT}`
                        : '2px solid transparent',
                    marginBottom: -1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.label} ({counts[t.key]})
                </button>
              ))}
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filtered.length === 0 ? (
                <div
                  style={{
                    padding: 30,
                    textAlign: 'center',
                    color: '#8A8A8E',
                    fontSize: 13,
                  }}
                >
                  {filterTab === 'pending'
                    ? 'Nenhum plano pendente 🎉'
                    : filterTab === 'approved'
                      ? 'Sem planos aprovados ainda'
                      : 'Sem planos no sistema'}
                </div>
              ) : (
                filtered.map(p => {
                  const isActive = selectedUserId === p.user_id;
                  return (
                    <div
                      key={p.user_id}
                      onClick={() => setSelectedUserId(p.user_id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '14px 16px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #F2F2F7',
                        background: isActive ? 'rgba(196,96,122,0.06)' : 'white',
                        borderLeft: isActive
                          ? `3px solid ${ACCENT}`
                          : '3px solid transparent',
                        paddingLeft: isActive ? 13 : 16,
                      }}
                    >
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: '50%',
                          background: gradientForId(p.user_id),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#fff',
                          flexShrink: 0,
                        }}
                      >
                        {initials(p.full_name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13.5,
                            fontWeight: 600,
                            color: '#2D1B2E',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {p.full_name}
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: '#8A8A8E',
                            marginTop: 2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {[
                            p.hair_type
                              ? HAIR_TYPE_LABEL[p.hair_type] ?? p.hair_type
                              : null,
                            p.porosity
                              ? POROSITY_LABEL[p.porosity] ?? p.porosity
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'Sem perfil capilar'}
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          gap: 4,
                          flexShrink: 0,
                        }}
                      >
                        <div style={{ fontSize: 11, color: '#AEAEB2' }}>
                          {formatDate(p.created_at)}
                        </div>
                        <div
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: !p.approved ? '#FF9500' : '#34C759',
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Detail panel */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '28px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            {!selected ? (
              <div style={{ color: '#8A8A8E', fontSize: 14 }}>
                Selecione uma usuária na lista para ver o plano.
              </div>
            ) : (
              <>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>
                    {selected.full_name}
                  </div>
                  <div style={{ fontSize: 13, color: '#8A8A8E', marginTop: 4 }}>
                    {[
                      selected.hair_type
                        ? HAIR_TYPE_LABEL[selected.hair_type] ?? selected.hair_type
                        : null,
                      selected.porosity
                        ? POROSITY_LABEL[selected.porosity] ?? selected.porosity
                        : null,
                      ...(selected.main_problems ?? []),
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Sem perfil capilar definido'}
                  </div>
                  <div style={{ fontSize: 12, color: '#AEAEB2', marginTop: 2 }}>
                    Criado em {formatDate(selected.created_at)}
                  </div>
                </div>

                {/* Weeks chips */}
                {weeks && weeks.length > 1 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {weeks.map(w => (
                      <button
                        key={w.week_number}
                        onClick={() => setActiveWeek(w.week_number)}
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '6px 12px',
                          borderRadius: 20,
                          cursor: 'pointer',
                          border: '1.5px solid',
                          borderColor:
                            activeWeek === w.week_number ? ACCENT : '#E5E5EA',
                          background:
                            activeWeek === w.week_number ? ACCENT : '#fff',
                          color:
                            activeWeek === w.week_number ? '#fff' : '#2D1B2E',
                        }}
                      >
                        Sem. {w.week_number}
                      </button>
                    ))}
                  </div>
                )}

                <div
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#8A8A8E',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      padding: '14px 20px 10px',
                      borderBottom: '1px solid #F2F2F7',
                    }}
                  >
                    Plano gerado · Semana {currentWeek?.week_number ?? '—'}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      borderBottom: '1px solid #F2F2F7',
                      padding: '0 20px',
                    }}
                  >
                    {PLAN_TABS.map(t => (
                      <button
                        key={t.key}
                        onClick={() => setPlanTab(t.key)}
                        style={{
                          fontSize: 12.5,
                          fontWeight: planTab === t.key ? 600 : 500,
                          color: planTab === t.key ? ACCENT : '#8A8A8E',
                          padding: '10px 12px',
                          cursor: 'pointer',
                          border: 'none',
                          background: 'none',
                          borderBottom:
                            planTab === t.key
                              ? `2px solid ${ACCENT}`
                              : '2px solid transparent',
                          marginBottom: -1,
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {loadingDetail ? (
                    <div style={{ padding: 30, textAlign: 'center', color: '#8A8A8E' }}>
                      Carregando…
                    </div>
                  ) : !currentWeek ? (
                    <div style={{ padding: 30, textAlign: 'center', color: '#8A8A8E' }}>
                      Sem semanas geradas para essa usuária.
                    </div>
                  ) : planTab === 'cronograma' ? (
                    <>
                      <div style={{ padding: '16px 20px', fontWeight: 600, fontSize: 14 }}>
                        🎯 {currentWeek.focus}
                      </div>
                      {(currentWeek.tasks ?? []).map((t, i, arr) => {
                        const obj =
                          typeof t === 'string' ? { title: t } : t;
                        const isLast = i === arr.length - 1;
                        return (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 14,
                              padding: '13px 20px',
                              borderBottom: isLast ? 'none' : '1px solid #F2F2F7',
                            }}
                          >
                            <div
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: '50%',
                                background: 'rgba(196,96,122,0.1)',
                                color: ACCENT,
                                fontSize: 12,
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {obj.day ?? i + 1}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>
                                {obj.title}
                              </div>
                              {obj.description && (
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: '#8A8A8E',
                                    marginTop: 2,
                                  }}
                                >
                                  {obj.description}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ) : planTab === 'produtos' ? (
                    (currentWeek.products ?? []).length === 0 ? (
                      <div style={{ padding: 20, color: '#8A8A8E', fontSize: 13 }}>
                        Sem produtos definidos para essa semana.
                      </div>
                    ) : (
                      (currentWeek.products ?? []).map((p, i, arr) => (
                        <div
                          key={i}
                          style={{
                            padding: '12px 20px',
                            borderBottom:
                              i < arr.length - 1 ? '1px solid #F2F2F7' : 'none',
                            display: 'flex',
                            gap: 10,
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ color: ACCENT }}>✓</span>
                          <span style={{ fontSize: 13 }}>{p}</span>
                        </div>
                      ))
                    )
                  ) : (
                    (currentWeek.tips ?? []).length === 0 ? (
                      <div style={{ padding: 20, color: '#8A8A8E', fontSize: 13 }}>
                        Sem dicas para essa semana.
                      </div>
                    ) : (
                      (currentWeek.tips ?? []).map((t, i, arr) => (
                        <div
                          key={i}
                          style={{
                            padding: '12px 20px',
                            borderBottom:
                              i < arr.length - 1 ? '1px solid #F2F2F7' : 'none',
                            display: 'flex',
                            gap: 10,
                            alignItems: 'flex-start',
                          }}
                        >
                          <span
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: 3,
                              background: ACCENT,
                              marginTop: 8,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontSize: 13, lineHeight: 1.5 }}>{t}</span>
                        </div>
                      ))
                    )
                  )}
                </div>

                <div
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#8A8A8E',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      padding: '14px 20px 10px',
                      borderBottom: '1px solid #F2F2F7',
                    }}
                  >
                    Observações da Ju (Semana {activeWeek})
                  </div>
                  <textarea
                    value={obs}
                    onChange={e => setObs(e.target.value)}
                    placeholder="Adicione observações personalizadas para esta usuária..."
                    style={{
                      width: '100%',
                      border: 'none',
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      color: '#2D1B2E',
                      padding: '16px 20px',
                      minHeight: 90,
                      background: 'transparent',
                      lineHeight: 1.5,
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => actOnPlan('reject')}
                    disabled={savingAction !== null}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 13.5,
                      fontWeight: 600,
                      padding: '10px 20px',
                      borderRadius: 9,
                      cursor: savingAction !== null ? 'wait' : 'pointer',
                      background: 'transparent',
                      border: '1.5px solid #FF3B30',
                      color: '#FF3B30',
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
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 13.5,
                      fontWeight: 600,
                      padding: '10px 20px',
                      borderRadius: 9,
                      cursor:
                        savingAction !== null || selected.approved
                          ? 'not-allowed'
                          : 'pointer',
                      background: selected.approved ? '#8A8A8E' : '#34C759',
                      border: '1.5px solid',
                      borderColor: selected.approved ? '#8A8A8E' : '#34C759',
                      color: '#fff',
                      boxShadow: selected.approved
                        ? 'none'
                        : '0 2px 8px rgba(52,199,89,0.3)',
                      opacity: savingAction !== null ? 0.6 : 1,
                    }}
                  >
                    {selected.approved
                      ? '✓ Já aprovado'
                      : savingAction === 'approve'
                        ? 'Aprovando…'
                        : '✓ Aprovar Plano'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
