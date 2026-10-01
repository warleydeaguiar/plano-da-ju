/**
 * Monta a URL de checkout da Hotmart já preenchida com os dados que o quiz
 * já coletou (teste A/B checkout próprio × Hotmart).
 *
 * `checkoutMode=10` ativa a página de pagamento personalizada (com a foto da
 * Juliane) — sem ele cai no layout genérico da Hotmart. Os demais parâmetros
 * seguem a doc oficial de pré-preenchimento:
 * https://help.hotmart.com/pt-br/article/115003588572
 */
const HOTMART_CHECKOUT_BASE = 'https://pay.hotmart.com/V107837322C';

/** Separa um telefone bruto (com ou sem DDI/máscara) em DDD + número. */
function dddNumero(bruto: string): { ddd: string; numero: string } | null {
  let d = bruto.replace(/\D/g, '');
  if (d.startsWith('55') && d.length > 11) d = d.slice(2);
  if (d.length < 10) return null;
  return { ddd: d.slice(0, 2), numero: d.slice(2) };
}

export function buildHotmartCheckoutUrl(dados: {
  email?: string;
  name?: string;
  phone?: string;
}): string {
  const params = new URLSearchParams({ checkoutMode: '10' });
  const email = (dados.email ?? '').trim();
  const name = (dados.name ?? '').trim();
  if (email) params.set('email', email);
  if (name) params.set('name', name);
  const tel = dados.phone ? dddNumero(dados.phone) : null;
  if (tel) {
    params.set('phoneac', tel.ddd);
    params.set('phonenumber', tel.numero);
  }
  return `${HOTMART_CHECKOUT_BASE}?${params.toString()}`;
}
