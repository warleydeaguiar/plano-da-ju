/**
 * Prepara o HTML herdado do WordPress para ser exibido.
 *
 * O conteúdo veio com `srcset` listando as miniaturas que o WordPress gerava
 * (`-300x300`, `-768x768`, `-414x500`…). Essas variantes não existem mais: o
 * servidor responde **400** para todas. No desktop passava despercebido porque
 * o navegador escolhia a imagem original; no CELULAR ele escolhe justamente uma
 * miniatura — e a leitora via um quadrado vazio. Eram 103 páginas assim.
 *
 * Tirar `srcset`/`sizes` faz o navegador usar o `src`, que redireciona certo
 * para o storage. A imagem passa a aparecer em todo lugar, ao custo de baixar
 * o arquivo cheio — melhor do que não aparecer.
 */
export function prepararHtmlDoConteudo(html: string | null | undefined): string {
  if (!html) return '';
  return html
    // srcset e sizes de <img> e <source>
    .replace(/\s+(srcset|sizes)="[^"]*"/gi, '')
    .replace(/\s+(srcset|sizes)='[^']*'/gi, '')
    // largura fixa no <figure> (o CSS já cobre, isto evita o salto de layout
    // antes de a folha de estilo ser aplicada)
    .replace(/(<figure[^>]*?)\s+style="[^"]*width:\s*\d+px[^"]*"/gi, '$1')
    .replace(/(<figure[^>]*?)\s+width="\d+"/gi, '$1');
}
