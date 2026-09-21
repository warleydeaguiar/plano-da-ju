import { NextResponse } from 'next/server';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { buildHtml } from '@/lib/plan-pdf-template';
import { JU_WHATSAPP } from '@/lib/contact';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const JU = 'https://db.planodaju.julianecost.com/storage/v1/object/public/ju-assets';

/**
 * GET /preview/plano-pdf
 *
 * O mesmo layout do PDF da cliente, com dados de exemplo. Serve para revisar
 * capa, cortes de imagem e quebras de página sem precisar abrir o plano de uma
 * cliente de verdade — nada aqui vem do banco.
 */
export async function GET() {
  const semana = (n: number, foco: string) => ({
    n, foco,
    tasks: [
      { day: 1, title: 'Lavagem com shampoo de limpeza suave', description: 'Água morna, massagem no couro por 1 minuto.' },
      { day: 3, title: 'Máscara de hidratação — 20 minutos', description: 'Do meio às pontas, com touca.' },
      { day: 6, title: 'Nutrição com óleo vegetal nas pontas', description: 'Meia hora antes da lavagem.' },
    ],
    tips: ['Evite água muito quente', 'Finalize sempre com protetor térmico'],
  });

  const html = buildHtml({
    nome: 'Mariana Alves',
    carta: 'Mariana, o seu cabelo não está perdido — ele está pedindo ordem. Eu vi na sua foto que a fibra ainda responde bem, e é por isso que eu montei esse plano em três frentes: devolver água, devolver massa e proteger o que a gente recuperar. Faça na ordem, sem pular etapa, e a gente se vê em 90 dias.',
    diagnostico: 'Fios com porosidade média-alta, pontas ressecadas e brilho abaixo do esperado para o seu tipo de fio. O comprimento está bom; o que trava é a falta de constância na hidratação.',
    scores: { frizz: 62, brilho: 48, hidratacao: 55, pontas: 40, porosidade: 'média-alta' },
    fotosCliente: [
      { label: 'Frente', src: `${JU}/ju-1.jpg` },
      { label: 'Costas', src: `${JU}/ju-2.jpg` },
    ],
    produtos: [
      {
        motivo: 'Repõe massa sem pesar — é o que as suas pontas estão pedindo.',
        principal: { name: 'Máscara Reconstrução Genoma 250g', brand: 'Ybera Paris', image: `${JU}/ju-3.jpg`, url: 'https://exemplo', videoUrl: null, videoThumb: null },
        alternativa: { name: 'Máscara Nutrição Renew Oil' },
        combos: [],
      },
    ],
    semanas: [
      semana(1, 'Limpeza e hidratação'),
      semana(2, 'Nutrição das pontas'),
      semana(3, 'Reconstrução leve'),
    ],
    ritualDiario: ['Protetor térmico antes de qualquer fonte de calor', 'Pentear de baixo para cima', 'Dormir com trança leve'],
    couro: 'oleoso',
    dataRetorno: { formatada: '20 de dezembro de 2026', diaSemana: 'domingo' },
    wa: JU_WHATSAPP,
    ju: {
      cover: `${JU}/ju-1.jpg`, carta: `${JU}/ju-2.jpg`, prodDivider: `${JU}/ju-3.jpg`,
      cronoDivider: `${JU}/ju-5.jpg`, footer: `${JU}/ju-4.jpg`,
    },
  });

  // Sem a caixa de impressão automática: aqui a intenção é olhar a página.
  return new NextResponse(String(html).replace(/window\.print\(\)/g, 'void 0'), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' },
  });
}
