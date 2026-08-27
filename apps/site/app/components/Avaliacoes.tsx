import type { Avaliacao, ResumoAvaliacoes } from '@/lib/conteudo';

const Estrelas = ({ n, tamanho = '1rem' }: { n: number; tamanho?: string }) => (
  <span style={{ color: '#e8a020', fontSize: tamanho, letterSpacing: '0.06em' }} aria-hidden>
    {'★'.repeat(Math.round(n))}
    <span style={{ color: 'var(--borda)' }}>{'★'.repeat(5 - Math.round(n))}</span>
  </span>
);

const dataBr = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

/**
 * Avaliações das clientes na página do produto.
 *
 * Isto NÃO é enfeite: é o que torna legítima a estrela que o Google exibe. A
 * política é explícita — o conteúdo marcado no schema tem que estar visível
 * para quem visita. Se este bloco sair da página, o `aggregateRating` tem que
 * sair junto.
 */
export default function Avaliacoes({
  itens, resumo,
}: { itens: Avaliacao[]; resumo: ResumoAvaliacoes | null }) {
  if (!itens.length || !resumo) return null;

  return (
    <section style={{ marginTop: '3rem' }} id="avaliacoes">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>O que as clientes dizem</h2>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Estrelas n={resumo.media} tamanho="1.05rem" />
          <span style={{ fontWeight: 700 }}>{String(resumo.media).replace('.', ',')}</span>
          <span style={{ color: 'var(--tinta-suave)', fontSize: '0.9rem' }}>
            · {resumo.total} {resumo.total === 1 ? 'avaliação' : 'avaliações'}
          </span>
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1.25rem' }}>
        {itens.map((a) => (
          <article
            key={a.id}
            style={{ border: '1px solid var(--borda)', background: '#fff', borderRadius: 12, padding: '1rem 1.2rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <p style={{ fontWeight: 700 }}>
                {a.autora} <Estrelas n={a.nota} tamanho="0.9rem" />
              </p>
              <span style={{ fontSize: '0.82rem', color: 'var(--tinta-suave)' }}>{dataBr(a.data)}</span>
            </div>
            <p style={{ color: 'var(--tinta-suave)', lineHeight: 1.65, marginTop: '0.45rem' }}>{a.texto}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
