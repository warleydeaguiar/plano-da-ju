import Sidebar from '../components/Sidebar';
import { T, fonts, shadow } from '../theme';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Funil — Admin Plano da Ju' };

/* ──────────────────────────────────────────────────────────────────────────
   MAPA VISUAL DO FUNIL — Plano Capilar
   Tudo aqui é CONFIG. Pra adicionar/remover um toque do funil, edite os arrays
   abaixo (não precisa mexer no layout). Mantido fiel ao que existe HOJE no
   código (auditoria 2026-06-18): ✓ ativo · ✋ manual · ✗ não configurado (lacuna).
   ────────────────────────────────────────────────────────────────────────── */

type Channel = 'pagina' | 'rastreio' | 'whatsapp' | 'email' | 'sms' | 'ia' | 'sistema';
type Status = 'ativo' | 'manual' | 'gap';
type Step = { channel: Channel; title: string; detail: string; timing: string; status: Status };

const CH: Record<Channel, { label: string; color: string; bg: string }> = {
  pagina:   { label: 'Página',        color: T.blue,     bg: T.blueSoft },
  rastreio: { label: 'Pixel / CAPI',  color: T.purple,   bg: T.purpleSoft },
  whatsapp: { label: 'WhatsApp',      color: T.green,    bg: T.greenSoft },
  email:    { label: 'E-mail',        color: T.pinkDeep, bg: T.pinkSoft },
  sms:      { label: 'SMS',           color: T.goldDeep, bg: T.goldSoft },
  ia:       { label: 'IA',            color: '#0F766E',  bg: '#D7F0EC' },
  sistema:  { label: 'Sistema',       color: T.inkMuted, bg: T.cream },
};

const ST: Record<Status, { label: string; color: string; bg: string }> = {
  ativo:  { label: 'ativo',            color: T.green,   bg: T.greenSoft },
  manual: { label: 'manual',           color: T.goldDeep, bg: T.goldSoft },
  gap:    { label: 'não configurado',  color: T.danger,  bg: T.dangerSoft },
};

// ── Etapas comuns (antes da bifurcação pagou/não pagou) ──
const ENTRADA: Step[] = [
  { channel: 'pagina',   title: 'Quiz capilar', detail: 'Lead acessa /quiz e responde (tipo, cor, o que mais incomoda…)', timing: 'Dia 0 · imediato', status: 'ativo' },
  { channel: 'rastreio', title: 'Evento Lead', detail: 'Dispara Lead no Pixel + CAPI ao concluir o quiz', timing: 'ao concluir o quiz', status: 'ativo' },
  { channel: 'sistema',  title: 'Cria o lead', detail: 'Salva em wg_quiz_leads (nome/e-mail/telefone/UTM) e escolhe o grupo de WhatsApp', timing: 'imediato', status: 'ativo' },
];

const CHECKOUT: Step[] = [
  { channel: 'pagina',   title: 'Oferta + roleta de desconto', detail: 'Página /oferta · plano por R$ 34,90', timing: 'Dia 0 · imediato', status: 'ativo' },
  { channel: 'rastreio', title: 'InitiateCheckout / AddPaymentInfo', detail: 'Eventos no Pixel + CAPI ao iniciar o pagamento', timing: 'ao iniciar pagamento', status: 'ativo' },
  { channel: 'sistema',  title: 'Gera PIX ou cobra cartão', detail: 'PIX expira em 1h · cria o perfil como “pendente”', timing: 'imediato', status: 'ativo' },
];

// ── Ramo A: PAGOU ──
const PAGOU: Step[] = [
  { channel: 'sistema',  title: 'Vira cliente ATIVA', detail: 'Perfil ativado por 90 dias (webhook do pagamento)', timing: 'na confirmação · imediato', status: 'ativo' },
  { channel: 'rastreio', title: 'Evento Purchase (CAPI)', detail: 'Compra server-side enviada à Meta — religado em 18/06', timing: 'na confirmação', status: 'ativo' },
  { channel: 'sistema',  title: 'Aviso de venda no Discord', detail: 'Notifica a equipe da nova venda', timing: 'na confirmação', status: 'ativo' },
  { channel: 'whatsapp', title: 'WhatsApp “acesso liberado”', detail: 'Template acesso_plano com botão pra criar a senha', timing: 'na confirmação · imediato', status: 'ativo' },
  { channel: 'email',    title: 'E-mail de boas-vindas / acesso', detail: 'Hoje só sai manualmente pelo painel — NÃO dispara sozinho na compra', timing: 'na confirmação', status: 'manual' },
];

