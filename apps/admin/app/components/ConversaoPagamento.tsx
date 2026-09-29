import { T, fonts } from '../theme';

export type PeriodoPagamento = {
  pixIniciou: number;
  pixPagou: number;
  cardIniciou: number;
  cardPagou: number;
};

/**
 * Taxa de conversão de pagamento — cartão × PIX, dia / semana / mês.
 *
 * "Iniciou" conta quem de fato tentou aquele método (gerou o PIX ou enviou o
 * cartão), não quem só clicou em "comprar": nesse clique a forma de pagamento
 * ainda não foi escolhida — o evento sempre grava 'pix' porque é o valor
 * inicial da tela, antes de qualquer escolha. Contar por ali inflaria o PIX e
 * apagaria o cartão da taxa.
 */
function taxa(iniciou: number, pagou: number): number {
  return iniciou > 0 ? (pagou / iniciou) * 100 : 0;
}

function corDaTaxa(pct: number, teveIniciou: boolean): string {
  if (!teveIniciou) return T.inkMuted;
  if (pct >= 60) return T.green;
  if (pct >= 35) return '#D97706';
  return T.danger;
}

function Coluna({ titulo, p }: { titulo: string; p: PeriodoPagamento }) {
  const pixPct = taxa(p.pixIniciou, p.pixPagou);
  const cardPct = taxa(p.cardIniciou, p.cardPagou);
  const totalIniciou = p.pixIniciou + p.cardIniciou;
  const totalPagou = p.pixPagou + p.cardPagou;
  const totalPct = taxa(totalIniciou, totalPagou);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {titulo}
        </span>
        <span style={{ fontSize: 20, fontWeight: 800, color: corDaTaxa(totalPct, totalIniciou > 0) }}>
          {totalIniciou > 0 ? `${totalPct.toFixed(1)}%` : '—'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15 }}>📱</span>
          <span style={{ fontSize: 12.5, color: T.ink, fontWeight: 600, width: 44 }}>PIX</span>
          <div style={{ flex: 1, height: 6, background: 'rgba(196,96,122,0.08)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, pixPct)}%`, height: '100%',
              background: corDaTaxa(pixPct, p.pixIniciou > 0), borderRadius: 99,
            }} />
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: corDaTaxa(pixPct, p.pixIniciou > 0), width: 44, textAlign: 'right' }}>
            {p.pixIniciou > 0 ? `${pixPct.toFixed(1)}%` : '—'}
          </span>
          <span style={{ fontSize: 11, color: T.inkMuted, width: 54, textAlign: 'right' }}>
            {p.pixPagou}/{p.pixIniciou}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15 }}>💳</span>
          <span style={{ fontSize: 12.5, color: T.ink, fontWeight: 600, width: 44 }}>Cartão</span>
          <div style={{ flex: 1, height: 6, background: 'rgba(196,96,122,0.08)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, cardPct)}%`, height: '100%',
              background: corDaTaxa(cardPct, p.cardIniciou > 0), borderRadius: 99,
            }} />
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: corDaTaxa(cardPct, p.cardIniciou > 0), width: 44, textAlign: 'right' }}>
            {p.cardIniciou > 0 ? `${cardPct.toFixed(1)}%` : '—'}
          </span>
          <span style={{ fontSize: 11, color: T.inkMuted, width: 54, textAlign: 'right' }}>
            {p.cardPagou}/{p.cardIniciou}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ConversaoPagamento({
  dia, semana, mes,
}: {
  dia: PeriodoPagamento; semana: PeriodoPagamento; mes: PeriodoPagamento;
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '20px 24px',
      border: '1px solid rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.ink, fontFamily: fonts.display }}>
            Conversão de pagamento
          </div>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>
            De quem tentou pagar (gerou o PIX ou enviou o cartão) para quem pagou de fato
          </div>
        </div>
        <a href="/checkout" style={{ fontSize: 12, color: T.pinkDeep, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
          Ver funil completo →
        </a>
      </div>

      <div className="conversao-pagamento-grid" style={{ display: 'flex', gap: 28 }}>
        <Coluna titulo="Hoje" p={dia} />
        <Coluna titulo="Últimos 7 dias" p={semana} />
        <Coluna titulo="Últimos 30 dias" p={mes} />
      </div>
    </div>
  );
}
