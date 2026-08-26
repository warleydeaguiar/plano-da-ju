export interface Pergunta { pergunta: string; resposta: string }

/**
 * Perguntas frequentes no fim do artigo.
 *
 * Usa <details>/<summary> nativo: abre e fecha sem JavaScript, e o texto da
 * resposta fica no HTML mesmo fechado — o Google lê tudo, e quem está no
 * celular com conexão ruim também.
 *
 * Sem schema FAQPage de propósito: o Google restringiu esse rich result a
 * sites de saúde e governo, e marcar assim mesmo só arrisca aviso no Search
 * Console. O ganho aqui é capturar busca de cauda longa pelo texto.
 */
export default function Faq({ itens }: { itens: Pergunta[] }) {
  if (!itens.length) return null;

  return (
    <section style={{ marginTop: '3.5rem' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.25rem' }}>
        Perguntas frequentes
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {itens.map((q) => (
          <details
            key={q.pergunta}
            style={{
              border: '1px solid var(--borda)', borderRadius: 12,
              background: '#fff', padding: '1rem 1.2rem',
            }}
          >
            <summary
              style={{
                fontWeight: 700, fontSize: '1.02rem', lineHeight: 1.4,
                cursor: 'pointer', listStyle: 'none',
                display: 'flex', justifyContent: 'space-between', gap: '1rem',
              }}
            >
              {q.pergunta}
              <span aria-hidden style={{ color: 'var(--rosa)', flexShrink: 0 }}>+</span>
            </summary>
            <p style={{ marginTop: '0.85rem', color: 'var(--tinta-suave)', lineHeight: 1.65 }}>
              {q.resposta}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
