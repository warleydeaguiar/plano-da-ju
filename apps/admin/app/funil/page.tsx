import Sidebar from '../components/Sidebar';
import { T, fonts, shadow } from '../theme';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Funil — Admin Plano da Ju' };

/* ──────────────────────────────────────────────────────────────────────────
   MAPA VISUAL DOS FUNIS — config-driven.
   Pra adicionar/remover um toque, edite os arrays do funil em FUNIS abaixo
   (o layout se monta sozinho). Fiel ao que existe HOJE no código
   (auditoria 2026-06-18): ✓ ativo · ✋ manual · ✗ não configurado (lacuna).
   ────────────────────────────────────────────────────────────────────────── */

type Channel = 'pagina' | 'rastreio' | 'whatsapp' | 'email' | 'sms' | 'ia' | 'sistema';
type Status = 'ativo' | 'manual' | 'gap';
type Step = { channel: Channel; title: string; detail: string; timing: string; status: Status };
type Stage = { n: string; title: string; subtitle: string; accent: string; steps: Step[] };
type Branch = { label: string; color: string; bg: string; stages: Stage[] };
type Section = { kind: 'stage'; stage: Stage } | { kind: 'branch'; intro: string; left: Branch; right: Branch };
type Lacuna = { channel: Channel; title: string; detail: string };
type Funnel = { key: string; label: string; sections: Section[]; lacunas: Lacuna[] };

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
  ativo:  { label: 'ativo',           color: T.green,    bg: T.greenSoft },
  manual: { label: 'manual',          color: T.goldDeep, bg: T.goldSoft },
  gap:    { label: 'não configurado', color: T.danger,   bg: T.dangerSoft },
};

