import ConsultaWhatsApp from '../../meu-plano/ConsultaWhatsApp';

export const metadata = { title: 'Preview — tela de consulta', robots: { index: false, follow: false } };

/**
 * Preview da tela que a cliente pagante vê enquanto o plano espera a consulta.
 *
 * Existe para revisar o fluxo sem precisar de uma compra de verdade. Não lê
 * nada do banco: o nome e o prazo são de exemplo.
 */
export default async function PreviewConsulta({
  searchParams,
}: {
  searchParams: Promise<{ nome?: string; horas?: string }>;
}) {
  const { nome, horas } = await searchParams;
  const h = Math.max(1, Math.min(96, Number(horas) || 72));
  return <ConsultaWhatsApp nome={nome || 'Mariana Alves'} liberaEm={Date.now() + h * 3_600_000} />;
}