const PLANO: Step[] = [
  { channel: 'ia',       title: 'Foto + geração do plano', detail: 'Lead envia a foto no app → IA (Claude Vision) monta 12 semanas', timing: 'quando entra no app', status: 'ativo' },
  { channel: 'sistema',  title: 'Plano aguardando revisão', detail: 'Fica “manual_required” até a Juliane aprovar', timing: 'após gerar', status: 'ativo' },
  { channel: 'email',    title: 'E-mail “Plano pronto”', detail: 'Sai quando a Juliane aprova + cron de entrega (1x por pessoa)', timing: 'após aprovação (até ~24h)', status: 'ativo' },
];

// ── Ramo B: NÃO PAGOU (recuperação) ──
const NAO_PAGOU: Step[] = [
  { channel: 'whatsapp', title: 'WhatsApp de recuperação', detail: 'Template pix_recuperacao_v2 com o código copia-e-cola', timing: '5–40 min após gerar o PIX', status: 'ativo' },
  { channel: 'sms',      title: 'SMS de recuperação', detail: 'Aviso sem link (Zenvia) → manda ver WhatsApp/e-mail', timing: '~15 min após gerar o PIX', status: 'ativo' },
  { channel: 'email',    title: 'E-mail de recuperação de PIX', detail: 'Não existe e-mail automático pra quem não pagou', timing: '—', status: 'gap' },
];

// ── Lacunas / oportunidades (o que NÃO existe hoje) ──
const LACUNAS: { title: string; detail: string; channel: Channel }[] = [
  { channel: 'email', title: 'Régua de e-mail por dia (Dia 1, Dia 3, Dia 7…)', detail: 'Não há nenhuma sequência/drip por data. O único e-mail automático é o “Plano pronto”.' },
  { channel: 'email', title: 'E-mail de boas-vindas automático na compra', detail: 'Hoje é manual — quem compra não recebe e-mail de acesso automaticamente.' },
  { channel: 'email', title: 'E-mail de recuperação de PIX', detail: 'A recuperação só tem WhatsApp + SMS. Falta o e-mail no mesmo momento (estratégia 360).' },
  { channel: 'whatsapp', title: 'Onboarding pós-compra (D+1, D+7…)', detail: 'Depois do acesso liberado não há follow-up de engajamento/uso do plano.' },
];

/* ── Render ── */
const card: React.CSSProperties = {
  background: T.surface, borderRadius: 18, border: `1px solid ${T.borderSoft}`, boxShadow: shadow.card,
};

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: bg, color, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

function StepRow({ s }: { s: Step }) {
  const ch = CH[s.channel];
  const st = ST[s.status];
  const dim = s.status === 'gap';
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px',
      borderRadius: 12, border: `1px solid ${dim ? T.borderSoft : T.borderSoft}`,
      background: dim ? 'transparent' : T.surface,
      borderStyle: dim ? 'dashed' : 'solid', opacity: dim ? 0.85 : 1,
    }}>
      <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: ch.color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Chip label={ch.label} color={ch.color} bg={ch.bg} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{s.title}</span>
          <Chip label={st.label} color={st.color} bg={st.bg} />
        </div>
        <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 4, lineHeight: 1.45 }}>{s.detail}</div>
        <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 4, fontWeight: 600 }}>⏱ {s.timing}</div>
      </div>
    </div>
  );
}