/* ════════════ FUNIL 1 — PLANO CAPILAR ════════════ */
const PLANO_CAPILAR: Funnel = {
  key: 'plano', label: 'Plano Capilar',
  sections: [
    { kind: 'stage', stage: { n: '1', title: 'Aquisição — Quiz', subtitle: 'O lead entra pelo anúncio e responde o quiz', accent: T.blue, steps: [
      { channel: 'pagina',   title: 'Quiz capilar', detail: 'Lead acessa /quiz e responde (tipo, cor, o que mais incomoda…)', timing: 'Dia 0 · imediato', status: 'ativo' },
      { channel: 'rastreio', title: 'Evento Lead', detail: 'Dispara Lead no Pixel + CAPI ao concluir o quiz', timing: 'ao concluir o quiz', status: 'ativo' },
      { channel: 'sistema',  title: 'Cria o lead', detail: 'Salva em wg_quiz_leads (nome/e-mail/telefone/UTM) e escolhe o grupo de WhatsApp', timing: 'imediato', status: 'ativo' },
    ]}},
    { kind: 'stage', stage: { n: '2', title: 'Checkout — Oferta', subtitle: 'Vê a oferta e gera o pagamento', accent: T.pink, steps: [
      { channel: 'pagina',   title: 'Oferta + roleta de desconto', detail: 'Página /oferta · plano por R$ 34,90', timing: 'Dia 0 · imediato', status: 'ativo' },
      { channel: 'rastreio', title: 'InitiateCheckout / AddPaymentInfo', detail: 'Eventos no Pixel + CAPI ao iniciar o pagamento', timing: 'ao iniciar pagamento', status: 'ativo' },
      { channel: 'sistema',  title: 'Gera PIX ou cobra cartão', detail: 'PIX expira em 1h · cria o perfil como “pendente”', timing: 'imediato', status: 'ativo' },
    ]}},
    { kind: 'branch', intro: 'A partir daqui depende do pagamento ⤵',
      left: { label: '✅ Pagou', color: T.green, bg: T.greenSoft, stages: [
        { n: '3A', title: 'Ativação', subtitle: 'Confirmou o pagamento', accent: T.green, steps: [
          { channel: 'sistema',  title: 'Vira cliente ATIVA', detail: 'Perfil ativado por 90 dias (webhook do pagamento)', timing: 'na confirmação · imediato', status: 'ativo' },
          { channel: 'rastreio', title: 'Evento Purchase (CAPI)', detail: 'Compra server-side enviada à Meta — religado em 18/06', timing: 'na confirmação', status: 'ativo' },
          { channel: 'sistema',  title: 'Aviso de venda no Discord', detail: 'Notifica a equipe da nova venda', timing: 'na confirmação', status: 'ativo' },
          { channel: 'whatsapp', title: 'WhatsApp “acesso liberado”', detail: 'Template acesso_plano com botão pra criar a senha', timing: 'na confirmação · imediato', status: 'ativo' },
          { channel: 'email',    title: 'E-mail de boas-vindas / acesso', detail: 'Hoje só sai manualmente pelo painel — NÃO dispara sozinho na compra', timing: 'na confirmação', status: 'manual' },
        ]},
        { n: '4A', title: 'Plano personalizado', subtitle: 'Foto → IA → revisão → entrega', accent: T.green, steps: [
          { channel: 'ia',      title: 'Foto + geração do plano', detail: 'Lead envia a foto no app → IA (Claude Vision) monta 12 semanas', timing: 'quando entra no app', status: 'ativo' },
          { channel: 'sistema', title: 'Plano aguardando revisão', detail: 'Fica “manual_required” até a Juliane aprovar', timing: 'após gerar', status: 'ativo' },
          { channel: 'email',   title: 'E-mail “Plano pronto”', detail: 'Sai quando a Juliane aprova + cron de entrega (1x por pessoa)', timing: 'após aprovação (até ~24h)', status: 'ativo' },
        ]},
      ]},
      right: { label: '⏳ Não pagou — recuperação', color: T.goldDeep, bg: T.goldSoft, stages: [
        { n: '3B', title: 'Recuperação de PIX', subtitle: 'Gerou o PIX mas não pagou (1x por pessoa)', accent: T.goldDeep, steps: [
          { channel: 'whatsapp', title: 'WhatsApp de recuperação', detail: 'Template pix_recuperacao_v2 com o código copia-e-cola', timing: '5–40 min após gerar o PIX', status: 'ativo' },
          { channel: 'sms',      title: 'SMS de recuperação', detail: 'Aviso sem link (Zenvia) → manda ver WhatsApp/e-mail', timing: '~15 min após gerar o PIX', status: 'ativo' },
          { channel: 'email',    title: 'E-mail de recuperação de PIX', detail: 'Não existe e-mail automático pra quem não pagou', timing: '—', status: 'gap' },
        ]},
      ]},
    },
  ],
  lacunas: [
    { channel: 'email', title: 'Régua de e-mail por dia (Dia 1, Dia 3, Dia 7…)', detail: 'Não há nenhuma sequência/drip por data. O único e-mail automático é o “Plano pronto”.' },
    { channel: 'email', title: 'E-mail de boas-vindas automático na compra', detail: 'Hoje é manual — quem compra não recebe e-mail de acesso automaticamente.' },
    { channel: 'email', title: 'E-mail de recuperação de PIX', detail: 'A recuperação só tem WhatsApp + SMS. Falta o e-mail no mesmo momento (estratégia 360).' },
    { channel: 'whatsapp', title: 'Onboarding pós-compra (D+1, D+7…)', detail: 'Depois do acesso liberado não há follow-up de engajamento/uso do plano.' },
  ],
};

