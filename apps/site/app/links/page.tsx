import type { Metadata } from 'next';
import { porPath } from '@/lib/conteudo';
import { SITE } from '@/lib/seo';
import { CARGO, FotoAutora } from '../components/BoxAutora';
import IconeWhatsapp from '../components/IconeWhatsapp';

export const revalidate = 3600; // literal: o Next analisa este export estaticamente

/**
 * Fora do índice de propósito, como já era no WordPress. É a página do link da
 * bio: existe para quem chega do Instagram, não para disputar busca. Deixá-la
 * indexável só criaria uma concorrente rasa da home.
 */
export const metadata: Metadata = {
  title: 'Juliane Cost',
  description: 'Grupo de promoções, plano capilar e os produtos que a Juliane indica.',
  robots: { index: false, follow: true },
  alternates: { canonical: `${SITE}/links/` },
};

interface Link {
  href: string;
  rotulo: string;
  emoji: string | null;
}

const REDES_CONHECIDAS = /instagram\.com|tiktok\.com|youtube\.com|youtu\.be|facebook\.com|kwai/i;

/** Emoji solto no começo do rótulo vira ícone; o texto fica limpo. */
const EMOJI_NA_FRENTE = /^\s*([\p{Extended_Pictographic}️‍]+)\s*/u;

const NOMEADAS: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…',
  ndash: '–', mdash: '—', rsquo: '’', ldquo: '“', rdquo: '”',
};

const semTags = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (inteiro, nome) => NOMEADAS[String(nome).toLowerCase()] ?? inteiro)
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Os links vêm do conteúdo, não de uma lista no código.
 *
 * Assim a Juliane muda a ordem, o texto e o destino pelo editor do admin —
 * que é o que ela vai querer fazer toda vez que abrir uma campanha nova —
 * sem depender de deploy. O desenho fica aqui; o conteúdo fica com ela.
 */
function extrairLinks(html: string | null): { principais: Link[]; redes: Link[] } {
  const principais: Link[] = [];
  const redes: Link[] = [];
  const vistos = new Set<string>();

  for (const m of (html || '').matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const href = m[1].trim();
    const bruto = semTags(m[2]);
    if (!href || !bruto || vistos.has(href)) continue;
    vistos.add(href);

    const emoji = bruto.match(EMOJI_NA_FRENTE);
    const link: Link = {
      href,
      rotulo: bruto.replace(EMOJI_NA_FRENTE, '').trim() || bruto,
      emoji: emoji ? emoji[1] : null,
    };
    (REDES_CONHECIDAS.test(href) ? redes : principais).push(link);
  }
  return { principais, redes };
}

export default async function LinkNaBio() {
  const item = await porPath('/links/');
  const { principais, redes } = extrairLinks(item?.content_clean ?? null);

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'linear-gradient(170deg, var(--rosa-claro) 0%, var(--creme) 42%, var(--creme) 100%)',
        padding: '2.5rem 1.25rem 3rem',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: '26rem' }}>
        {/* ------------------------------------------------------- perfil */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-block',
              borderRadius: '50%',
              padding: 4,
              background: '#fff',
              boxShadow: '0 6px 24px rgba(196, 120, 143, 0.22)',
            }}
          >
            {/* A foto é o primeiro pixel que aparece e some do topo se demorar:
                sem lazy, e com prioridade. */}
            <FotoAutora tamanho={116} prioritaria />
          </div>

          <h1
            style={{
              fontSize: '1.6rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              margin: '0.9rem 0 0.3rem',
              color: 'var(--tinta)',
            }}
          >
            Juliane Cost
          </h1>
          <p
            style={{
              fontSize: '0.9rem',
              lineHeight: 1.45,
              color: 'var(--tinta-suave)',
              margin: '0 auto',
              maxWidth: '20rem',
            }}
          >
            {CARGO}
          </p>
        </div>

        {/* ------------------------------------------------------- botões */}
        <nav style={{ display: 'grid', gap: '0.8rem', marginTop: '1.9rem' }}>
          {principais.map((l, i) => (
            <Botao key={l.href} link={l} destaque={i === 0} />
          ))}
        </nav>

        {/* -------------------------------------------------------- redes */}
        {redes.length > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '0.6rem',
              marginTop: '1.9rem',
              flexWrap: 'wrap',
            }}
          >
            {redes.map((r) => (
              <a
                key={r.href}
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={r.rotulo}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem 1rem',
                  borderRadius: 999,
                  border: '1px solid var(--borda)',
                  background: 'rgba(255,255,255,0.75)',
                  color: 'var(--tinta-suave)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                {r.rotulo}
              </a>
            ))}
          </div>
        )}

        <p
          style={{
            textAlign: 'center',
            fontSize: '0.72rem',
            lineHeight: 1.5,
            color: 'var(--tinta-suave)',
            opacity: 0.75,
            marginTop: '2.2rem',
          }}
        >
          Alguns links são de parceiros. Se você comprar por eles, posso receber uma comissão —
          sem custo nenhum para você.
        </p>
      </div>
    </div>
  );
}

/**
 * O primeiro botão é o de maior valor (hoje, o grupo de promoções) e vem
 * preenchido; os outros ficam em cartão branco. Um só destaque por tela — se
 * tudo grita, nada é escolhido.
 */
function Botao({ link, destaque }: { link: Link; destaque: boolean }) {
  const ehWhatsapp = /wa\.me|api\.whatsapp\.com/.test(link.href);
  const externo = !link.href.startsWith('/');

  return (
    <a
      href={link.href}
      {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      style={{
        // 60px de altura: alvo confortável de polegar, que é como 100% desta
        // página é usada.
        minHeight: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.6rem',
        padding: '0.9rem 1.2rem',
        borderRadius: 16,
        textAlign: 'center',
        fontWeight: 700,
        fontSize: '1rem',
        lineHeight: 1.25,
        textDecoration: 'none',
        border: destaque ? '1px solid transparent' : '1px solid var(--borda)',
        background: destaque ? 'var(--rosa)' : 'rgba(255,255,255,0.92)',
        color: destaque ? '#fff' : 'var(--tinta)',
        boxShadow: destaque
          ? '0 8px 22px rgba(196, 120, 143, 0.32)'
          : '0 2px 10px rgba(36, 29, 34, 0.05)',
      }}
    >
      {ehWhatsapp ? (
        <IconeWhatsapp tamanho={20} />
      ) : link.emoji ? (
        <span aria-hidden style={{ fontSize: '1.15rem' }}>{link.emoji}</span>
      ) : null}
      <span>{link.rotulo}</span>
    </a>
  );
}
