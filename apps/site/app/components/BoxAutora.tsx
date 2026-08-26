/**
 * Assinatura da autora.
 *
 * É sinal de E-E-A-T: o Google quer saber quem escreveu e por que essa pessoa
 * tem autoridade no assunto. Num nicho de beleza, onde a leitora vai passar
 * química no próprio cabelo seguindo o que leu aqui, isso pesa — e o site
 * antigo não mostrava nada disso.
 */
export default function BoxAutora({ compacto = false }: { compacto?: boolean }) {
  if (compacto) {
    return (
      <span style={{ color: 'var(--tinta-suave)' }}>
        Por <strong style={{ color: 'var(--tinta)' }}>Juliane Cost</strong>
      </span>
    );
  }

  return (
    <aside
      style={{
        display: 'flex',
        gap: '1rem',
        alignItems: 'flex-start',
        border: '1px solid var(--borda)',
        background: '#fff',
        borderRadius: 14,
        padding: '1.3rem 1.4rem',
        marginTop: '3rem',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
          background: 'var(--rosa-claro)', color: 'var(--rosa)',
          display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '1.3rem',
        }}
      >
        JC
      </div>
      <div>
        <p style={{ fontWeight: 700 }}>Juliane Cost</p>
        <p style={{ fontSize: '0.9rem', color: 'var(--tinta-suave)', marginTop: '0.15rem', lineHeight: 1.55 }}>
          Especialista em cuidados capilares. Testo os produtos antes de indicar e atendo mulheres
          todos os dias montando plano capilar personalizado.
        </p>
      </div>
    </aside>
  );
}