/* ════════════ FUNIL 2 — GRUPOS DE PROMOÇÃO ════════════ */
const GRUPOS: Funnel = {
  key: 'grupos', label: 'Grupos de Promoção',
  sections: [
    { kind: 'stage', stage: { n: '1', title: 'Aquisição — Quiz Fashion Gold', subtitle: 'Lead entra pelo anúncio dos grupos e responde o quiz', accent: T.blue, steps: [
      { channel: 'pagina',   title: 'Quiz Fashion Gold', detail: 'Lead acessa /quiz/fashion-gold e responde', timing: 'Dia 0 · imediato', status: 'ativo' },
      { channel: 'rastreio', title: 'Evento Lead', detail: 'Lead no Pixel + CAPI ao concluir (espera 700ms p/ o Pixel disparar antes de redirecionar)', timing: 'ao concluir o quiz', status: 'ativo' },
      { channel: 'sistema',  title: 'Cria o lead + mira o grupo', detail: 'Salva em wg_quiz_leads (slug fashion-gold) e escolhe o grupo mais vazio (< 1024 membros)', timing: 'imediato', status: 'ativo' },
      { channel: 'whatsapp', title: 'Manda pro WhatsApp oficial', detail: 'Redireciona pro wa.me com a mensagem pronta pra falar com a Ju', timing: 'ao finalizar o quiz', status: 'ativo' },
    ]}},
    { kind: 'stage', stage: { n: '2', title: 'Entrada no grupo', subtitle: 'Lead fala no WhatsApp e é distribuído num grupo', accent: T.green, steps: [
      { channel: 'whatsapp', title: 'Auto-resposta de boas-vindas', detail: 'Responde sozinho com o link do grupo (/g/entrar) e pergunta “o que mais te incomoda no cabelo?” 💖 (configurado no Chatwoot)', timing: 'segundos após a 1ª mensagem', status: 'ativo' },
      { channel: 'sistema',  title: 'Distribui num grupo com vaga', detail: '/g/entrar escolhe um grupo (3 camadas de fallback), loga o clique e redireciona', timing: 'ao clicar no link', status: 'ativo' },
      { channel: 'whatsapp', title: 'Follow-up 1:1 na 1ª entrada', detail: 'Mensagem pessoal “que bom que você entrou! 💚 me conta o que mais te incomoda” — 1x por telefone', timing: 'ao entrar no grupo', status: 'ativo' },
    ]}},
    { kind: 'stage', stage: { n: '3', title: 'Relacionamento — Broadcasts', subtitle: 'Ofertas recorrentes pros grupos', accent: T.pink, steps: [
      { channel: 'whatsapp', title: 'Broadcast pros grupos', detail: 'Disparo manual no painel; entrega em gotejamento anti-ban (4 grupos/lote, 25–50s entre, com spintax) via cron a cada 1 min', timing: 'recorrente (quando você cria)', status: 'ativo' },
      { channel: 'email',    title: 'Sequência de e-mail pro lead de grupo', detail: 'O motor existe (sequência por dia, âncora “lead criado”, filtro fashion-gold), mas NENHUMA sequência está ativa hoje', timing: 'recorrente', status: 'gap' },
    ]}},
    { kind: 'stage', stage: { n: '4', title: 'Conversão — Ybera', subtitle: 'Lead de grupo vira comprador Ybera', accent: T.goldDeep, steps: [
      { channel: 'sistema', title: 'Sync de pedidos Ybera', detail: 'Cron diário (9h) puxa os pedidos da Ybera pra ybera_orders', timing: 'diário', status: 'ativo' },
      { channel: 'sistema', title: 'Conversão por safra', detail: 'Cruza leads de grupo × compradores Ybera (e-mail/telefone) → % de conversão por mês de entrada (/ybera/conversao)', timing: 'recorrente', status: 'ativo' },
    ]}},
  ],
  lacunas: [
    { channel: 'whatsapp', title: 'Captura automática do “o que mais te incomoda”', detail: 'O lead responde, mas a resposta não é lida/segmentada automaticamente — hoje é tratada manualmente no Chatwoot.' },
    { channel: 'email', title: 'Sequência de e-mail ativa pro grupo', detail: 'O motor está pronto, mas não há nenhuma sequência criada — leads de grupo não recebem nutrição por e-mail.' },
    { channel: 'whatsapp', title: 'Reativação de quem não comprou', detail: 'Sem follow-up automático pra quem entrou no grupo e nunca comprou Ybera.' },
    { channel: 'sms', title: 'SMS no funil de grupos', detail: 'SMS hoje é usado só na recuperação de PIX do plano; não entra na jornada dos grupos.' },
  ],
};

