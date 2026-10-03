import type { Metadata } from 'next';
import { porPath } from '@/lib/conteudo';
import { SITE } from '@/lib/seo';
import { CARGO, FotoAutora } from '../components/BoxAutora';
import IconeWhatsapp from '../components/IconeWhatsapp';
import { IconeInstagram, IconeTikTok, IconeYoutube } from '../components/IconesRedes';
import styles from './bio.module.css';

export const revalidate = 3600; // literal: o Next analisa este export estaticamente

const VIDEO_FUNDO = 'https://db.planodaju.julianecost.com/storage/v1/object/public/site-conteudo/bio/video-fundo.mp4';
const POSTER_FUNDO = 'https://db.planodaju.julianecost.com/storage/v1/object/public/site-conteudo/bio/video-fundo-poster.jpg';

/**
 * Fora do índice de propósito, como já era no WordPress (path antigo
 * `/links/`, agora `/bio/` — redirect 308 em next.config.ts). Existe para
 * quem chega do Instagram, não para disputar busca.
 */
export const metadata: Metadata = {
  title: 'Juliane Cost',
  description: 'Grupo de promoções, plano capilar e os produtos que a Juliane indica.',
  robots: { index: false, follow: true },
  alternates: { canonical: `${SITE}/bio/` },
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

function iconeDaRede(href: string) {
  if (/instagram\.com/i.test(href)) return <IconeInstagram tamanho={19} />;
  if (/tiktok\.com/i.test(href)) return <IconeTikTok tamanho={18} />;
  if (/youtube\.com|youtu\.be/i.test(href)) return <IconeYoutube tamanho={19} />;
  return null;
}

export default async function LinkNaBio() {
  const item = await porPath('/bio/');
  const { principais, redes } = extrairLinks(item?.content_clean ?? null);

  return (
    <div className={styles.palco}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        className={styles.video}
        src={VIDEO_FUNDO}
        poster={POSTER_FUNDO}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      <div className={styles.veu} />

      <div className={styles.conteudo}>
        {/* ------------------------------------------------------- perfil */}
        <div className={styles.avatarAro} style={{ animationDelay: '0s' }}>
          <FotoAutora tamanho={116} prioritaria />
        </div>

        <h1 className={`${styles.item} ${styles.nome}`} style={{ animationDelay: '0.12s' }}>
          Juliane Cost
        </h1>
        <p className={`${styles.item} ${styles.cargo}`} style={{ animationDelay: '0.22s' }}>
          {CARGO}
        </p>

        {/* ------------------------------------------------------- botões */}
        <nav className={styles.nav}>
          {principais.map((l, i) => (
            <Botao key={l.href} link={l} destaque={i === 0} delay={0.34 + i * 0.09} />
          ))}
        </nav>

        {/* -------------------------------------------------------- redes */}
        {redes.length > 0 && (
          <div
            className={`${styles.item} ${styles.redes}`}
            style={{ animationDelay: `${0.34 + principais.length * 0.09 + 0.1}s` }}
          >
            {redes.map((r) => (
              <a
                key={r.href}
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={r.rotulo}
                className={styles.rede}
              >
                {iconeDaRede(r.href)}
              </a>
            ))}
          </div>
        )}

        <p
          className={`${styles.item} ${styles.rodape}`}
          style={{ animationDelay: `${0.34 + principais.length * 0.09 + 0.2}s` }}
        >
          Alguns links são de parceiros. Se você comprar por eles, posso receber uma comissão —
          sem custo nenhum para você.
        </p>
      </div>
    </div>
  );
}

function Botao({ link, destaque, delay }: { link: Link; destaque: boolean; delay: number }) {
  const ehWhatsapp = /wa\.me|api\.whatsapp\.com/.test(link.href);
  const externo = !link.href.startsWith('/');

  return (
    <a
      href={link.href}
      {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={`${styles.item} ${styles.botao} ${destaque ? styles.botaoDestaque : ''}`}
      style={{ animationDelay: `${delay}s` }}
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
