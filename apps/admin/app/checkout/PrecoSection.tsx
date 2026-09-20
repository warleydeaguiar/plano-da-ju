/**
 * Conversão por preço — leitura do preço dinâmico.
 *
 * Cada cliente vê um preço conforme o que declarou gastar por mês com produtos
 * de cabelo (pergunta do quiz). Esta seção responde: cada preço traz quantas
 * pessoas, quantas compram e quanto entra. Sem isso não dá para saber se subir
 * o preço compensou ou espantou.
 *
 * Quem não respondeu a pergunta (quiz antigo) aparece como "Não respondeu" e
 * paga o preço padrão — fica na tabela para o total fechar.
 */
export type LinhaFaixa = {
  faixa: string
  preco_cents: number
  respostas: number
  leads: number
  iniciaram: number
  compras: number
  receita_cents: number
}

const ROTULO: Record<string, string> = {
  ate_50: 'Gasta até R$ 50/mês',
  ate_100: 'De R$ 50 a R$ 100/mês',
  ate_300: 'De R$ 100 a R$ 300/mês',
  acima_300: 'Mais de R$ 300/mês',
  ate_600: 'Até R$ 600/mês (faixa antiga)',
  ate_1000: 'Até R$ 1.000/mês (faixa antiga)',
  sem_resposta: 'Não respondeu a pergunta',
}

const n = (v: unknown) => Number(v ?? 0)
const brl = (cents: number) => `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const num = (v: number) => v.toLocaleString('pt-BR')
const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null)
const pctStr = (v: number | null) => (v != null ? `${v.toFixed(1).replace('.', ',')}%` : '—')

const AMOSTRA_MINIMA = 30 // abaixo disso a conversão oscila demais para comparar

export default function PrecoSection({ linhas, days }: { linhas: LinhaFaixa[]; days: number }) {
  const gray = '#7C6B7E'
  const accent = '#BE185D'
  const green = '#22A06B'

  const dados = linhas
    .map(l => ({
      faixa: l.faixa,
      rotulo: ROTULO[l.faixa] ?? l.faixa,
      preco: n(l.preco_cents),
      leads: n(l.leads),
      iniciaram: n(l.iniciaram),
      compras: n(l.compras),
      receita: n(l.receita_cents),
    }))
    .filter(l => l.leads > 0 || l.compras > 0)

  if (!dados.length) return null

  const total = dados.reduce(
    (a, l) => ({ leads: a.leads + l.leads, iniciaram: a.iniciaram + l.iniciaram, compras: a.compras + l.compras, receita: a.receita + l.receita }),
    { leads: 0, iniciaram: 0, compras: 0, receita: 0 },
  )
  const comAmostra = dados.filter(l => l.leads >= AMOSTRA_MINIMA)
  const melhor = comAmostra.length
    ? comAmostra.reduce((a, b) => ((pct(b.compras, b.leads) ?? 0) > (pct(a.compras, a.leads) ?? 0) ? b : a))
    : null
  const maxConv = Math.max(1, ...dados.map(l => pct(l.compras, l.leads) ?? 0))

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', marginTop: 20, overflow: 'hidden' }}>
      <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#2A1E2C' }}>Conversão por preço</div>
        <div style={{ fontSize: 12.5, color: gray, marginTop: 4, lineHeight: 1.6 }}>
          Cada cliente vê um preço conforme o que declarou gastar por mês com cabelo — últimos {days} dias.
          {melhor && (
            <> Melhor conversão agora: <strong style={{ color: '#2A1E2C' }}>{brl(melhor.preco)}</strong>{' '}
              ({pctStr(pct(melhor.compras, melhor.leads))} de quem viu esse preço).</>
          )}
        </div>
      </div>

      <div className="tabela-rolavel" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr style={{ background: '#FBF7F9' }}>
              {['Preço', 'Quem vê esse preço', 'Leads', 'Foram ao checkout', 'Compras', 'Conversão', 'Receita'].map((h, i) => (
                <th key={h} style={{
                  padding: '10px 16px', textAlign: i <= 1 ? 'left' : 'right', fontSize: 11,
                  color: gray, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dados.map(l => {
              const c = pct(l.compras, l.leads)
              const poucos = l.leads < AMOSTRA_MINIMA
              const ehMelhor = melhor?.faixa === l.faixa
              return (
                <tr key={l.faixa} style={{ borderTop: '1px solid rgba(0,0,0,0.05)', background: ehMelhor ? '#F2FBF7' : 'transparent' }}>
                  <td style={{ padding: '12px 16px', fontSize: 15, fontWeight: 800, color: accent, whiteSpace: 'nowrap' }}>
                    {brl(l.preco)}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#2A1E2C' }}>
                    {l.rotulo}
                    {poucos && <span style={{ fontSize: 11, color: gray, marginLeft: 8 }}>amostra pequena</span>}
                  </td>
                  <td style={celula(gray)}>{num(l.leads)}</td>
                  <td style={celula(gray)}>{num(l.iniciaram)}</td>
                  <td style={{ ...celula('#2A1E2C'), fontWeight: 700 }}>{num(l.compras)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', minWidth: 150 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                      <div style={{ flex: '0 0 76px', height: 6, background: '#F0ECEF', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(100, ((c ?? 0) / maxConv) * 100)}%`, height: '100%',
                          background: poucos ? '#CFC6CC' : ehMelhor ? green : accent, borderRadius: 4,
                        }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: poucos ? gray : '#2A1E2C', minWidth: 46, textAlign: 'right' }}>
                        {pctStr(c)}
                      </span>
                    </div>
                  </td>
                  <td style={celula(gray)}>{brl(l.receita)}</td>
                </tr>
              )
            })}
            <tr style={{ borderTop: '2px solid rgba(0,0,0,0.08)', background: '#FBF7F9' }}>
              <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 800, color: gray, textTransform: 'uppercase', letterSpacing: 0.4 }} colSpan={2}>Total</td>
              <td style={{ ...celula('#2A1E2C'), fontWeight: 700 }}>{num(total.leads)}</td>
              <td style={{ ...celula('#2A1E2C'), fontWeight: 700 }}>{num(total.iniciaram)}</td>
              <td style={{ ...celula('#2A1E2C'), fontWeight: 700 }}>{num(total.compras)}</td>
              <td style={{ ...celula('#2A1E2C'), fontWeight: 700 }}>{pctStr(pct(total.compras, total.leads))}</td>
              <td style={{ ...celula('#2A1E2C'), fontWeight: 700 }}>{brl(total.receita)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ padding: '12px 22px 16px', fontSize: 11.5, color: gray, lineHeight: 1.7 }}>
        Conversão = compras ÷ leads daquele preço. Faixa com menos de {AMOSTRA_MINIMA} leads aparece em cinza:
        a amostra ainda é pequena para comparar. O preço é sempre decidido no servidor a partir da resposta do quiz.
      </div>
    </div>
  )
}

const celula = (cor: string): React.CSSProperties => ({
  padding: '12px 16px', textAlign: 'right', fontSize: 13, color: cor, whiteSpace: 'nowrap',
})
