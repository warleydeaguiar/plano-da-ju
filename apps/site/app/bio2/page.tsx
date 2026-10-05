import type { Metadata } from 'next';
import { Syne } from 'next/font/google';
import { SITE } from '@/lib/seo';
import { carregarBio, FOTO_AVATAR, ehExterno, ehWhatsapp } from '@/lib/bio';
import { CARGO } from '../components/BoxAutora';
import IconeWhatsapp from '../components/IconeWhatsapp';
import { IconeRede } from '../components/IconesRedes';
import s from './bio2.module.css';

export const revalidate = 3600;

const display = Syne({ subsets: ['latin'], weight: ['700', '800'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Juliane Cost',
  description: 'Grupo de promoções, plano capilar e os produtos que a Juliane indica.',
  robots: { index: false, follow: true },
  alternates: { canonical: `${SITE}/bio/` },
};

const TEMAS = ['Tricologia', 'Cronograma capilar', 'Progressiva sem formol', 'Fashion Gold', 'Ybera Paris', 'Cabelo saudável'];

const atraso = (n: number) => ({ animationDelay: `${n}s` });

/** Versão noir: fundo escuro com aurora em movimento, bordas de luz girando e nome em dourado. */
export default async function Bio2() {
  const { principais, redes } = await carregarBio();
  const base = 0.55;

  return (
    <div className={s.palco}>
      <div className={s.aurora} aria-hidden>
        <span className={s.a1} />
        <span className={s.a2} />
        <span className={s.a3} />
      </div>
      <div className={s.grao} aria-hidden />

      <main className={s.coluna}>
        <div className={`${s.avatar} ${s.entra}`}>
          <span className={s.aro} />
          <picture>
            <source srcSet={`${FOTO_AVATAR}.avif`} type="image/avif" />
            <source srcSet={`${FOTO_AVATAR}.webp`} type="image/webp" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${FOTO_AVATAR}.webp`} alt="Juliane Cost, tricologista" width={112} height={112} fetchPriority="high" />
          </picture>
        </div>

        <span className={`${s.selo} ${s.entra}`} style={atraso(0.15)}>✦ Tricologista</span>

        <h1 className={`${display.className} ${s.nome}`} style={atraso(0.25)}>
          Juliane Cost
        </h1>
        <p className={`${s.cargo} ${s.entra}`} style={atraso(0.35)}>{CARGO}</p>

        <div className={`${s.faixa} ${s.entra}`} style={atraso(0.45)} aria-hidden>
          <div className={s.trilho}>
            {[...TEMAS, ...TEMAS].map((t, i) => (
              <span key={i}>{t}<i>✦</i></span>
            ))}
          </div>
        </div>

        <nav className={s.lista}>
          {principais.map((l, i) => (
            <a
              key={l.href}
              href={l.href}
              {...(ehExterno(l.href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className={`${s.cartao} ${i === 0 ? s.principal : ''}`}
              style={{ ['--atraso' as string]: `${base + i * 0.09}s`, ['--giro' as string]: `${-i * 1.4}s` }}
            >
              <span className={s.icone}>
                {ehWhatsapp(l.href) ? <IconeWhatsapp tamanho={19} /> : (l.emoji ?? '✦')}
              </span>
              <span className={s.rotulo}>{l.rotulo}</span>
              <span className={s.chevron} aria-hidden>›</span>
            </a>
          ))}
        </nav>

        {redes.length > 0 && (
          <div className={`${s.redes} ${s.entra}`} style={atraso(base + principais.length * 0.09 + 0.1)}>
            {redes.map((r) => (
              <a key={r.href} href={r.href} target="_blank" rel="noopener noreferrer" aria-label={r.rotulo} className={s.rede}>
                <IconeRede href={r.href} tamanho={19} />
              </a>
            ))}
          </div>
        )}

        <p className={`${s.rodape} ${s.entra}`} style={atraso(base + principais.length * 0.09 + 0.2)}>
          Alguns links são de parceiros. Se você comprar por eles, posso receber uma comissão — sem custo nenhum para você.
        </p>
      </main>
    </div>
  );
}
