/**
 * JSON-LD para rich result.
 *
 * O escape de `<` é obrigatório: se algum campo vindo do banco contiver
 * "</script>", o navegador fecharia a tag no meio do JSON e o resto do HTML
 * viraria texto solto na página.
 */
export default function JsonLd({ dados }: { dados: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(dados).replace(/</g, '\\u003c') }}
    />
  );
}
