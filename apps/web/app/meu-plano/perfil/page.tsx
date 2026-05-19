'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { T, fonts, shadow, gradient } from '../theme';
import { IconCamera, IconChevronLeft } from '../icons';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  hair_type: string | null;
  subscription_type: string | null;
  subscription_expires_at: string | null;
}

export default function PerfilPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }
    const { data } = await supabase
      .from('profiles')
      .select('id,email,full_name,avatar_url,hair_type,subscription_type,subscription_expires_at')
      .eq('id', session.user.id)
      .single();
    if (data) {
      setProfile(data as Profile);
      setNameDraft((data as Profile).full_name ?? '');
    }
    setLoading(false);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    setUploadingAvatar(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const fd = new FormData();
      fd.append('photo', file);
      const res = await fetch('/api/meu-plano/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      });
      const j = await res.json();
      if (res.ok && j.avatar_url) {
        setProfile(p => p ? { ...p, avatar_url: j.avatar_url } : p);
        setFeedback({ ok: true, msg: 'Foto de perfil atualizada' });
      } else {
        setFeedback({ ok: false, msg: j.error ?? 'Erro ao enviar' });
      }
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSaveName() {
    if (!nameDraft.trim() || nameDraft === profile?.full_name) return;
    setSavingName(true); setFeedback(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/meu-plano/avatar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ full_name: nameDraft.trim() }),
      });
      if (res.ok) {
        setProfile(p => p ? { ...p, full_name: nameDraft.trim() } : p);
        setFeedback({ ok: true, msg: 'Nome atualizado' });
      } else {
        const j = await res.json().catch(() => ({}));
        setFeedback({ ok: false, msg: j.error ?? 'Erro' });
      }
    } finally {
      setSavingName(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading || !profile) return null;

  const initial = (profile.full_name ?? profile.email ?? 'U')[0].toUpperCase();
  const expiresAt = profile.subscription_expires_at ? new Date(profile.subscription_expires_at) : null;
  const subLabel = profile.subscription_type === 'annual_card' || profile.subscription_type === 'annual_pix'
    ? 'Anual' : (profile.subscription_type ?? '—');

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 10, border: 'none',
            background: T.surface, color: T.ink,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: shadow.card,
          }}
        >
          <IconChevronLeft size={20} stroke={2.2} />
        </button>
        <div style={{
          fontSize: 22, fontWeight: 600, color: T.ink,
          fontFamily: fonts.display, letterSpacing: -0.3,
        }}>
          <em style={{ fontStyle: 'italic' }}>Perfil</em>
        </div>
      </div>

      {/* Avatar */}
      <div style={{ padding: '20px 20px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <label style={{
          position: 'relative', cursor: uploadingAvatar ? 'default' : 'pointer',
          width: 120, height: 120, borderRadius: '50%',
          background: gradient.heroSoft,
          padding: 3,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 26px rgba(190,24,93,0.30)',
          opacity: uploadingAvatar ? 0.7 : 1,
        }}>
          <input
            ref={fileInputRef}
            type="file" accept="image/*"
            onChange={handleAvatarUpload}
            disabled={uploadingAvatar}
            style={{ display: 'none' }}
          />
          <div style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: '#FFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="Foto de perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                color: T.pinkDeep, fontWeight: 700, fontSize: 48,
                fontFamily: fonts.display,
              }}>{initial}</div>
            )}
          </div>
          {/* Câmera badge */}
          <div style={{
            position: 'absolute', bottom: 0, right: 4,
            width: 36, height: 36, borderRadius: '50%',
            background: T.pink, color: '#FFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(190,24,93,0.40)',
            border: '3px solid #FFF',
          }}>
            <IconCamera size={16} stroke={2} color="#FFF" />
          </div>
        </label>
        <div style={{ marginTop: 12, fontSize: 12.5, color: T.inkSoft, fontWeight: 500 }}>
          {uploadingAvatar ? 'Enviando…' : 'Toque para trocar a foto'}
        </div>
      </div>

      {feedback && (
        <div style={{
          margin: '14px 20px 0',
          background: feedback.ok ? '#DCFCE7' : '#FEE2E2',
          color: feedback.ok ? '#166534' : '#991B1B',
          borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600,
          border: `1px solid ${feedback.ok ? '#86EFAC' : '#FCA5A5'}`,
        }}>
          {feedback.ok ? '✓ ' : '⚠ '}{feedback.msg}
        </div>
      )}

      {/* Nome */}
      <div style={{ padding: '28px 20px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          Nome
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={nameDraft}
            onChange={e => setNameDraft(e.target.value)}
            placeholder="Seu nome"
            style={{
              flex: 1, background: T.surface, border: `1px solid ${T.borderSoft}`,
              borderRadius: 12, padding: '12px 14px', fontSize: 15, color: T.ink,
              fontFamily: fonts.ui, outline: 'none',
            }}
          />
          <button
            onClick={handleSaveName}
            disabled={savingName || !nameDraft.trim() || nameDraft === profile.full_name}
            style={{
              background: nameDraft === profile.full_name ? T.borderSoft : T.pink,
              color: nameDraft === profile.full_name ? T.inkSoft : '#FFF',
              border: 'none', borderRadius: 12,
              padding: '0 18px', fontSize: 13, fontWeight: 700,
              cursor: savingName ? 'default' : 'pointer',
              fontFamily: fonts.ui,
              opacity: savingName ? 0.6 : 1,
            }}
          >
            {savingName ? '…' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Conta info */}
      <div style={{ padding: '24px 20px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          Conta
        </div>
        <div style={{
          background: T.surface, borderRadius: 14, border: `1px solid ${T.borderSoft}`,
          overflow: 'hidden', boxShadow: shadow.card,
        }}>
          <InfoRow label="E-mail" value={profile.email} />
          <InfoRow label="Plano" value={subLabel} />
          {expiresAt && (
            <InfoRow label="Renova em" value={expiresAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} last />
          )}
        </div>
      </div>

      {/* Logout */}
      <div style={{ padding: '32px 20px 0' }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', background: 'transparent', color: '#991B1B',
            border: `1px solid #FCA5A5`, borderRadius: 12,
            padding: '13px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            fontFamily: fonts.ui,
          }}
        >
          Sair da conta
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '14px 16px',
      borderBottom: last ? 'none' : `1px solid ${T.borderSoft}`,
    }}>
      <span style={{ fontSize: 13, color: T.inkSoft, fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: T.ink, fontWeight: 600, textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
    </div>
  );
}
