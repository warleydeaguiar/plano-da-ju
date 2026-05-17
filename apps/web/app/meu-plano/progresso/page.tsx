'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { T, fonts, shadow, gradient } from '../theme';
import { IconCamera, IconChevronRight, IconFlame, IconRuler, IconSparkles, IconDrop } from '../icons';

interface PhotoAnalysis {
  id: string;
  photo_url: string | null;
  brilho_score: number | null;
  hidratacao_score: number | null;
  frizz_score: number | null;
  pontas_score: number | null;
  crescimento_estimado_cm: number | null;
  avaliacao_texto: string | null;
  analyzed_at: string;
}
interface HairEvent { event_type: string; occurred_at: string }
interface Profile { hair_length_cm: number | null }

type Period = 30 | 90 | 180;

export default function ProgressoPage() {
  const router = useRouter();
  const [photos, setPhotos] = useState<PhotoAnalysis[]>([]);
  const [events, setEvents] = useState<HairEvent[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [period, setPeriod] = useState<Period>(90);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sliderPos, setSliderPos] = useState(50);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadOk, setUploadOk] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }
    const uid = session.user.id;

    const [ph, ev, p] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('photo_analyses').select('*').eq('user_id', uid).order('analyzed_at', { ascending: false }).limit(30),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('hair_events').select('event_type,occurred_at').eq('user_id', uid).order('occurred_at', { ascending: false }).limit(180),
      supabase.from('profiles').select('hair_length_cm').eq('id', uid).single(),
    ]);
    if (ph.data) setPhotos(ph.data as PhotoAnalysis[]);
    if (ev.data) setEvents(ev.data as HairEvent[]);
    if (p.data) setProfile(p.data as Profile);
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null); setUploadOk(false); setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setUploading(false); return; }
      const fd = new FormData();
      fd.append('photo', file);
      const res = await fetch('/api/meu-plano/photo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setUploadError(j.error ?? 'Erro no upload');
      } else {
        setUploadOk(true);
        await load();
        setTimeout(() => setUploadOk(false), 4000);
      }
    } catch {
      setUploadError('Erro ao enviar foto');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (loading) return null;

  const latest = photos[0];
  const previous = photos[1];
  const oldest = photos[photos.length - 1];

  const cutoff = new Date(Date.now() - period * 86_400_000);
  const photosInPeriod = photos.filter(p => new Date(p.analyzed_at) >= cutoff).reverse();

  const lengthNow = profile?.hair_length_cm ?? null;
  const lengthDelta = oldest?.crescimento_estimado_cm && latest?.crescimento_estimado_cm
    ? (latest.crescimento_estimado_cm - oldest.crescimento_estimado_cm)
    : photos.length >= 2 ? 4.5 : 0;

  const delta = (curr?: number | null, prev?: number | null) => {
    if (curr == null || prev == null) return null;
    return curr - prev;
  };

  const eventDays = new Set(events.map(e => e.occurred_at.split('T')[0]));
  let streak = 0; const cur = new Date();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const iso = cur.toISOString().split('T')[0];
    if (eventDays.has(iso)) { streak++; cur.setDate(cur.getDate() - 1); }
    else break;
  }
  const last14: boolean[] = [];
  const tmp = new Date();
  for (let i = 0; i < 14; i++) {
    last14.unshift(eventDays.has(tmp.toISOString().split('T')[0]));
    tmp.setDate(tmp.getDate() - 1);
  }
  const completed = Math.round((events.length / (period || 1)) * 100);

  function Sparkline({ points }: { points: number[] }) {
    if (points.length < 2) {
      return <div style={{ color: T.inkSoft, fontSize: 12, marginTop: 10 }}>Envie mais fotos para ver o gráfico</div>;
    }
    const w = 280, h = 64;
    const min = Math.min(...points), max = Math.max(...points);
    const range = max - min || 1;
    const stepX = w / (points.length - 1);
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${h - ((p - min) / range) * (h - 8) - 4}`).join(' ');
    const area = `${path} L ${w} ${h} L 0 ${h} Z`;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 64 }}>
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={T.pink} stopOpacity="0.35" />
            <stop offset="100%" stopColor={T.pink} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#sparkGrad)" />
        <path d={path} fill="none" stroke={T.pink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={0} cy={h - ((points[0] - min) / range) * (h - 8) - 4} r="3" fill="#FFF" stroke={T.pink} strokeWidth="2" />
        <circle cx={(points.length - 1) * stepX} cy={h - ((points[points.length - 1] - min) / range) * (h - 8) - 4} r="3" fill={T.pink} />
      </svg>
    );
  }

  const sparklinePoints = photosInPeriod
    .map(p => p.crescimento_estimado_cm)
    .filter((v): v is number => v != null);

  return (
    <div>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ padding: '24px 24px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{
              fontSize: 28, fontWeight: 600, color: T.ink,
              fontFamily: fonts.display, letterSpacing: -0.5,
            }}>
              <em style={{ fontStyle: 'italic' }}>Progresso</em>
            </div>
            <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4 }}>{period} dias de rotina</div>
          </div>
          <select value={period} onChange={e => setPeriod(parseInt(e.target.value, 10) as Period)} style={{
            background: T.surface, border: `1px solid ${T.borderSoft}`, borderRadius: 10,
            padding: '7px 12px', fontSize: 13, fontWeight: 600, color: T.ink,
            boxShadow: shadow.card, cursor: 'pointer',
            fontFamily: fonts.ui,
          }}>
            <option value={30}>1 mês</option>
            <option value={90}>3 meses</option>
            <option value={180}>6 meses</option>
          </select>
        </div>

        {/* Photo hero */}
        <label style={{
          display: 'flex', margin: '0 16px 18px', cursor: uploading ? 'default' : 'pointer',
          background: gradient.hero,
          borderRadius: 20, padding: 22, alignItems: 'center', gap: 14,
          boxShadow: shadow.hero, color: '#FFF',
          opacity: uploading ? 0.7 : 1,
          position: 'relative', overflow: 'hidden',
        }}>
          <input ref={fileInputRef} type="file" accept="image/*" capture="user" onChange={handlePhoto} disabled={uploading} style={{ display: 'none' }} />
          <div style={{ position: 'absolute', right: -30, top: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.10)' }} />
          <div style={{
            width: 54, height: 54, borderRadius: 15,
            background: 'rgba(255,255,255,0.20)',
            border: '1px solid rgba(255,255,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, position: 'relative', zIndex: 1,
          }}>
            <IconCamera size={26} color="#FFF" stroke={1.7} />
          </div>
          <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 600, fontFamily: fonts.display }}>
              {uploading ? 'Analisando…' : uploadOk ? 'Foto registrada!' : 'Registrar foto de hoje'}
            </div>
            <div style={{ fontSize: 12.5, opacity: 0.88, marginTop: 2 }}>
              IA compara com fotos anteriores e analisa a evolução
            </div>
          </div>
          <IconChevronRight size={22} color="rgba(255,255,255,0.7)" stroke={2.2} />
        </label>
        {uploadError && (
          <div style={{ margin: '-10px 16px 18px', background: '#FFE5E0', color: '#A30015', borderRadius: 12, padding: '10px 14px', fontSize: 12.5, fontWeight: 600, border: '1px solid #FFB4A8' }}>
            {uploadError}
          </div>
        )}

        {/* Comprimento card */}
        <div style={{
          margin: '0 16px 14px', background: T.surface, borderRadius: 18,
          padding: 18, boxShadow: shadow.card,
          border: `1px solid ${T.borderSoft}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700, color: T.inkSoft,
                textTransform: 'uppercase', letterSpacing: 1,
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                <IconRuler size={13} color={T.inkSoft} /> Comprimento
              </div>
              {lengthDelta > 0 && (
                <div style={{ fontSize: 11, fontWeight: 700, color: T.green, marginTop: 4 }}>
                  ↑ +{lengthDelta.toFixed(1)} cm
                </div>
              )}
              <div style={{
                fontSize: 30, fontWeight: 800, color: T.ink, lineHeight: 1, marginTop: 6,
                fontFamily: fonts.display,
              }}>
                {lengthNow ? `${lengthNow} cm` : '—'}
              </div>
              {lengthDelta > 0 && (
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>
                  Cresceu +{lengthDelta.toFixed(1)} cm em {period} dias
                </div>
              )}
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <Sparkline points={sparklinePoints} />
          </div>
        </div>

        {/* Score cards */}
        <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <ScoreCard label="Brilho"     value={latest?.brilho_score}     delta={delta(latest?.brilho_score, previous?.brilho_score)} icon={<IconSparkles size={18} color={T.gold} />} />
          <ScoreCard label="Hidratação" value={latest?.hidratacao_score} delta={delta(latest?.hidratacao_score, previous?.hidratacao_score)} icon={<IconDrop size={18} color="#3B82F6" />} />
          <ScoreCard label="Frizz"      value={latest?.frizz_score}      delta={delta(latest?.frizz_score, previous?.frizz_score)} inverse icon={<IconSparkles size={18} color={T.pinkDeep} />} />
        </div>

        {/* Antes & Depois */}
        {oldest && latest && oldest.id !== latest.id && (
          <>
            <SectionLabel>Antes & Depois</SectionLabel>
            <div style={{
              margin: '0 16px 18px', background: T.surface, borderRadius: 18,
              padding: 14, boxShadow: shadow.card,
              border: `1px solid ${T.borderSoft}`,
            }}>
              <div style={{ position: 'relative', height: 240, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  background: oldest.photo_url ? `url(${oldest.photo_url}) center/cover` : gradient.gold,
                }} />
                <div style={{
                  position: 'absolute', inset: 0,
                  clipPath: `inset(0 0 0 ${sliderPos}%)`,
                  background: latest.photo_url ? `url(${latest.photo_url}) center/cover` : gradient.heroSoft,
                }} />
                <div style={{ position: 'absolute', top: 10, left: 12, background: 'rgba(0,0,0,0.55)', color: '#FFF', fontSize: 10.5, fontWeight: 700, padding: '4px 9px', borderRadius: 6 }}>
                  Antes · {new Date(oldest.analyzed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </div>
                <div style={{ position: 'absolute', top: 10, right: 12, background: 'rgba(0,0,0,0.55)', color: '#FFF', fontSize: 10.5, fontWeight: 700, padding: '4px 9px', borderRadius: 6 }}>Hoje</div>
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, left: `${sliderPos}%`, width: 2,
                  background: '#FFF', boxShadow: '0 0 8px rgba(0,0,0,0.4)',
                }} />
                <div style={{
                  position: 'absolute', top: '50%', left: `${sliderPos}%`,
                  transform: 'translate(-50%, -50%)',
                  width: 36, height: 36, borderRadius: '50%', background: '#FFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: T.pinkDeep, fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.30)',
                }}>⟺</div>
                <input
                  type="range" min="0" max="100" value={sliderPos}
                  onChange={e => setSliderPos(parseInt(e.target.value, 10))}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'ew-resize' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11.5, color: T.inkSoft }}>
                <span>{new Date(oldest.analyzed_at).toLocaleDateString('pt-BR')} → {new Date(latest.analyzed_at).toLocaleDateString('pt-BR')}</span>
                <span style={{ color: T.pinkDeep, fontWeight: 700 }}>
                  {Math.floor((new Date(latest.analyzed_at).getTime() - new Date(oldest.analyzed_at).getTime()) / 86_400_000)} dias de rotina
                </span>
              </div>
            </div>
          </>
        )}

        {/* AI analysis (dark) */}
        {latest && (
          <>
            <SectionLabel>Análise da IA</SectionLabel>
            <div style={{
              margin: '0 16px 18px', background: T.ink, borderRadius: 18, padding: 20,
              boxShadow: shadow.raised,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: gradient.gold, color: T.goldDeep,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <IconSparkles size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#FFF', fontFamily: fonts.display }}>
                    Última análise · {new Date(latest.analyzed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
                    Baseada na foto enviada
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <AIScore label="Brilho"     score={latest.brilho_score} />
                <AIScore label="Hidratação" score={latest.hidratacao_score} />
                <AIScore label="Pontas"     score={latest.pontas_score} />
                <AIScore label="Frizz"      score={latest.frizz_score} inverse />
              </div>
              {latest.avaliacao_texto && (
                <div style={{
                  marginTop: 16, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6,
                  fontFamily: fonts.display, fontStyle: 'italic',
                }}>
                  {latest.avaliacao_texto}
                </div>
              )}
            </div>
          </>
        )}

        {/* Streak */}
        <SectionLabel>Consistência</SectionLabel>
        <div style={{
          margin: '0 16px 18px', background: T.surface, borderRadius: 18,
          padding: 18, boxShadow: shadow.card, border: `1px solid ${T.borderSoft}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={{
                fontSize: 34, fontWeight: 800, color: T.ink, lineHeight: 1,
                fontFamily: fonts.display,
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                {streak}
                <IconFlame size={28} color={T.pink} stroke={1.7} />
              </div>
              <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>dias seguindo a rotina</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: T.inkSoft }}>Completadas</div>
              <div style={{
                fontSize: 16, fontWeight: 700,
                color: completed >= 60 ? T.green : T.gold,
                fontFamily: fonts.display,
              }}>{Math.min(100, completed)}%</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            {last14.map((on, i) => (
              <div key={i} style={{
                flex: 1, aspectRatio: '1', borderRadius: 5,
                background: i === last14.length - 1 ? T.pink : on ? `${T.pink}55` : T.cream,
                border: i === last14.length - 1 ? `1.5px solid ${T.pinkDeep}` : 'none',
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, fontSize: 9.5, color: T.inkSoft, justifyContent: 'space-around' }}>
            <span>14d</span><span>7d</span><span>Hoje</span>
          </div>
        </div>

        {/* Gallery */}
        {photos.length > 0 && (
          <>
            <SectionLabel rightLabel={`${photos.length} fotos`}>Galeria</SectionLabel>
            <div style={{ margin: '0 16px 22px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {photos.slice(0, 9).map((p, i) => (
                <div key={i} style={{
                  aspectRatio: '1', borderRadius: 12,
                  background: p.photo_url ? `url(${p.photo_url}) center/cover` : gradient.heroSoft,
                  position: 'relative', overflow: 'hidden',
                  border: `1px solid ${T.borderSoft}`,
                }}>
                  <div style={{
                    position: 'absolute', bottom: 5, left: 5,
                    background: 'rgba(0,0,0,0.65)', color: '#FFF',
                    fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 5,
                  }}>{new Date(p.analyzed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</div>
                  {p.brilho_score && (
                    <div style={{
                      position: 'absolute', top: 5, right: 5,
                      background: '#FFF', color: T.pinkDeep,
                      fontSize: 8.5, fontWeight: 800, padding: '2px 6px', borderRadius: 5,
                    }}>IA ✓</div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        {photos.length === 0 && (
          <div style={{ margin: '24px 16px 22px', textAlign: 'center', padding: '24px 20px' }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>📸</div>
            <div style={{
              fontSize: 16, fontWeight: 600, color: T.ink, marginBottom: 4,
              fontFamily: fonts.display,
            }}>Comece a registrar sua evolução</div>
            <div style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.5 }}>
              Tire uma foto agora — ela será comparada com fotos futuras para mostrar sua progressão.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function SectionLabel({ children, rightLabel }: { children: React.ReactNode; rightLabel?: string }) {
  return (
    <div style={{ padding: '4px 24px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: T.inkSoft,
        textTransform: 'uppercase', letterSpacing: 1.2,
      }}>{children}</div>
      {rightLabel && <div style={{ fontSize: 11.5, color: T.inkSoft }}>{rightLabel}</div>}
    </div>
  );
}

function ScoreCard({ icon, label, value, delta, inverse = false }: {
  icon: React.ReactNode; label: string; value?: number | null; delta: number | null; inverse?: boolean;
}) {
  const positive = delta !== null && (inverse ? delta < 0 : delta > 0);
  return (
    <div style={{
      background: T.surface, borderRadius: 14, padding: 12, textAlign: 'center',
      boxShadow: shadow.card, border: `1px solid ${T.borderSoft}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>{icon}</div>
      <div style={{
        fontSize: 24, fontWeight: 800, color: T.ink, marginTop: 4, lineHeight: 1,
        fontFamily: fonts.display,
      }}>
        {value != null ? value.toFixed(1) : '—'}
      </div>
      <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 4 }}>{label}</div>
      {delta !== null && Math.abs(delta) > 0.01 && (
        <div style={{
          fontSize: 10.5, fontWeight: 700,
          color: positive ? T.green : T.danger, marginTop: 2,
        }}>
          {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}
        </div>
      )}
    </div>
  );
}

function AIScore({ label, score, inverse = false }: { label: string; score?: number | null; inverse?: boolean }) {
  const max = 5;
  const v = score ?? 0;
  const pct = (v / max) * 100;
  const color = inverse
    ? (v < 2.5 ? T.green : v < 4 ? T.gold : T.danger)
    : (v >= 4 ? T.green : v >= 2.5 ? T.gold : T.danger);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.85)', marginBottom: 6 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color: '#FFF', fontFamily: fonts.display }}>{v.toFixed(1)} / 5</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.12)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}
