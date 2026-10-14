'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * AUTOPLAY COM SOM — e, se o navegador recusar, autoplay SEM som.
 *
 * Copiado da qd-loja (components/youtube-autoplay.ts), onde foi medido no iPhone.
 * Warley, 28/09/2026: "se não der autoplay com áudio, dê autoplay sem áudio."
 *
 * 🔴 O que estava acontecendo, medido no iPhone:
 *
 * Nenhum navegador deixa um iframe COMEÇAR com áudio sem um gesto dado DENTRO
 * do próprio iframe — e o toque no nosso botão acontece fora dele. Resultado:
 *  · quem pedia `autoplay=1` sem `mute=1` simplesmente não tocava, e o YouTube
 *    desenhava o pôster dele com o botão vermelho por cima (foi o que apareceu
 *    no print do Warley);
 *  · quem tocava mudo e chamava `unMute` logo em seguida ficava PIOR: o iOS
 *    PAUSA o vídeo ao desmutar sem gesto, então a tentativa de ligar o som
 *    matava o autoplay mudo que já estava funcionando.
 *
 * A regra agora é simples: vídeo tocando mudo vale mais do que vídeo parado com
 * som. O som só é tentado DEPOIS de o player confirmar que está tocando, e uma
 * vez só; se a tentativa derrubar a reprodução, a gente remuta e volta a tocar,
 * e o convite "toque para ouvir" fica na tela.
 *
 * Fala com o player pelo `postMessage` do YouTube — exige `enablejsapi=1` na
 * URL do embed.
 */
export type EstadoAutoplay = {
  /** O player CONFIRMOU que está tocando (playerState 1). */
  tocando: boolean
  /** O player já respondeu alguma vez — separa "parado" de "não sei". */
  ouviu: boolean
  /** Está mudo, segundo o PLAYER (nunca segundo o nosso palpite). */
  mudo: boolean
  /** O navegador recusou o som: a partir daqui só mudo, e o convite aparece. */
  somBloqueado: boolean
  /** Envia comando ao player ('playVideo', 'unMute', 'mute'…). */
  comandar: (func: string, args?: unknown[]) => void
  /** Chamar no `onLoad` do iframe: assina o canal e manda tocar. */
  aoCarregar: () => void
  /** Tentar o som por gesto do usuário (o botão "toque para ouvir"). */
  ligarSom: () => void
  /** playerState bruto do YouTube (-1, 0 = terminou, 1 = tocando, 2 = pausado…). */
  estado: number | null
  /** Segundos assistidos e duração total, segundo o player. */
  tempo: number
  duracao: number
  /** O som foi bloqueado ANTES de o vídeo tocar uma vez: remontar com mute=1. */
  remontarMudo: boolean
}

/** Quanto esperamos a confirmação de que o som não derrubou a reprodução. */
const CARENCIA_MS = 1_200
/**
 * Quanto esperamos o vídeo COMEÇAR antes de desistir do som.
 *
 * 2 s e não menos: em 3G o player ainda está baixando e um corte cedo
 * demais tiraria o som de quem teria ouvido sem problema nenhum.
 */
const ESPERA_INICIO_MS = 2_000

