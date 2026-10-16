/**
 * MAPA DOS FUNIS (admin /funil) — a jornada de cada lead, em ordem, como está
 * no código HOJE (revisado em 16/10/2026, depois do discador).
 *
 * Cada passo diz o canal, quando sai, a regra e quem NÃO recebe. O texto da
 * mensagem NUNCA é copiado aqui: `previas` aponta para a fonte de verdade e a
 * página busca na hora (lib/funil/dados.ts):
 *   email:<id>     → wg_email_sequences (a régua do e-mail marketing)
 *   wa:<template>  → template aprovado na Meta
 *   web:<chave>    → texto escrito no código do site (apps/web/lib/textos-mensagens.ts)
 *   admin:<chave>  → texto escrito no código do admin
 *   discador:sms | discador:link | discador:ficha → painel do discador
 * O status ao vivo e os números de 7 dias vêm do banco, pelo `id` do passo.
 */

export type Canal = 'pagina' | 'rastreio' | 'whatsapp' | 'email' | 'sms' | 'ligacao' | 'sistema'
export type Status = 'ativo' | 'manual' | 'off' | 'gap'
export type Previa = { rotulo?: string; chave: string }
export type Passo = {
  id: string
  canal: Canal
  titulo: string
  quando: string
  regra: string
  naoRecebe?: string
  previas?: Previa[]
  /** Status fixo; os passos com fonte no banco/Meta são recalculados ao vivo. */
  status?: Status
}
export type Etapa = { n: string; titulo: string; subtitulo: string; passos: Passo[] }
export type Ramo = { rotulo: string; tom: 'verde' | 'ouro'; etapas: Etapa[] }
export type Secao = { tipo: 'etapa'; etapa: Etapa } | { tipo: 'ramo'; intro: string; esquerda: Ramo; direita: Ramo }
export type Atencao = { canal: Canal; titulo: string; detalhe: string }
export type Funil = { chave: string; rotulo: string; descricao: string; secoes: Secao[]; atencao: Atencao[] }

/** Ordem em que a régua do lead tenta os templates (lead-recovery). O 1º aprovado é o que sai. */
export const CADEIA_LEAD = ['consulta_50off_v1', 'diagnostico_quiz_v1', 'consulta_pendente_v1', 'inscricao_pendente_util_v5'] as const

const NAO_PAGOU = 'quem pagou, é cortesia ou pediu para não receber'

