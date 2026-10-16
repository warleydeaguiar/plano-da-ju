/**
 * TEXTOS das mensagens automáticas escritas no código (SMS, WhatsApp de texto
 * livre e o e-mail do PIX). Um lugar só, usado por QUEM ENVIA e pela
 * pré-visualização do painel (admin /funil, via /api/previa-mensagens) — assim
 * o que o painel mostra é exatamente o que sai.
 *
 * Os textos de template do WhatsApp NÃO estão aqui: moram na Meta (o painel lê
 * de lá). Os e-mails das réguas moram em wg_email_sequences.
 */

const APP = 'https://planodaju.julianecost.com'

// ── E-mail imediato do PIX (checkout/pix) ──────────────────────────────────
export const EMAIL_PIX_ASSUNTO = 'Seu PIX do Plano da Ju — código para pagar 💛'

/** E-mail transacional com o PIX copia-e-cola (a cliente paga de qualquer lugar). */
export function emailPixHtml(first: string, code: string, qrImg?: string): string {
  return `
  <div style="background:#FFFAF5;padding:32px 0;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif">
    <div style="max-width:460px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #F0E0E4">
      <div style="background-color:#BE185D;background-image:linear-gradient(135deg,#FB7185,#BE185D);padding:26px 32px">
        <div style="color:#ffffff;font-size:22px;font-weight:700;font-family:Georgia,serif">Plano da <em>Ju</em></div>
      </div>
      <div style="padding:26px 32px;color:#3D2B2E">
        <p style="font-size:16px;margin:0 0 12px">Oi, ${first}! 💛</p>
        <p style="font-size:14px;line-height:1.6;color:#7A6A6D;margin:0 0 18px">
          Seu PIX do <strong>Plano da Ju</strong> foi gerado. É só pagar com o código abaixo
          que a Juliane já começa a preparar a sua consulta e o seu plano capilar de 90 dias. <strong>O PIX expira em 1 hora.</strong>
        </p>
        ${qrImg ? `<div style="text-align:center;margin:0 0 18px"><img src="${qrImg}" alt="QR Code PIX" width="180" height="180" style="border-radius:12px"/></div>` : ''}
        <div style="font-size:11px;font-weight:700;color:#BE185D;text-transform:uppercase;letter-spacing:.5px;margin:0 0 6px">PIX copia e cola</div>
        <div style="font-family:monospace;font-size:12.5px;line-height:1.5;color:#3D2B2E;background:#FFF6F9;border:1px dashed #F0C0CE;border-radius:10px;padding:12px;word-break:break-all">${code}</div>
        <p style="font-size:12.5px;line-height:1.6;color:#7A6A6D;margin:18px 0 0">
          Abra o app do seu banco, escolha <strong>PIX &gt; Copia e Cola</strong>, cole esse código e confirme.
          Assim que o pagamento cair, seu acesso é liberado automaticamente.
        </p>
      </div>
    </div>
  </div>`
}

// ── SMS (Zenvia; o sendSms tira os acentos) ────────────────────────────────
/** Toque 1 — na hora em que o PIX é gerado (checkout/pix). */
export function smsPixGerado(first: string): string {
  return `${first}, seu PIX do Plano da Ju foi gerado! O codigo esta no seu e-mail. Finalize o pagamento pra garantir sua consulta com a Juliane.`
}

// SMS sem acento/emoji (GSM-7, custo menor) e SEM link. Estrategia 360: leva pro
// WhatsApp/e-mail, onde estao o codigo PIX e a oferta. Mensagem por toque.
/** Toques 2 (+24 h) e 3 (+48 h) do PIX não pago (cron pix-sms). */
export function smsPixToque(name: string, touch: number): string {
  if (touch === 2) {
    return `${name}, sua consulta com a Juliane ainda ta te esperando! Ainda da tempo de garantir. Chama a gente no WhatsApp que a gente finaliza com voce.`
  }
  return `${name}, ultima chamada! A Juliane separou um horario pra sua consulta. Responde nosso WhatsApp hoje que a gente destrava seu acesso.`
}

/** Plano liberado (cron plano-pronto-sms). */
export function smsPlanoPronto(name: string): string {
  return `${name}, seu plano capilar personalizado da Juliane ficou pronto! Abra o app Plano da Ju pra ver seu cronograma completo e comecar hoje.`
}