export function useAutoplayYoutube(
  quadro: React.RefObject<HTMLIFrameElement | null>,
  ativo: boolean,
  /** Já nasce mudo? (galeria nasce; depoimento tenta com som primeiro) */
  comecaMudo = false,
): EstadoAutoplay {
  const [tocando, setTocando] = useState(false)
  const [ouviu, setOuviu] = useState(false)
  const [mudo, setMudo] = useState(comecaMudo)
  const [somBloqueado, setSomBloqueado] = useState(false)
  const tentouSom = useRef(false)
  const tocouAlgumaVez = useRef(false)
  const [estado, setEstado] = useState<number | null>(null)
  const [tempo, setTempo] = useState(0)
  const [duracao, setDuracao] = useState(0)
  const [remontarMudo, setRemontarMudo] = useState(false)

  const comandar = useCallback((func: string, args: unknown[] = []) => {
    quadro.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args }), '*')
  }, [quadro])

  /* ── ouve o player ── */
  useEffect(() => {
    if (!ativo) return
    const ouvir = (e: MessageEvent) => {
      if (typeof e.data !== 'string' || !e.origin.includes('youtube')) return
      try {
        const d = JSON.parse(e.data)
        if (d?.info) setOuviu(true)
        if (d?.info?.muted !== undefined) setMudo(!!d.info.muted)
        if (typeof d?.info?.currentTime === 'number') setTempo(d.info.currentTime)
        if (typeof d?.info?.duration === 'number' && d.info.duration > 0) setDuracao(d.info.duration)
        if (d?.info?.playerState !== undefined) {
          setEstado(d.info.playerState)
          const agora = d.info.playerState === 1
          setTocando(agora)
          if (agora) tocouAlgumaVez.current = true
        }
      } catch { /* mensagem do YouTube que não é JSON */ }
    }
    window.addEventListener('message', ouvir)
    return () => window.removeEventListener('message', ouvir)
  }, [ativo])

  const aoCarregar = useCallback(() => {
    const assinar = () => quadro.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'listening', id: 1 }), '*')
    assinar()
    comandar('playVideo')
    /**
     * ⚠️ NADA de `unMute` aqui. Era isto que derrubava o autoplay mudo: o
     * player ainda nem confirmou que começou, e já pedíamos som. O som só é
     * tentado no efeito abaixo, depois do "estou tocando".
     */
    window.setTimeout(() => { assinar(); comandar('playVideo') }, 500)
    window.setTimeout(assinar, 1_500)
    window.setTimeout(assinar, 3_000)
  }, [comandar, quadro])

  /* ── confirmou que toca → tenta o som UMA vez ── */
  useEffect(() => {
    if (!ativo || !tocando || tentouSom.current || somBloqueado) return
    tentouSom.current = true
    comandar('unMute')
  }, [ativo, tocando, somBloqueado, comandar])

  /**
   * ── o som derrubou a reprodução? volta para mudo ──
   *
   * Se logo depois da tentativa o player disser que parou, foi o `unMute` que
   * pausou. Remutar e voltar a tocar devolve o vídeo; o convite de som fica
   * para quem quiser dar o gesto.
   */
  useEffect(() => {
    if (!ativo || !tentouSom.current || somBloqueado) return
    if (tocando || !tocouAlgumaVez.current) return
    const t = window.setTimeout(() => {
      comandar('mute')
      comandar('playVideo')
      setSomBloqueado(true)
      setMudo(true)
    }, CARENCIA_MS)
    return () => window.clearTimeout(t)
  }, [ativo, tocando, somBloqueado, comandar])

  /**
   * ── NUNCA COMEÇOU? remonta mudo ──
   *
   * 🔴 O caso do print do Warley, e que o efeito acima NÃO cobria: quando o
   * embed pede som desde o início, o iOS não pausa o vídeo — ele nem deixa
   * começar. Não há "tocou e parou" para detectar; há silêncio absoluto, e o
   * YouTube desenha o pôster dele com o botão vermelho por cima.
   *
   * Passada a carência sem NENHUM sinal de reprodução, a URL é remontada com
   * `mute=1`. Só vale para quem tenta com som: quem já nasce mudo (a galeria)
   * tem o caminho manual próprio, com os controles do YouTube.
   */
  useEffect(() => {
    if (!ativo || comecaMudo || somBloqueado || tocouAlgumaVez.current) return
    const t = window.setTimeout(() => {
      if (tocouAlgumaVez.current) return
      setSomBloqueado(true)
      setMudo(true)
      setRemontarMudo(true)
    }, ESPERA_INICIO_MS)
    return () => window.clearTimeout(t)
  }, [ativo, comecaMudo, somBloqueado, tocando])

  /** O gesto do usuário é o único que o iOS aceita de verdade. */
  const ligarSom = useCallback(() => {
    comandar('unMute')
    comandar('playVideo')
    setSomBloqueado(false)
    setMudo(false)
  }, [comandar])

  return { tocando, ouviu, mudo, somBloqueado, comandar, aoCarregar, ligarSom, estado, tempo, duracao, remontarMudo }
}
