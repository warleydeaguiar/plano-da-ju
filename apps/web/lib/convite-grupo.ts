/* eslint-disable @typescript-eslint/no-explicit-any */
import { templateUtilitarioAprovado } from '@/lib/wa-templates';
import { telefonesBloqueados } from '@/lib/wa-optout';
import { qualidadeDoNumero } from '@/lib/wa-saude';

/**
 * Convite do grupo, enviado DEPOIS que a pessoa já foi para a oferta.
 *
 * O funil mudou em 25/09/2026: a página de obrigado passou a levar direto para
 * a loja, porque mandar todo mundo para o grupo não estava funcionando — a
 * maioria não entrava e o caminho morria ali. O grupo virou um segundo passo,
 * e este é o convite dele.
 *
 * A mensagem NÃO manda o link de cara: diz que a vaga está pendente e pergunta
 * se pode enviar. Quem responde "quero entrar" recebe o link (e abre a janela
 * de 24 h); quem toca em "Bloquear mensagens" sai da lista pelo nosso opt-out,
 * sem precisar bloquear o número de verdade — que é o que machucaria a
 * qualidade do canal.
 */
export const TEMPLATE_CONVITE = process.env.WHATSAPP_CONVITE_GRUPO_TEMPLATE || 'entrada_grupo_pendente_v1';

export async function convidarParaGrupo(
  sb: any,
  telefoneBruto: string | null | undefined,
  nome: string | null | undefined,
): Promise<{ enviado: boolean; motivo: string }> {
  const token = process.env.WHATSAPP_TOKEN;
  const pid = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const digitos = String(telefoneBruto ?? '').replace(/\D/g, '');
  const intl = digitos.startsWith('55') ? digitos : `55${digitos}`;
  if (!token || !pid || digitos.length < 10) return { enviado: false, motivo: 'sem_telefone' };

  try {
    // Vermelho é a Meta avisando que o número está prestes a ser restringido:
    // nem mensagem de utilidade vale o risco nesse estado.
    if ((await qualidadeDoNumero()) === 'RED') return { enviado: false, motivo: 'qualidade_vermelha' };
    if ((await telefonesBloqueados(sb, [intl])).size > 0) return { enviado: false, motivo: 'optout' };
    if (!(await templateUtilitarioAprovado(TEMPLATE_CONVITE))) {
      return { enviado: false, motivo: 'template_nao_aprovado' };
    }

    const primeiro = String(nome ?? '').trim().split(/\s+/)[0] || 'tudo bem';
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    const r = await fetch(`https://graph.facebook.com/v21.0/${pid}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: intl,
        type: 'template',
        template: {
          name: TEMPLATE_CONVITE,
          language: { code: 'pt_BR' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: primeiro }] }],
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(t);
    return { enviado: r.ok, motivo: r.ok ? 'ok' : `graph_${r.status}` };
  } catch {
    return { enviado: false, motivo: 'excecao' };
  }
}
