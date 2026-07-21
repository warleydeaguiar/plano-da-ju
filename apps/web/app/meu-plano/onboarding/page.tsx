'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { T, fonts, shadow, gradient } from '../theme';
import { IconCamera, IconSparkles } from '../icons';

/**
 * Onboarding — primeira tela após login.
 * Bloqueia o app até a usuária enviar a foto do cabelo.
 *
 * Fluxo:
 *  0. 'quiz'  — mini-quiz (só p/ cadastro manual sem quiz_answers)
 *  1. 'photo' — 3 fotos (obrigatórias) + vídeo/comprimento/peso (opcionais)
 *
 *  Ao final da foto → router.replace('/meu-plano') (banner "plano em preparação").
 *  (A pergunta "produtos que já tem em casa" foi REMOVIDA a pedido da equipe —
 *   causava confusão; a lista de compras é montada pela indicação da Ju.)
 */
type Step = 'quiz' | 'photo' | 'submitting';

// Mini-quiz in-app — só aparece pra quem foi cadastrada manualmente (sem
// quiz_answers). São as perguntas que mais pesam na geração do plano.
const QUIZ_QUESTIONS: { key: string; q: string; opts: { v: string; l: string }[] }[] = [
  { key: 'tipo', q: 'Qual é o seu tipo de cabelo?', opts: [
    { v: 'liso', l: 'Liso' }, { v: 'ondulado', l: 'Ondulado' }, { v: 'cacheado', l: 'Cacheado' }, { v: 'crespo', l: 'Crespo' } ] },
  { key: 'quimica', q: 'Fez alguma química recente?', opts: [
    { v: 'progressiva', l: 'Progressiva' }, { v: 'descoloracao', l: 'Descoloração / luzes' }, { v: 'tintura', l: 'Tintura' },
    { v: 'relaxamento', l: 'Relaxamento' }, { v: 'botox', l: 'Botox / selagem' }, { v: 'nenhuma', l: 'Nenhuma' } ] },
  { key: 'incomoda', q: 'O que mais te incomoda hoje?', opts: [
    { v: 'pontas', l: 'Pontas ressecadas' }, { v: 'frizz', l: 'Frizz' }, { v: 'quebra', l: 'Quebra' },
    { v: 'queda', l: 'Queda' }, { v: 'crescimento', l: 'Cresce pouco' }, { v: 'volume', l: 'Volume / armado' } ] },
  { key: 'porosidade', q: 'Como seu cabelo absorve água e produto?', opts: [
    { v: 'baixa', l: 'Demora pra molhar e secar (baixa)' }, { v: 'media', l: 'Normal (média)' },
    { v: 'alta', l: 'Molha e seca rápido (alta)' }, { v: 'nao_sei', l: 'Não sei' } ] },
  { key: 'oleosidade', q: 'Como é a sua raiz / couro cabeludo?', opts: [
    { v: 'seca', l: 'Resseca' }, { v: 'normal', l: 'Normal' }, { v: 'oleosa', l: 'Oleosa' } ] },
  { key: 'lavagem', q: 'Com que frequência você lava o cabelo?', opts: [
    { v: 'diaria', l: 'Todo dia' }, { v: '3x_semana', l: '2 a 3x na semana' },
    { v: '1x_semana', l: '1x na semana' }, { v: 'quinzenal', l: 'A cada 15 dias ou mais' } ] },
  { key: 'calor', q: 'Usa calor (chapinha, secador, babyliss)?', opts: [
    { v: 'sempre', l: 'Quase sempre' }, { v: 'as_vezes', l: 'Às vezes' }, { v: 'raramente', l: 'Raramente / nunca' } ] },
  { key: 'objetivo', q: 'Qual é o seu maior objetivo?', opts: [
    { v: 'crescimento', l: 'Crescer mais rápido' }, { v: 'reparar', l: 'Reparar / recuperar' },
    { v: 'hidratar', l: 'Hidratar e dar brilho' }, { v: 'reduzir_queda', l: 'Reduzir a queda' }, { v: 'definir', l: 'Definir cachos / ondas' } ] },
];

/**
 * Comprime/redimensiona uma imagem no navegador (respeitando a orientação EXIF)
 * pra deixar o upload leve e dentro do limite de corpo da serverless (~4.5MB).
 * Se algo falhar, devolve o arquivo original.
 */
