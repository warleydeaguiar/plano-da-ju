'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { LINK_BIO_QUIZ_STEPS, ESTILOS, PRECO_TEXTO, type LinkBioQuizStep } from '@/lib/quiz-link-bio-questions';
import { PROFISSOES } from '@/lib/quiz-link-bio-profissoes';
import { normalizeEmail, isValidEmailFormat } from '@/lib/normalize-email';
import { enrichIdentity, getTrackingSessionId, newEventId, sendServerEvent } from '@/lib/tracking-client';
import { prepararFoto, FotoNaoSuportada } from '@/lib/foto-upload';

const STEPS = LINK_BIO_QUIZ_STEPS;
const PRECO = 19.9;

const supabaseBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// ─── armazenamento local (Safari privado lança em localStorage) ──────────────
const K_SESSAO = 'link_bio_session_id';
const K_ESTADO = 'link_bio_estado';
const K_PIX = 'link_bio_pix';
const K_COMPRA = 'bio_pro_purchase';

function ler<T>(k: string): T | null {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
}
function gravar(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
}
function apagar(k: string) {
  try { localStorage.removeItem(k); } catch {}
}
function novaSessao(): string {
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  try { localStorage.setItem(K_SESSAO, JSON.stringify(id)); } catch {}
  return id;
}
function sessaoAtual(): string {
  const id = ler<string>(K_SESSAO);
  return id && /^[a-z0-9]{8,40}$/i.test(id) ? id : novaSessao();
}