const CONSULTA: Funil = {
  chave: 'consulta',
  rotulo: 'Consulta (quiz capilar)',
  descricao: 'Quiz /quiz → oferta R$ 97 → consulta com a Juliane e plano de 90 dias.',
  secoes: [
    { tipo: 'etapa', etapa: { n: '1', titulo: 'Quiz', subtitulo: 'Vem do anúncio e responde o quiz capilar', passos: [
      { id: 'quiz', canal: 'pagina', titulo: 'Quiz capilar', quando: 'Dia 0', regra: 'Responde o /quiz (tipo, cor, o que mais incomoda, quanto gasta…) e deixa nome, e-mail e WhatsApp.', status: 'ativo' },
      { id: 'quiz_lead', canal: 'rastreio', titulo: 'Evento Lead', quando: 'ao terminar o quiz', regra: 'Lead no Pixel + CAPI da Meta.', status: 'ativo' },
      { id: 'quiz_cria', canal: 'sistema', titulo: 'Cria o lead', quando: 'na hora', regra: 'Salva em wg_quiz_leads com quiz_slug = plano-capilar — é isso que separa este funil do funil dos grupos.', status: 'ativo' },
    ] } },
    { tipo: 'etapa', etapa: { n: '2', titulo: 'Oferta e pagamento', subtitulo: 'Vê a oferta e gera o PIX ou passa o cartão', passos: [
      { id: 'oferta', canal: 'pagina', titulo: 'Oferta com vídeo', quando: 'logo após o quiz', regra: '/oferta: vídeo de vendas, de R$ 197 por R$ 97, garantia. Cartão só libera com CPF válido, como o PIX.', status: 'ativo' },
      { id: 'pix_gerado', canal: 'sistema', titulo: 'Gera o PIX', quando: 'na hora', regra: 'PIX da Pagar.me vale 1 h (a tela mostra um cronômetro de 3 min). Cria o perfil como "pendente".', status: 'ativo' },
      { id: 'email_pix', canal: 'email', titulo: 'E-mail com o código do PIX', quando: 'na hora em que o PIX é gerado', regra: 'QR Code + copia e cola, para pagar de qualquer lugar.', naoRecebe: 'quem reaproveita um PIX que já estava aberto (não manda de novo)', previas: [{ chave: 'web:email_pix' }], status: 'ativo' },
      { id: 'sms_pix_1', canal: 'sms', titulo: 'SMS "seu PIX foi gerado"', quando: 'na hora em que o PIX é gerado', regra: 'Pela Zenvia, sem link: manda olhar o e-mail.', naoRecebe: 'quem não deixou telefone', previas: [{ chave: 'web:sms_pix_1' }], status: 'ativo' },
    ] } },
    { tipo: 'ramo', intro: 'A partir daqui depende do pagamento',
      esquerda: { rotulo: 'Pagou', tom: 'verde', etapas: [
        { n: '3A', titulo: 'Acesso liberado', subtitulo: 'Pagamento confirmado', passos: [
          { id: 'ativa', canal: 'sistema', titulo: 'Vira cliente ativa', quando: 'na confirmação', regra: 'Webhook da Pagar.me ativa o perfil (90 dias) e marca "aguardando foto".', status: 'ativo' },
          { id: 'purchase', canal: 'rastreio', titulo: 'Purchase (CAPI) + aviso no Discord', quando: 'na confirmação', regra: 'Compra enviada para a Meta pelo servidor; a equipe é avisada no Discord.', status: 'ativo' },
          { id: 'wa_boas_vindas', canal: 'whatsapp', titulo: 'WhatsApp "acesso liberado"', quando: 'até ~2 min depois', regra: 'Template com o botão para abrir o plano e o botão "Pode enviar por aqui".', naoRecebe: 'cortesia (parceria) e quem bloqueou', previas: [{ chave: 'wa:acesso_plano_v2' }] },
          { id: 'email:8aefb95d', canal: 'email', titulo: 'E-mail "Acesso liberado"', quando: '+5 min', regra: 'Pós-compra 1.', previas: [{ chave: 'email:8aefb95d' }] },
        ] },
        { n: '4A', titulo: 'Foto e plano', subtitulo: 'Foto → consulta → Juliane libera o plano', passos: [
          { id: 'email:fa5b7c88', canal: 'email', titulo: 'E-mail "Faltou sua foto"', quando: 'D+1', regra: 'Só para quem ainda não mandou a foto.', previas: [{ chave: 'email:fa5b7c88' }] },
          { id: 'email:faab542e', canal: 'email', titulo: 'E-mail "Última chamada da foto"', quando: 'D+3', regra: 'Só para quem ainda não mandou a foto.', previas: [{ chave: 'email:faab542e' }] },
          { id: 'sem_foto', canal: 'sistema', titulo: 'Plano sem foto', quando: '48 h sem foto', regra: 'Gera o plano mesmo sem foto; ele fica retido até a Juliane liberar.', status: 'ativo' },
          { id: 'libera', canal: 'sistema', titulo: 'Juliane libera o plano', quando: 'depois da consulta', regra: 'Clique em "Liberar plano" no admin. É isso que dispara os avisos abaixo.', status: 'manual' },
          { id: 'email_plano_liberado', canal: 'email', titulo: 'E-mail "plano liberado"', quando: 'até 10 min após liberar', regra: 'Link para o plano no app + WhatsApp da Juliane.', previas: [{ chave: 'admin:email_plano_liberado' }], status: 'ativo' },
          { id: 'sms_plano_pronto', canal: 'sms', titulo: 'SMS "plano pronto"', quando: 'até 10 min após liberar', regra: 'Pela Zenvia, manda abrir o app.', previas: [{ chave: 'web:sms_plano_pronto' }], status: 'ativo' },
          { id: 'wa_plano_por_wa', canal: 'whatsapp', titulo: 'Resposta "Pode enviar por aqui"', quando: 'quando ela toca no botão', regra: 'Confirma que o plano vai pelo WhatsApp (a equipe envia).', previas: [{ chave: 'web:wa_resp_plano_wa' }], status: 'ativo' },
        ] },
        { n: '5A', titulo: 'Acompanhamento', subtitulo: 'Contado a partir da liberação do plano', passos: [
          { id: 'email:f72ea137', canal: 'email', titulo: 'E-mail "Primeiros passos"', quando: 'D+1 da liberação', regra: 'Pós-compra 2.', previas: [{ chave: 'email:f72ea137' }] },
          { id: 'email:d853de21', canal: 'email', titulo: 'E-mail "Semana 1"', quando: 'D+7 da liberação', regra: 'Pós-compra 3.', previas: [{ chave: 'email:d853de21' }] },
          { id: 'email:801c298d', canal: 'email', titulo: 'E-mail "30 dias — foto de progresso"', quando: 'D+30 da liberação', regra: 'Só para quem já mandou foto.', previas: [{ chave: 'email:801c298d' }] },
          { id: 'email:897525c9', canal: 'email', titulo: 'E-mail "Reta final"', quando: 'D+60 da liberação', regra: 'Só para quem já mandou foto.', previas: [{ chave: 'email:897525c9' }] },
        ] },
      ] },
      direita: { rotulo: 'Não pagou — recuperação', tom: 'ouro', etapas: [
        { n: '3B', titulo: 'Primeira hora', subtitulo: 'Gerou o PIX ou tentou o cartão e não pagou', passos: [
          { id: 'wa_pix', canal: 'whatsapp', titulo: 'WhatsApp "PIX pendente"', quando: '5 a 40 min após gerar o PIX', regra: 'Template com o botão que reabre o PIX. Uma vez só por pessoa.', naoRecebe: 'quem pagou ou bloqueou', previas: [{ chave: 'wa:pix_recuperacao_v2' }] },
          { id: 'disc_pix', canal: 'ligacao', titulo: 'Ligação — PIX não pago', quando: '15 min após gerar o PIX', regra: 'O discador liga do celular da empresa (seg–sex, 8h–17h). A atendente vê a ficha e pode mandar o link.', naoRecebe: NAO_PAGOU, previas: [{ rotulo: 'Ficha na tela', chave: 'discador:ficha' }, { rotulo: 'Mensagem com o link', chave: 'discador:link' }] },
          { id: 'disc_cartao', canal: 'ligacao', titulo: 'Ligação — cartão recusado', quando: '15 min após a recusa', regra: 'Não há mensagem automática para cartão recusado: quem age é o discador.', naoRecebe: NAO_PAGOU, previas: [{ rotulo: 'Ficha na tela', chave: 'discador:ficha' }] },
          { id: 'disc_sms', canal: 'sms', titulo: 'SMS quando não atende', quando: 'logo depois da ligação sem resposta', regra: 'Sai pelo chip do celular da atendente. No máximo 1 por dia por telefone.', previas: [{ chave: 'discador:sms' }] },
        ] },
        { n: '4B', titulo: 'Mesmo dia', subtitulo: 'Fez o quiz e não comprou', passos: [
          { id: 'email:585d6f75', canal: 'email', titulo: 'E-mail NP1 — o diagnóstico', quando: '+20 min do quiz', regra: 'Início da régua de e-mail de quem não comprou.', previas: [{ chave: 'email:585d6f75' }] },
          { id: 'wa_lead', canal: 'whatsapp', titulo: 'WhatsApp da régua do lead', quando: '2 h a 14 h após o quiz (8h–21h)', regra: 'Uma mensagem por pessoa. Sai o 1º template aprovado desta ordem: 50% OFF → diagnóstico → consulta pendente → inscrição pendente. O 50% OFF cria um cupom J50 de R$ 48,50 que vale 24 h.', naoRecebe: `${NAO_PAGOU}; quem está com PIX aberto há menos de 1 h espera`, previas: CADEIA_LEAD.map((t) => ({ rotulo: t, chave: `wa:${t}` })) },
          { id: 'wa_respostas', canal: 'whatsapp', titulo: 'Respostas automáticas aos botões', quando: 'na hora em que ela toca', regra: 'Texto livre (a resposta dela abre a janela de 24 h).', previas: [
            { rotulo: '"Quero concluir"', chave: 'web:wa_resp_concluir' },
            { rotulo: '"Tenho uma dúvida"', chave: 'web:wa_resp_duvida' },
            { rotulo: '"Quero meu diagnóstico" (no horário)', chave: 'web:wa_resp_diagnostico' },
            { rotulo: '"Quero meu diagnóstico" (fora do horário)', chave: 'web:wa_resp_diagnostico_fora' },
            { rotulo: 'Disse que ganhou de cortesia', chave: 'web:wa_resp_cortesia' },
            { rotulo: '"Bloquear mensagens"', chave: 'web:wa_resp_bloqueio' },
          ], status: 'ativo' },
          { id: 'wa_desconto', canal: 'whatsapp', titulo: 'WhatsApp com cupom para quem respondeu', quando: '2 h após a régua, se ela respondeu', regra: 'Texto livre com o cupom VOLTA15. 1 em cada 5 fica de fora (grupo de controle).', naoRecebe: 'quem recusou, bloqueou ou é cortesia', previas: [{ chave: 'web:wa_desconto' }] },
          { id: 'disc_checkout', canal: 'ligacao', titulo: 'Ligação — abriu o pagamento e saiu', quando: '2 h depois', regra: 'Discador.', naoRecebe: NAO_PAGOU, previas: [{ rotulo: 'Ficha na tela', chave: 'discador:ficha' }] },
          { id: 'disc_quiz', canal: 'ligacao', titulo: 'Ligação — fez o quiz e não abriu o pagamento', quando: '2 h depois', regra: 'Discador, no máximo 30 novas por dia.', naoRecebe: NAO_PAGOU, previas: [{ rotulo: 'Ficha na tela', chave: 'discador:ficha' }] },
        ] },
        { n: '5B', titulo: 'Dias seguintes', subtitulo: 'Continua sem pagar', passos: [
          { id: 'disc_tentativas', canal: 'ligacao', titulo: 'Novas ligações', quando: 'a cada ~20 h, até 5 tentativas', regra: 'Só em dia útil, 8h–17h. "Ligar depois" volta em 3 h; "Vai pagar" confere no dia seguinte; "Vai pensar" em 2 dias.', naoRecebe: NAO_PAGOU },
          { id: 'sms_pix_2', canal: 'sms', titulo: 'SMS do PIX — 2º toque', quando: '+24 h do PIX', regra: 'Pela Zenvia, sem link: manda chamar no WhatsApp.', naoRecebe: 'quem pagou', previas: [{ chave: 'web:sms_pix_2' }], status: 'ativo' },
          { id: 'sms_pix_3', canal: 'sms', titulo: 'SMS do PIX — última chamada', quando: '+72 h do PIX', regra: 'Último SMS da Zenvia.', naoRecebe: 'quem pagou', previas: [{ chave: 'web:sms_pix_3' }], status: 'ativo' },
          { id: 'email:41dcdb76', canal: 'email', titulo: 'E-mail NP2 — a causa real', quando: 'D+1', regra: 'Régua de quem não comprou.', previas: [{ chave: 'email:41dcdb76' }] },
          { id: 'email:9e73e3d3', canal: 'email', titulo: 'E-mail NP3 — custo de não agir', quando: 'D+2', regra: '', previas: [{ chave: 'email:9e73e3d3' }] },
          { id: 'email:3a522cf0', canal: 'email', titulo: 'E-mail NP4 — prova social', quando: 'D+3', regra: '', previas: [{ chave: 'email:3a522cf0' }] },
          { id: 'email:499913a8', canal: 'email', titulo: 'E-mail NP5 — "já tentei de tudo"', quando: 'D+5', regra: '', previas: [{ chave: 'email:499913a8' }] },
          { id: 'email:6c8a0775', canal: 'email', titulo: 'E-mail NP6 — a oferta', quando: 'D+7', regra: '', previas: [{ chave: 'email:6c8a0775' }] },
          { id: 'email:4a3673ef', canal: 'email', titulo: 'E-mail NP7 — última chamada', quando: 'D+10', regra: 'Fim da régua.', previas: [{ chave: 'email:4a3673ef' }] },
          { id: 'email:bc9a8849', canal: 'email', titulo: 'E-mail "diagnóstico pronto"', quando: '+15 min do quiz', regra: 'Configurado, mas desligado.', previas: [{ chave: 'email:bc9a8849' }] },
          { id: 'email:a901fd37', canal: 'email', titulo: 'E-mail "última hora do desconto"', quando: '+4 h do quiz', regra: 'Configurado, mas desligado.', previas: [{ chave: 'email:a901fd37' }] },
        ] },
      ] },
    },
  ],
  atencao: [
    { canal: 'sms', titulo: 'SMS da Zenvia não olha o "bloquear mensagens"', detalhe: 'Os SMS do PIX e do plano pronto saem mesmo para quem pediu para parar no WhatsApp. O SMS do discador e as mensagens de WhatsApp respeitam.' },
    { canal: 'email', titulo: 'E-mail e SMS do PIX ainda dizem "Plano da Ju"', detalhe: 'O resto do funil já fala em "Consulta com a Tricologista Juliane Cost".' },
    { canal: 'whatsapp', titulo: 'WhatsApp do PIX só uma vez na vida', detalhe: 'Quem gera um 2º PIX dias depois não recebe de novo (o discador cobre).' },
    { canal: 'email', titulo: 'Horário dos e-mails', detalhe: 'Os e-mails da régua saem na hora em que a pessoa fez o quiz + o atraso (não às 9h/10h, apesar do campo "hora de envio").' },
  ],
}

