'use client';

import { JU_WHATSAPP } from '@/lib/contact';
import Picture from '@/app/components/Picture';
import { IconWhatsApp } from './icons';

/**
 * Tela de quem pagou e ainda não fez a consulta.
 *
 * O plano já está pronto do outro lado; o que falta é a conversa. Entregar só
 * pelo aplicativo não sustentava a indicação dos produtos — a cliente recebia
 * um PDF e não falava com ninguém. Aqui a ação principal é uma só: chamar a
 * Juliane no WhatsApp, e a tela inteira deixa claro que é ALI que ela é
 * atendida (foto dela atendendo no alto, ícone do WhatsApp no botão).
 */
export default function ConsultaWhatsApp({
  nome,
  liberaEm,
}: {
  nome?: string | null;
  /** Quando o plano abre sozinho (ms) — a rede de proteção do fluxo. */
  liberaEm?: number;
}) {
  void liberaEm;
  const primeiro = String(nome ?? '').trim().split(/\s+/)[0] ?? '';

  const msg = primeiro
    ? `Oi Juliane! Aqui é a ${primeiro}. Enviei minha foto e quero fazer minha consulta do Plano Capilar. 💛`
    : 'Oi Juliane! Enviei minha foto e quero fazer minha consulta do Plano Capilar. 💛';
  const link = `https://wa.me/${JU_WHATSAPP}?text=${encodeURIComponent(msg)}`;

  return (
    <div style={{
      minHeight: 'calc(100dvh - 60px)',
      background: 'radial-gradient(120% 55% at 50% 0%, #2b1120 0%, #1a0b13 55%, #140810 100%)',
      color: '#F7ECEF',
      fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      paddingBottom: 44,
    }}>
      {/* A Juliane atendendo: a cliente precisa ver que tem gente do outro lado. */}
      <div style={{ position: 'relative', height: 210, overflow: 'hidden' }}>
        <Picture
          src="/images/consulta-hero.jpg"
          alt="Juliane Cost, tricologista, atendendo no consultório"
          loading="eager"
          fetchPriority="high"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '38% 28%', display: 'block' }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(20,8,16,.25) 0%, rgba(20,8,16,0) 30%, rgba(20,8,16,.62) 66%, rgba(20,8,16,.98) 100%)',
        }} />
        <div style={{
          position: 'absolute', left: 18, bottom: 14, right: 18,
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase',
            background: 'rgba(20,8,16,.55)', border: '1px solid rgba(233,169,191,.3)',
            padding: '6px 12px', borderRadius: 99, backdropFilter: 'blur(4px)',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6FD3A3', display: 'inline-block' }} />
            Plano pronto — falta a sua consulta
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 460, margin: '0 auto', padding: '20px 20px 0' }}>
        <h1 style={{
          fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 600,
          fontSize: 26, lineHeight: 1.2, margin: '0 0 12px', textAlign: 'center',
        }}>
          {primeiro ? `${primeiro}, ` : ''}vamos conversar<br />sobre o seu plano?
        </h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#C7A6B4', margin: '0 0 8px', textAlign: 'center' }}>
          Analisei a sua foto e as suas respostas, e montei o seu plano capilar personalizado.
          Agora eu te chamo para uma <strong style={{ color: '#F7ECEF' }}>conversa de 10 minutos no
          WhatsApp</strong>: é onde eu te explico o que encontrei no seu cabelo e como seguir o
          plano do jeito certo.
        </p>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#9C7C8B', margin: '0 0 22px', textAlign: 'center' }}>
          Dez minutos, no seu tempo — e o seu plano fica liberado aqui no aplicativo.
        </p>

        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            textDecoration: 'none',
            background: 'linear-gradient(135deg,#25D366,#12A150)', color: '#fff',
            fontSize: 16.5, fontWeight: 800, padding: '17px 20px', borderRadius: 16,
            boxShadow: '0 16px 34px -16px rgba(37,211,102,.9)', marginBottom: 10,
          }}
        >
          <IconWhatsApp size={23} color="#fff" />
          Falar com a Juliane agora
        </a>
        <div style={{ textAlign: 'center', fontSize: 12.5, color: '#9C7C8B', marginBottom: 24 }}>
          Atendimento de segunda a sexta, das 9h às 17h30
        </div>

        <div style={{
          background: 'linear-gradient(165deg,#361628,#2A1120)',
          border: '1px solid rgba(233,169,191,.28)', borderRadius: 20, padding: '18px 18px 14px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: '#D9A96B', marginBottom: 12 }}>
            Nos 10 minutos de conversa
          </div>
          {[
            ['💬', 'Eu te mostro o que vi na sua foto — porosidade, danos e o que está travando o seu cabelo.'],
            ['🧴', 'A gente decide juntas os produtos: o que você já tem em casa serve, e o que falta de verdade.'],
            ['📅', 'Ajusto o cronograma ao seu tempo real, e libero o seu plano aqui no aplicativo.'],
          ].map(([ic, txt], i, arr) => (
            <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', marginBottom: i === arr.length - 1 ? 0 : 11 }}>
              <span style={{ fontSize: 16, lineHeight: 1.3 }}>{ic}</span>
              <span style={{ fontSize: 13.5, lineHeight: 1.55, color: '#E8D6DC' }}>{txt}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
