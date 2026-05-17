'use client';

import { useState, useRef } from 'react';

const accent = '#C4607A';
const accent2 = '#9B4A6A';
const dark = '#1C1C1E';
const gray = '#8A8A8E';
const green = '#34C759';

interface Story {
  id: string;
  title: string;
  description: string;
  media_type: 'video' | 'audio';
  media_url: string;
  cover_image_url: string | null;
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

const HAIR_TYPES  = ['liso','ondulado','cacheado','crespo'];
const PROBLEMS    = ['queda','frizz','ressecamento','oleosidade','pontas','crescimento','brilho','quimica','caspa'];
const POROSITIES  = ['baixa','media','alta'];
const CHEMICALS   = ['nenhuma','coloracao','mechas','progressiva','relaxamento'];
const PHASES      = [
  { value: 'plan_delivery', label: 'Na entrega do plano' },
  { value: 'ongoing',       label: 'Durante o uso' },
  { value: 'milestone',     label: 'Após marco' },
  { value: 'any',           label: 'Sempre' },
];

export default function StoriesClient({ initialStories }: { initialStories: Story[] }) {
  const [stories, setStories] = useState(initialStories);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiAssist, setAiAssist] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);
    setMessage(null);
    const formData = new FormData(e.currentTarget);
    formData.set('ai_assist', String(aiAssist));
    try {
      const res = await fetch('/api/stories', { method: 'POST', body: formData });
      const j = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: j.error ?? 'Erro ao salvar' });
      } else {
        setMessage({ type: 'success', text: `Story salva! ${j.ai_targeting ? 'IA sugeriu segmentação automaticamente.' : ''}` });
        setStories(prev => [j.story, ...prev]);
        formRef.current?.reset();
        setShowForm(false);
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro de rede' });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deletar esta story permanentemente?')) return;
    const res = await fetch(`/api/stories?id=${id}`, { method: 'DELETE' });
    if (res.ok) setStories(prev => prev.filter(s => s.id !== id));
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: dark, margin: '0 0 4px' }}>Stories da Juliane</h1>
          <p style={{ fontSize: 13, color: gray, margin: 0 }}>
            Vídeos e áudios entregues no app estilo Stories. A IA pode sugerir segmentação automaticamente com base na descrição.
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

      {message && (
        <div style={{
          background: message.type === 'success' ? '#E8F8EF' : '#FFE5E0',
          color: message.type === 'success' ? '#0B5132' : '#A30015',
          padding: '12px 16px', borderRadius: 10, marginBottom: 20,
          fontSize: 13, fontWeight: 600,
        }}>{message.text}</div>
      )}

      {/* Upload form */}
      {showForm && (
        <form ref={formRef} onSubmit={handleSubmit} style={{
          background: '#fff', borderRadius: 14, padding: '24px 28px', marginBottom: 28,
          border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: dark, marginBottom: 18 }}>Nova Story</h2>

          <Field label="Título" required>
            <input name="title" required placeholder="Ex: Como lidar com queda nos primeiros 30 dias"
              style={inputStyle} />
          </Field>

          <Field label="Descrição (a IA usa isso para sugerir quando mostrar)" required>
            <textarea name="description" required rows={4}
              placeholder="Ex: Para mulheres sofrendo com queda de cabelo nos primeiros 30 dias do plano. Dou 3 dicas sobre massagem no couro cabeludo, alimentação e produtos suaves."
              style={{ ...inputStyle, fontFamily: 'inherit' }} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Tipo de mídia" required>
              <select name="media_type" required style={inputStyle}>
                <option value="video">🎥 Vídeo (vertical 9:16)</option>
                <option value="audio">🎙️ Áudio</option>
              </select>
            </Field>
            <Field label="Prioridade (maior = aparece antes)">
              <input name="priority" type="number" defaultValue="0" style={inputStyle} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Arquivo de mídia" required>
              <input name="media" type="file" accept="video/*,audio/*" required style={inputStyle} />
            </Field>
            <Field label="Capa (opcional, recomendado para vídeo)">
              <input name="cover" type="file" accept="image/*" style={inputStyle} />
            </Field>
          </div>

          {/* AI assist toggle */}
          <div style={{
            background: '#FDE8EE', borderRadius: 10, padding: '12px 14px', marginBottom: 18,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <input type="checkbox" id="ai_assist" checked={aiAssist}
              onChange={e => setAiAssist(e.target.checked)} style={{ cursor: 'pointer' }} />
            <label htmlFor="ai_assist" style={{ fontSize: 13, color: dark, cursor: 'pointer' }}>
              <strong>Usar IA para sugerir segmentação</strong> com base na descrição.
              {' '}Você pode preencher manualmente abaixo para forçar valores específicos.
            </label>
          </div>

          <details style={{ marginBottom: 18 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: accent, marginBottom: 12 }}>
              Segmentação manual (opcional — sobrescreve a IA)
            </summary>
            <div style={{ padding: '12px 0' }}>
              <Field label="Tipo de cabelo (vírgula separa)">
                <input name="target_hair_types" placeholder={HAIR_TYPES.join(', ')} style={inputStyle} />
              </Field>
              <Field label="Problemas">
                <input name="target_problems" placeholder={PROBLEMS.join(', ')} style={inputStyle} />
              </Field>
              <Field label="Porosidade">
                <input name="target_porosity" placeholder={POROSITIES.join(', ')} style={inputStyle} />
              </Field>
              <Field label="Químicas">
                <input name="target_chemicals" placeholder={CHEMICALS.join(', ')} style={inputStyle} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Field label="Fase">
                  <select name="trigger_phase" defaultValue="" style={inputStyle}>
                    <option value="">(IA decide)</option>
                    {PHASES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </Field>
                <Field label="Dia min">
                  <input name="trigger_day_min" type="number" placeholder="0" style={inputStyle} />
                </Field>
                <Field label="Dia max">
                  <input name="trigger_day_max" type="number" placeholder="∞" style={inputStyle} />
                </Field>
              </div>
            </div>
          </details>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={uploading} style={{
              background: uploading ? '#ccc' : `linear-gradient(135deg, ${accent2}, ${accent})`,
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '10px 22px', fontSize: 14, fontWeight: 700,
              cursor: uploading ? 'default' : 'pointer',
            }}>
              {uploading ? 'Enviando…' : 'Salvar Story'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={{
              background: 'transparent', color: gray, border: 'none',
              padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>Cancelar</button>
          </div>
        </form>
      )}

      {/* Stories list */}
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
          <div key={s.id} style={{
            background: '#fff', borderRadius: 14, padding: '16px 20px',
            border: '1px solid rgba(0,0,0,0.06)',
            display: 'flex', gap: 16,
          }}>
            <div style={{
              width: 60, height: 90, borderRadius: 10, flexShrink: 0,
              background: s.cover_image_url ? `url(${s.cover_image_url}) center/cover` : `linear-gradient(135deg, ${accent2}, ${accent})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, color: '#fff',
            }}>{s.media_type === 'video' ? '🎥' : '🎙️'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: dark, margin: 0 }}>{s.title}</h3>
                {s.active && <span style={{
                  fontSize: 10, fontWeight: 700, color: green, background: '#E8F8EF',
                  borderRadius: 4, padding: '2px 6px',
                }}>ATIVA</span>}
              </div>
              <p style={{ fontSize: 13, color: gray, margin: '0 0 8px', lineHeight: 1.45 }}>{s.description}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
                {s.target_hair_types.map(t => <Tag key={t} color="#C4607A">{t}</Tag>)}
                {s.target_problems.map(t => <Tag key={t} color="#FF9500">{t}</Tag>)}
                {s.target_porosity.map(t => <Tag key={t} color="#007AFF">{t} porosidade</Tag>)}
                {s.target_chemicals.map(t => <Tag key={t} color="#5856D6">{t}</Tag>)}
                {s.target_hair_types.length + s.target_problems.length + s.target_porosity.length + s.target_chemicals.length === 0 && (
                  <Tag color="#8A8A8E">qualquer perfil</Tag>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: gray, display: 'flex', gap: 12 }}>
                <span>📍 {PHASES.find(p => p.value === s.trigger_phase)?.label ?? s.trigger_phase}</span>
                <span>⏱️ {s.trigger_day_min}–{s.trigger_day_max ?? '∞'} dias</span>
                <span>👁️ {s.view_count} visualizações</span>
                <span>⭐ prioridade {s.priority}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <a href={s.media_url} target="_blank" rel="noopener noreferrer" style={{
                fontSize: 11, color: accent, textDecoration: 'none', fontWeight: 600,
              }}>Ver mídia →</a>
              <button onClick={() => handleDelete(s.id)} style={{
                background: 'transparent', border: 'none', color: '#FF3B30',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0,
              }}>Deletar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: 13,
  border: '1.5px solid #E5E5EA', borderRadius: 8, outline: 'none',
  background: '#fff', color: dark, marginTop: 4,
};

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: gray, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}{required && <span style={{ color: '#FF3B30', marginLeft: 3 }}>*</span>}
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