const FUNIS: Funnel[] = [PLANO_CAPILAR, GRUPOS];

/* ── Render ── */
const card: React.CSSProperties = {
  background: T.surface, borderRadius: 18, border: `1px solid ${T.borderSoft}`, boxShadow: shadow.card,
};

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: bg, color, whiteSpace: 'nowrap' }}>{label}</span>
  );
}

function StepRow({ s }: { s: Step }) {
  const ch = CH[s.channel]; const st = ST[s.status]; const dim = s.status === 'gap';
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12, border: `1px solid ${T.borderSoft}`, background: dim ? 'transparent' : T.surface, borderStyle: dim ? 'dashed' : 'solid', opacity: dim ? 0.85 : 1 }}>
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

function StageBlock({ stage }: { stage: Stage }) {
  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: stage.accent + '18', color: stage.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13.5, flexShrink: 0 }}>{stage.n}</div>
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: T.ink }}>{stage.title}</div>
          <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 1 }}>{stage.subtitle}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {stage.steps.map((s, i) => <StepRow key={i} s={s} />)}
      </div>
    </div>
  );
}

function Arrow() {
  return <div style={{ textAlign: 'center', color: T.inkMuted, fontSize: 20, lineHeight: '8px', padding: '2px 0' }}>↓</div>;
}

function ColumnStages({ stages }: { stages: Stage[] }) {
  return (
    <>
      {stages.map((st, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {i > 0 && <Arrow />}
          <StageBlock stage={st} />
        </div>
      ))}
    </>
  );
}

export default async function FunilPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const sp = await searchParams;
  const funnel = FUNIS.find((f) => f.key === sp.f) ?? FUNIS[0];

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

        {/* Seletor de funil */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FUNIS.map((f) => {
            const active = f.key === funnel.key;
            return (
              <a key={f.key} href={`/funil?f=${f.key}`} style={{
                padding: '7px 16px', borderRadius: 99, fontSize: 13, fontWeight: 700, textDecoration: 'none',
                background: active ? T.pinkDeep : T.surface, color: active ? '#fff' : T.inkSoft,
                border: active ? 'none' : `1px solid ${T.borderSoft}`,
              }}>{f.label}</a>
            );
          })}
        </div>

        {/* Legenda */}
        <div style={{ ...card, padding: '12px 16px', display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Canais</span>
          {Object.values(CH).map((c) => <Chip key={c.label} label={c.label} color={c.color} bg={c.bg} />)}
          <span style={{ width: 1, height: 18, background: T.borderSoft }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</span>
          {Object.values(ST).map((s) => <Chip key={s.label} label={s.label} color={s.color} bg={s.bg} />)}
        </div>

        {/* Seções do funil */}
        {funnel.sections.map((sec, idx) => {
          if (sec.kind === 'stage') {
            return (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {idx > 0 && <Arrow />}
                <StageBlock stage={sec.stage} />
              </div>
            );
          }
          // branch
          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Arrow />
              <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: T.inkSoft }}>{sec.intro}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
                {[sec.left, sec.right].map((br, bi) => (
                  <div key={bi} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 12, background: br.bg, color: br.color, fontWeight: 800, fontSize: 14 }}>{br.label}</div>
                    <ColumnStages stages={br.stages} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Lacunas */}
        <div style={{ ...card, padding: 18, borderLeft: `4px solid ${T.alert}`, marginTop: 6 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: T.ink, marginBottom: 4 }}>🧩 Lacunas e oportunidades</div>
          <div style={{ fontSize: 12.5, color: T.inkSoft, marginBottom: 14 }}>O que NÃO existe hoje neste funil — candidatos a adicionar.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {funnel.lacunas.map((l, i) => (
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
