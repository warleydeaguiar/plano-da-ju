const PLANO = 'https://planodaju.julianecost.com/quiz';
const GRUPOS = 'https://grupos.julianecost.com/';

const STORAGE = 'https://db.planodaju.julianecost.com/storage/v1/object/public/site-conteudo';
const FOTO_JU = `${STORAGE}/autora/juliane-cost`;
const FOTO_FASHION_GOLD = `${STORAGE}/c92f9870c8/copia-escova-progressiva-300g-fashion-gold-1787-1-87bbaf5a55`;

/**
 * Imagem da chamada. Dimensões declaradas para o bloco não pular quando ela
 * carrega — a chamada fica no meio do texto, e um salto ali empurra o
 * parágrafo que a leitora está lendo.
 */
function Ilustracao({ base, alt, redonda = false }: { base: string; alt: string; redonda?: boolean }) {
  return (
    <picture>
      <source srcSet={`${base}.avif`} type="image/avif" />
      <source srcSet={`${base}.webp`} type="image/webp" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${base}.webp`}
        alt={alt}
        width={132}
        height={132}
        loading="lazy"
        decoding="async"
        style={{
          width: 132, height: 132, objectFit: 'cover', display: 'block', flexShrink: 0,
          borderRadius: redonda ? '50%' : 14,
          background: '#fff',
        }}
      />
    </picture>
  );
}

const caixa: React.CSSProperties = {
  borderRadius: 16,
  padding: '1.5rem',
  margin: '2.75rem 0',
  border: '1px solid var(--borda)',
  display: 'flex',
  gap: '1.25rem',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
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

const selo: React.CSSProperties = {
  fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
};

/**
 * Chamada do Plano Capilar.
 *
 * A copy espelha o que a leitora encontra do outro lado: a página de destino
 * se chama "Diagnóstico Capilar Gratuito", pede 15 perguntas e promete
 * recuperar o cabelo em 90 dias. A versão anterior falava em "montar meu plano
 * capilar" e "algumas perguntas" — a pessoa clicava esperando um produto e
 * caía num questionário, o que derruba a conversão logo na primeira tela.
 */
export function ChamadaPlano({ utm = 'meio-artigo' }: { utm?: string }) {
  return (
    <aside style={{ ...caixa, background: 'var(--rosa-claro)', borderColor: 'var(--rosa)' }}>
      <Ilustracao base={FOTO_JU} alt="Juliane Cost, tricologista" redonda />

      <div style={{ flex: 1, minWidth: '15rem' }}>
        <p style={{ ...selo, color: 'var(--rosa)' }}>Diagnóstico capilar gratuito</p>

        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, lineHeight: 1.25, marginTop: '0.5rem' }}>
          Descubra o plano ideal para recuperar o seu cabelo em 90 dias
        </h3>

        <p style={{ marginTop: '0.7rem', color: 'var(--tinta-suave)', lineHeight: 1.6 }}>
          São 15 perguntas sobre os seus fios, a sua rotina e o histórico de química. No fim eu
          monto o plano personalizado, com os produtos certos na ordem certa. Responder não
          custa nada.
        </p>

        <a
          href={`${PLANO}?utm_source=blog&utm_medium=artigo&utm_campaign=plano-capilar&utm_content=${utm}`}
          style={{ ...botao, background: 'var(--rosa)', color: '#fff' }}
        >
          Fazer meu diagnóstico grátis
        </a>
      </div>
    </aside>
  );
}

/**
 * Chamada do grupo de promoções.
 *
 * O destino é o "Grupo VIP Ybera Paris — Promoções Exclusivas", e a entrada
 * passa por algumas perguntas antes do link do WhatsApp. A versão anterior
 * dizia "Entrar no grupo do WhatsApp" e falava genericamente nos "produtos que
 * indico aqui": prometia entrada imediata num grupo genérico e entregava um
 * formulário de um grupo da Ybera.
 */
export function ChamadaGrupos({ utm = 'fim-artigo' }: { utm?: string }) {
  return (
    <aside style={{ ...caixa, background: '#f2f8f4', borderColor: '#cfe6d6' }}>
      <Ilustracao base={FOTO_FASHION_GOLD} alt="Progressiva Fashion Gold da Ybera Paris" />

      <div style={{ flex: 1, minWidth: '15rem' }}>
        <p style={{ ...selo, color: '#3d8f5e' }}>Grupo VIP Ybera Paris</p>

        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, lineHeight: 1.25, marginTop: '0.5rem' }}>
          Promoções exclusivas da Ybera antes de todo mundo
        </h3>

        <p style={{ marginTop: '0.7rem', color: 'var(--tinta-suave)', lineHeight: 1.6 }}>
          Todo mês eu consigo desconto direto com a Ybera e aviso primeiro no grupo. Responda
          duas perguntas rápidas e eu te mando o link do WhatsApp. É gratuito e você sai quando
          quiser.
        </p>

        <a
          href={`${GRUPOS}?utm_source=blog&utm_medium=artigo&utm_campaign=grupos-whatsapp&utm_content=${utm}`}
          style={{ ...botao, background: '#3d8f5e', color: '#fff' }}
        >
          Quero entrar no grupo VIP
        </a>
      </div>
    </aside>
  );
}
