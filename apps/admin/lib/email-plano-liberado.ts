/**
 * E-mail "plano liberado" (cron deliver-plans). Fica aqui, fora da rota, para o
 * mapa do funil (/funil) mostrar exatamente o que sai.
 */
export const PLANO_LIBERADO_ASSUNTO = '💛 Seu plano capilar está liberado'

const APP_URL = 'https://planodaju.julianecost.com/meu-plano/plano'

export function planoLiberadoHtml(firstName: string): string {
  const oi = firstName ? `Oi, ${firstName}! ` : 'Oi! '
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;color:#2A1E2C">
    <div style="background:linear-gradient(135deg,#BE185D,#EC4899);color:#fff;padding:28px 24px;border-radius:16px 16px 0 0">
      <div style="font-size:13px;letter-spacing:1px;opacity:.9;text-transform:uppercase">Plano da Ju</div>
      <h1 style="font-size:24px;margin:8px 0 0">💛 Seu plano capilar está liberado!</h1>
    </div>
    <div style="background:#fff;border:1px solid #f0e6ec;border-top:none;padding:24px;border-radius:0 0 16px 16px">
      <p style="font-size:15px;line-height:1.6">${oi}A Juliane terminou de revisar o seu caso e <strong>liberou o seu plano capilar</strong> no aplicativo. É só entrar e começar. 💛</p>
      <p style="font-size:15px;line-height:1.6">Seu <strong>cronograma capilar personalizado de 90 dias</strong> já está liberado no app — com as lavagens, hidratações, reconstruções e os produtos certos pro seu cabelo.</p>
      <p style="text-align:center;margin:26px 0">
        <a href="${APP_URL}" style="background:#BE185D;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;display:inline-block">Ver meu plano agora</a>
      </p>
      <p style="font-size:13px;color:#7C6B7E;line-height:1.6">Deu pra ver tudo? No app você também pode <strong>avaliar o plano</strong> e pedir ajustes se quiser — a gente responde em até 2 dias úteis. 😉</p>
      <div style="margin-top:18px;padding:14px 16px;background:#E9F9EE;border:1px solid #A9E6BE;border-radius:12px">
        <p style="font-size:13.5px;color:#1F7A55;font-weight:700;margin:0 0 4px">Dúvida sobre o plano ou qual produto comprar?</p>
        <p style="font-size:13px;color:#3f5a4d;margin:0 0 10px;line-height:1.5">Fala com a Juliane no WhatsApp — ela te ajuda a escolher e a começar do jeito certo. 💚</p>
        <a href="https://wa.me/5531999994001?text=${encodeURIComponent('Oi Juliane! 💛 Tenho uma dúvida sobre o meu plano capilar e os produtos.')}" style="background:#25D366;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 20px;border-radius:10px;display:inline-block">Falar com a Juliane no WhatsApp</a>
      </div>
    </div>
  </div>`
}