function StageBlock({ n, title, subtitle, steps, accent }: {
  n: string; title: string; subtitle: string; steps: Step[]; accent: string;
}) {
  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: accent + '18', color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{n}</div>
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: T.ink }}>{title}</div>
          <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 1 }}>{subtitle}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {steps.map((s, i) => <StepRow key={i} s={s} />)}
      </div>
    </div>
  );
}

function Arrow() {
  return <div style={{ textAlign: 'center', color: T.inkMuted, fontSize: 20, lineHeight: '8px', padding: '2px 0' }}>↓</div>;
}

export default function FunilPage() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: T.bg, fontFamily: fonts.ui, color: T.ink }}>
      <Sidebar />
      <main style={{ marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto', padding: 32, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Header */}
        <div>
          <div style={{ fontSize: 26, fontWeight: 600, fontFamily: fonts.display, letterSpacing: -0.5 }}>Funil</div>
          <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4 }}>
            Mapa visual da jornada de um lead — tudo que acontece, em ordem. Pra decidir o que adicionar ou remover olhando o todo.
          </div>
        </div>

        {/* Seletor de funil (por ora só o plano capilar) */}
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ padding: '7px 16px', borderRadius: 99, fontSize: 13, fontWeight: 700, background: T.pinkDeep, color: '#fff' }}>Plano Capilar</span>
          <span style={{ padding: '7px 16px', borderRadius: 99, fontSize: 13, fontWeight: 600, background: T.surface, color: T.inkMuted, border: `1px dashed ${T.borderSoft}` }}>Grupos de Promoção (em breve)</span>
        </div>

        {/* Legenda */}
        <div style={{ ...card, padding: '12px 16px', display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Canais</span>
          {Object.values(CH).map((c) => <Chip key={c.label} label={c.label} color={c.color} bg={c.bg} />)}
          <span style={{ width: 1, height: 18, background: T.borderSoft }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</span>
          {Object.values(ST).map((s) => <Chip key={s.label} label={s.label} color={s.color} bg={s.bg} />)}
        </div>

        {/* Etapas comuns */}
        <StageBlock n="1" title="Aquisição — Quiz" subtitle="O lead entra pelo anúncio e responde o quiz" steps={ENTRADA} accent={T.blue} />
        <Arrow />
        <StageBlock n="2" title="Checkout — Oferta" subtitle="Vê a oferta e gera o pagamento" steps={CHECKOUT} accent={T.pink} />
        <Arrow />

        {/* Bifurcação */}
        <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: T.inkSoft }}>
          A partir daqui depende do pagamento ⤵
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
          {/* Ramo A: pagou */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 12, background: T.greenSoft, color: T.green, fontWeight: 800, fontSize: 14 }}>✅ Pagou</div>
            <StageBlock n="3A" title="Ativação" subtitle="Confirmou o pagamento" steps={PAGOU} accent={T.green} />
            <Arrow />
            <StageBlock n="4A" title="Plano personalizado" subtitle="Foto → IA → revisão → entrega" steps={PLANO} accent={T.green} />
          </div>
          {/* Ramo B: não pagou */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 12, background: T.goldSoft, color: T.goldDeep, fontWeight: 800, fontSize: 14 }}>⏳ Não pagou — recuperação</div>
            <StageBlock n="3B" title="Recuperação de PIX" subtitle="Gerou o PIX mas não pagou (1x por pessoa)" steps={NAO_PAGOU} accent={T.goldDeep} />
          </div>
        </div>

        {/* Lacunas */}
        <div style={{ ...card, padding: 18, borderLeft: `4px solid ${T.alert}`, marginTop: 6 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: T.ink, marginBottom: 4 }}>🧩 Lacunas e oportunidades</div>
          <div style={{ fontSize: 12.5, color: T.inkSoft, marginBottom: 14 }}>O que NÃO existe hoje no funil — candidatos a adicionar.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {LACUNAS.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12, border: `1px dashed ${T.borderSoft}` }}>
                <Chip label={CH[l.channel].label} color={CH[l.channel].color} bg={CH[l.channel].bg} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{l.title}</div>
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 3, lineHeight: 1.45 }}>{l.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ height: 16 }} />
      </main>
    </div>
  );
}