// ── WhatsApp em texto livre (só dentro da janela de 24 h) ──────────────────
/** Oferta com cupom para quem respondeu a régua (cron lead-desconto). */
export function waDesconto(nome: string, precoBase: string, precoComCupom: string, cupom: string): string {
  return (
    `Oi ${nome}! Vi que você ainda não finalizou a sua inscrição na consulta com a Juliane 💛\n\n`
    // O "em vez de" é o preço DELA (a faixa que respondeu no quiz), senão a
    // mensagem prometeria um desconto sobre um valor que ela nunca viu.
    + `Separei um desconto pra você: em vez de ${precoBase}, fica por ${precoComCupom}.\n\n`
    + `É só entrar por aqui que o desconto já vem aplicado:\n`
    + `${APP}/oferta?cupom=${cupom}`
  )
}

/** Primeira mensagem dela no número oficial (funil dos grupos, wa-autoreply). */
export function waAutoreplyGrupo(firstName: string, link: string): string {
  return (
    `Oiii${firstName ? `, ${firstName}` : ''}! Que bom te ver por aqui 💖 Tem vaga sim!\n\n` +
    `Entra no nosso grupo de promoções por aqui: ${link}\n\n` +
    'E me conta uma coisinha, pra eu conseguir te ajudar melhor: o que MAIS te incomoda no seu cabelo hoje? ' +
    '(queda, frizz, pontas ressecadas, quebra, crescimento, volume…) 💬'
  )
}

/** Entrou no grupo pela 1ª vez (g/entrar), quando o template não sai. */
export function waEntrouNoGrupo(first: string): string {
  const ola = first ? `Fico muito feliz, ${first}, que você entrou no meu grupo! 💚` : 'Fico muito feliz que você entrou no meu grupo! 💚'
  return `${ola}\n\nEu dou uma atenção especial pra todas que estão nele, então me conta: o que mais te incomoda no seu cabelo hoje?`
}

/** Respostas automáticas aos botões / pedidos (wa/resposta). */
export const waResposta = {
  bloqueio: () => 'Pronto! Você não vai mais receber mensagens automáticas por aqui. 💛',
  planoPorWhatsapp: () => 'Perfeito! 💛 Vou te mandar o seu plano por aqui. Se precisar de qualquer ajuste, é só me falar nesta conversa.',
  diagnostico: (nome: string, noExpediente: boolean) => noExpediente
    ? `${nome ? `Oi, ${nome}! ` : 'Oi! '}Estou olhando as suas respostas do quiz agora e já te mando o seu diagnóstico por aqui. 💛`
    : `${nome ? `Oi, ${nome}! ` : 'Oi! '}Recebi o seu pedido 💛 Vou olhar as suas respostas do quiz e te mandar o diagnóstico por aqui. Nosso atendimento é de segunda a sexta, das 8h às 17h30.`,
  querGrupo: (nome: string, link: string) =>
    `${nome ? `Perfeito, ${nome}! ` : 'Perfeito! '}Sua vaga está reservada 💛\n\n`
    + `É só tocar aqui para entrar: ${link}\n\n`
    + 'É nesse grupo que eu aviso quando os produtos entram em promoção de verdade.',
  naoEntrei: (nome: string, link: string) =>
    `${nome ? `Ai, ${nome}, ` : ''}desculpa! Toca aqui que eu te coloco em um grupo com vaga agora: ${link}`,
  entrei: (nome: string) =>
    `${nome ? `Que bom, ${nome}! ` : 'Que bom! '}Já que você está no grupo, me conta uma coisa para eu te avisar do que interessa: `
    + 'o que mais te incomoda no seu cabelo hoje — queda, quebra, volume, frizz ou ressecamento? 💛',
  cortesia: () =>
    'Ai, me desculpa! 🙈 Se você já recebeu o Plano de cortesia, ignora essa mensagem — não é para você pagar nada. Já tirei o seu número da fila desse aviso.\n\nSe o seu acesso não estiver funcionando, me fala por aqui que eu resolvo. 💛',
  concluir: (nome: string, link: string) =>
    `${nome ? `Que bom, ${nome}! ` : 'Que bom! '}É só tocar aqui para concluir a sua inscrição: ${link}\n\nSe travar em alguma etapa, me conta por aqui que eu te ajudo. 💛`,
  duvida: () => 'Claro! Me conta: o que mais te incomoda no seu cabelo hoje? Eu te respondo por aqui. 💛',
}