// ─── validação e máscaras (mesmas regras do checkout do Plano Capilar) ──────
const digitos = (v: string) => v.replace(/\D/g, '');
function luhnCheck(num: string): boolean {
  const d = digitos(num);
  if (d.length < 13) return false;
  let soma = 0, alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = parseInt(d[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    soma += n; alt = !alt;
  }
  return soma % 10 === 0;
}
function isValidExpiry(exp: string): boolean {
  const m = exp.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return false;
  const mes = parseInt(m[1], 10);
  if (mes < 1 || mes > 12) return false;
  return new Date(2000 + parseInt(m[2], 10), mes, 0).getTime() >= Date.now();
}
function isValidCpf(cpf: string): boolean {
  const c = digitos(cpf);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(c[i], 10) * (10 - i);
  let d1 = (s * 10) % 11; if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(c[9], 10)) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(c[i], 10) * (11 - i);
  let d2 = (s * 10) % 11; if (d2 === 10) d2 = 0;
  return d2 === parseInt(c[10], 10);
}
const fmtCpf = (v: string) => digitos(v).slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
const fmtCartao = (v: string) => digitos(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
const fmtValidade = (v: string) => digitos(v).slice(0, 4).replace(/(\d{2})(\d)/, '$1/$2');
const fmtCep = (v: string) => digitos(v).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
function fmtTel(v: string) {
  const d = digitos(v).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function bandeira(num: string): string {
  const n = digitos(num);
  if (/^4/.test(n)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'Amex';
  if (/^(636|438935|504175|451416|5067|509|627780|636297|636368)/.test(n)) return 'Elo';
  if (/^(606282|3841)/.test(n)) return 'Hipercard';
  return '';
}

// Anda rápido no começo, como no quiz do Plano Capilar (fakeProgress).
const progresso = (pos: number, total: number) => {
  const t = total > 1 ? pos / (total - 1) : 0;
  return 0.06 + (1 - Math.pow(1 - t, 0.45)) * 0.86;
};

function fbq(...args: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const f = typeof window !== 'undefined' ? (window as any).fbq : undefined;
  if (typeof f === 'function') { try { f(...args); } catch {} }
}

type Imagem = { slot: string; url: string };
type Estado = {
  stepId: string;
  answers: Record<string, string>;
  imagens: Imagem[];
  nome: string;
  email: string;
  telefone: string;
};
type PixAtivo = { orderId: string; code: string; qrUrl: string; expiresAt: string | null; sessionId: string };

const inputCls = 'w-full rounded-2xl border bg-white/5 px-4 py-3.5 text-white placeholder-white/40 outline-none focus:border-white/50';
const borda = (erro: boolean) => (erro ? 'border-red-300/70' : 'border-white/15');

// Fora do componente de propósito: declarados dentro, eles eram recriados a
// cada letra digitada e o botão remontava — um toque podia se perder.
function Cta({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="w-full rounded-2xl py-4 font-bold text-white disabled:opacity-50 active:scale-[0.98] transition" style={{ background: 'var(--pink)' }}>
      {children}
    </button>
  );
}
function VoltarBtn({ visivel, onClick }: { visivel: boolean; onClick: () => void }) {
  return visivel ? <button onClick={onClick} className="mt-6 text-sm text-white/50 block mx-auto py-2">← Voltar</button> : null;
}

export default function QuizLinkBioClient() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [imagens, setImagens] = useState<Imagem[]>([]);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [erroContato, setErroContato] = useState('');
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState('');

  const [metodo, setMetodo] = useState<'pix' | 'card'>('pix');
  const [cpf, setCpf] = useState('');
  const [cartao, setCartao] = useState('');
  const [nomeCartao, setNomeCartao] = useState('');
  const [validade, setValidade] = useState('');
  const [cvv, setCvv] = useState('');
  const [cep, setCep] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [tentouPagar, setTentouPagar] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [erroPagamento, setErroPagamento] = useState('');
  const [pix, setPix] = useState<PixAtivo | null>(null);
  const [pixGerando, setPixGerando] = useState(false);
  const [pixFalhou, setPixFalhou] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [analise, setAnalise] = useState<string | null>(null);
  const [agora, setAgora] = useState(Date.now());

  const answersRef = useRef(answers);
  answersRef.current = answers;
  const contatoRef = useRef({ nome, email, telefone });
  contatoRef.current = { nome, email, telefone };
  const sessionRef = useRef('');
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restaurado = useRef(false);

  const step: LinkBioQuizStep = STEPS[stepIndex];

  // Etapas visíveis com as respostas atuais — base da barra e do índice do funil.
  const visiveis = useMemo(
    () => STEPS.map((s, i) => ({ s, i })).filter(({ s }) => !s.showIf || s.showIf(answers)),
    [answers],
  );
  const posicao = Math.max(0, visiveis.findIndex((v) => v.i === stepIndex));

  // ─── sincronização com o servidor ─────────────────────────────────────────
  const sincronizar = useCallback(async (extra: { etapa?: LinkBioQuizStep; contato?: boolean; imagem?: { slot: string; path: string } } = {}) => {
    const sid = sessionRef.current;
    if (!sid) return null;
    const campos: Record<string, unknown> = { tracking_session_id: getTrackingSessionId() };
    const a = answersRef.current;
    if (a.profissao) campos.profissao = a.profissao;
    if (extra.etapa) {
      campos.etapa_id = extra.etapa.id;
      const vis = STEPS.filter((s) => !s.showIf || s.showIf(a));
      campos.etapa_indice = Math.max(0, vis.findIndex((s) => s.id === extra.etapa!.id));
    }
    if (extra.contato) {
      campos.nome = contatoRef.current.nome.trim();
      campos.email = contatoRef.current.email.trim();
      campos.telefone = digitos(contatoRef.current.telefone);
    }
    try {
      const url = new URL(window.location.href);
      for (const k of ['utm_source', 'utm_medium', 'utm_campaign']) {
        const v = url.searchParams.get(k);
        if (v) campos[k] = v;
      }
    } catch {}
    try {
      const r = await fetch('/api/link-bio-pro/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sid, seq: Date.now(), respostas: a, campos, imagem: extra.imagem }),
      });
      const d = await r.json().catch(() => ({}));
      if (d?.pago) {
        // Esta sessão já virou um pedido pago (ex.: compra anterior no mesmo
        // celular) — começa uma nova em vez de mexer no pedido pago.
        apagar(K_ESTADO);
        const nova = novaSessao();
        sessionRef.current = nova;
        setSessionId(nova);
      }
      return { ok: r.ok, ...d };
    } catch {
      return null;
    }
  }, []);

  // ─── restaura de onde parou ───────────────────────────────────────────────
  useEffect(() => {
    const sid = sessaoAtual();
    sessionRef.current = sid;
    setSessionId(sid);
    const est = ler<Estado>(K_ESTADO);
    if (est) {
      setAnswers(est.answers ?? {});
      answersRef.current = est.answers ?? {};
      setImagens(est.imagens ?? []);
      setNome(est.nome ?? '');
      setEmail(est.email ?? '');
      setTelefone(est.telefone ?? '');
      const i = STEPS.findIndex((s) => s.id === est.stepId);
      if (i > 0) setStepIndex(i);
    }
    const p = ler<PixAtivo>(K_PIX);
    if (p && p.sessionId === sid && (!p.expiresAt || new Date(p.expiresAt).getTime() - Date.now() > 5 * 60_000)) {
      setPix(p);
    }
    restaurado.current = true;
  }, []);

  // Cada etapa vista: grava estado local, avisa o funil e volta pro topo.
  useEffect(() => {
    if (!restaurado.current || !sessionId) return;
    gravar(K_ESTADO, { stepId: step.id, answers, imagens, nome, email, telefone } satisfies Estado);
  }, [step.id, answers, imagens, nome, email, telefone, sessionId]);

  useEffect(() => {
    if (!restaurado.current || !sessionId) return;
    sincronizar({ etapa: step });
    try { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); } catch {}
    if (step.kind === 'checkout') {
      const chave = `link_bio_ic_${sessionId}`;
      if (!ler(chave)) {
        gravar(chave, 1);
        const eventId = newEventId();
        fbq('track', 'InitiateCheckout', { value: PRECO, currency: 'BRL', content_name: 'Link na Bio PRO' }, { eventID: eventId });
        sendServerEvent('InitiateCheckout', { eventId, value: PRECO, currency: 'BRL', contentName: 'Link na Bio PRO', email: contatoRef.current.email || undefined });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id, sessionId]);

  // ─── navegação ────────────────────────────────────────────────────────────
  const proximo = useCallback((de: number) => {
    let n = de + 1;
    while (n < STEPS.length - 1 && STEPS[n].showIf && !STEPS[n].showIf!(answersRef.current)) n++;
    return Math.min(STEPS.length - 1, n);
  }, []);
  const anterior = useCallback((de: number) => {
    let p = de - 1;
    while (p > 0 && STEPS[p].showIf && !STEPS[p].showIf!(answersRef.current)) p--;
    return Math.max(0, p);
  }, []);
  const avancar = () => setStepIndex((i) => proximo(i));
  const voltar = () => setStepIndex((i) => anterior(i));

  function responder(id: string, valor: string) {
    const novo = { ...answersRef.current, [id]: valor };
    answersRef.current = novo;
    setAnswers(novo);
    return novo;
  }

  function escolherProfissao(id: string) {
    // Trocou de profissão: some com OAB/CRM/etc. da anterior.
    const outros = Object.entries(PROFISSOES).filter(([pid]) => pid !== id).flatMap(([, p]) => p.stepsExtra);
    const novo: Record<string, string> = { ...answersRef.current, profissao: id };
    for (const k of outros) delete novo[k];
    answersRef.current = novo;
    setAnswers(novo);
    avancar();
  }

  // ─── contato (Lead) ───────────────────────────────────────────────────────
  function continuarContato() {
    const n = nome.trim();
    const { email: em, corrected } = normalizeEmail(email);
    const tel = digitos(telefone);
    if (n.length < 2) return setErroContato('Escreva seu nome.');
    if (!isValidEmailFormat(em)) return setErroContato('Confira o e-mail (ex.: nome@email.com).');
    if (tel.length < 10 || tel.length > 11) return setErroContato('Confira o WhatsApp com DDD.');
    setErroContato('');
    if (corrected) setEmail(em);
    contatoRef.current = { nome: n, email: em, telefone: tel };
    sincronizar({ contato: true });
    enrichIdentity({ email: em, phone: tel });
    const chave = `link_bio_lead_${sessionRef.current}`;
    if (!ler(chave)) {
      gravar(chave, 1);
      const eventId = newEventId();
      fbq('track', 'Lead', { content_name: 'Link na Bio PRO' }, { eventID: eventId });
      sendServerEvent('Lead', { eventId, email: em, phone: tel, contentName: 'Link na Bio PRO' });
    }
    avancar();
  }

  // ─── foto (opcional — a venda nunca espera upload) ────────────────────────
  async function escolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const bruto = e.target.files?.[0];
    e.target.value = '';
    if (!bruto) return;
    // iPhone/Android às vezes mandam HEIC com `type` vazio: aceita pela extensão.
    const ehImagem = bruto.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(bruto.name);
    if (!ehImagem) return setErroFoto('Escolha uma foto (JPG, PNG ou do iPhone).');
    setEnviandoFoto(true);
    setErroFoto('');
    try {
      const arquivo = await prepararFoto(bruto);
      const prep = await fetch('/api/link-bio-pro/photo-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionRef.current, slot: 'perfil' }),
      }).then((r) => r.json());
      if (!prep?.token) throw new Error(prep?.error ?? 'Não consegui preparar o envio.');

      const tipo = arquivo.type || (/\.hei[cf]$/i.test(arquivo.name) ? 'image/heic' : 'image/jpeg');
      const { error } = await supabaseBrowser.storage
        .from('bio-pro-uploads')
        .uploadToSignedUrl(prep.path, prep.token, arquivo, { contentType: tipo });
      if (error) throw new Error('A foto não subiu. Confira a internet e tente de novo.');

      const r = await sincronizar({ imagem: { slot: 'perfil', path: prep.path } });
      if (!r?.ok || !r.imagem?.url) throw new Error(r?.error ?? 'Não consegui salvar a foto.');
      setImagens((atual) => [...atual, { slot: 'perfil', url: r.imagem.url }]);
    } catch (err) {
      setErroFoto(err instanceof FotoNaoSuportada || err instanceof Error ? err.message : 'Erro ao enviar a foto.');
    } finally {
      setEnviandoFoto(false);
    }
  }

  // ─── checkout ─────────────────────────────────────────────────────────────
  async function buscarCep(valor: string) {
    const d = digitos(valor);
    if (d.length !== 8) return;
    setBuscandoCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`).then((x) => x.json());
      if (!r?.erro) {
        if (r.logradouro) setRua([r.logradouro, r.bairro].filter(Boolean).join(', '));
        if (r.localidade) setCidade(r.localidade);
        if (r.uf) setUf(r.uf);
      }
    } catch { /* preenche à mão */ } finally {
      setBuscandoCep(false);
    }
  }

  const faltando = useMemo(() => {
    const f: string[] = [];
    if (!isValidCpf(cpf)) f.push('CPF');
    if (metodo === 'card') {
      if (!luhnCheck(cartao)) f.push('número do cartão');
      if (nomeCartao.trim().length < 3) f.push('nome no cartão');
      if (!isValidExpiry(validade)) f.push('validade');
      if (cvv.length < 3) f.push('CVV');
      if (digitos(cep).length !== 8) f.push('CEP');
      if (!rua.trim()) f.push('rua');
      if (!numero.trim()) f.push('número');
      if (!cidade.trim() || uf.trim().length !== 2) f.push('cidade/UF');
    }
    return f;
  }, [cpf, metodo, cartao, nomeCartao, validade, cvv, cep, rua, numero, cidade, uf]);

  const pararConsulta = () => { if (pollRef.current) clearTimeout(pollRef.current); pollRef.current = null; };
  useEffect(() => pararConsulta, []);

  const concluirCompra = useCallback((orderId: string | null) => {
    pararConsulta();
    if (orderId) gravar(K_COMPRA, { orderId, value: PRECO, ts: Date.now() });
    apagar(K_ESTADO);
    apagar(K_PIX);
    novaSessao(); // próxima compra neste celular começa do zero
    router.push('/link-bio-pro/obrigado');
  }, [router]);

  const consultar = useCallback((orderId: string, sid: string, modo: 'pix' | 'card', tentativa = 0) => {
    pararConsulta();
    const intervalo = modo === 'pix' ? 4000 : 5000;
    pollRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/link-bio-pro/checkout/status?order_id=${orderId}&session_id=${sid}`).then((x) => x.json());
        if (r.paid) return concluirCompra(orderId);
        if (modo === 'pix') {
          if (r.pix_qr_code) {
            setPix((p) => {
              const novo = { orderId, code: r.pix_qr_code, qrUrl: r.pix_qr_code_url ?? '', expiresAt: r.expires_at ?? null, sessionId: sid };
              if (!p?.code) gravar(K_PIX, novo);
              return p?.code ? p : novo;
            });
            setPixGerando(false);
          }
          if (r.falhou) { setPixFalhou(true); setPixGerando(false); apagar(K_PIX); return; }
        } else if (r.falhou) {
          setAnalise(null);
          setErroPagamento('O banco não aprovou o pagamento. Tente outro cartão ou pague via PIX.');
          return;
        }
      } catch { /* tenta de novo */ }
      // Cartão em análise: desiste da tela depois de ~5 min (o e-mail confirma depois).
      if (modo === 'card' && tentativa > 60) return;
      consultar(orderId, sid, modo, tentativa + 1);
    }, tentativa === 0 && modo === 'pix' ? 2000 : intervalo);
  }, [concluirCompra]);

  // PIX retomado do localStorage: volta a consultar sozinho.
  useEffect(() => {
    if (pix && sessionId && !pollRef.current) consultar(pix.orderId, sessionId, 'pix');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pix?.orderId, sessionId]);

  // Relógio da expiração do PIX.
  useEffect(() => {
    if (!pix?.expiresAt) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pix?.expiresAt]);

  async function pagar() {
    setTentouPagar(true);
    setErroPagamento('');
    if (faltando.length) return setErroPagamento(`Falta preencher: ${faltando.join(', ')}.`);
    const sid = sessionRef.current;
    const { nome: n, email: em, telefone: tel } = contatoRef.current;
    if (!n || !em || digitos(tel).length < 10) {
      setErroPagamento('Faltam seus dados de contato.');
      const i = STEPS.findIndex((s) => s.id === 'contato');
      if (i >= 0) setStepIndex(i);
      return;
    }
    setPagando(true);
    try {
      if (metodo === 'pix') {
        setPixFalhou(false);
        const r = await fetch('/api/link-bio-pro/checkout/pix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: n, email: em, cpf: digitos(cpf), phone: digitos(tel), session_id: sid }),
        }).then((x) => x.json());
        if (r.error) return setErroPagamento(r.error);
        if (r.paid) return concluirCompra(r.order_id ?? null);
        if (r.email && r.email !== em) setEmail(r.email);
        if (r.pix_qr_code) {
          const novo = { orderId: r.order_id, code: r.pix_qr_code, qrUrl: r.pix_qr_code_url ?? '', expiresAt: r.expires_at ?? null, sessionId: sid };
          setPix(novo);
          gravar(K_PIX, novo);
        } else {
          setPix({ orderId: r.order_id, code: '', qrUrl: '', expiresAt: null, sessionId: sid });
          setPixGerando(true);
        }
        consultar(r.order_id, sid, 'pix');
        return;
      }

      const chave = process.env.NEXT_PUBLIC_PAGARME_PUBLISHABLE_KEY;
      if (!chave) return setErroPagamento('Pagamento indisponível agora. Tente o PIX.');
      const endereco = { line_1: `${rua.trim()}, ${numero.trim()}`, zip_code: digitos(cep), city: cidade.trim(), state: uf.trim().toUpperCase(), country: 'BR' };
      const tokenRes = await fetch(`https://api.pagar.me/core/v5/tokens?appId=${chave}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'card',
          card: {
            number: digitos(cartao), holder_name: nomeCartao.trim(), holder_document: digitos(cpf),
            exp_month: parseInt(validade.slice(0, 2), 10), exp_year: 2000 + parseInt(validade.slice(3, 5), 10),
            cvv, billing_address: endereco,
          },
        }),
      });
      const token = await tokenRes.json();
      if (!tokenRes.ok) return setErroPagamento('Confira os dados do cartão — o banco não aceitou o número, a validade ou o CVV.');

      const r = await fetch('/api/link-bio-pro/checkout/card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: n, email: em, cpf: digitos(cpf), phone: digitos(tel), card_token: token.id, session_id: sid,
          billing_address: { line_1: endereco.line_1, cep: endereco.zip_code, city: endereco.city, state: endereco.state },
        }),
      }).then((x) => x.json());
      if (r.error) return setErroPagamento(r.error);
      if (r.paid) return concluirCompra(r.order_id ?? null);
      if (r.analise && r.order_id) {
        setAnalise(r.order_id);
        consultar(r.order_id, sid, 'card');
        return;
      }
      setErroPagamento('O banco não aprovou o pagamento. Tente outro cartão ou pague via PIX (aprovação na hora).');
    } catch {
      setErroPagamento('Não consegui falar com o pagamento agora. Confira a internet e tente de novo.');
    } finally {
      setPagando(false);
    }
  }

  function copiarPix() {
    if (!pix?.code) return;
    navigator.clipboard?.writeText(pix.code).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    }).catch(() => {});
  }

  const restante = pix?.expiresAt ? Math.max(0, new Date(pix.expiresAt).getTime() - agora) : null;
  const pixExpirado = restante !== null && restante <= 0;
  useEffect(() => {
    if (pixExpirado) { pararConsulta(); apagar(K_PIX); }
  }, [pixExpirado]);
  const estiloEscolhido = ESTILOS.find((e) => e.label === answers.estilo);
  const enter = (fn: () => void) => (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); fn(); } };
  const voltarVisivel = stepIndex > 0;

  return (
    <div className="min-h-dvh flex justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md px-5 py-8 text-white">
        <div className="h-1.5 w-full rounded-full bg-white/10 mb-8 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.round(progresso(posicao, visiveis.length) * 100)}%`, background: 'var(--pink)' }} />
        </div>

        {step.kind === 'info' && (
          <div>
            <h1 className="text-[1.7rem] leading-tight font-extrabold mb-3">{step.title}</h1>
            {step.subtitle && <p className="text-white/70 mb-6 leading-relaxed">{step.subtitle}</p>}
            {step.itens && (
              <ul className="grid gap-3 mb-6">
                {step.itens.map((t) => (
                  <li key={t} className="flex gap-3 items-start text-white/90">
                    <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full grid place-items-center text-xs font-bold" style={{ background: 'var(--pink)' }}>✓</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            )}
            <Cta onClick={avancar}>{step.ctaText ?? 'Continuar'}</Cta>
            <p className="mt-5 text-center text-xs text-white/50">
              Exemplos:{' '}
              {ESTILOS.filter((e) => e.exemplo).map((e, i) => (
                <span key={e.id}>{i > 0 && ' · '}<a href={e.exemplo} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{e.label}</a></span>
              ))}
            </p>
          </div>
        )}

        {step.kind === 'single' && (
          <div>
            <h1 className="text-2xl font-extrabold mb-2">{step.title}</h1>
            {step.subtitle && <p className="text-white/70 mb-6">{step.subtitle}</p>}
            <div className="grid gap-3">
              {step.options?.map((o) => {
                const marcado = answers[step.id] === o.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => (step.id === 'profissao' ? escolherProfissao(o.id) : (responder(step.id, o.id), avancar()))}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left font-semibold transition active:scale-[0.98] ${marcado ? 'border-white/60 bg-white/15' : 'border-white/15 bg-white/5 hover:bg-white/10'}`}
                  >
                    {o.emoji && <span className="text-xl">{o.emoji}</span>}
                    {o.label}
                  </button>
                );
              })}
            </div>
            <VoltarBtn visivel={voltarVisivel} onClick={voltar} />
          </div>
        )}

        {step.kind === 'textarea' && (
          <div>
            <h1 className="text-2xl font-extrabold mb-2">{step.title}</h1>
            {step.subtitle && <p className="text-white/70 mb-4">{step.subtitle}</p>}
            <textarea
              value={answers[step.id] ?? ''}
              onChange={(e) => responder(step.id, e.target.value)}
              placeholder={step.placeholder}
              rows={4}
              className={`${inputCls} ${borda(false)}`}
            />
            <div className="mt-5"><Cta onClick={avancar}>{(answers[step.id] ?? '').trim() ? 'Continuar' : 'Pular'}</Cta></div>
            <VoltarBtn visivel={voltarVisivel} onClick={voltar} />
          </div>
        )}

        {step.kind === 'contact' && (
          <div>
            <h1 className="text-2xl font-extrabold mb-2">{step.title}</h1>
            {step.subtitle && <p className="text-white/70 mb-5">{step.subtitle}</p>}
            <div className="grid gap-3">
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" autoComplete="name" className={`${inputCls} ${borda(false)}`} onKeyDown={enter(continuarContato)} />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Seu e-mail" type="email" inputMode="email" autoComplete="email" className={`${inputCls} ${borda(false)}`} onKeyDown={enter(continuarContato)} />
              <input value={fmtTel(telefone)} onChange={(e) => setTelefone(digitos(e.target.value))} placeholder="WhatsApp com DDD" inputMode="tel" autoComplete="tel" className={`${inputCls} ${borda(false)}`} onKeyDown={enter(continuarContato)} />
            </div>
            {erroContato && <p className="text-red-300 text-sm mt-3">{erroContato}</p>}
            <div className="mt-5"><Cta onClick={continuarContato}>Continuar</Cta></div>
            <p className="mt-3 text-center text-xs text-white/40">Seus dados ficam só com a Juliane.</p>
            <VoltarBtn visivel={voltarVisivel} onClick={voltar} />
          </div>
        )}

        {step.kind === 'estilo' && (
          <div>
            <h1 className="text-2xl font-extrabold mb-2">{step.title}</h1>
            {step.subtitle && <p className="text-white/70 mb-5">{step.subtitle}</p>}
            <div className="grid grid-cols-2 gap-3">
              {step.options?.map((o) => {
                const marcado = answers.estilo === o.label;
                return (
                  <div key={o.id} className={`rounded-2xl border overflow-hidden transition ${marcado ? 'border-white ring-2 ring-white/60' : 'border-white/15'} ${o.id === 'livre' ? 'col-span-2' : ''}`}>
                    <button onClick={() => { responder('estilo', o.label); avancar(); }} className="block w-full text-left active:scale-[0.98] transition">
                      <span className={`block ${o.id === 'livre' ? 'h-12' : 'h-24'}`} style={{ background: o.preview }} />
                      <span className="block px-3 pt-2.5 font-bold">{o.label}</span>
                      <span className="block px-3 pb-2 text-xs text-white/60 leading-snug">{o.descricao}</span>
                    </button>
                    {o.exemplo && (
                      <a href={o.exemplo} target="_blank" rel="noopener noreferrer" className="block px-3 pb-3 text-xs font-semibold underline underline-offset-2" style={{ color: '#ffb3c9' }}>
                        ver exemplo ↗
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
            <VoltarBtn visivel={voltarVisivel} onClick={voltar} />
          </div>
        )}

        {step.kind === 'photo' && (
          <div>
            <h1 className="text-2xl font-extrabold mb-2">{step.title}</h1>
            {step.subtitle && <p className="text-white/70 mb-5">{step.subtitle}</p>}
            {imagens.length > 0 ? (
              <div className="flex flex-col items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagens[imagens.length - 1].url} alt="Sua foto" className="w-40 h-40 rounded-full object-cover border-4 border-white/20" />
                <label className="text-sm text-white/70 underline underline-offset-2 cursor-pointer">
                  <input type="file" accept="image/*" onChange={escolherFoto} className="hidden" disabled={enviandoFoto} />
                  {enviandoFoto ? 'Enviando…' : 'Trocar foto'}
                </label>
                <Cta onClick={avancar}>Continuar</Cta>
              </div>
            ) : (
              <>
                <label className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/20 py-12 cursor-pointer hover:border-white/40 transition">
                  <input type="file" accept="image/*" onChange={escolherFoto} className="hidden" disabled={enviandoFoto} />
                  <span className="text-4xl">{enviandoFoto ? '⏳' : '📷'}</span>
                  <span className="text-white/70 font-semibold">{enviandoFoto ? 'Enviando a foto…' : 'Toque para escolher a foto'}</span>
                </label>
                <button onClick={avancar} className="w-full mt-4 rounded-2xl py-3.5 font-semibold text-white/80 border border-white/15">
                  Pular — mando depois pelo WhatsApp
                </button>
              </>
            )}
            {erroFoto && <p className="text-red-300 text-sm mt-3">{erroFoto}</p>}
            <VoltarBtn visivel={voltarVisivel} onClick={voltar} />
          </div>
        )}

        {step.kind === 'checkout' && (
          <div>
            <h1 className="text-2xl font-extrabold mb-1">{step.title}</h1>
            {step.subtitle && <p className="text-white/70 mb-5">{step.subtitle}</p>}

            <div className="rounded-2xl border border-white/15 bg-white/5 p-4 mb-5">
              <div className="flex justify-between items-baseline">
                <span className="font-bold">Link na Bio PRO</span>
                <span className="font-extrabold text-lg">{PRECO_TEXTO}</span>
              </div>
              <p className="text-sm text-white/60 mt-1">
                {PROFISSOES[answers.profissao]?.label ?? 'Bio personalizada'}{estiloEscolhido ? ` · estilo ${estiloEscolhido.label}` : ''} · feita pela Juliane
              </p>
            </div>

            {analise ? (
              <div className="text-center rounded-2xl border border-white/15 bg-white/5 p-6">
                <div className="text-3xl mb-3">⏳</div>
                <p className="font-bold mb-1">Pagamento em análise</p>
                <p className="text-sm text-white/60">O banco está conferindo. Esta tela avança sozinha — e você recebe a confirmação por e-mail. Não precisa pagar de novo.</p>
                {erroPagamento && <p className="text-red-300 text-sm mt-3">{erroPagamento}</p>}
              </div>
            ) : pix && !pixFalhou && !pixExpirado ? (
              <div className="text-center">
                {!pix.code || pixGerando ? (
                  <div className="rounded-2xl border border-white/15 bg-white/5 p-6">
                    <div className="mx-auto mb-3 h-8 w-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    <p className="font-bold">Gerando seu código PIX…</p>
                    <p className="text-sm text-white/60 mt-1">Leva alguns segundos. Também mando o código pro seu e-mail.</p>
                  </div>
                ) : (
                  <>
                    {pix.qrUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pix.qrUrl} alt="QR Code PIX" className="w-48 h-48 mx-auto rounded-xl mb-4 bg-white p-2" />
                    )}
                    <p className="text-white/70 text-sm mb-2">PIX copia e cola</p>
                    <div className="rounded-xl bg-white/5 border border-white/15 p-3 text-xs break-all font-mono mb-4 text-left">{pix.code}</div>
                    <Cta onClick={copiarPix}>{copiado ? 'Copiado! ✓' : 'Copiar código'}</Cta>
                    <p className="text-white/50 text-xs mt-3">
                      Assim que o pagamento cair, a página avança sozinha.
                      {restante !== null && ` Expira em ${Math.floor(restante / 60000)}:${String(Math.floor((restante % 60000) / 1000)).padStart(2, '0')}.`}
                    </p>
                  </>
                )}
                <button onClick={() => { pararConsulta(); setPix(null); apagar(K_PIX); setPixGerando(false); }} className="mt-5 text-sm text-white/50 underline underline-offset-2">
                  Trocar forma de pagamento
                </button>
              </div>
            ) : (
              <>
                {(pixFalhou || pixExpirado) && (
                  <p className="text-amber-200 text-sm mb-4">{pixExpirado ? 'Esse PIX expirou.' : 'O PIX não foi gerado.'} Gere um novo abaixo — leva segundos.</p>
                )}
                <div className="flex gap-2 mb-4">
                  {(['pix', 'card'] as const).map((m) => (
                    <button key={m} onClick={() => { setMetodo(m); setErroPagamento(''); }} className={`flex-1 rounded-xl py-2.5 font-semibold ${metodo === m ? 'text-white' : 'bg-white/5 text-white/50'}`} style={metodo === m ? { background: 'var(--pink)' } : {}}>
                      {m === 'pix' ? 'PIX' : 'Cartão'}
                    </button>
                  ))}
                </div>

                <div className="grid gap-3">
                  <input value={fmtCpf(cpf)} onChange={(e) => setCpf(digitos(e.target.value))} placeholder="CPF" inputMode="numeric" className={`${inputCls} ${borda(tentouPagar && !isValidCpf(cpf))}`} />
                  {metodo === 'card' && (
                    <>
                      <div className="relative">
                        <input value={fmtCartao(cartao)} onChange={(e) => setCartao(digitos(e.target.value))} placeholder="Número do cartão" inputMode="numeric" autoComplete="cc-number" className={`${inputCls} ${borda(tentouPagar && !luhnCheck(cartao))}`} />
                        {bandeira(cartao) && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-white/60">{bandeira(cartao)}</span>}
                      </div>
                      <input value={nomeCartao} onChange={(e) => setNomeCartao(e.target.value)} placeholder="Nome como está no cartão" autoComplete="cc-name" className={`${inputCls} ${borda(tentouPagar && nomeCartao.trim().length < 3)}`} />
                      <div className="flex gap-3">
                        <input value={fmtValidade(validade)} onChange={(e) => setValidade(fmtValidade(e.target.value))} placeholder="MM/AA" inputMode="numeric" autoComplete="cc-exp" className={`${inputCls} ${borda(tentouPagar && !isValidExpiry(validade))}`} />
                        <input value={cvv} onChange={(e) => setCvv(digitos(e.target.value).slice(0, 4))} placeholder="CVV" inputMode="numeric" autoComplete="cc-csc" className={`${inputCls} ${borda(tentouPagar && cvv.length < 3)}`} />
                      </div>
                      <input value={fmtCep(cep)} onChange={(e) => { setCep(digitos(e.target.value)); buscarCep(e.target.value); }} placeholder={buscandoCep ? 'Buscando endereço…' : 'CEP do endereço do cartão'} inputMode="numeric" autoComplete="postal-code" className={`${inputCls} ${borda(tentouPagar && digitos(cep).length !== 8)}`} />
                      <input value={rua} onChange={(e) => setRua(e.target.value)} placeholder="Rua e bairro" autoComplete="address-line1" className={`${inputCls} ${borda(tentouPagar && !rua.trim())}`} />
                      <div className="flex gap-3">
                        <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Número" className={`w-24 ${inputCls} ${borda(tentouPagar && !numero.trim())}`} />
                        <input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade" autoComplete="address-level2" className={`flex-1 ${inputCls} ${borda(tentouPagar && !cidade.trim())}`} />
                        <input value={uf} onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))} placeholder="UF" className={`w-16 ${inputCls} ${borda(tentouPagar && uf.length !== 2)}`} />
                      </div>
                    </>
                  )}
                  {erroPagamento && <p className="text-red-300 text-sm">{erroPagamento}</p>}
                  <Cta onClick={pagar} disabled={pagando}>
                    {pagando ? 'Processando…' : metodo === 'pix' ? `Gerar PIX de ${PRECO_TEXTO}` : `Pagar ${PRECO_TEXTO}`}
                  </Cta>
                  <p className="text-center text-xs text-white/40">Pagamento seguro processado pela Pagar.me.</p>
                </div>
              </>
            )}
            {(!pix || pixFalhou || pixExpirado) && !analise && <VoltarBtn visivel={voltarVisivel} onClick={voltar} />}
          </div>
        )}
      </div>
    </div>
  );
}
