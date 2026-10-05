import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { SITE } from '@/lib/seo';
import {
  carregarBio, RETRATO_STORY, FOTO_KIT, VIDEO_FUNDO, POSTER_FUNDO,
  ehExterno, ehWhatsapp, type LinkBio,
} from '@/lib/bio';
import { CARGO } from '../components/BoxAutora';
import IconeWhatsapp from '../components/IconeWhatsapp';
import { IconeRede } from '../components/IconesRedes';
import s from './bio3.module.css';

export const revalidate = 3600;

const fonte = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['500', '700', '800'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Juliane Cost',
  description: 'Grupo de promoções, plano capilar e os produtos que a Juliane indica.',
  robots: { index: false, follow: true },
  alternates: { canonical: `${SITE}/bio/` },
};

const TONS = [s.pessego, s.lilas, s.menta, s.manteiga];
const EH_LOJA = /produto|ybera|loja/i;

const atraso = (n: number) => ({ animationDelay: `${n}s` });

const alvo = (href: string) => (ehExterno(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {});

function Seta() {
  return (
    <span className={s.seta} aria-hidden>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17 17 7M8 7h9v9" />
      </svg>
    </span>
  );
}

function Icone({ link }: { link: LinkBio }) {
  if (ehWhatsapp(link.href)) return <IconeWhatsapp tamanho={26} />;
  return <>{link.emoji ?? '✨'}</>;
}

/** Versão bento: blocos de tamanhos diferentes, foto, vídeo e produto como peças do mosaico. */
export default async function Bio3() {
  const { principais, redes } = await carregarBio();
  const [principal, ...resto] = principais;
  const sobraImpar = resto.length % 2 === 1;
  let ordem = 0;
  const proximo = () => atraso(0.08 * ordem++);

  return (
    <div className={`${fonte.className} ${s.palco}`}>
      <main className={s.grade}>
        {/* ------------------------------------------------------- perfil */}
        <section className={`${s.bloco} ${s.perfil}`} style={proximo()}>
          <picture>
            <source srcSet={`${RETRATO_STORY}.webp`} type="image/webp" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${RETRATO_STORY}.jpg`} alt="Juliane Cost" className={s.cobre} fetchPriority="high" />
          </picture>
          <span className={s.chip}>✓ Tricologista</span>
          <div className={s.legenda}>
            <h1 className={s.nome}>Juliane Cost</h1>
            <p className={s.cargo}>{CARGO}</p>
          </div>
        </section>

        {/* ------------------------------------------- link principal */}
        {principal && (
          <a href={principal.href} {...alvo(principal.href)} className={`${s.bloco} ${s.principal}`} style={proximo()}>
            <Seta />
            <span className={s.emojiGrande}><Icone link={principal} /></span>
            <span className={s.rotuloForte}>{principal.rotulo}</span>
          </a>
        )}

        {/* ------------------------------------------------------- vídeo */}
        <section className={`${s.bloco} ${s.video}`} style={proximo()}>
          <video className={s.cobre} src={VIDEO_FUNDO} poster={POSTER_FUNDO} autoPlay muted loop playsInline preload="metadata" />
          <span className={s.etiqueta}>Resultados reais ✨</span>
        </section>

        {/* ------------------------------------------------------ número */}
        <section className={`${s.bloco} ${s.numero}`} style={proximo()}>
          <strong>+30 mil</strong>
          <span>mulheres já cuidam do cabelo com a Ju</span>
        </section>

        {/* -------------------------------------------- demais links */}
        {resto.map((l, i) => {
          const largo = sobraImpar && i === resto.length - 1;
          const loja = EH_LOJA.test(l.rotulo);
          return (
            <a
              key={l.href}
              href={l.href}
              {...alvo(l.href)}
              className={`${s.bloco} ${s.link} ${largo ? s.largo : ''} ${loja ? s.loja : TONS[i % TONS.length]}`}
              style={proximo()}
            >
              {loja && (
                <picture>
                  <source srcSet={`${FOTO_KIT}.webp`} type="image/webp" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${FOTO_KIT}.jpg`} alt="" className={s.cobre} loading="lazy" />
                </picture>
              )}
              <Seta />
              {!loja && <span className={s.emoji}><Icone link={l} /></span>}
              <span className={s.rotulo}>{l.rotulo}</span>
            </a>
          );
        })}

        {/* ------------------------------------------------------- redes */}
        {redes.length > 0 && (
          <section className={`${s.bloco} ${s.redes}`} style={proximo()}>
            {redes.map((r) => (
              <a key={r.href} href={r.href} target="_blank" rel="noopener noreferrer" className={s.rede}>
                <IconeRede href={r.href} tamanho={20} />
                <span>{r.rotulo}</span>
              </a>
            ))}
          </section>
        )}

        <p className={s.rodape} style={proximo()}>
          Alguns links são de parceiros. Se você comprar por eles, posso receber uma comissão — sem custo nenhum para você.
        </p>
      </main>
    </div>
  );
}