const GRUPOS: Funil = {
  chave: 'grupos',
  rotulo: 'Grupos de promoção (Ybera)',
  descricao: 'Quiz /quiz/fashion-gold → grupo de promoções no WhatsApp → compra na Ybera.',
  secoes: [
    { tipo: 'etapa', etapa: { n: '1', titulo: 'Quiz Fashion Gold', subtitulo: 'Vem do anúncio dos grupos', passos: [
      { id: 'fg_quiz', canal: 'pagina', titulo: 'Quiz Fashion Gold', quando: 'Dia 0', regra: '/quiz/fashion-gold; salva o lead com quiz_slug = fashion-gold.', status: 'ativo' },
      { id: 'fg_lead', canal: 'rastreio', titulo: 'Evento Lead', quando: 'ao terminar', regra: 'Pixel + CAPI.', status: 'ativo' },
      { id: 'fg_convite', canal: 'whatsapp', titulo: 'WhatsApp "entrada pendente"', quando: 'na hora', regra: 'Template que pergunta se pode mandar o link do grupo.', naoRecebe: 'quem bloqueou', previas: [{ chave: 'wa:entrada_grupo_pendente_v2' }] },
      { id: 'email:e4ac3304', canal: 'email', titulo: 'E-mail "guardei a sua vaga"', quando: '+25 min', regra: 'Convite do grupo por e-mail.', previas: [{ chave: 'email:e4ac3304' }] },
    ] } },
    { tipo: 'etapa', etapa: { n: '2', titulo: 'Entrada no grupo', subtitulo: 'Ela responde e recebe o link', passos: [
      { id: 'fg_autoreply', canal: 'whatsapp', titulo: 'Resposta à 1ª mensagem dela', quando: 'segundos depois', regra: 'Quando ela chama o número oficial: link do grupo + pergunta do cabelo.', previas: [{ chave: 'web:wa_autoreply_grupo' }], status: 'ativo' },
      { id: 'fg_quer', canal: 'whatsapp', titulo: 'Botões do convite', quando: 'na hora em que ela toca', regra: 'Manda o link /g/entrar, que escolhe um grupo com vaga.', previas: [
        { rotulo: '"Quero entrar no grupo"', chave: 'web:wa_resp_quer_grupo' },
        { rotulo: '"Não consegui entrar"', chave: 'web:wa_resp_nao_entrei' },
        { rotulo: '"Consegui entrar"', chave: 'web:wa_resp_entrei' },
      ], status: 'ativo' },
      { id: 'fg_entrou', canal: 'whatsapp', titulo: 'Confirmação de entrada', quando: 'ao clicar no link (1x por telefone)', regra: 'Template de confirmação; se ele não sair, vai o texto livre.', naoRecebe: 'quem bloqueou', previas: [{ rotulo: 'Template', chave: 'wa:confirmacao_inscricao_grupo_v3' }, { rotulo: 'Texto se o template falhar', chave: 'web:wa_entrou_grupo' }] },
    ] } },
    { tipo: 'etapa', etapa: { n: '3', titulo: 'Ofertas e conversão', subtitulo: 'Promoções nos grupos → compra na Ybera', passos: [
      { id: 'fg_broadcast', canal: 'whatsapp', titulo: 'Ofertas nos grupos', quando: 'quando você cria', regra: 'Disparo em gotas para não bloquear o número (Grupos → Disparos).', status: 'manual' },
      { id: 'fg_ybera', canal: 'sistema', titulo: 'Compras na Ybera', quando: 'todo dia, 9h', regra: 'Puxa os pedidos da Ybera e cruza com os leads (Ybera → Conversão).', status: 'ativo' },
    ] } },
  ],
  atencao: [
    { canal: 'whatsapp', titulo: 'Ninguém reativa quem entrou e não comprou', detalhe: 'Não há mensagem automática para quem está no grupo há semanas sem comprar na Ybera.' },
  ],
}

export const FUNIS: Funil[] = [CONSULTA, GRUPOS]
