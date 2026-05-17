'use client';

import { useState, useMemo } from 'react';

const accent = '#C4607A';
const accent2 = '#9B4A6A';
const dark = '#1C1C1E';
const gray = '#8A8A8E';
const green = '#34C759';
const red = '#FF3B30';

interface Story {
  id: string;
  title: string;
  description: string;
  media_type: 'video' | 'audio';
  media_url: string;
  cover_image_url: string | null;
  youtube_video_id?: string | null;
  target_hair_types: string[];
  target_problems: string[];
  target_porosity: string[];
  target_chemicals: string[];
  trigger_phase: string;
  trigger_day_min: number;
  trigger_day_max: number | null;
  priority: number;
  active: boolean;
  view_count: number;
  created_at: string;
}

const HAIR_TYPES  = ['liso', 'ondulado', 'cacheado', 'crespo'];
const PROBLEMS    = ['queda', 'frizz', 'ressecamento', 'oleosidade', 'pontas', 'crescimento', 'brilho', 'quimica', 'caspa'];
const POROSITIES  = ['baixa', 'media', 'alta'];
const CHEMICALS   = ['nenhuma', 'coloracao', 'mechas', 'progressiva', 'relaxamento'];
const PHASES      = [
  { value: 'plan_delivery', label: 'Na entrega do plano' },
  { value: 'ongoing',       label: 'Durante o uso' },
  { value: 'milestone',     label: 'Após marco' },
  { value: 'any',           label: 'Sempre' },
];

// ─── YouTube helpers (client-side) ────────────────────────────────
function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0] || null;
    const v = u.searchParams.get('v');
    if (v) return v;
    const m = u.pathname.match(/\/(shorts|embed|v)\/([^/?&]+)/);
    if (m?.[2]) return m[2];
  } catch { /* noop */ }
  return null;
}

function thumbnailUrl(videoId: string) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
function watchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

// ─── Form type ────────────────────────────────────────────────────
type FormState = {
  title: string;
  description: string;
  youtube_url: string;
  priority: string;
  ai_assist: boolean;
  target_hair_types: string;
  target_problems: string;
  target_porosity: string;
  target_chemicals: string;
  trigger_phase: string;
  trigger_day_min: string;
  trigger_day_max: string;
};

const EMPTY_FORM: FormState = {
  title: '', description: '', youtube_url: '', priority: '0',
  ai_assist: true,
  target_hair_types: '', target_problems: '', target_porosity: '', target_chemicals: '',
  trigger_phase: '', trigger_day_min: '', trigger_day_max: '',
};

// ─── YouTube Preview ──────────────────────────────────────────────
function YouTubePreview({ videoId }: { videoId: string }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{
        borderRadius: 10, overflow: 'hidden', position: 'relative',
        paddingBottom: '56.25%', height: 0, background: '#000',
        border: `1.5px solid ${green}40`,
      }}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            border: 'none',
          }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="Preview do vídeo"
        />
      </div>
      <div style={{
        marginTop: 6, fontSize: 11, color: green, fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        ✓ Vídeo válido ·{' '}
        <a
          href={watchUrl(videoId)}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: green, textDecoration: 'underline' }}
        >
          abrir no YouTube
        </a>
      </div>
    </div>
  );
}

