'use client';
import { useState } from 'react';
import { T } from '../theme';

export type DiaLeads = { dia: string; leads: number };

/**
 * Leads captados por dia pelo funil dos anúncios de "Grupos".
 *
 * Substitui a contagem de "cadastros" que aparecia zerada: aquela media
 * entradas confirmadas no grupo (`wg_member_events`), e esse webhook não
 * registra nada desde 28/07/2026 — muito antes de o funil mudar. E, desde
 * 25/09, o quiz nem passa mais pelo grupo: leva direto à loja da Ybera.
 *
 * O que o investimento produz hoje é LEAD, e é isso que o gráfico mostra.
 */
export default function LeadsPorDia({ dias, titulo = 'Leads por dia' }: { dias: DiaLeads[]; titulo?: string }) {
  const [ativo, setAtivo] = useState<string | null>(null);
  if (!dias.length) return null;

  const total = dias.reduce((a, d) => a + Number(d.leads ?? 0), 0);
  const media = Math.round(total / dias.length);
  const maior = Math.max(1, ...dias.map(d => Number(d.leads ?? 0)));
  const rotulo = (iso: string) => {
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
  };

  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '18px 20px 14px',
      border: '1px solid rgba(0,0,0,0.06)', marginTop: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, gap: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{titulo}</div>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>
            {total} no período · média de {media} por dia
          </div>
        </div>
        {ativo && (
          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.pinkDeep, whiteSpace: 'nowrap' }}>
            {rotulo(ativo)}: {dias.find(d => d.dia === ativo)?.leads ?? 0} leads
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
        {dias.map(d => {
          const v = Number(d.leads ?? 0);
          const destacado = ativo === d.dia;
          return (
            <div
              key={d.dia}
              onMouseEnter={() => setAtivo(d.dia)}
              onMouseLeave={() => setAtivo(null)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'default' }}
            >
              <div style={{ fontSize: 10, color: destacado ? T.pinkDeep : T.inkSoft, fontWeight: destacado ? 700 : 500 }}>
                {v || ''}
              </div>
              <div
                style={{
                  width: '100%', height: `${Math.max(3, (v / maior) * 92)}px`,
                  borderRadius: '6px 6px 2px 2px',
                  background: destacado
                    ? 'linear-gradient(180deg,#EC4899,#BE185D)'
                    : 'linear-gradient(180deg,#F9A8D4,#EC4899)',
                  transition: 'background 0.15s ease',
                }}
              />
              <div style={{ fontSize: 9.5, color: T.inkSoft, whiteSpace: 'nowrap' }}>{rotulo(d.dia)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
