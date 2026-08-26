import Link from 'next/link';

/**
 * 404 de verdade — devolve status 404.
 *
 * No WordPress o plugin Custom 404 Pro redirecionava TODA URL inexistente com
 * 302 para uma página de promoção. O site ficava incapaz de dizer ao Google que
 * algo não existe, e link quebrado passava despercebido: foi assim que dois
 * links internos mortos ficaram escondidos por meses.
 */
export default function NaoEncontrada() {
  return (
    <section style={{ maxWidth: 'var(--largura)', margin: '0 auto', padding: '5rem 1.25rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Essa página não existe</h1>
      <p style={{ marginTop: '0.9rem', color: 'var(--tinta-suave)' }}>
        O endereço pode ter mudado ou o conteúdo saiu do ar.
      </p>
      <div style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/blog/" style={{ background: 'var(--rosa)', color: '#fff', fontWeight: 700, padding: '0.8rem 1.5rem', borderRadius: 999 }}>
          Ver o blog
        </Link>
        <Link href="/" style={{ border: '1px solid var(--borda)', padding: '0.8rem 1.5rem', borderRadius: 999 }}>
          Ir para o início
        </Link>
      </div>
    </section>
  );
}
