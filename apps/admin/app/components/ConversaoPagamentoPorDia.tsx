'use client';
import { useMemo, useState } from 'react';
import { T, fonts } from '../theme';

export type DiaConversao = {
  dia: string; // YYYY-MM-DD
  pixStarted: number; pixPaid: number;
  cardStarted: number; cardPaid: number;
};

const W = 760;
const H = 190;
const PAD_L = 34;
const PAD_R = 8;
const PAD_T = 14;
const PAD_B = 24;

function taxa(started: number, paid: number): number | null {
  return started > 0 ? (paid / started) * 100 : null;
}

/**
 * Conversão de pagamento por dia — PIX × Cartão, últimos 14 dias.
 *
 * Duas linhas, não barras: são duas taxas (%) que se comparam dia a dia, e
 * linha deixa a tendência visível de um jeito que barra lado a lado não deixa
 * com só 14 pontos. O cartão tem poucos eventos por dia (às vezes zero) — o
 * ponto some nesse dia em vez de cair pra 0%, que mentiria "ninguém pagou"
 * quando na verdade ninguém nem tentou.
 */
export default function ConversaoPagamentoPorDia({ dias }: { dias: DiaConversao[] }) {
  const [ativo, setAtivo] = useState<string | null>(null);
  if (!dias.length) return null;

  const pontos = useMemo(() => {
    const n = dias.length;
    const stepX = (W - PAD_L - PAD_R) / Math.max(1, n - 1);
    return dias.map((d, i) => ({
      ...d,
      x: PAD_L + i * stepX,
      pix: taxa(d.pixStarted, d.pixPaid),
      card: taxa(d.cardStarted, d.cardPaid),
    }));
  }, [dias]);

  const y = (pct: number) => PAD_T + (H - PAD_T - PAD_B) * (1 - pct / 100);

  const linha = (chave: 'pix' | 'card') => {
    const validos = pontos.filter(p => p[chave] !== null);
    if (validos.length < 2) return '';
    return validos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${y(p[chave] as number).toFixed(1)}`).join(' ');
  };

  const rotulo = (iso: string) => {
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
  };

  const destacado = pontos.find(p => p.dia === ativo) ?? null;

  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '18px 20px 14px',
      border: '1px solid rgba(0,0,0,0.06)', marginTop: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6, gap: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, fontFamily: fonts.display }}>
            Conversão de pagamento por dia
          </div>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2, display: 'flex', gap: 14 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: T.pinkDeep, display: 'inline-block' }} />
              PIX
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: T.gold, display: 'inline-block' }} />
              Cartão
            </span>
          </div>
        </div>
        {destacado && (
          <div style={{ fontSize: 12, textAlign: 'right', whiteSpace: 'nowrap' }}>
            <div style={{ fontWeight: 700, color: T.ink }}>{rotulo(destacado.dia)}</div>
            <div style={{ color: T.pinkDeep }}>
              PIX {destacado.pix !== null ? `${destacado.pix.toFixed(0)}%` : '—'} ({destacado.pixPaid}/{destacado.pixStarted})
            </div>
            <div style={{ color: T.gold }}>
              Cartão {destacado.card !== null ? `${destacado.card.toFixed(0)}%` : '—'} ({destacado.cardPaid}/{destacado.cardStarted})
            </div>
          </div>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {[0, 25, 50, 75, 100].map(pct => (
          <g key={pct}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(pct)} y2={y(pct)} stroke="rgba(0,0,0,0.06)" strokeWidth={1} />
            <text x={0} y={y(pct) + 3} fontSize={9} fill={T.inkMuted}>{pct}%</text>
          </g>
        ))}

        <path d={linha('pix')} fill="none" stroke={T.pinkDeep} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <path d={linha('card')} fill="none" stroke={T.gold} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3" />

        {pontos.map(p => (
          <g key={p.dia}>
            {p.pix !== null && <circle cx={p.x} cy={y(p.pix)} r={ativo === p.dia ? 4 : 2.5} fill={T.pinkDeep} />}
            {p.card !== null && <circle cx={p.x} cy={y(p.card)} r={ativo === p.dia ? 4 : 2.5} fill={T.gold} />}
            {/* Área de toque generosa — os pontos reais são pequenos demais pra apontar o mouse com precisão. */}
            <rect
              x={p.x - (W - PAD_L - PAD_R) / dias.length / 2} y={0}
              width={(W - PAD_L - PAD_R) / dias.length} height={H}
              fill="transparent"
              onMouseEnter={() => setAtivo(p.dia)}
              onMouseLeave={() => setAtivo(a => (a === p.dia ? null : a))}
            />
            {ativo === p.dia && <line x1={p.x} x2={p.x} y1={PAD_T} y2={H - PAD_B} stroke="rgba(0,0,0,0.12)" strokeWidth={1} />}
            <text x={p.x} y={H - 6} fontSize={9} fill={T.inkMuted} textAnchor="middle">
              {dias.length <= 14 || pontos.indexOf(p) % 2 === 0 ? rotulo(p.dia) : ''}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
