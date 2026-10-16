import { NextRequest, NextResponse } from 'next/server';
import {
  EMAIL_PIX_ASSUNTO, emailPixHtml, smsPixGerado, smsPixToque, smsPlanoPronto,
  waDesconto, waAutoreplyGrupo, waEntrouNoGrupo, waResposta,
} from '@/lib/textos-mensagens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/previa-mensagens  (Authorization: Bearer PREVIA_MENSAGENS_SECRET)
 *
 * As mensagens que estão escritas no código, montadas pelas MESMAS funções que
 * enviam, com uma cliente de exemplo ("Maria"). Quem lê é o admin (/funil) para
 * a pré-visualização. Só leitura, sem dado de cliente.
 */
const NOME = 'Maria';
const APP = 'https://planodaju.julianecost.com';
const LINK_GRUPO = `${APP}/g/entrar?p=5531999990000`;
const PIX_EXEMPLO = '00020101021226880014br.gov.bcb.pix2566qrcode.pagar.me/pix/exemplo-do-codigo-copia-e-cola5204000053039865406497.005802BR5925JULIANE COST6014BELO HORIZONTE62070503***6304ABCD';

export async function GET(req: NextRequest) {
  const segredo = process.env.PREVIA_MENSAGENS_SECRET;
  if (!segredo || req.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const sms = (texto: string) => ({ canal: 'sms', texto });
  const wa = (texto: string) => ({ canal: 'whatsapp', texto });
  return NextResponse.json({
    mensagens: {
      email_pix: { canal: 'email', assunto: EMAIL_PIX_ASSUNTO, html: emailPixHtml(NOME, PIX_EXEMPLO) },
      sms_pix_1: sms(smsPixGerado(NOME)),
      sms_pix_2: sms(smsPixToque(NOME, 2)),
      sms_pix_3: sms(smsPixToque(NOME, 3)),
      sms_plano_pronto: sms(smsPlanoPronto(NOME)),
      wa_desconto: wa(waDesconto(NOME, 'R$ 97,00', 'R$ 82,45', 'VOLTA15')),
      wa_autoreply_grupo: wa(waAutoreplyGrupo(NOME, LINK_GRUPO)),
      wa_entrou_grupo: wa(waEntrouNoGrupo(NOME)),
      wa_resp_bloqueio: wa(waResposta.bloqueio()),
      wa_resp_plano_wa: wa(waResposta.planoPorWhatsapp()),
      wa_resp_diagnostico: wa(waResposta.diagnostico(NOME, true)),
      wa_resp_diagnostico_fora: wa(waResposta.diagnostico(NOME, false)),
      wa_resp_quer_grupo: wa(waResposta.querGrupo(NOME, LINK_GRUPO)),
      wa_resp_nao_entrei: wa(waResposta.naoEntrei(NOME, LINK_GRUPO)),
      wa_resp_entrei: wa(waResposta.entrei(NOME)),
      wa_resp_cortesia: wa(waResposta.cortesia()),
      wa_resp_concluir: wa(waResposta.concluir(NOME, `${APP}/oferta`)),
      wa_resp_duvida: wa(waResposta.duvida()),
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
