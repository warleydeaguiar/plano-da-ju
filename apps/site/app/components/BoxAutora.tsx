const FOTO = 'https://db.planodaju.julianecost.com/storage/v1/object/public/site-conteudo/autora/juliane-cost';

export const CARGO = 'Tricologista formada e especializada em tratamentos capilares';

export const REDES = [
  { nome: 'Instagram', url: 'https://www.instagram.com/julianecost' },
  { nome: 'TikTok', url: 'https://www.tiktok.com/@julianecost' },
  { nome: 'YouTube', url: 'https://www.youtube.com/@julianecost' },
];

/** Foto da autora em <picture>, no tamanho pedido. */
export function FotoAutora({ tamanho = 56, quadrada = false }: { tamanho?: number; quadrada?: boolean }) {
  return (
    <picture>
      <source srcSet={`${FOTO}.avif`} type="image/avif" />
      <source srcSet={`${FOTO}.webp`} type="image/webp" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${FOTO}.webp`}
        alt="Juliane Cost, tricologista"
        width={tamanho}
        height={tamanho}
        loading="lazy"
        decoding="async"
        style={{
          width: tamanho, height: tamanho, objectFit: 'cover', display: 'block', flexShrink: 0,
          borderRadius: quadrada ? 14 : '50%',
          border: quadrada ? '1px solid var(--borda)' : '2px solid var(--rosa-claro)',
        }}
      />
    </picture>
  );
}

/**
 * Assinatura curta, para a linha de crédito do artigo e o rodapé dos cards.
 */
export function AutoraCompacta() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: 'var(--tinta-suave)' }}>
      <FotoAutora tamanho={24} />
      Por <strong style={{ color: 'var(--tinta)' }}>Juliane Cost</strong>
    </span>
  );
}

/**
 * Box "Sobre a autora" no fim do artigo.
 *
 * É o sinal de E-E-A-T mais forte da página: o Google quer saber quem escreveu
 * e por que essa pessoa tem autoridade. Aqui a leitora vai passar química no
 * próprio cabelo seguindo o texto, então "tricologista formada" não é enfeite
 * — é a razão de confiar. O site antigo não mostrava autora nenhuma.
 *
 * A bio fala só de cabelo. A Juliane também foi modelo e Miss Betim, mas isso
 * fica de fora de propósito: misturar credencial de beleza com credencial
 * clínica dilui exatamente o sinal que queremos passar.
 */
export default function BoxAutora() {
  return (
    <aside
      style={{
        border: '1px solid var(--borda)', background: '#fff', borderRadius: 18,
        padding: '1.75rem', marginTop: '3rem',
        display: 'grid', gap: '1.5rem',
        gridTemplateColumns: 'minmax(0, 1fr)',
      }}
      className="box-autora"
    >
      <div>
        <FotoAutora tamanho={168} quadrada />
      </div>

      <div>
        <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>Sobre a Juliane Cost:</p>

        <p style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--rosa)', lineHeight: 1.2, marginTop: '0.35rem' }}>
          Juliane Cost
        </p>

        <p style={{ fontSize: '1.02rem', lineHeight: 1.5, marginTop: '0.2rem' }}>{CARGO}</p>

        <p style={{ marginTop: '1rem', color: 'var(--tinta-suave)', lineHeight: 1.65 }}>
          A Juliane atende mulheres todos os dias no consultório, montando plano capilar
          personalizado a partir do tipo de fio, da porosidade, do histórico de química e da
          rotina de cada uma. Ela testa pessoalmente os produtos antes de recomendar — e é isso
          que ela reúne aqui no blog, em comparativos e guias práticos, para que você consiga
          escolher o produto certo sem gastar dinheiro em tentativa e erro.
        </p>

        <p style={{ marginTop: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.9rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--tinta-suave)' }}>Siga nas redes:</span>
          {REDES.map((r) => (
            <a
              key={r.nome}
              href={r.url}
              target="_blank"
              rel="me noopener noreferrer"
              // padding vertical para o dedo acertar: sem ele o link tem a
              // altura da linha (~20px) e erra no celular
              style={{ fontSize: '0.9rem', color: 'var(--rosa)', fontWeight: 600, padding: '0.6rem 0', display: 'inline-block' }}
            >
              {r.nome}
            </a>
          ))}
        </p>
      </div>
    </aside>
  );
}
