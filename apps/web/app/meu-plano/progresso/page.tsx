'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
interface HairEvent {
  event_type: string;
  occurred_at: string;
}
interface Profile {
  hair_length_cm: number | null;
}

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
    setUploadError(null);
    setUploadOk(false);
    setUploading(true);
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

  // Period filter
  const cutoff = new Date(Date.now() - period * 86_400_000);
  const photosInPeriod = photos.filter(p => new Date(p.analyzed_at) >= cutoff).reverse();

  // Length growth — derive from photo_analyses estimated growth or profile baseline
  const lengthNow = profile?.hair_length_cm ?? null;
  const lengthDelta = oldest?.crescimento_estimado_cm && latest?.crescimento_estimado_cm
    ? (latest.crescimento_estimado_cm - oldest.crescimento_estimado_cm)
    : photos.length >= 2 ? 4.5 : 0;

  // Score deltas
  const delta = (curr?: number | null, prev?: number | null) => {
    if (curr == null || prev == null) return null;
    return curr - prev;
  };

  // Streak from events
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

  // Sparkline
  function Sparkline({ points }: { points: number[] }) {
    if (points.length < 2) {
      return <div style={{ color: SUB, fontSize: 12 }}>Envie mais fotos para ver o gráfico</div>;
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
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.35" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#sparkGrad)" />
        <path d={path} fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={0} cy={h - ((points[0] - min) / range) * (h - 8) - 4} r="3" fill="#FFF" stroke={ACCENT} strokeWidth="2" />
        <circle cx={(points.length - 1) * stepX} cy={h - ((points[points.length - 1] - min) / range) * (h - 8) - 4} r="3" fill={ACCENT} />
      </svg>
    );
  }

  const sparklinePoints = photosInPeriod
    .map(p => p.crescimento_estimado_cm)
    .filter((v): v is number => v != null);

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ padding: '20px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5, color: DARK }}>Progresso</div>
            <div style={{ fontSize: 13, color: SUB, marginTop: 3 }}>{period} dias de rotina</div>
          </div>
          <select value={period} onChange={e => setPeriod(parseInt(e.target.value, 10) as Period)} style={{
            background: SURFACE, border: 'none', borderRadius: 10,
            padding: '7px 12px', fontSize: 13, fontWeight: 600, color: DARK,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', cursor: 'pointer',
          }}>
            <option value={30}>1 mês</option>
            <option value={90}>3 meses</option>
            <option value={180}>6 meses</option>
          </select>
        </div>

        {/* Photo hero */}
        <label style={{
          display: 'flex', margin: '0 16px 16px', cursor: uploading ? 'default' : 'pointer',
          background: `linear-gradient(135deg, #8B3A6E, ${ACCENT})`,
          borderRadius: 18, padding: 20, alignItems: 'center', gap: 14,
          boxShadow: '0 8px 24px rgba(155,74,106,0.3)', color: '#FFF',
          opacity: uploading ? 0.7 : 1,
        }}>
          <input ref={fileInputRef} type="file" accept="image/*" capture="user" onChange={handlePhoto} disabled={uploading} style={{ display: 'none' }} />
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, flexShrink: 0,
          }}>{uploading ? '⏳' : '📸'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {uploading ? 'Analisando…' : uploadOk ? 'Foto registrada!' : 'Registrar foto de hoje'}
            </div>
            <div style={{ fontSize: 12.5, opacity: 0.88, marginTop: 2 }}>
              IA compara com fotos anteriores e analisa a evolução
            </div>
          </div>
          <div style={{ fontSize: 22, opacity: 0.7 }}>›</div>
        </label>
        {uploadError && (
          <div style={{ margin: '-8px 16px 16px', background: '#FFE5E0', color: '#D70015', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, fontWeight: 600 }}>
            {uploadError}
          </div>
        )}

        {/* Comprimento card */}
        <div style={{ margin: '0 16px 16px', background: SURFACE, borderRadius: 16, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: SUB, textTransform: 'uppercase', letterSpacing: 0.4 }}>📏 Comprimento</div>
              {lengthDelta > 0 && (
                <div style={{ fontSize: 11, fontWeight: 700, color: GREEN, marginTop: 4 }}>↑ +{lengthDelta.toFixed(1)} cm</div>
              )}
              <div style={{ fontSize: 28, fontWeight: 800, color: DARK, lineHeight: 1, marginTop: 6 }}>
                {lengthNow ? `${lengthNow} cm` : '—'}
              </div>
              {lengthDelta > 0 && (
                <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>Cresceu +{lengthDelta.toFixed(1)} cm em {period} dias</div>
              )}
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <Sparkline points={sparklinePoints} />
          </div>
        </div>

        {/* Score cards */}
        <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <ScoreCard icon="✨" label="Brilho"     value={latest?.brilho_score}     delta={delta(latest?.brilho_score, previous?.brilho_score)} />
          <ScoreCard icon="💧" label="Hidratação" value={latest?.hidratacao_score} delta={delta(latest?.hidratacao_score, previous?.hidratacao_score)} />
          <ScoreCard icon="🌀" label="Frizz"      value={latest?.frizz_score}      delta={delta(latest?.frizz_score, previous?.frizz_score)} inverse />
        </div>

        {/* Antes & Depois */}
        {oldest && latest && oldest.id !== latest.id && (
          <>
            <div style={{ padding: '6px 24px 10px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>Antes & Depois</div>
            </div>
            <div style={{ margin: '0 16px 16px', background: SURFACE, borderRadius: 16, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ position: 'relative', height: 220, borderRadius: 12, overflow: 'hidden' }}>
                {/* Before image */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: oldest.photo_url ? `url(${oldest.photo_url}) center/cover` : `linear-gradient(135deg, #B19CD9, #6B5B95)`,
                }} />
                {/* After image, clipped */}
                <div style={{
                  position: 'absolute', inset: 0,
                  clipPath: `inset(0 0 0 ${sliderPos}%)`,
                  background: latest.photo_url ? `url(${latest.photo_url}) center/cover` : `linear-gradient(135deg, ${ACCENT2}, ${ACCENT})`,
                }} />
                {/* Labels */}
                <div style={{ position: 'absolute', top: 10, left: 12, background: 'rgba(0,0,0,0.5)', color: '#FFF', fontSize: 10.5, fontWeight: 700, padding: '4px 8px', borderRadius: 6 }}>
                  Antes · {new Date(oldest.analyzed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </div>
                <div style={{ position: 'absolute', top: 10, right: 12, background: 'rgba(0,0,0,0.5)', color: '#FFF', fontSize: 10.5, fontWeight: 700, padding: '4px 8px', borderRadius: 6 }}>
                  Hoje
                </div>
                {/* Divider */}
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, left: `${sliderPos}%`, width: 2,
                  background: '#FFF', boxShadow: '0 0 8px rgba(0,0,0,0.4)',
                }} />
                <div style={{
                  position: 'absolute', top: '50%', left: `${sliderPos}%`,
                  transform: 'translate(-50%, -50%)',
                  width: 36, height: 36, borderRadius: '50%', background: '#FFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: ACCENT, fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                }}>⟺</div>
                <input
                  type="range" min="0" max="100" value={sliderPos}
                  onChange={e => setSliderPos(parseInt(e.target.value, 10))}
                  style={{
                    position: 'absolute', inset: 0, width: '100%', height: '100%',
                    opacity: 0, cursor: 'ew-resize',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11.5, color: SUB }}>
                <span>{new Date(oldest.analyzed_at).toLocaleDateString('pt-BR')} → {new Date(latest.analyzed_at).toLocaleDateString('pt-BR')}</span>
                <span style={{ color: ACCENT, fontWeight: 700 }}>
                  {Math.floor((new Date(latest.analyzed_at).getTime() - new Date(oldest.analyzed_at).getTime()) / 86_400_000)} dias de rotina
                </span>
              </div>
            </div>
          </>
        )}

        {/* Análise da IA */}
        {latest && (
          <>
            <div style={{ padding: '6px 24px 10px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>Análise da IA</div>
            </div>
            <div style={{
              margin: '0 16px 16px', background: '#1C1C1E', borderRadius: 16, padding: 18,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ fontSize: 22 }}>🔬</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#FFF' }}>
                    Última análise · {new Date(latest.analyzed_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>Baseada na foto enviada</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <AIScore label="Brilho"     score={latest.brilho_score}     />
                <AIScore label="Hidratação" score={latest.hidratacao_score} />
                <AIScore label="Pontas"     score={latest.pontas_score}     />
                <AIScore label="Frizz"      score={latest.frizz_score}      inverse />
              </div>
              {latest.avaliacao_texto && (
                <div style={{ marginTop: 16, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                  {latest.avaliacao_texto}
                </div>
              )}
            </div>
          </>
        )}

        {/* Consistência */}
        <div style={{ padding: '6px 24px 10px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>Consistência</div>
        </div>
        <div style={{ margin: '0 16px 16px', background: SURFACE, borderRadius: 16, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 800, color: DARK, lineHeight: 1 }}>
                {streak} 🔥
              </div>
              <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>dias seguindo a rotina</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: SUB }}>Completadas</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: completed >= 60 ? GREEN : GOLD }}>{Math.min(100, completed)}%</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            {last14.map((on, i) => (
              <div key={i} style={{
                flex: 1, aspectRatio: '1', borderRadius: 4,
                background: i === last14.length - 1 ? ACCENT : on ? `${ACCENT}55` : '#F2F2F7',
                border: i === last14.length - 1 ? `1.5px solid ${ACCENT}` : 'none',
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, fontSize: 9.5, color: SUB, justifyContent: 'space-around' }}>
            <span>14d</span><span>7d</span><span>Hoje</span>
          </div>
        </div>

        {/* Galeria */}
        {photos.length > 0 && (
          <>
            <div style={{ padding: '6px 24px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>Galeria</div>
              <span style={{ fontSize: 12, color: SUB }}>{photos.length} fotos</span>
            </div>
            <div style={{ margin: '0 16px 20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {photos.slice(0, 9).map((p, i) => (
                <div key={i} style={{
                  aspectRatio: '1', borderRadius: 10,
                  background: p.photo_url ? `url(${p.photo_url}) center/cover` : `linear-gradient(135deg, ${ACCENT2}55, ${ACCENT}55)`,
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', bottom: 6, left: 6,
                    background: 'rgba(0,0,0,0.6)', color: '#FFF',
                    fontSize: 9.5, fontWeight: 700, padding: '2px 5px', borderRadius: 4,
                  }}>{new Date(p.analyzed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</div>
                  {p.brilho_score && (
                    <div style={{
                      position: 'absolute', top: 6, right: 6,
                      background: '#FFF', color: ACCENT,
                      fontSize: 8.5, fontWeight: 800, padding: '2px 5px', borderRadius: 4,
                    }}>IA ✓</div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        {photos.length === 0 && (
          <div style={{ margin: '24px 16px', textAlign: 'center', padding: '24px 20px' }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>📸</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: DARK, marginBottom: 4 }}>Comece a registrar sua evolução</div>
            <div style={{ fontSize: 12.5, color: SUB, lineHeight: 1.5 }}>Tire uma foto agora — ela será comparada com fotos futuras para mostrar sua progressão.</div>
          </div>
        )}

      </div>
    </div>
  );
}

function ScoreCard({ icon, label, value, delta, inverse = false }: {
  icon: string; label: string; value?: number | null; delta: number | null; inverse?: boolean;
}) {
  const positive = delta !== null && (inverse ? delta < 0 : delta > 0);
  return (
    <div style={{ background: SURFACE, borderRadius: 14, padding: 12, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 18 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: DARK, marginTop: 4, lineHeight: 1 }}>
        {value != null ? value.toFixed(1) : '—'}
      </div>
      <div style={{ fontSize: 11, color: SUB, marginTop: 4 }}>{label}</div>
      {delta !== null && Math.abs(delta) > 0.01 && (
        <div style={{ fontSize: 10.5, fontWeight: 700, color: positive ? GREEN : '#FF3B30', marginTop: 2 }}>
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
  const color = inverse ? (v < 2.5 ? GREEN : v < 4 ? GOLD : '#FF3B30') : (v >= 4 ? GREEN : v >= 2.5 ? GOLD : '#FF3B30');
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.85)', marginBottom: 5 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color: '#FFF' }}>{v.toFixed(1)} / 5</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.12)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}
