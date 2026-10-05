/**
 * Ícones de rede social, em SVG inline — mesmo motivo do IconeWhatsapp:
 * minúsculos, sem requisição extra, herdam a cor por `currentColor`.
 */
function Svg({ tamanho, path }: { tamanho: number; path: string }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0 }}
    >
      <path d={path} />
    </svg>
  );
}

export function IconeInstagram({ tamanho = 20 }: { tamanho?: number }) {
  return (
    <Svg
      tamanho={tamanho}
      path="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.789.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.789-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06zM12 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm7.846-10.405a1.44 1.44 0 1 1-2.881.001 1.44 1.44 0 0 1 2.881-.001z"
    />
  );
}

export function IconeTikTok({ tamanho = 20 }: { tamanho?: number }) {
  return (
    <Svg
      tamanho={tamanho}
      path="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z"
    />
  );
}

export function IconeFacebook({ tamanho = 20 }: { tamanho?: number }) {
  return (
    <Svg
      tamanho={tamanho}
      path="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"
    />
  );
}

/**
 * Escolhe o ícone pela URL da rede. Rede sem ícone (Kwai, etc.) vira a inicial
 * do nome — botão redondo vazio não diz nada pra quem vê.
 */
export function IconeRede({ href, tamanho = 20, rotulo }: { href: string; tamanho?: number; rotulo?: string }) {
  if (/instagram\.com/i.test(href)) return <IconeInstagram tamanho={tamanho} />;
  if (/tiktok\.com/i.test(href)) return <IconeTikTok tamanho={tamanho - 1} />;
  if (/youtube\.com|youtu\.be/i.test(href)) return <IconeYoutube tamanho={tamanho} />;
  if (/facebook\.com|fb\.com/i.test(href)) return <IconeFacebook tamanho={tamanho} />;
  const inicial = (rotulo ?? '').trim().charAt(0).toUpperCase();
  return inicial ? <span aria-hidden style={{ fontWeight: 800, fontSize: tamanho * 0.8, lineHeight: 1 }}>{inicial}</span> : null;
}

export function IconeYoutube({ tamanho = 20 }: { tamanho?: number }) {
  return (
    <Svg
      tamanho={tamanho}
      path="M23.498 6.186a2.994 2.994 0 0 0-2.106-2.117C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.392.524A2.994 2.994 0 0 0 .502 6.186C0 8.084 0 12 0 12s0 3.916.502 5.814a2.994 2.994 0 0 0 2.106 2.117c1.887.524 9.392.524 9.392.524s7.505 0 9.392-.524a2.994 2.994 0 0 0 2.106-2.117C24 15.916 24 12 24 12s0-3.916-.502-5.814zM9.75 15.568V8.432L15.818 12l-6.068 3.568z"
    />
  );
}
