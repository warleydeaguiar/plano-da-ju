import type { Metadata } from 'next';
import { SITE } from '@/lib/seo';
import { carregarBio, VIDEO_FUNDO, POSTER_FUNDO, type LinkBio as Link } from '@/lib/bio';
import { CARGO, FotoAutora } from '../components/BoxAutora';
import IconeWhatsapp from '../components/IconeWhatsapp';
import { IconeRede } from '../components/IconesRedes';
import styles from './bio.module.css';

export const revalidate = 3600; // literal: o Next analisa este export estaticamente

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

export default async function LinkNaBio() {
  const { principais, redes } = await carregarBio();

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
                <IconeRede href={r.href} tamanho={19} rotulo={r.rotulo} />
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
