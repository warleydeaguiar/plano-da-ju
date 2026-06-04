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
 * Fluxo em 2 etapas:
 *  1. 'photo'    — foto (obrigatória) + comprimento cm (opcional)
 *  2. 'products' — quais produtos já tem em casa (opcional)
 *                  → pergunta migrada do quiz porque causava 84% de abandono
 *                    no funil pré-compra. Aqui ela já comprou, então skip ≠ perda.
 *
 *  Ao final → router.replace('/meu-plano') (banner "plano em preparação")
 */
type Step = 'quiz' | 'photo' | 'submitting' | 'products' | 'saving';

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

export default function OnboardingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState('');
  const [step, setStep] = useState<Step>('photo');

  // Etapa 1: foto + comprimento
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [lengthCm, setLengthCm] = useState('');
  const [skipLength, setSkipLength] = useState(false);

  // Etapa 2: produtos em casa
  const [productsText, setProductsText] = useState('');

  // Etapa 0 (cadastro manual): mini-quiz
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizStep, setQuizStep] = useState(0);

  const [error, setError] = useState('');
  const [checkingProfile, setCheckingProfile] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('Foto muito grande (máx. 10 MB)'); return; }
    if (!file.type.startsWith('image/')) { setError('Arquivo precisa ser uma imagem'); return; }
    setError('');
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  // ── Etapa 0 → salvar respostas do mini-quiz e ir pra foto ──
  async function submitQuiz() {
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const res = await fetch('/api/meu-plano/quiz-extra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ answers: quizAnswers }),
      });
      if (!res.ok) { setError('Não consegui salvar suas respostas. Tente de novo.'); return; }
      setStep('photo');
    } catch {
      setError('Falha de conexão. Tente de novo.');
    }
  }

  // ── Etapa 1 → enviar foto + length ─────────────────────────
  async function submitPhoto() {
    if (!photoFile || step !== 'photo') return;
    setError('');
    setStep('submitting');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }

      const fd = new FormData();
      fd.append('photo', photoFile);
      if (!skipLength && lengthCm) {
        const n = parseFloat(lengthCm.replace(',', '.'));
        if (!isNaN(n) && n > 0 && n < 200) fd.append('hair_length_cm', String(n));
      }

      const res = await fetch('/api/meu-plano/photo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao enviar foto');

      // Avança pra etapa 2 (produtos em casa)
      setStep('products');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
      setStep('photo');
    }
  }

  // ── Etapa 2 → salvar produtos (ou pular) e ir pro app ──────
  async function submitProducts(skip: boolean) {
    setError('');
    setStep('saving');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }

      if (!skip && productsText.trim()) {
        // Salva no quiz_answers via API
        await fetch('/api/meu-plano/quiz-extra', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ produtos_casa: productsText.trim() }),
        }).catch(err => console.error('[onboarding/products]', err));
      }

      router.replace('/meu-plano');
    } catch {
      // Se falhar salvar produtos, segue mesmo assim — não bloqueia o acesso ao app
      router.replace('/meu-plano');
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
  const isSaving          = step === 'saving';

  // ────────────────────────────────────────────────────────────
  // ETAPA 2: produtos em casa (após foto enviada)
  // ────────────────────────────────────────────────────────────
  if (step === 'products' || isSaving) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, padding: '32px 20px 40px', fontFamily: fonts.ui }}>
        <div style={{ maxWidth: 440, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: T.greenSoft, color: T.green,
              fontSize: 11, fontWeight: 700, letterSpacing: 1,
              padding: '6px 12px', borderRadius: 99,
              textTransform: 'uppercase', marginBottom: 16,
            }}>
              ✓ Foto enviada
            </div>
            <h1 style={{
              fontSize: 24, fontWeight: 700, color: T.ink,
              margin: '0 0 10px', letterSpacing: -0.5,
              fontFamily: fonts.display, lineHeight: 1.2,
            }}>
              Última pergunta {firstName ? firstName + ', ' : ''}— quais produtos você já tem em casa?
            </h1>
            <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6, margin: 0, padding: '0 4px' }}>
              Isso ajuda a Juliane a aproveitar o que você já tem ao montar o cronograma.
              Pode <strong>pular essa pergunta</strong> e responder depois no perfil.
            </p>
          </div>

          {/* Textarea */}
          <div style={{
            background: T.surface, borderRadius: 18, padding: 18,
            marginBottom: 16, boxShadow: shadow.card,
            border: `1px solid ${T.borderSoft}`,
          }}>
            <label htmlFor="onb-products" style={{
              display: 'block', fontSize: 13, fontWeight: 700, color: T.ink,
              fontFamily: fonts.display, marginBottom: 10,
            }}>
              Produtos que você já tem
            </label>
            <textarea
              id="onb-products"
              value={productsText}
              onChange={e => setProductsText(e.target.value)}
              placeholder="Ex: shampoo Ybera Hydra, máscara hidratação Salon Line, óleo de coco, leave-in…"
              rows={5}
              maxLength={2000}
              style={{
                width: '100%', padding: '12px 14px', fontSize: 14,
                border: `1.5px solid ${T.border}`, borderRadius: 12,
                background: '#FFF', color: T.ink,
                outline: 'none', fontFamily: fonts.ui,
                resize: 'vertical', minHeight: 100, lineHeight: 1.5,
                boxSizing: 'border-box',
              }}
            />
            <p style={{ fontSize: 11.5, color: T.inkMuted, margin: '8px 0 0', lineHeight: 1.5 }}>
              Pode escrever do jeito que lembrar — não precisa ser nome exato.
            </p>
          </div>

          {error && (
            <p style={{ color: '#C0392B', fontSize: 13, marginBottom: 12, textAlign: 'center', padding: '11px 16px', background: '#FDE8EE', borderRadius: 12 }}>
              {error}
            </p>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => submitProducts(false)}
              disabled={isSaving || !productsText.trim()}
              style={{
                width: '100%', padding: 16,
                background: isSaving || !productsText.trim()
                  ? '#D4A0AC' : `linear-gradient(135deg, ${T.pink}, ${T.pinkDeep})`,
                border: 'none', borderRadius: 14,
                fontSize: 15, fontWeight: 800, color: '#FFF',
                cursor: isSaving || !productsText.trim() ? 'not-allowed' : 'pointer',
                fontFamily: fonts.ui,
                boxShadow: !productsText.trim() ? 'none' : '0 8px 22px rgba(190,24,93,0.28)',
                transition: 'all 0.18s',
              }}
            >
              {isSaving ? 'Salvando…' : 'Salvar e entrar no app →'}
            </button>
            <button
              onClick={() => submitProducts(true)}
              disabled={isSaving}
              style={{
                width: '100%', padding: 12,
                background: 'transparent',
                border: `1px solid ${T.border}`, borderRadius: 12,
                fontSize: 13, color: T.inkSoft, cursor: isSaving ? 'not-allowed' : 'pointer',
                fontFamily: fonts.ui,
              }}
            >
              {isSaving ? '…' : 'Pular por agora'}
            </button>
          </div>

          <p style={{ textAlign: 'center', color: T.inkMuted, fontSize: 11, marginTop: 14, lineHeight: 1.6 }}>
            Você pode adicionar/editar essa lista a qualquer momento no perfil.
          </p>
        </div>
      </div>
    );
  }

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
            {firstName ? `${firstName}, ` : ''}envie a foto do seu cabelo
          </h1>
          <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6, margin: 0, padding: '0 4px' }}>
            A Juliane vai analisar seu cabelo na foto + suas respostas do quiz
            e montar um plano <strong style={{ color: T.ink }}>100% personalizado</strong> pra você.
          </p>
        </div>

        {/* Photo upload */}
        <label htmlFor="onb-photo" style={{ display: 'block', cursor: 'pointer', marginBottom: 14 }}>
          <div style={{
            background: T.surface, borderRadius: 22,
            border: `2px dashed ${photoPreview ? T.pink : T.border}`,
            aspectRatio: '4/3', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', position: 'relative',
            boxShadow: photoPreview ? `0 8px 24px rgba(236,72,153,0.18)` : shadow.card,
            transition: 'all 0.2s',
          }}>
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="Prévia" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <>
                <div style={{
                  width: 64, height: 64, borderRadius: 18,
                  background: gradient.heroSoft, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 14, boxShadow: '0 8px 22px rgba(190,24,93,0.28)',
                }}>
                  <IconCamera size={30} stroke={1.6} color="#fff" />
                </div>
                <p style={{ color: T.ink, fontSize: 16, fontWeight: 700, margin: '0 0 4px', fontFamily: fonts.display }}>
                  Toque para enviar foto
                </p>
                <p style={{ color: T.inkSoft, fontSize: 12, margin: 0 }}>Câmera ou galeria</p>
              </>
            )}
          </div>
        </label>
        <input
          ref={fileInputRef}
          id="onb-photo"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {photoPreview && (
          <button
            onClick={() => { setPhotoFile(null); setPhotoPreview(''); fileInputRef.current!.value = ''; }}
            style={{
              width: '100%', background: 'transparent',
              border: `1px solid ${T.border}`, borderRadius: 12,
              padding: 10, fontSize: 13, color: T.inkSoft,
              cursor: 'pointer', marginBottom: 14, fontFamily: fonts.ui,
            }}
          >
            Trocar foto
          </button>
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

        {/* Tips card */}
        <div style={{
          background: gradient.gold, borderRadius: 14, padding: '12px 14px',
          marginBottom: 18, display: 'flex', gap: 10, alignItems: 'flex-start',
          border: `1px solid ${T.gold}55`,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>💡</span>
          <div style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.55 }}>
            <strong>Dica:</strong> foto com a cabeça inteira, boa iluminação natural e cabelo solto. Sem filtros!
          </div>
        </div>

        {error && (
          <p style={{ color: '#C0392B', fontSize: 13, marginBottom: 12, textAlign: 'center', padding: '11px 16px', background: '#FDE8EE', borderRadius: 12 }}>
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          onClick={submitPhoto}
          disabled={!photoFile || isSubmittingPhoto}
          style={{
            width: '100%', padding: 16,
            background: !photoFile || isSubmittingPhoto
              ? '#D4A0AC' : `linear-gradient(135deg, ${T.pink}, ${T.pinkDeep})`,
            border: 'none', borderRadius: 14,
            fontSize: 15, fontWeight: 800, color: '#FFF',
            cursor: !photoFile || isSubmittingPhoto ? 'not-allowed' : 'pointer',
            fontFamily: fonts.ui,
            boxShadow: !photoFile ? 'none' : '0 8px 22px rgba(190,24,93,0.28)',
            transition: 'all 0.18s',
          }}
        >
          {isSubmittingPhoto ? 'Enviando…' : '✨ Enviar foto e continuar'}
        </button>

        <p style={{ textAlign: 'center', color: T.inkMuted, fontSize: 11, marginTop: 14, lineHeight: 1.6 }}>
          Sua foto é privada — só a Juliane e você têm acesso.
        </p>
      </div>
    </div>
  );
}
