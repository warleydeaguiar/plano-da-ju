import type { Metadata } from 'next';
import { Fraunces } from 'next/font/google';
import { SITE } from '@/lib/seo';
import { carregarBio, RETRATO, ehExterno } from '@/lib/bio';
import { CARGO } from '../components/BoxAutora';
import s from './bio1.module.css';

export const revalidate = 3600;

const serif = Fraunces({ subsets: ['latin'], style: ['normal', 'italic'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Juliane Cost',
  description: 'Grupo de promoções, plano capilar e os produtos que a Juliane indica.',
  robots: { index: false, follow: true },
  alternates: { canonical: `${SITE}/bio/` },
};

const atraso = (n: number) => ({ animationDelay: `${n}s` });

/** Versão editorial: papel, serifa, retrato em arco e lista numerada como índice de revista. */
export default async function Bio1() {
  const { principais, redes } = await carregarBio();
  const base = 0.75;

  return (
    <div className={s.pagina}>
      <main className={s.coluna}>
        <p className={`${s.sobrelinha} ${s.surge}`} style={atraso(0.05)}>
          <span>Nº 01</span>
          <span className={s.fio} />
          <span>Tricologista</span>
        </p>

        <div className={s.arco}>
          <picture>
            <source srcSet={`${RETRATO}.webp`} type="image/webp" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${RETRATO}.jpg`} alt="Juliane Cost no consultório" width={410} height={546} fetchPriority="high" />
          </picture>
        </div>

        <h1 className={`${serif.className} ${s.nome}`}>
          <span className={s.mascara}><span style={atraso(0.35)}>Juliane</span></span>
          <span className={s.mascara}><em style={atraso(0.5)}>Cost</em></span>
        </h1>

        <p className={`${serif.className} ${s.cargo} ${s.surge}`} style={atraso(0.65)}>
          {CARGO}.
        </p>

        <nav className={s.indice} aria-label="Links">
          {principais.map((l, i) => (
            <a
              key={l.href}
              href={l.href}
              {...(ehExterno(l.href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className={`${s.linha} ${i === 0 ? s.destaque : ''} ${s.surge}`}
              style={atraso(base + i * 0.08)}
            >
              <span className={`${serif.className} ${s.numero}`}>{String(i + 1).padStart(2, '0')}</span>
              <span className={s.rotulo}>{l.rotulo}</span>
              <span className={s.seta} aria-hidden>→</span>
            </a>
          ))}
        </nav>

        {redes.length > 0 && (
          <p className={`${s.redes} ${s.surge}`} style={atraso(base + principais.length * 0.08 + 0.1)}>
            {redes.map((r, i) => (
              <span key={r.href}>
                {i > 0 && <span className={s.ponto}>·</span>}
                <a href={r.href} target="_blank" rel="noopener noreferrer">{r.rotulo}</a>
              </span>
            ))}
          </p>
        )}

        <footer className={`${s.rodape} ${s.surge}`} style={atraso(base + principais.length * 0.08 + 0.2)}>
          <span className={`${serif.className} ${s.assinatura}`}>com carinho, Ju</span>
          <span>
            Alguns links são de parceiros. Se você comprar por eles, posso receber uma comissão — sem custo nenhum para você.
          </span>
        </footer>
      </main>
    </div>
  );
}
