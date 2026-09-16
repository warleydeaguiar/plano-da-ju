/* eslint-disable @typescript-eslint/no-explicit-any */
import { PLAN_BASE_CENTS } from '@/lib/pricing';
import { QUESTAO_GASTO, precoPorResposta } from '@/lib/preco-dinamico';

/**
 * Preço desta cliente, lido do BANCO.
 *
 * O checkout recebe as respostas do quiz pelo navegador, e por isso elas não
 * servem para definir preço: bastaria editar o payload para pagar menos. Aqui
 * a resposta é relida de `wg_quiz_answers`, achando a sessão do quiz pelo
 * e-mail (`wg_quiz_leads`) ou pela sessão informada.
 *
 * Sem resposta (link direto, outro aparelho, quiz antigo) devolve o preço
 * padrão — nunca bloqueia a venda.
 */
export async function precoDoCliente(
  sb: any,
  dados: { email?: string | null; quizSessionId?: string | null },
): Promise<{ precoCents: number; origem: 'quiz' | 'perfil' | 'padrao' }> {
  const email = (dados.email ?? '').toLowerCase().trim();
  const sessoes: string[] = [];
  if (dados.quizSessionId) sessoes.push(String(dados.quizSessionId).slice(0, 64));

  try {
    if (email) {
      const { data } = await sb.from('wg_quiz_leads')
        .select('session_id').ilike('email', email)
        .order('created_at', { ascending: false }).limit(5);
      for (const l of ((data ?? []) as any[])) if (l.session_id) sessoes.push(String(l.session_id));
    }

    if (sessoes.length) {
      const { data } = await sb.from('wg_quiz_answers')
        .select('answer, created_at')
        .in('session_id', [...new Set(sessoes)])
        .eq('question_id', QUESTAO_GASTO)
        .order('created_at', { ascending: false }).limit(1);
      const linha = ((data ?? []) as any[])[0];
      if (linha) return { precoCents: precoPorResposta(linha.answer), origem: 'quiz' };
    }

    // Quem já tem perfil (recompra, cortesia que virou cliente) guarda as
    // respostas no próprio profile.
    if (email) {
      const { data } = await sb.from('profiles')
        .select('quiz_answers').ilike('email', email).maybeSingle();
      const resposta = (data?.quiz_answers ?? {})[QUESTAO_GASTO];
      if (resposta) return { precoCents: precoPorResposta(resposta), origem: 'perfil' };
    }
  } catch {
    // Banco indisponível não pode derrubar o checkout: cobra o preço padrão.
  }

  return { precoCents: PLAN_BASE_CENTS, origem: 'padrao' };
}