async function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    let { width, height } = bitmap;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
    bitmap.close?.();
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const backInputRef = useRef<HTMLInputElement>(null);
  const rootInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState('');
  const [step, setStep] = useState<Step>('photo');

  // Etapa 1: 3 fotos (frente + costas + raiz, todas obrigatórias) + vídeo (opcional)
  const [photoFile, setPhotoFile] = useState<File | null>(null);       // frente
  const [photoPreview, setPhotoPreview] = useState('');
  const [backFile, setBackFile] = useState<File | null>(null);          // costas
  const [backPreview, setBackPreview] = useState('');
  const [rootFile, setRootFile] = useState<File | null>(null);          // raiz / couro cabeludo
  const [rootPreview, setRootPreview] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);        // vídeo opcional
  const [videoName, setVideoName] = useState('');
  const [submitMsg, setSubmitMsg] = useState('Enviando…');
  const [lengthCm, setLengthCm] = useState('');
  const [skipLength, setSkipLength] = useState(false);
  const [weightKg, setWeightKg] = useState('');

  // Etapa 0 (cadastro manual): mini-quiz
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizStep, setQuizStep] = useState(0);

  const [error, setError] = useState('');
  const [checkingProfile, setCheckingProfile] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // Alguns access_tokens salvos no navegador chegavam MALFORMADOS ao servidor
  // (o Auth recusava com "token is malformed" → 401 no salvar/foto). Antes de
  // qualquer chamada autenticada, forçamos um refresh pra garantir um token novo
  // e bem-formado. Se o refresh falhar, cai no token atual (não piora nada).
  async function getFreshToken(fallback: string): Promise<string> {
    try {
      const { data } = await supabase.auth.refreshSession();
      return data.session?.access_token ?? fallback;
    } catch {
      return fallback;
    }
  }

  // Auth check + pula onboarding se já tem foto
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: prof } = await (supabase.from('profiles') as any)
        .select('full_name, photo_url, quiz_answers')
        .eq('id', session.user.id)
        .maybeSingle();
      if (prof?.photo_url) { router.replace('/meu-plano'); return; }
      setFirstName(prof?.full_name?.split(' ')[0] ?? '');
      // Cadastro manual (sem respostas do quiz) → começa pelo mini-quiz.
      // Quem veio do funil já tem quiz_answers.tipo → vai direto pra foto.
      const qa = (prof?.quiz_answers ?? null) as Record<string, unknown> | null;
      if (!qa || !qa.tipo) setStep('quiz');
      setCheckingProfile(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePhotoPick(which: 'front' | 'back' | 'root', e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { setError('Foto muito grande (máx. 20 MB)'); return; }
    if (!file.type.startsWith('image/')) { setError('Arquivo precisa ser uma imagem'); return; }
    setError('');
    if (which === 'front') { setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file)); }
    else if (which === 'back') { setBackFile(file); setBackPreview(URL.createObjectURL(file)); }
    else { setRootFile(file); setRootPreview(URL.createObjectURL(file)); }
  }

  function handleVideoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) { setError('O arquivo precisa ser um vídeo'); return; }
    if (file.size > 80 * 1024 * 1024) { setError('Vídeo muito grande (máx. 80 MB). Grave um clipe curto 🙂'); return; }
    setError('');
    setVideoFile(file);
    setVideoName(file.name);
  }

  // ── Etapa 0 → salvar respostas do mini-quiz e ir pra foto ──
  async function submitQuiz() {
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const accessToken = await getFreshToken(session.access_token);
      const res = await fetch('/api/meu-plano/quiz-extra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ answers: quizAnswers }),
      });
      // Não bloqueia o cadastro se o save falhar — as respostas ajudam, mas a
      // cliente PRECISA conseguir avançar pra foto (o que gera o plano).
      if (!res.ok) { console.error('[onboarding/quiz] save falhou', res.status); }
      setStep('photo');
    } catch {
      setError('Falha de conexão. Tente de novo.');
    }
  }

  // ── Etapa 1 → enviar fotos (+ vídeo opcional) + length ─────
  async function submitPhoto() {
    if (!photoFile || !backFile || !rootFile || step !== 'photo') return;
    setError('');
    setSubmitMsg('Preparando suas fotos…');
    setStep('submitting');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const accessToken = await getFreshToken(session.access_token);
      const authH = { Authorization: `Bearer ${accessToken}` };

      // Comprime as três fotos no navegador (rápido + cabe no limite da Vercel).
      const [frontC, backC, rootC] = await Promise.all([compressImage(photoFile), compressImage(backFile), compressImage(rootFile)]);

      // Vídeo opcional → sobe DIRETO pro Storage via URL assinada (sem limite de corpo).
      let videoUrl = '';
      if (videoFile) {
        try {
          setSubmitMsg('Enviando seu vídeo…');
          const ext = (videoFile.name.split('.').pop() || 'mp4').toLowerCase();
          const r = await fetch('/api/meu-plano/video-url', {
            method: 'POST',
            headers: { ...authH, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ext }),
          });
          const sig = await r.json();
          if (r.ok && sig.path && sig.token) {
            const up = await supabase.storage.from('hair-videos').uploadToSignedUrl(sig.path, sig.token, videoFile);
            if (!up.error) videoUrl = sig.publicUrl;
          }
        } catch { /* vídeo é opcional — segue sem ele se falhar */ }
      }

      // Fotos → sobem DIRETO pro Storage via URLs assinadas (não passam pelo limite
      // de ~4,5MB de corpo da serverless — era o "Request Entity Too Large").
      setSubmitMsg('Enviando suas fotos…');
      const su = await fetch('/api/meu-plano/photo-url', {
        method: 'POST',
        headers: { ...authH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots: ['front', 'back', 'root'] }),
      });
      const suData = await su.json().catch(() => ({}));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!su.ok || !Array.isArray(suData.uploads)) throw new Error(suData.error || 'Não consegui preparar o envio das fotos. Tente de novo.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bySlot: Record<string, any> = Object.fromEntries(suData.uploads.map((u: any) => [u.slot, u]));
      const files: Record<string, File> = { front: frontC, back: backC, root: rootC };
      for (const slot of ['front', 'back', 'root']) {
        const u = bySlot[slot];
        if (!u) throw new Error('Falha ao preparar o envio das fotos.');
        const up = await supabase.storage.from('hair-photos').uploadToSignedUrl(u.path, u.token, files[slot]);
        if (up.error) throw new Error('Não consegui enviar suas fotos. Verifique a conexão e tente de novo.');
      }

      const payload: Record<string, unknown> = {
        photo_url: bySlot.front.publicUrl,
        photo_back_url: bySlot.back?.publicUrl,
        photo_root_url: bySlot.root?.publicUrl,
      };
      if (videoUrl) payload.video_url = videoUrl;
      if (!skipLength && lengthCm) { const n = parseFloat(lengthCm.replace(',', '.')); if (!isNaN(n) && n > 0 && n < 200) payload.hair_length_cm = n; }
      if (weightKg) { const w = parseFloat(weightKg.replace(',', '.')); if (!isNaN(w) && w >= 30 && w <= 300) payload.weight_kg = w; }

      const res = await fetch('/api/meu-plano/photo', {
        method: 'POST',
        headers: { ...authH, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // Trata resposta não-JSON com elegância (evita o "Unexpected token R" cru).
      const data = await res.json().catch(() => ({ error: 'Não consegui concluir o envio. Tente de novo.' }));
      if (!res.ok) throw new Error(data.error ?? 'Erro ao enviar foto');

      // Foto enviada → dispara a geração do plano; leva a cliente direto pro app
      // (banner "plano em preparação"). A pergunta de produtos em casa foi removida.
      router.replace('/meu-plano');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
      setStep('photo');
    }
  }

  // ── Loading inicial ────────────────────────────────────────
  if (checkingProfile) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${T.pinkSoft}`, borderTopColor: T.pink, borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // ETAPA 0: mini-quiz (cadastro manual sem respostas)
  // ────────────────────────────────────────────────────────────
  if (step === 'quiz') {
    const q = QUIZ_QUESTIONS[quizStep];
    const total = QUIZ_QUESTIONS.length;
    const answered = !!quizAnswers[q.key];
    const isLast = quizStep === total - 1;
    return (
      <div style={{ minHeight: '100vh', background: T.bg, padding: '28px 20px 40px', fontFamily: fonts.ui }}>
        <div style={{ maxWidth: 440, margin: '0 auto' }}>
          {/* Progresso */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
            {QUIZ_QUESTIONS.map((_, i) => (
              <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: i <= quizStep ? T.pink : T.pinkSoft }} />
            ))}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
            Pergunta {quizStep + 1} de {total}
          </div>
          <h1 style={{ fontSize: 23, fontWeight: 700, color: T.ink, margin: '0 0 20px', fontFamily: fonts.display, lineHeight: 1.2 }}>
            {firstName && quizStep === 0 ? `${firstName}, ` : ''}{q.q}
          </h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {q.opts.map(o => {
              const sel = quizAnswers[q.key] === o.v;
              return (
                <button
                  key={o.v}
                  onClick={() => setQuizAnswers(a => ({ ...a, [q.key]: o.v }))}
                  style={{
                    width: '100%', textAlign: 'left', padding: '15px 16px', borderRadius: 14,
                    border: `1.5px solid ${sel ? T.pink : T.border}`, background: sel ? T.pinkSoft : T.surface,
                    color: T.ink, fontSize: 15, fontWeight: sel ? 700 : 500, cursor: 'pointer', fontFamily: fonts.ui,
                    boxShadow: sel ? '0 4px 12px rgba(236,72,153,0.15)' : 'none', transition: 'all 0.15s',
                  }}
                >
                  {o.l}
                </button>
              );
            })}
          </div>
          {error && <p style={{ color: '#C0392B', fontSize: 13, marginTop: 14, textAlign: 'center' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            {quizStep > 0 && (
              <button
                onClick={() => { setError(''); setQuizStep(s => s - 1); }}
                style={{ padding: '14px 18px', borderRadius: 14, border: `1px solid ${T.border}`, background: 'transparent', color: T.inkSoft, fontSize: 14, cursor: 'pointer', fontFamily: fonts.ui }}
              >
                ← Voltar
              </button>
            )}
            <button
              onClick={() => { if (!answered) return; if (isLast) submitQuiz(); else { setError(''); setQuizStep(s => s + 1); } }}
              disabled={!answered}
              style={{
                flex: 1, padding: 15, borderRadius: 14, border: 'none',
                background: answered ? `linear-gradient(135deg, ${T.pink}, ${T.pinkDeep})` : '#D4A0AC',
                color: '#FFF', fontSize: 15, fontWeight: 800, cursor: answered ? 'pointer' : 'not-allowed',
                fontFamily: fonts.ui, boxShadow: answered ? '0 8px 22px rgba(190,24,93,0.28)' : 'none',
              }}
            >
              {isLast ? 'Continuar pra foto →' : 'Continuar →'}
            </button>
          </div>
          <p style={{ textAlign: 'center', color: T.inkMuted, fontSize: 11, marginTop: 16, lineHeight: 1.6 }}>
            Essas respostas ajudam a Juliane a montar seu plano personalizado.
          </p>
        </div>
      </div>
    );
  }

  const isSubmittingPhoto = step === 'submitting';

  // ────────────────────────────────────────────────────────────
  // ETAPA 1: foto + comprimento (default)
  // ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: T.bg, padding: '32px 20px 40px', fontFamily: fonts.ui }}>
      <div style={{ maxWidth: 440, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: T.pinkSoft, color: T.pinkDeep,
            fontSize: 11, fontWeight: 700, letterSpacing: 1,
            padding: '6px 12px', borderRadius: 99,
            textTransform: 'uppercase', marginBottom: 16,
          }}>
            <IconSparkles size={12} stroke={2} /> Última etapa
          </div>
          <h1 style={{
            fontSize: 26, fontWeight: 700, color: T.ink,
            margin: '0 0 10px', letterSpacing: -0.5,
            fontFamily: fonts.display, lineHeight: 1.15,
          }}>
            {firstName ? `${firstName}, ` : ''}envie 3 fotos do seu cabelo
          </h1>
          <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6, margin: 0, padding: '0 4px' }}>
            Uma <strong style={{ color: T.ink }}>de frente</strong>, uma <strong style={{ color: T.ink }}>de costas</strong> e
            uma <strong style={{ color: T.ink }}>da raiz</strong> —
            assim a Juliane analisa seu cabelo por inteiro e monta um plano
            <strong style={{ color: T.ink }}> 100% personalizado</strong>. Um vídeo é opcional, mas ajuda muito 💛
          </p>
        </div>

        {/* Fotos: frente + costas + raiz (todas obrigatórias), lado a lado */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {([
            { key: 'front' as const, emoji: '🙂', title: 'De frente', preview: photoPreview, id: 'onb-photo-front', ref: fileInputRef,
              clear: () => { setPhotoFile(null); setPhotoPreview(''); if (fileInputRef.current) fileInputRef.current.value = ''; } },
            { key: 'back' as const, emoji: '🔄', title: 'De costas', preview: backPreview, id: 'onb-photo-back', ref: backInputRef,
              clear: () => { setBackFile(null); setBackPreview(''); if (backInputRef.current) backInputRef.current.value = ''; } },
            { key: 'root' as const, emoji: '🌱', title: 'Da raiz', preview: rootPreview, id: 'onb-photo-root', ref: rootInputRef,
              clear: () => { setRootFile(null); setRootPreview(''); if (rootInputRef.current) rootInputRef.current.value = ''; } },
          ]).map(slot => (
            <div key={slot.key} style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 6, textAlign: 'center', fontFamily: fonts.display }}>
                {slot.emoji} {slot.title}
              </div>
              <label htmlFor={slot.id} style={{ display: 'block', cursor: 'pointer' }}>
                <div style={{
                  background: T.surface, borderRadius: 18,
                  border: `2px dashed ${slot.preview ? T.pink : T.border}`,
                  aspectRatio: '3/4', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', position: 'relative',
                  boxShadow: slot.preview ? `0 8px 24px rgba(236,72,153,0.18)` : shadow.card,
                  transition: 'all 0.2s',
                }}>
                  {slot.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={slot.preview} alt={slot.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <>
                      <div style={{
                        width: 46, height: 46, borderRadius: 14,
                        background: gradient.heroSoft, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8,
                        boxShadow: '0 6px 18px rgba(190,24,93,0.26)',
                      }}>
                        <IconCamera size={22} stroke={1.6} color="#fff" />
                      </div>
                      <p style={{ color: T.ink, fontSize: 12.5, fontWeight: 700, margin: 0, fontFamily: fonts.display }}>Toque pra enviar</p>
                    </>
                  )}
                </div>
              </label>
              <input id={slot.id} ref={slot.ref} type="file" accept="image/*"
                onChange={e => handlePhotoPick(slot.key, e)} style={{ display: 'none' }} />
              {slot.preview && (
                <button onClick={slot.clear} style={{
                  width: '100%', background: 'transparent', border: `1px solid ${T.border}`,
                  borderRadius: 10, padding: 7, fontSize: 12, color: T.inkSoft,
                  cursor: 'pointer', marginTop: 6, fontFamily: fonts.ui,
                }}>Trocar</button>
              )}
            </div>
          ))}
        </div>

        {/* Vídeo opcional */}
        <label htmlFor="onb-video" style={{ display: 'block', cursor: 'pointer', marginBottom: 14 }}>
          <div style={{
            background: videoName ? T.pinkSoft : T.surface, borderRadius: 14,
            border: `2px dashed ${videoName ? T.pink : T.border}`,
            padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: shadow.card,
          }}>
            <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{videoName ? '🎬' : '🎥'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, fontFamily: fonts.display }}>
                {videoName ? 'Vídeo adicionado ✓' : 'Adicionar um vídeo'}
                {!videoName && <span style={{ fontSize: 11, color: T.inkSoft, fontWeight: 500 }}> · opcional</span>}
              </div>
              <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {videoName ? videoName : 'Mostre o movimento, brilho e volume do cabelo'}
              </div>
            </div>
          </div>
        </label>
        <input id="onb-video" ref={videoInputRef} type="file" accept="video/*"
          onChange={handleVideoPick} style={{ display: 'none' }} />
        {videoName && (
          <button onClick={() => { setVideoFile(null); setVideoName(''); if (videoInputRef.current) videoInputRef.current.value = ''; }}
            style={{
              width: '100%', background: 'transparent', border: `1px solid ${T.border}`,
              borderRadius: 10, padding: 8, fontSize: 12, color: T.inkSoft,
              cursor: 'pointer', marginTop: -8, marginBottom: 14, fontFamily: fonts.ui,
            }}>Remover vídeo</button>
        )}

        {/* Hair length input (optional) */}
        <div style={{
          background: T.surface, borderRadius: 18, padding: 18,
          marginBottom: 14, boxShadow: shadow.card,
          border: `1px solid ${T.borderSoft}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <label htmlFor="onb-length" style={{ fontSize: 13, fontWeight: 700, color: T.ink, fontFamily: fonts.display }}>
              Comprimento do cabelo
            </label>
            <span style={{ fontSize: 11, color: T.inkSoft }}>Opcional</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              id="onb-length"
              type="number"
              inputMode="decimal"
              min={0}
              max={200}
              placeholder="ex: 35"
              value={lengthCm}
              disabled={skipLength}
              onChange={e => setLengthCm(e.target.value)}
              style={{
                flex: 1, padding: '12px 14px', fontSize: 15,
                border: `1.5px solid ${T.border}`, borderRadius: 12,
                background: skipLength ? '#F5F1F2' : '#FFF', color: T.ink,
                outline: 'none', fontFamily: fonts.ui,
                opacity: skipLength ? 0.5 : 1,
              }}
            />
            <span style={{ fontSize: 14, color: T.inkSoft, fontWeight: 600, paddingRight: 4 }}>cm</span>
          </div>
          <button
            onClick={() => { setSkipLength(s => !s); if (!skipLength) setLengthCm(''); }}
            style={{
              marginTop: 10, padding: 0, background: 'none',
              border: 'none', cursor: 'pointer', fontSize: 12.5,
              color: skipLength ? T.pinkDeep : T.inkSoft, fontWeight: 600,
              textDecoration: 'underline', fontFamily: fonts.ui,
            }}
          >
            {skipLength ? '✓ Vou medir depois' : 'Não consigo medir agora'}
          </button>
          <p style={{ fontSize: 11.5, color: T.inkMuted, margin: '10px 0 0', lineHeight: 1.5 }}>
            Se não tem fita métrica, sem problema. Você consegue adicionar isso depois pelo perfil.
          </p>
        </div>

        {/* Peso → meta de água */}
        <div style={{
          background: T.surface, borderRadius: 18, padding: 18,
          marginBottom: 14, boxShadow: shadow.card, border: `1px solid ${T.borderSoft}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <label htmlFor="onb-weight" style={{ fontSize: 13, fontWeight: 700, color: T.ink, fontFamily: fonts.display }}>
              Seu peso
            </label>
            <span style={{ fontSize: 11, color: T.inkSoft }}>Opcional</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              id="onb-weight"
              type="number"
              inputMode="decimal"
              min={30}
              max={300}
              placeholder="ex: 65"
              value={weightKg}
              onChange={e => setWeightKg(e.target.value)}
              style={{
                flex: 1, padding: '12px 14px', fontSize: 15,
                border: `1.5px solid ${T.border}`, borderRadius: 12,
                background: '#FFF', color: T.ink, outline: 'none', fontFamily: fonts.ui,
              }}
            />
            <span style={{ fontSize: 14, color: T.inkSoft, fontWeight: 600, paddingRight: 4 }}>kg</span>
          </div>
          <p style={{ fontSize: 11.5, color: T.inkMuted, margin: '10px 0 0', lineHeight: 1.5 }}>
            Usamos pra calcular sua <strong>meta diária de água</strong> 💧 (cabelo hidratado começa de dentro). Dá pra editar depois no perfil.
          </p>
        </div>

        {/* Tips card */}
        <div style={{
          background: gradient.gold, borderRadius: 14, padding: '12px 14px',
          marginBottom: 18, display: 'flex', gap: 10, alignItems: 'flex-start',
          border: `1px solid ${T.gold}55`,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>💡</span>
          <div style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.55 }}>
            <strong>Dica:</strong> cabeça inteira, boa luz natural e cabelo solto. Sem filtros! A de costas mostra comprimento e pontas; a da raiz mostra o couro cabeludo e a oleosidade.
          </div>
        </div>

        {error && (
          <p style={{ color: '#C0392B', fontSize: 13, marginBottom: 12, textAlign: 'center', padding: '11px 16px', background: '#FDE8EE', borderRadius: 12 }}>
            {error}
          </p>
        )}

        {/* Submit */}
        {(() => {
          const ready = !!photoFile && !!backFile && !!rootFile;
          const disabled = !ready || isSubmittingPhoto;
          return (
            <button
              onClick={submitPhoto}
              disabled={disabled}
              style={{
                width: '100%', padding: 16,
                background: disabled ? '#D4A0AC' : `linear-gradient(135deg, ${T.pink}, ${T.pinkDeep})`,
                border: 'none', borderRadius: 14,
                fontSize: 15, fontWeight: 800, color: '#FFF',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontFamily: fonts.ui,
                boxShadow: disabled ? 'none' : '0 8px 22px rgba(190,24,93,0.28)',
                transition: 'all 0.18s',
              }}
            >
              {isSubmittingPhoto ? submitMsg
                : !photoFile ? 'Envie a foto de frente'
                : !backFile ? 'Falta a foto de costas'
                : !rootFile ? 'Falta a foto da raiz'
                : '✨ Enviar e continuar'}
            </button>
          );
        })()}

        <p style={{ textAlign: 'center', color: T.inkMuted, fontSize: 11, marginTop: 14, lineHeight: 1.6 }}>
          Suas fotos e vídeo são privados — só a Juliane e você têm acesso.
        </p>
      </div>
    </div>
  );
}