// ─── Story Card ────────────────────────────────────────────────────
function StoryCard({
  story,
  onDelete,
  onToggleActive,
}: {
  story: Story;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
}) {
  const videoId = story.youtube_video_id
    ?? (story.media_url ? parseYouTubeId(story.media_url.replace('/embed/', '/watch?v=')) : null);

  const thumb = story.cover_image_url
    ?? (videoId ? thumbnailUrl(videoId) : null);

  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '16px 20px',
      border: '1px solid rgba(0,0,0,0.06)',
      display: 'flex', gap: 16, alignItems: 'flex-start',
    }}>
      {/* Thumbnail */}
      <a
        href={videoId ? watchUrl(videoId) : story.media_url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          width: 100, height: 60, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
          background: thumb ? `url(${thumb}) center/cover` : `linear-gradient(135deg, ${accent2}, ${accent})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, color: '#fff', textDecoration: 'none', position: 'relative',
        }}
      >
        {!thumb && '🎬'}
        {thumb && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(255,255,255,0.9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 0, height: 0,
                borderTop: '6px solid transparent',
                borderBottom: '6px solid transparent',
                borderLeft: `10px solid ${accent}`,
                marginLeft: 2,
              }} />
            </div>
          </div>
        )}
      </a>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: 14.5, fontWeight: 700, color: dark, margin: 0 }}>{story.title}</h3>
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: story.active ? green : gray,
            background: story.active ? '#E8F8EF' : '#F5F5F7',
            borderRadius: 4, padding: '2px 6px',
          }}>
            {story.active ? 'ATIVA' : 'INATIVA'}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600, color: '#FF0000',
            background: '#FF000012', borderRadius: 4, padding: '2px 6px',
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            ▶ YouTube
          </span>
        </div>
        <p style={{ fontSize: 12.5, color: gray, margin: '0 0 7px', lineHeight: 1.45 }}>
          {story.description.length > 140 ? story.description.slice(0, 140) + '…' : story.description}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {story.target_hair_types.map(t => <Tag key={t} color="#C4607A">{t}</Tag>)}
          {story.target_problems.map(t => <Tag key={t} color="#FF9500">{t}</Tag>)}
          {story.target_porosity.map(t => <Tag key={t} color="#007AFF">{t} porosidade</Tag>)}
          {story.target_chemicals.map(t => <Tag key={t} color="#5856D6">{t}</Tag>)}
          {story.target_hair_types.length + story.target_problems.length + story.target_porosity.length + story.target_chemicals.length === 0 && (
            <Tag color={gray}>qualquer perfil</Tag>
          )}
        </div>
        <div style={{ fontSize: 11, color: gray, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span>📍 {PHASES.find(p => p.value === story.trigger_phase)?.label ?? story.trigger_phase}</span>
          <span>⏱️ {story.trigger_day_min}–{story.trigger_day_max ?? '∞'} dias</span>
          <span>👁️ {story.view_count} visualizações</span>
          <span>⭐ prioridade {story.priority}</span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
        {videoId && (
          <a
            href={watchUrl(videoId)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 11.5, color: '#FF0000', textDecoration: 'none', fontWeight: 600 }}
          >
            ▶ Ver no YouTube
          </a>
        )}
        <button
          onClick={() => onToggleActive(story.id, !story.active)}
          style={{
            background: 'transparent', border: 'none',
            color: story.active ? gray : green,
            fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0,
          }}
        >
          {story.active ? 'Desativar' : 'Ativar'}
        </button>
        <button
          onClick={() => onDelete(story.id)}
          style={{
            background: 'transparent', border: 'none', color: red,
            fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0,
          }}
        >
          Deletar
        </button>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────
export default function StoriesClient({ initialStories }: { initialStories: Story[] }) {
  const [stories, setStories] = useState(initialStories);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Live YouTube preview
  const previewVideoId = useMemo(() => {
    if (!form.youtube_url.trim()) return null;
    return parseYouTubeId(form.youtube_url);
  }, [form.youtube_url]);

  function update(field: keyof FormState, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!previewVideoId) {
      setMessage({ type: 'error', text: 'Link do YouTube inválido.' });
      return;
    }
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          youtube_url: form.youtube_url,
          priority: form.priority,
          ai_assist: form.ai_assist,
          target_hair_types: form.target_hair_types,
          target_problems: form.target_problems,
          target_porosity: form.target_porosity,
          target_chemicals: form.target_chemicals,
          trigger_phase: form.trigger_phase || undefined,
          trigger_day_min: form.trigger_day_min ? Number(form.trigger_day_min) : undefined,
          trigger_day_max: form.trigger_day_max ? Number(form.trigger_day_max) : undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: j.error ?? 'Erro ao salvar' });
      } else {
        setMessage({ type: 'success', text: `Story salva!${j.ai_targeting ? ' IA sugeriu segmentação automaticamente.' : ''}` });
        setStories(prev => [j.story, ...prev]);
        setForm(EMPTY_FORM);
        setShowForm(false);
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro de rede' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deletar esta story permanentemente?')) return;
    const res = await fetch(`/api/stories?id=${id}`, { method: 'DELETE' });
    if (res.ok) setStories(prev => prev.filter(s => s.id !== id));
  }

  async function handleToggleActive(id: string, active: boolean) {
    setStories(prev => prev.map(s => s.id === id ? { ...s, active } : s));
    await fetch('/api/stories', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active }),
    });
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: dark, margin: '0 0 4px' }}>Stories da Juliane</h1>
          <p style={{ fontSize: 13, color: gray, margin: 0 }}>
            Vídeos do YouTube entregues no app estilo Stories. A IA sugere segmentação com base na descrição.
          </p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} style={{
            background: `linear-gradient(135deg, ${accent2}, ${accent})`,
            color: '#fff', border: 'none', borderRadius: 10,
            padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(196,96,122,0.3)',
          }}>+ Nova Story</button>
        )}
      </div>

      {/* Toast message */}
      {message && (
        <div style={{
          background: message.type === 'success' ? '#E8F8EF' : '#FFE5E0',
          color: message.type === 'success' ? '#0B5132' : '#A30015',
          padding: '12px 16px', borderRadius: 10, marginBottom: 20,
          fontSize: 13, fontWeight: 600,
        }}>
          {message.text}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{
          background: '#fff', borderRadius: 14, padding: '24px 28px', marginBottom: 28,
          border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: dark, marginBottom: 18 }}>Nova Story</h2>

          <Field label="Título" required>
            <input
              required value={form.title}
              onChange={e => update('title', e.target.value)}
              placeholder="Ex: Como lidar com queda nos primeiros 30 dias"
              style={inputStyle}
            />
          </Field>

          <Field label="Descrição (a IA usa isso para sugerir quando mostrar)" required>
            <textarea
              required rows={3}
              value={form.description}
              onChange={e => update('description', e.target.value)}
              placeholder="Ex: Para mulheres com queda nos primeiros 30 dias do plano. Dou 3 dicas sobre massagem no couro cabeludo, alimentação e produtos suaves."
              style={{ ...inputStyle, fontFamily: 'inherit' }}
            />
          </Field>

          {/* YouTube URL */}
          <Field label="Link do YouTube" required>
            <input
              required value={form.youtube_url}
              onChange={e => update('youtube_url', e.target.value)}
              placeholder="https://www.youtube.com/watch?v=… ou https://youtu.be/…"
              style={{
                ...inputStyle,
                borderColor: form.youtube_url
                  ? (previewVideoId ? `${green}80` : `${red}80`)
                  : '#E5E5EA',
              }}
            />
            {form.youtube_url && !previewVideoId && (
              <div style={{ fontSize: 11.5, color: red, marginTop: 4, fontWeight: 500 }}>
                Link não reconhecido. Use: youtube.com/watch?v=ID, youtu.be/ID ou youtube.com/shorts/ID
              </div>
            )}
            {previewVideoId && <YouTubePreview videoId={previewVideoId} />}
          </Field>

          {/* Priority */}
          <div style={{ maxWidth: 200 }}>
            <Field label="Prioridade (maior = aparece antes)">
              <input
                type="number" value={form.priority}
                onChange={e => update('priority', e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>

          {/* AI assist toggle */}
          <div style={{
            background: '#FDE8EE', borderRadius: 10, padding: '12px 14px', marginBottom: 18,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <input
              type="checkbox" id="ai_assist"
              checked={form.ai_assist}
              onChange={e => update('ai_assist', e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="ai_assist" style={{ fontSize: 13, color: dark, cursor: 'pointer' }}>
              <strong>Usar IA para sugerir segmentação</strong> com base na descrição.
              {' '}Você pode preencher abaixo para forçar valores específicos.
            </label>
          </div>

          <details style={{ marginBottom: 18 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: accent, marginBottom: 12 }}>
              Segmentação manual (opcional — sobrescreve a IA)
            </summary>
            <div style={{ padding: '12px 0' }}>
              <Field label="Tipo de cabelo (vírgula separa)">
                <input
                  value={form.target_hair_types}
                  onChange={e => update('target_hair_types', e.target.value)}
                  placeholder={HAIR_TYPES.join(', ')}
                  style={inputStyle}
                />
              </Field>
              <Field label="Problemas">
                <input
                  value={form.target_problems}
                  onChange={e => update('target_problems', e.target.value)}
                  placeholder={PROBLEMS.join(', ')}
                  style={inputStyle}
                />
              </Field>
              <Field label="Porosidade">
                <input
                  value={form.target_porosity}
                  onChange={e => update('target_porosity', e.target.value)}
                  placeholder={POROSITIES.join(', ')}
                  style={inputStyle}
                />
              </Field>
              <Field label="Químicas">
                <input
                  value={form.target_chemicals}
                  onChange={e => update('target_chemicals', e.target.value)}
                  placeholder={CHEMICALS.join(', ')}
                  style={inputStyle}
                />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Field label="Fase">
                  <select
                    value={form.trigger_phase}
                    onChange={e => update('trigger_phase', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">(IA decide)</option>
                    {PHASES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </Field>
                <Field label="Dia min">
                  <input
                    type="number" placeholder="0"
                    value={form.trigger_day_min}
                    onChange={e => update('trigger_day_min', e.target.value)}
                    style={inputStyle}
                  />
                </Field>
                <Field label="Dia max">
                  <input
                    type="number" placeholder="∞"
                    value={form.trigger_day_max}
                    onChange={e => update('trigger_day_max', e.target.value)}
                    style={inputStyle}
                  />
                </Field>
              </div>
            </div>
          </details>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={saving || !previewVideoId} style={{
              background: saving || !previewVideoId
                ? '#ccc'
                : `linear-gradient(135deg, ${accent2}, ${accent})`,
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '10px 22px', fontSize: 14, fontWeight: 700,
              cursor: saving || !previewVideoId ? 'default' : 'pointer',
            }}>
              {saving ? 'Salvando…' : 'Salvar Story'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} style={{
              background: 'transparent', color: gray, border: 'none',
              padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>Cancelar</button>
          </div>
        </form>
      )}

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {stories.length === 0 ? (
          <div style={{
            background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center',
            border: '1px solid rgba(0,0,0,0.06)',
          }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>🎬</div>
            <p style={{ color: gray, fontSize: 14 }}>Nenhuma story cadastrada ainda. Clique em &ldquo;Nova Story&rdquo; para começar.</p>
          </div>
        ) : stories.map(s => (
          <StoryCard
            key={s.id}
            story={s}
            onDelete={handleDelete}
            onToggleActive={handleToggleActive}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Small helpers ─────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: 13,
  border: '1.5px solid #E5E5EA', borderRadius: 8, outline: 'none',
  background: '#fff', color: dark, marginTop: 4, boxSizing: 'border-box',
};

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: gray, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}{required && <span style={{ color: red, marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color, background: `${color}1A`,
      borderRadius: 5, padding: '2px 7px', textTransform: 'capitalize',
    }}>{children}</span>
  );
}
