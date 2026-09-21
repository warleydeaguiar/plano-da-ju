'use client';

import { useState } from 'react';
import { T } from '../theme';

export type DiaAlunas = { dia: string; pagantes: number; ugc: number };

/**
 * Alunas que entraram por dia — pagante × cortesia da parceria UGC.
 *
 * Os dois números nunca aparecem somados: cortesia não é venda (foi o que o
 * pixel fazia errado, contando 283 cortesias como compra). Cada barra mostra
 * as duas partes empilhadas, com o total em cima; ao passar o mouse, a divisão
 * exata do dia.
 */
export default function AlunasPorDia({ dias }: { dias: DiaAlunas[] }) {
  const [ativo, setAtivo] = useState<string | null>(null);
  if (!dias.length) return null;

  const n = (v: unknown) => Number(v ?? 0);
  const totPag = dias.reduce((a, d) => a + n(d.pagantes), 0);
  const totUgc = dias.reduce((a, d) => a + n(d.ugc), 0);
  const maxDia = Math.max(1, ...dias.map(d => n(d.pagantes) + n(d.ugc)));
  const ALTURA = 132;
  const sel = dias.find(d => d.dia === ativo) ?? null;
  const dataBR = (iso: string) => `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}`;

  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.borderSoft}`, borderRadius: 16,
      padding: '20px 22px 16px', marginBottom: 22,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink }}>Alunas por dia</div>
          <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 3 }}>
            Últimos 30 dias · quem pagou e quem entrou por cortesia da parceria
          </div>
        </div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: T.inkSoft, fontWeight: 700 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: T.green, display: 'inline-block' }} /> Pagantes
            </div>
            <div style={{ fontSize: 21, fontWeight: 800, color: T.green, lineHeight: 1.2 }}>{totPag.toLocaleString('pt-BR')}</div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: T.inkSoft, fontWeight: 700 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: T.gold, display: 'inline-block' }} /> UGC (cortesia)
            </div>
            <div style={{ fontSize: 21, fontWeight: 800, color: T.goldDeep, lineHeight: 1.2 }}>{totUgc.toLocaleString('pt-BR')}</div>
          </div>
        </div>
      </div>

      {/* Linha do dia apontado: some a necessidade de adivinhar a divisão da
          barra, que é justamente o que o empilhado esconde. */}
      <div style={{
        minHeight: 26, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        fontSize: 12.5, color: T.inkSoft, marginTop: 8,
      }}>
        {sel ? (
          <>
            <strong style={{ color: T.ink, fontSize: 13.5 }}>{dataBR(sel.dia)}</strong>
            <span><span style={{ color: T.green, fontWeight: 800 }}>{n(sel.pagantes)}</span> pagante{n(sel.pagantes) === 1 ? '' : 's'}</span>
            <span><span style={{ color: T.goldDeep, fontWeight: 800 }}>{n(sel.ugc)}</span> cortesia{n(sel.ugc) === 1 ? '' : 's'}</span>
            <span style={{ color: T.inkMuted }}>total {n(sel.pagantes) + n(sel.ugc)}</span>
          </>
        ) : (
          <span style={{ color: T.inkMuted }}>Passe o mouse (ou toque) numa barra para ver a divisão do dia.</span>
        )}
      </div>

      <div className="tabela-rolavel" style={{ overflowX: 'auto', paddingTop: 12 }}>
        <div
          style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: ALTURA + 34, minWidth: 30 * 22 }}
          onMouseLeave={() => setAtivo(null)}
        >
          {dias.map(d => {
            const pag = n(d.pagantes);
            const ugc = n(d.ugc);
            const total = pag + ugc;
            const hPag = (pag / maxDia) * ALTURA;
            const hUgc = (ugc / maxDia) * ALTURA;
            const destaque = d.dia === ativo;
            return (
              <div
                key={d.dia}
                onMouseEnter={() => setAtivo(d.dia)}
                onClick={() => setAtivo(d.dia)}
                title={`${dataBR(d.dia)}: ${pag} pagante(s) + ${ugc} cortesia(s) = ${total}`}
                style={{
                  flex: 1, minWidth: 16, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 4, cursor: 'pointer', opacity: ativo && !destaque ? 0.55 : 1, transition: 'opacity .12s',
                }}
              >
                <div style={{ fontSize: 9.5, fontWeight: 800, color: total > 0 ? T.ink : T.inkMuted }}>
                  {total > 0 ? total : '·'}
                </div>
                <div style={{ width: '100%', maxWidth: 26, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: ALTURA }}>
                  {ugc > 0 && <div style={{ height: Math.max(hUgc, 2), background: T.gold, borderRadius: pag > 0 ? '4px 4px 0 0' : 4 }} />}
                  {pag > 0 && <div style={{ height: Math.max(hPag, 2), background: T.green, borderRadius: ugc > 0 ? '0 0 4px 4px' : 4 }} />}
                  {total === 0 && <div style={{ height: 2, background: T.borderSoft, borderRadius: 2 }} />}
                </div>
                <div style={{ fontSize: 9, color: destaque ? T.ink : T.inkMuted, fontWeight: destaque ? 700 : 400, whiteSpace: 'nowrap' }}>
                  {dataBR(d.dia)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ fontSize: 11.5, color: T.inkMuted, marginTop: 10, lineHeight: 1.6 }}>
        Conta a data de ativação do acesso. Cortesia da parceria não é venda e nunca entra na receita —
        aparece aqui para explicar o movimento do dia.
      </div>
    </div>
  );
}
