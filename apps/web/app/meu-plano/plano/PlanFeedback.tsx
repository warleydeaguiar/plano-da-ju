'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { T, fonts } from '../theme';

// WhatsApp de suporte (fallback quando a revisão estoura o prazo).
const WA_SUPORTE = '5531971445597';
const WA_MSG = 'Oi! Já passou das 48h do prazo de revisão do meu plano capilar e gostaria de ajuda com ele 💛';
const waLink = () => `https://wa.me/${WA_SUPORTE}?text=${encodeURIComponent(WA_MSG)}`;

export default function PlanFeedback(
  { alreadySubmitted = false, revisionPending = false, revisionDueAt = null }:
  { alreadySubmitted?: boolean; revisionPending?: boolean; revisionDueAt?: string | null },
) {
  const [rating, setRating] = useState(0);
  const [mode, setMode] = useState<'ask' | 'revision'>('ask'); // 'ask' = pergunta se quer ajuste
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  // Avaliação é ÚNICA: se a cliente já avaliou (vindo do perfil), já abre no
  // estado concluído — não mostra o formulário de novo ao voltar pra aba.
  const [done, setDone] = useState<null | { revision: boolean }>(
    alreadySubmitted ? { revision: revisionPending } : null,
  );
  const [err, setErr] = useState('');
  const [now, setNow] = useState(() => Date.now());

  // Contador da revisão: só roda enquanto houver prazo pendente.
  const dueMs = revisionDueAt ? new Date(revisionDueAt).getTime() : null;
  useEffect(() => {
    if (!(done?.revision && dueMs)) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [done, dueMs]);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // wantsRevision = true só quando a cliente escolhe "quero ajuste" E escreve o pedido.
  async function submit(wantsRevision: boolean) {
    if (sending) return;
    if (!rating && !wantsRevision) { setErr('Toque nas estrelas pra dar sua nota 💛'); return; }
    if (wantsRevision && !msg.trim()) { setErr('Conte o que você gostaria de ajustar.'); return; }
    setSending(true); setErr('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setErr('Sessão expirada — entre de novo.'); setSending(false); return; }
      const res = await fetch('/api/meu-plano/plan-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ rating: rating || undefined, message: wantsRevision ? msg.trim() : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro');
      setDone({ revision: !!data.revision });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao enviar');
    } finally { setSending(false); }
  }

  if (done) {
    // Caso simples: avaliou sem pedir ajuste.
    if (!done.revision) {
      return (
        <div style={{ margin: '0 16px 28px', background: T.surface, border: `1px solid ${T.borderSoft}`, borderRadius: 16, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 30 }}>💛</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, fontFamily: fonts.display, marginTop: 6 }}>
            Obrigada pela avaliação!
          </div>
          <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 6, lineHeight: 1.5 }}>
            Que bom que gostou! Bora seguir o cronograma 💪
          </div>
        </div>
      );
    }

    // Pediu ajuste: mostra contador até o prazo da Juliane; depois, fallback WhatsApp.
    const remaining = dueMs ? dueMs - now : null;
    const overdue = remaining != null && remaining <= 0;

    let countdownLabel = '';
    if (remaining != null && remaining > 0) {
      const totalMin = Math.floor(remaining / 60_000);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      if (h >= 24) {
        const d = Math.floor(h / 24);
        const hr = h % 24;
        countdownLabel = `${d}d ${hr}h restantes`;
      } else if (h >= 1) {
        countdownLabel = `${h}h ${m}min restantes`;
      } else {
        countdownLabel = `${Math.max(1, totalMin)}min restantes`;
      }
    }

    return (
      <div style={{ margin: '0 16px 28px', background: T.surface, border: `1px solid ${T.borderSoft}`, borderRadius: 16, padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 30 }}>{overdue ? '💬' : '📝'}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, fontFamily: fonts.display, marginTop: 6 }}>
          {overdue ? 'Vamos resolver isso juntas 💛' : 'Pedido de ajuste recebido!'}
        </div>

        {!overdue && (
          <>
            <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 6, lineHeight: 1.5 }}>
              A Juliane vai revisar seu plano e responde em até <strong>2 dias úteis</strong> (não contamos sábado e domingo).
            </div>
            {countdownLabel && (
              <div style={{ marginTop: 14, display: 'inline-block', background: T.pinkSoft, border: `1px solid ${T.borderSoft}`, borderRadius: 999, padding: '8px 16px' }}>
                <span style={{ fontSize: 11, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5 }}>Prazo da resposta</span>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.ink, fontFamily: fonts.display, marginTop: 2 }}>
                  ⏳ {countdownLabel}
                </div>
              </div>
            )}
          </>
        )}

        {overdue && (
          <>
            <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 6, lineHeight: 1.5 }}>
              Já passou do prazo de resposta e a gente não quer te deixar esperando.
              Chama a gente no WhatsApp que resolvemos seu ajuste rapidinho 💛
            </div>
            <a
              href={waLink()}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', marginTop: 16, background: '#25D366', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 15, padding: '14px 26px', borderRadius: 12 }}
            >
              💬 Falar no WhatsApp
            </a>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ margin: '0 16px 28px', background: T.surface, border: `1px solid ${T.borderSoft}`, borderRadius: 16, padding: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, fontFamily: fonts.display }}>O que achou do seu plano?</div>
      <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 4 }}>Sua opinião ajuda a Juliane a deixar tudo com a sua cara.</div>

      {/* Estrelas */}
      <div style={{ display: 'flex', gap: 6, margin: '14px 0 4px' }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => setRating(n)} aria-label={`${n} estrelas`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 30, lineHeight: 1, padding: 0, filter: n <= rating ? 'none' : 'grayscale(1) opacity(0.35)' }}>
            ⭐
          </button>
        ))}
      </div>

      {/* Pergunta-chave: quer ajustar? Só vai pra revisão se disser que sim. */}
      {mode === 'ask' && (
        <>
          <div style={{ fontSize: 13.5, color: T.ink, fontWeight: 600, marginTop: 16 }}>
            Quer ajustar algo no seu plano?
          </div>
          {err && <div style={{ fontSize: 12.5, color: T.danger, marginTop: 8 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button onClick={() => submit(false)} disabled={sending}
              style={{ flex: 1, padding: 13, borderRadius: 12, border: `1.5px solid ${T.green}`, background: T.greenSoft, color: '#0B5132', fontSize: 14, fontWeight: 700, cursor: sending ? 'default' : 'pointer', fontFamily: fonts.ui }}>
              {sending ? 'Enviando…' : 'Tá ótimo, não 💛'}
            </button>
            <button onClick={() => { setErr(''); setMode('revision'); }} disabled={sending}
              style={{ flex: 1, padding: 13, borderRadius: 12, border: `1.5px solid ${T.pink}`, background: '#fff', color: T.pinkDeep, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: fonts.ui }}>
              Quero um ajuste
            </button>
          </div>
        </>
      )}

      {/* Modo revisão: campo aberto pro pedido */}
      {mode === 'revision' && (
        <>
          <label style={{ fontSize: 12.5, color: T.inkSoft, fontWeight: 600, display: 'block', marginTop: 16 }}>
            O que você gostaria de ajustar?
          </label>
          <textarea
            value={msg}
            onChange={e => setMsg(e.target.value)}
            placeholder="Ex.: tenho alergia a um ingrediente, queria menos passos na semana, posso trocar a progressiva por outra coisa?…"
            rows={4} autoFocus
            style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 14, fontFamily: fonts.ui, outline: 'none', resize: 'vertical' }}
          />
          {err && <div style={{ fontSize: 12.5, color: T.danger, marginTop: 8 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => submit(true)} disabled={sending}
              style={{ flex: 1, padding: 13, borderRadius: 12, border: 'none', background: T.pinkDeep, color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.6 : 1, fontFamily: fonts.ui }}>
              {sending ? 'Enviando…' : 'Enviar pedido de ajuste'}
            </button>
            <button onClick={() => { setErr(''); setMode('ask'); }} disabled={sending}
              style={{ padding: '13px 16px', borderRadius: 12, border: `1px solid ${T.border}`, background: 'transparent', color: T.inkSoft, fontSize: 13, cursor: 'pointer', fontFamily: fonts.ui }}>
              Voltar
            </button>
          </div>
          <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 8, textAlign: 'center' }}>
            Pedidos de ajuste são respondidos em até <strong>2 dias úteis</strong>.
          </div>
        </>
      )}
    </div>
  );
}
