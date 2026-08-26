/**
 * Chamadas para os produtos da Juliane dentro do conteúdo.
 *
 * Duas ofertas com papéis diferentes, e é por isso que são componentes
 * separados em vez de um só parametrizado:
 *
 *   Plano Capilar — produto pago (R$34,90). Vai no meio do artigo, onde a
 *   leitora já entendeu o problema dela e a oferta responde à dúvida que a
 *   trouxe até aqui.
 *
 *   Grupos de promoção — gratuito, entrada por WhatsApp. Vai no fim, como
 *   saída de baixo atrito para quem não comprou.
 *
 * Os links saem para outro domínio (planodaju/grupos), então não usam <Link>.
 */

const PLANO = 'https://planodaju.julianecost.com/quiz';
const GRUPOS = 'https://grupos.julianecost.com/';

const caixa: React.CSSProperties = {
  borderRadius: 16,
  padding: '1.6rem 1.5rem',
  margin: '2.75rem 0',
  border: '1px solid var(--borda)',
};

const botao: React.CSSProperties = {
  display: 'inline-block',
  fontWeight: 700,
  padding: '0.85rem 1.6rem',
  borderRadius: 999,
  fontSize: '1rem',
  textDecoration: 'none',
  marginTop: '1.1rem',
};

export function ChamadaPlano({ utm = 'meio-artigo' }: { utm?: string }) {
  return (
    <aside style={{ ...caixa, background: 'var(--rosa-claro)', borderColor: 'var(--rosa)' }}>
      <p style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--rosa)' }}>
        Feito para o seu cabelo
      </p>
      <h3 style={{ fontSize: '1.3rem', fontWeight: 800, lineHeight: 1.25, marginTop: '0.5rem' }}>
        Descubra o que o seu cabelo precisa de verdade
      </h3>
      <p style={{ marginTop: '0.7rem', color: 'var(--tinta-suave)', lineHeight: 1.6 }}>
        Responda algumas perguntas sobre os seus fios e eu monto um plano capilar personalizado —
        com os produtos certos, na ordem certa, para a sua rotina.
      </p>
      <a
        href={`${PLANO}?utm_source=blog&utm_medium=artigo&utm_campaign=plano-capilar&utm_content=${utm}`}
        style={{ ...botao, background: 'var(--rosa)', color: '#fff' }}
      >
        Montar meu plano capilar
      </a>
    </aside>
  );
}

export function ChamadaGrupos({ utm = 'fim-artigo' }: { utm?: string }) {
  return (
    <aside style={{ ...caixa, background: '#f2f8f4', borderColor: '#cfe6d6' }}>
      <p style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#3d8f5e' }}>
        Grupo de promoções
      </p>
      <h3 style={{ fontSize: '1.3rem', fontWeight: 800, lineHeight: 1.25, marginTop: '0.5rem' }}>
        Receba as promoções antes de todo mundo
      </h3>
      <p style={{ marginTop: '0.7rem', color: 'var(--tinta-suave)', lineHeight: 1.6 }}>
        Entro nos grupos de WhatsApp toda semana com os descontos que eu mesma consigo nos
        produtos que indico aqui. É gratuito e você sai quando quiser.
      </p>
      <a
        href={`${GRUPOS}?utm_source=blog&utm_medium=artigo&utm_campaign=grupos-whatsapp&utm_content=${utm}`}
        style={{ ...botao, background: '#3d8f5e', color: '#fff' }}
      >
        Entrar no grupo do WhatsApp
      </a>
    </aside>
  );
}
