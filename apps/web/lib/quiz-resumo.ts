/* eslint-disable @typescript-eslint/no-explicit-any */
import { QUIZ_STEPS } from '@/lib/quiz-questions';

/**
 * Resumo das respostas do quiz em texto, para a ATENDENTE ler.
 *
 * Quando a cliente toca em "Quero meu diagnóstico", quem responde é uma pessoa
 * da equipe — não um robô. Ela precisa do que a cliente respondeu no quiz sem
 * sair do Chatwoot e sem procurar no painel; é isso que esta função monta, e
 * vai como nota PRIVADA na conversa (a cliente não vê).
 *
 * Os rótulos saem de QUIZ_STEPS, a mesma fonte que desenha o quiz: se a
 * pergunta mudar lá, a nota muda junto.
 */
const RELEVANTES = new Set(['single', 'multi', 'textarea']);

function rotulo(step: any, valor: unknown): string {
  const opcoes: any[] = step.options ?? [];
  const um = (v: unknown) => opcoes.find((o) => o.id === v)?.label ?? String(v ?? '');
  const limpar = (s: string) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  if (Array.isArray(valor)) return limpar(valor.map(um).join(', '));
  return limpar(um(valor));
}

export function resumoQuizTexto(respostas: Record<string, any>): string {
  const linhas: string[] = [];
  for (const step of QUIZ_STEPS as any[]) {
    if (!RELEVANTES.has(step.kind)) continue;
    const valor = respostas?.[step.id];
    if (valor === undefined || valor === null || valor === '' || (Array.isArray(valor) && !valor.length)) continue;
    const titulo = String(step.title ?? step.id).replace(/\*\*/g, '').trim();
    linhas.push(`• ${titulo}: ${rotulo(step, valor).slice(0, 160)}`);
  }
  return linhas.join('\n');
}

/** Respostas gravadas para as sessões de quiz daquela pessoa (mais recente vence). */
export async function respostasDasSessoes(sb: any, sessoes: string[]): Promise<Record<string, any>> {
  const ids = [...new Set(sessoes.filter(Boolean).map((s) => String(s).slice(0, 64)))];
  if (!ids.length) return {};
  const { data } = await sb.from('wg_quiz_answers')
    .select('question_id, answer, created_at')
    .in('session_id', ids)
    .order('created_at', { ascending: true });
  const out: Record<string, any> = {};
  for (const linha of ((data ?? []) as any[])) out[linha.question_id] = linha.answer;
  return out;
}
