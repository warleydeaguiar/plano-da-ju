'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { LINK_BIO_QUIZ_STEPS, type LinkBioQuizStep } from '@/lib/quiz-link-bio-questions';

const STEPS = LINK_BIO_QUIZ_STEPS;

const supabaseBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

function safeGetItem(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSetItem(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch {}
}

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  const key = 'link_bio_session_id';
  let id = safeGetItem(key);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    safeSetItem(key, id);
  }
  return id;
}

function luhnCheck(num: string): boolean {
  const digits = num.replace(/\D/g, '');
  if (digits.length < 13) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}
function isValidExpiry(exp: string): boolean {
  const m = exp.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return false;
  const month = parseInt(m[1], 10);
  const year = 2000 + parseInt(m[2], 10);
  if (month < 1 || month > 12) return false;
  return new Date(year, month, 0).getTime() >= Date.now();
}
function isValidCpf(cpf: string): boolean {
  const c = cpf.replace(/\D/g, '');
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i], 10) * (10 - i);
  let d1 = (sum * 10) % 11; if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(c[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i], 10) * (11 - i);
  let d2 = (sum * 10) % 11; if (d2 === 10) d2 = 0;
  return d2 === parseInt(c[10], 10);
}

type Imagem = { slot: string; url: string };

export default function QuizLinkBioClient() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [imagens, setImagens] = useState<Imagem[]>([]);
  const [textValue, setTextValue] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [metodo, setMetodo] = useState<'pix' | 'card'>('pix');
  const [cpf, setCpf] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [pixCode, setPixCode] = useState('');
  const [pixQrUrl, setPixQrUrl] = useState('');
  const [pixOrderId, setPixOrderId] = useState('');
  const [paid, setPaid] = useState(false);

  const answersRef = useRef(answers);
  answersRef.current = answers;

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  const nextVisible = useCallback((from: number) => {
    let n = from + 1;
    const a = answersRef.current;
    while (n < STEPS.length - 1 && STEPS[n].showIf && !STEPS[n].showIf!(a)) n++;
    return Math.min(STEPS.length - 1, n);
  }, []);
  const prevVisible = useCallback((from: number) => {
    let p = from - 1;
    const a = answersRef.current;
    while (p > 0 && STEPS[p].showIf && !STEPS[p].showIf!(a)) p--;
    return Math.max(0, p);
  }, []);

  const step: LinkBioQuizStep = STEPS[stepIndex];

  async function syncSession(patch: Record<string, unknown> = {}) {
    if (!sessionId) return;
    try {
      await fetch('/api/link-bio-pro/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, respostas: answersRef.current, ...patch }),
      });
    } catch { /* fire-and-forget */ }
  }

  function goNext(patch?: Record<string, unknown>) {
    syncSession(patch);
    setStepIndex((i) => nextVisible(i));
    setTextValue('');
  }
  function goPrev() {
    setStepIndex((i) => prevVisible(i));
  }

  function selecionarOpcao(optionId: string) {
    const novo = { ...answers, [step.id]: optionId };
    setAnswers(novo);
    answersRef.current = novo;
    const patch: Record<string, unknown> = {};
    if (step.id === 'profissao') patch.profissao = optionId;
    goNext(patch);
  }

  function continuarTexto() {
    const novo = { ...answers, [step.id]: textValue };
    setAnswers(novo);
    answersRef.current = novo;
    goNext();
  }

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Envie um arquivo de imagem (JPG, PNG, HEIC).');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadError('A imagem precisa ter até 20MB.');
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      const prep = await fetch('/api/link-bio-pro/photo-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, slot: 'perfil' }),
      }).then((r) => r.json());
      if (!prep?.token) throw new Error(prep?.error ?? 'Erro ao preparar upload');

      const { error: upErr } = await supabaseBrowser.storage
        .from('bio-pro-uploads')
        .uploadToSignedUrl(prep.path, prep.token, file);
      if (upErr) throw new Error('Falha ao subir a imagem');

      const nova = [...imagens, { slot: 'perfil', url: prep.publicUrl }];
      setImagens(nova);
      await syncSession({ imagem: { slot: 'perfil', url: prep.publicUrl } });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Erro ao enviar a foto');
    } finally {
      setUploading(false);
    }
  }

  function continuarContato() {
    if (!nome.trim() || !email.trim()) return;
    syncSession({ nome: nome.trim(), email: email.trim(), telefone: telefone.replace(/\D/g, '') });
    setStepIndex((i) => nextVisible(i));
  }

  async function pagarPix() {
    setPayError('');
    const cleanCpf = cpf.replace(/\D/g, '');
    const cleanPhone = telefone.replace(/\D/g, '');
    if (!isValidCpf(cleanCpf)) { setPayError('CPF inválido.'); return; }
    if (cleanPhone.length < 10) { setPayError('Informe um WhatsApp válido.'); return; }
    setPaying(true);
    try {
      const res = await fetch('/api/link-bio-pro/checkout/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nome, email, cpf: cleanCpf, phone: cleanPhone, session_id: sessionId }),
      }).then((r) => r.json());
      if (res.error) { setPayError(res.error); setPaying(false); return; }
      setPixCode(res.pix_qr_code ?? '');
      setPixQrUrl(res.pix_qr_code_url ?? '');
      setPixOrderId(res.order_id ?? '');
      setPaying(false);
      if (res.pix_qr_code) pollPix(res.order_id);
    } catch {
      setPayError('Erro ao gerar PIX. Tente de novo.');
      setPaying(false);
    }
  }

  function pollPix(orderId: string) {
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/link-bio-pro/checkout/pix/status?order_id=${orderId}&email=${encodeURIComponent(email)}`).then((r) => r.json());
        if (res.pix_qr_code && !pixCode) setPixCode(res.pix_qr_code);
        if (res.paid) {
          clearInterval(iv);
          setPaid(true);
          router.push('/link-bio-pro/obrigado');
        }
      } catch { /* tenta de novo no próximo tick */ }
    }, 5000);
  }

  async function pagarCartao() {
    setPayError('');
    const cleanCpf = cpf.replace(/\D/g, '');
    const cleanCep = cep.replace(/\D/g, '');
    if (!luhnCheck(cardNumber)) { setPayError('Número do cartão inválido.'); return; }
    if (cardName.trim().length < 3) { setPayError('Informe o nome como está no cartão.'); return; }
    if (!isValidExpiry(cardExpiry)) { setPayError('Validade do cartão inválida.'); return; }
    if (cardCvv.length < 3) { setPayError('CVV inválido.'); return; }
    if (!isValidCpf(cleanCpf)) { setPayError('CPF inválido.'); return; }
    if (cleanCep.length !== 8 || !city || !state) { setPayError('Preencha o endereço de cobrança (CEP, cidade, UF).'); return; }

    setPaying(true);
    try {
      const publishableKey = process.env.NEXT_PUBLIC_PAGARME_PUBLISHABLE_KEY;
      const tokenRes = await fetch(`https://api.pagar.me/core/v5/tokens?appId=${publishableKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'card',
          card: {
            number: cardNumber.replace(/\s/g, ''),
            holder_name: cardName.trim(),
            holder_document: cleanCpf,
            exp_month: parseInt(cardExpiry.split('/')[0], 10),
            exp_year: parseInt('20' + cardExpiry.split('/')[1], 10),
            cvv: cardCvv,
            billing_address: { line_1: `${street}, ${addressNumber}`.trim(), zip_code: cleanCep, city, state, country: 'BR' },
          },
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenData?.errors?.[0]?.message ?? 'Erro ao validar cartão');

      const res = await fetch('/api/link-bio-pro/checkout/card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nome, email, cpf: cleanCpf, phone: telefone.replace(/\D/g, ''),
          card_token: tokenData.id, session_id: sessionId,
          billing_address: { line_1: `${street}, ${addressNumber}`.trim(), cep: cleanCep, city, state },
        }),
      }).then((r) => r.json());

      if (res.error) { setPayError(res.error); setPaying(false); return; }
      if (res.paid) {
        setPaid(true);
        router.push('/link-bio-pro/obrigado');
      } else {
        setPayError('Pagamento não aprovado. Tente outro cartão ou use o PIX.');
      }
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Erro ao processar o cartão.');
    } finally {
      setPaying(false);
    }
  }

  const progresso = useMemo(() => Math.round(((stepIndex + 1) / STEPS.length) * 100), [stepIndex]);

  return (
    <div className="min-h-dvh flex justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md px-5 py-8 text-white">
        <div className="h-1.5 w-full rounded-full bg-white/10 mb-8 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progresso}%`, background: 'var(--pink)' }} />
        </div>

        {step.kind === 'info' && (
          <div className="text-center">
            <h1 className="text-2xl font-extrabold mb-3">{step.title}</h1>
            {step.subtitle && <p className="text-white/70 mb-8 leading-relaxed">{step.subtitle}</p>}
            <button onClick={() => goNext()} className="w-full rounded-2xl py-4 font-bold text-white" style={{ background: 'var(--pink)' }}>
              {step.ctaText ?? 'Continuar'}
            </button>
          </div>
        )}

        {step.kind === 'single' && (
          <div>
            <h1 className="text-2xl font-extrabold mb-2">{step.title}</h1>
            {step.subtitle && <p className="text-white/70 mb-6">{step.subtitle}</p>}
            <div className="grid gap-3">
              {step.options?.map((o) => (
                <button
                  key={o.id}
                  onClick={() => selecionarOpcao(o.id)}
                  className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 text-left font-semibold hover:bg-white/10 transition"
                >
                  {o.emoji && <span className="text-xl">{o.emoji}</span>}
                  {o.label}
                </button>
              ))}
            </div>
            {stepIndex > 0 && <button onClick={goPrev} className="mt-6 text-sm text-white/50">← Voltar</button>}
          </div>
        )}

        {step.kind === 'textarea' && (
          <div>
            <h1 className="text-2xl font-extrabold mb-2">{step.title}</h1>
            {step.subtitle && <p className="text-white/70 mb-4">{step.subtitle}</p>}
            <textarea
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder={step.placeholder}
              rows={4}
              className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-white/40"
            />
            <button
              onClick={continuarTexto}
              className="w-full rounded-2xl py-4 font-bold text-white mt-5 disabled:opacity-40"
              style={{ background: 'var(--pink)' }}
            >
              Continuar
            </button>
            <button onClick={goPrev} className="mt-4 text-sm text-white/50 block mx-auto">← Voltar</button>
          </div>
        )}

        {step.kind === 'photo' && (
          <div>
            <h1 className="text-2xl font-extrabold mb-2">{step.title}</h1>
            {step.subtitle && <p className="text-white/70 mb-5">{step.subtitle}</p>}
            {imagens.length > 0 ? (
              <div className="flex flex-col items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagens[imagens.length - 1].url} alt="Foto enviada" className="w-40 h-40 rounded-full object-cover border-4 border-white/20" />
                <button onClick={() => goNext()} className="w-full rounded-2xl py-4 font-bold text-white" style={{ background: 'var(--pink)' }}>
                  Continuar
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/20 py-12 cursor-pointer hover:border-white/40 transition">
                <input type="file" accept="image/*" onChange={handleFoto} className="hidden" disabled={uploading} />
                <span className="text-4xl">📷</span>
                <span className="text-white/70 font-semibold">{uploading ? 'Enviando...' : 'Toque para escolher a foto'}</span>
              </label>
            )}
            {uploadError && <p className="text-red-300 text-sm mt-3">{uploadError}</p>}
            <button onClick={goPrev} className="mt-6 text-sm text-white/50 block mx-auto">← Voltar</button>
          </div>
        )}

        {step.kind === 'contact' && (
          <div>
            <h1 className="text-2xl font-extrabold mb-2">{step.title}</h1>
            {step.subtitle && <p className="text-white/70 mb-5">{step.subtitle}</p>}
            <div className="grid gap-3">
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 outline-none focus:border-white/40" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Seu e-mail" type="email" className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 outline-none focus:border-white/40" />
              <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="WhatsApp (DDD + número)" className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 outline-none focus:border-white/40" />
            </div>
            <button onClick={continuarContato} className="w-full rounded-2xl py-4 font-bold text-white mt-5" style={{ background: 'var(--pink)' }}>
              Continuar
            </button>
            <button onClick={goPrev} className="mt-4 text-sm text-white/50 block mx-auto">← Voltar</button>
          </div>
        )}

        {step.kind === 'checkout' && !paid && (
          <div>
            <h1 className="text-2xl font-extrabold mb-1">{step.title}</h1>
            {step.subtitle && <p className="text-white/70 mb-5">{step.subtitle}</p>}

            <div className="flex gap-2 mb-5">
              <button onClick={() => setMetodo('pix')} className={`flex-1 rounded-xl py-2.5 font-semibold ${metodo === 'pix' ? 'text-white' : 'bg-white/5 text-white/50'}`} style={metodo === 'pix' ? { background: 'var(--pink)' } : {}}>PIX</button>
              <button onClick={() => setMetodo('card')} className={`flex-1 rounded-xl py-2.5 font-semibold ${metodo === 'card' ? 'text-white' : 'bg-white/5 text-white/50'}`} style={metodo === 'card' ? { background: 'var(--pink)' } : {}}>Cartão</button>
            </div>

            {!pixCode && (
              <div className="grid gap-3">
                <input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="CPF" className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 outline-none focus:border-white/40" />
                {metodo === 'card' && (
                  <>
                    <input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="Número do cartão" className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 outline-none focus:border-white/40" />
                    <input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Nome no cartão" className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 outline-none focus:border-white/40" />
                    <div className="flex gap-3">
                      <input value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} placeholder="MM/AA" className="flex-1 rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 outline-none focus:border-white/40" />
                      <input value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} placeholder="CVV" className="flex-1 rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 outline-none focus:border-white/40" />
                    </div>
                    <input value={cep} onChange={(e) => setCep(e.target.value)} placeholder="CEP" className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 outline-none focus:border-white/40" />
                    <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Rua" className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 outline-none focus:border-white/40" />
                    <div className="flex gap-3">
                      <input value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} placeholder="Número" className="flex-1 rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 outline-none focus:border-white/40" />
                      <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" className="flex-1 rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 outline-none focus:border-white/40" />
                      <input value={state} onChange={(e) => setState(e.target.value.toUpperCase())} placeholder="UF" maxLength={2} className="w-16 rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 outline-none focus:border-white/40" />
                    </div>
                  </>
                )}
                {payError && <p className="text-red-300 text-sm">{payError}</p>}
                <button
                  onClick={metodo === 'pix' ? pagarPix : pagarCartao}
                  disabled={paying}
                  className="w-full rounded-2xl py-4 font-bold text-white disabled:opacity-50"
                  style={{ background: 'var(--pink)' }}
                >
                  {paying ? 'Processando...' : 'Pagar R$ 19,90'}
                </button>
              </div>
            )}

            {pixCode && (
              <div className="text-center">
                {pixQrUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pixQrUrl} alt="QR Code PIX" className="w-48 h-48 mx-auto rounded-xl mb-4" />
                )}
                <p className="text-white/70 text-sm mb-2">PIX copia e cola</p>
                <div className="rounded-xl bg-white/5 border border-white/15 p-3 text-xs break-all font-mono mb-4">{pixCode}</div>
                <button
                  onClick={() => navigator.clipboard?.writeText(pixCode)}
                  className="w-full rounded-2xl py-3 font-bold text-white mb-2"
                  style={{ background: 'var(--pink)' }}
                >
                  Copiar código
                </button>
                <p className="text-white/50 text-xs">Assim que o pagamento cair, a página avança sozinha.</p>
              </div>
            )}

            <button onClick={goPrev} className="mt-6 text-sm text-white/50 block mx-auto">← Voltar</button>
          </div>
        )}
      </div>
    </div>
  );
}
