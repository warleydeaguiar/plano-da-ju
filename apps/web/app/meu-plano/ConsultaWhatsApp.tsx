'use client';

import { JU_WHATSAPP } from '@/lib/contact';

/**
 * Tela de quem pagou e ainda não fez a consulta.
 *
 * O plano já está pronto do outro lado; o que falta é a conversa. Entregar só
 * pelo aplicativo não sustentava a indicação dos produtos — a cliente recebia
 * um PDF e não falava com ninguém. Aqui a ação principal é uma só: chamar a
 * Juliane no WhatsApp.
 *
 * O prazo aparece na tela de propósito. Ele é promessa, não ameaça: se a
 * consulta não acontecer, o plano abre sozinho e ninguém fica sem o que pagou.
 */
export default function ConsultaWhatsApp({
  nome,
  liberaEm,
}: {
  nome?: string | null;
  /** Quando o plano abre sozinho (ms). */
  liberaEm: number;
}) {
  const primeiro = String(nome ?? '').trim().split(/\s+/)[0] ?? '';
  const restante = Math.max(0, liberaEm - Date.now());
  const horas = Math.floor(restante / 3_600_000);
  const prazo = horas >= 24
    ? `${Math.ceil(horas / 24)} dia${Math.ceil(horas / 24) > 1 ? 's' : ''}`
    : horas >= 1 ? `${horas} hora${horas > 1 ? 's' : ''}` : 'poucos minutos';

  const msg = primeiro
    ? `Oi Juliane! Aqui é a ${primeiro}. Acabei de enviar minha foto e quero fazer minha consulta do Plano Capilar. 💛`
    : 'Oi Juliane! Acabei de enviar minha foto e quero fazer minha consulta do Plano Capilar. 💛';
  const link = `https://wa.me/${JU_WHATSAPP}?text=${encodeURIComponent(msg)}`;

  return (
    <div style={{
      minHeight: 'calc(100dvh - 60px)',
      background: 'radial-gradient(120% 55% at 50% 0%, #2b1120 0%, #1a0b13 55%, #140810 100%)',
      color: '#F7ECEF',
      fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      padding: '30px 20px 48px',
    }}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>

        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 96, height: 96, borderRadius: '50%', overflow: 'hidden', margin: '0 auto 16px',
            border: '3px solid rgba(233,169,191,.45)', boxShadow: '0 14px 34px -14px rgba(0,0,0,.9)',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/juliane-consultorio.jpg"
              alt="Juliane Cost, tricologista"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '43% 20%', transform: 'scale(1.9)', transformOrigin: '43% 28%' }}
            />
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 10.5, fontWeight: 800,
            letterSpacing: 1, textTransform: 'uppercase', color: '#F7ECEF',
            background: 'rgba(247,236,239,.10)', border: '1px solid rgba(233,169,191,.25)',
            padding: '6px 12px', borderRadius: 99, marginBottom: 14,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6FD3A3', display: 'inline-block' }} />
            Plano pronto — falta a sua consulta
          </div>

          <h1 style={{
            fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 600,
            fontSize: 27, lineHeight: 1.18, margin: '0 0 10px',
          }}>
            {primeiro ? `${primeiro}, ` : ''}eu quero te explicar<br />o seu plano
          </h1>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#C7A6B4', margin: '0 0 22px' }}>
            Analisei a sua foto e as suas respostas, e montei o seu plano capilar.
            Antes de liberar, eu faço a sua consulta pelo WhatsApp: é onde eu te explico
            o que o seu cabelo precisa e a ordem certa de fazer cada coisa.
          </p>
        </div>

        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block', textAlign: 'center', textDecoration: 'none',
            background: 'linear-gradient(135deg,#25D366,#12A150)', color: '#fff',
            fontSize: 16.5, fontWeight: 800, padding: '18px 20px', borderRadius: 16,
            boxShadow: '0 16px 34px -16px rgba(37,211,102,.9)', marginBottom: 12,
          }}
        >
          Falar com a Juliane agora
        </a>
        <div style={{ textAlign: 'center', fontSize: 12.5, color: '#9C7C8B', marginBottom: 26 }}>
          Atendimento de segunda a sexta, das 9h às 17h30
        </div>

        <div style={{
          background: 'linear-gradient(165deg,#361628,#2A1120)',
          border: '1px solid rgba(233,169,191,.28)', borderRadius: 20, padding: '18px 18px 14px',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: '#D9A96B', marginBottom: 12 }}>
            O que acontece na consulta
          </div>
          {[
            ['💬', 'Eu te mostro o que vi na sua foto — porosidade, danos e o que está travando o seu cabelo.'],
            ['🧴', 'A gente decide juntas os produtos: o que você já tem em casa serve, e o que falta de verdade.'],
            ['📅', 'Ajusto o cronograma ao seu tempo real, e só então libero o plano aqui no aplicativo.'],
          ].map(([ic, txt], i, arr) => (
            <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', marginBottom: i === arr.length - 1 ? 0 : 11 }}>
              <span style={{ fontSize: 16, lineHeight: 1.3 }}>{ic}</span>
              <span style={{ fontSize: 13.5, lineHeight: 1.55, color: '#E8D6DC' }}>{txt}</span>
            </div>
          ))}
        </div>

        <div style={{
          background: 'rgba(247,236,239,.06)', border: '1px solid rgba(233,169,191,.16)',
          borderRadius: 14, padding: '13px 16px', fontSize: 12.5, lineHeight: 1.6, color: '#C7A6B4',
        }}>
          Não consegue falar agora? Sem problema: <strong style={{ color: '#F7ECEF' }}>o seu plano
          abre sozinho aqui em {prazo}</strong>. A consulta é para você aproveitar melhor — nunca
          para segurar o que já é seu.
        </div>
      </div>
    </div>
  );
}
