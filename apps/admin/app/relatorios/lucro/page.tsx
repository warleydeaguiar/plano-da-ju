import Sidebar from '../../components/Sidebar';
import { T, fonts } from '../../theme';
import { getProfitReport, type PlanoRow, type GruposRow } from '../../../lib/profit';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Lucro — Relatórios' };

const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const green = '#22A06B';
const red = '#DC2626';
const gray = '#7C6B7E';

function LucroCell({ v }: { v: number }) {
  return <span style={{ fontWeight: 700, color: v >= 0 ? green : red }}>{brl(v)}</span>;
}

function Bar({ v, max }: { v: number; max: number }) {
  const w = max > 0 ? Math.min(100, (Math.abs(v) / max) * 100) : 0;
  return (
    <div style={{ height: 7, borderRadius: 99, background: '#F0E8EC', overflow: 'hidden', minWidth: 60 }}>
      <div style={{ width: `${w}%`, height: '100%', borderRadius: 99, background: v >= 0 ? green : red }} />
    </div>
  );
}

function Section({ title, subtitle, head, rows, totalLucro }: {
  title: string; subtitle: string; head: string[]; rows: React.ReactNode; totalLucro: number;
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', marginBottom: 26, overflow: 'hidden' }}>
      <div style={{ padding: '18px 24px', borderBottom: '1px solid #F0F0F5', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#2A1E2C' }}>{title}</div>
          <div style={{ fontSize: 12.5, color: gray, marginTop: 2 }}>{subtitle}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: gray, textTransform: 'uppercase', letterSpacing: 0.4 }}>Lucro total</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: totalLucro >= 0 ? green : red }}>{brl(totalLucro)}</div>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr style={{ background: '#FFF7EE', borderBottom: '1px solid #F0F0F5' }}>
              {head.map((h, i) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: i === 0 ? 'left' : 'right', fontSize: 11, color: gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>
  );
}

export default async function LucroPage() {
  const { plano, grupos, metaOk } = await getProfitReport();
  const planoTotal = plano.reduce((s, r) => s + r.lucro, 0);
  const gruposTotal = grupos.reduce((s, r) => s + r.lucro, 0);
  const planoMax = Math.max(1, ...plano.map(r => Math.abs(r.lucro)));
  const gruposMax = Math.max(1, ...grupos.map(r => Math.abs(r.lucro)));

  const td: React.CSSProperties = { padding: '11px 16px', textAlign: 'right', fontSize: 13, color: '#2A1E2C', whiteSpace: 'nowrap' };
  const tdMes: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#2A1E2C', whiteSpace: 'nowrap' };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#FFFAF5', fontFamily: fonts.ui, color: T.ink }}>
      <Sidebar />
      <main style={{ marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto', padding: '32px 40px' }}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#2A1E2C', fontFamily: fonts.display }}>💰 Lucro</div>
          <div style={{ fontSize: 13, color: gray, marginTop: 4 }}>
            Lucro mês a mês, separado por Plano Capilar e Grupos de Promoção.
            {!metaOk && <span style={{ color: '#D97706' }}> · ⚠️ gasto do Meta indisponível agora (anúncios podem aparecer zerados)</span>}
          </div>
        </div>

        <Section
          title="🧴 Plano Capilar"
          subtitle="Receita real (Pagar.me) menos anúncios, IA, SMS e taxas."
          head={['Mês', 'Receita', 'Anúncios', 'IA', 'SMS', 'Taxas', 'Lucro', '']}
          totalLucro={planoTotal}
          rows={plano.map((r: PlanoRow) => (
            <tr key={r.ym} style={{ borderBottom: '1px solid #F9F9FC' }}>
              <td style={tdMes}>{r.monthName}</td>
              <td style={td}>{brl(r.receita)}</td>
              <td style={{ ...td, color: gray }}>{brl(r.anuncios)}</td>
              <td style={{ ...td, color: gray }}>{brl(r.ia)}</td>
              <td style={{ ...td, color: gray }}>{brl(r.sms)}</td>
              <td style={{ ...td, color: gray }}>{brl(r.taxas)}</td>
              <td style={td}><LucroCell v={r.lucro} /></td>
              <td style={{ padding: '11px 16px', width: 120 }}><Bar v={r.lucro} max={planoMax} /></td>
            </tr>
          ))}
        />

        <Section
          title="🎁 Grupos de Promoção"
          subtitle="Comissão Ybera (20% das vendas afiliadas) menos o investimento em anúncios."
          head={['Mês', 'Comissão (20%)', 'Anúncios', 'Lucro', '']}
          totalLucro={gruposTotal}
          rows={grupos.map((r: GruposRow) => (
            <tr key={r.ym} style={{ borderBottom: '1px solid #F9F9FC' }}>
              <td style={tdMes}>{r.monthName}</td>
              <td style={td}>{brl(r.comissao)}</td>
              <td style={{ ...td, color: gray }}>{brl(r.anuncios)}</td>
              <td style={td}><LucroCell v={r.lucro} /></td>
              <td style={{ padding: '11px 16px', width: 120 }}><Bar v={r.lucro} max={gruposMax} /></td>
            </tr>
          ))}
        />

        <div style={{ fontSize: 11.5, color: gray, lineHeight: 1.6, maxWidth: 720 }}>
          <strong>Como é calculado:</strong> Plano Capilar — receita = pagamentos reais confirmados (Pagar.me, sem cortesias);
          IA ≈ planos gerados × custo médio; SMS ≈ envios × tarifa; taxas ≈ % sobre a receita. Grupos — comissão = vendas afiliadas × 20%;
          anúncios = gasto do Meta (com imposto de 13,68%) quando disponível, senão o valor histórico do painel Ybera. Valores de IA/SMS/taxas são estimativas ajustáveis.
        </div>
      </main>
    </div>
  );
}
