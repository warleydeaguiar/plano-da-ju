'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Vídeo de vendas da oferta (14/10/26) — "Consulta com a Tricologista Juliane Cost".
 *
 * Sem os controles do YouTube (nada de barra, logo, título ou vídeos
 * sugeridos). O SOM precisa vir no primeiro toque (Warley, 14/10: "quando dou o
 * play precisa iniciar já com áudio — tive que clicar em play e depois no
 * volume").
 *
 * 🔴 Por que o play é dado DENTRO do iframe: nenhum navegador (o iPhone menos
 * ainda) deixa um iframe tocar com som a partir de um toque dado FORA dele — o
 * nosso botão de play era fora, então o vídeo saía mudo. Agora o player do
 * YouTube já fica carregado POR BAIXO da nossa capa, e a capa tem
 * `pointer-events: none`: ela só aparece, o toque cai no próprio YouTube, que
 * começa com som. Quando o player confirma que está tocando, a capa some e a
 * nossa camada passa a cuidar de pausar/continuar.
 *
 * Rede de segurança: se depois do toque o vídeo não começar em 3 s, damos o
 * play por mensagem; se só tocar mudo, aparece "Toque para ouvir".
 */
export const VSL_YOUTUBE_ID = 'trmyz41uviA';
/** Liga o vídeo na oferta. */
export const VSL_ATIVO = true; // processado em 14/10/26 13:13 — 3min05s
/** Vídeo VERTICAL (9:16) — confirmado pelo Warley e na tela; a medição pela página
 * do YouTube pegou o tamanho de outro elemento (1280×720) e enganou. */
export const VSL_VERTICAL = true;

const MARCOS = [25, 50, 75, 100];

export default function VideoVendas({
  onCta,
  onEvento,
  ctaTexto = 'Quero minha consulta →',
}: {
  onCta: () => void;
  onEvento: (tipo: 'vsl_play' | 'vsl_progresso', metadata?: Record<string, unknown>) => void;
  ctaTexto?: string;
}) {
  const quadro = useRef<HTMLIFrameElement>(null);
  // O iframe só monta depois da página interativa — não pesa no primeiro desenho.
  const [montar, setMontar] = useState(false);
  const [estado, setEstado] = useState<number | null>(null); // 1 tocando, 2 pausado, 0 fim, 3 carregando
  const [mudo, setMudo] = useState(false);
  const [tempo, setTempo] = useState(0);
  const [duracao, setDuracao] = useState(0);
  const [comecou, setComecou] = useState(false); // já tocou alguma vez → capa sai
  const marcados = useRef(new Set<number>());
  const tocou = useRef(false);
  const legendaOff = useRef(false);

  useEffect(() => { setMontar(true); }, []);

  const comandar = useCallback((func: string, args: unknown[] = []) => {
    quadro.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
  }, []);

  // Ouve o player (estado, tempo, duração, mudo).
  useEffect(() => {
    if (!montar) return;
    const ouvir = (e: MessageEvent) => {
      if (typeof e.data !== 'string' || !e.origin.includes('youtube')) return;
      try {
        const d = JSON.parse(e.data);
        const info = d?.info;
        if (!info) return;
        if (typeof info.currentTime === 'number') setTempo(info.currentTime);
        if (typeof info.duration === 'number' && info.duration > 0) setDuracao(info.duration);
        if (info.muted !== undefined) setMudo(!!info.muted);
        if (info.playerState !== undefined) {
          setEstado(info.playerState);
          if ((info.playerState === 1 || info.playerState === 3) && !tocou.current) {
            tocou.current = true;
            setComecou(true);
            onEvento('vsl_play');
          }
          // O vídeo já tem legenda gravada; a do YouTube (traduzida para o idioma
          // do navegador) aparecia por cima. Só depois de TOCAR de verdade —
          // mandado durante o carregamento, o player voltava para "não iniciado".
          if (info.playerState === 1 && !legendaOff.current) {
            legendaOff.current = true;
            window.setTimeout(() => { comandar('unloadModule', ['captions']); comandar('unloadModule', ['cc']); }, 400);
          }
        }
      } catch { /* mensagem do YouTube que não é JSON */ }
    };
    window.addEventListener('message', ouvir);
    return () => window.removeEventListener('message', ouvir);
  }, [montar, onEvento, comandar]);

  // Assina os eventos do player (precisa repetir: o iframe demora a responder).
  const aoCarregar = useCallback(() => {
    const assinar = () => quadro.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1 }), '*');
    assinar();
    window.setTimeout(assinar, 500);
    window.setTimeout(assinar, 1_500);
    window.setTimeout(assinar, 3_000);
  }, []);

  // Rede de segurança: o toque foi dentro do iframe (a janela perde o foco) mas
  // o vídeo não começou em 3 s → damos o play por mensagem.
  useEffect(() => {
    if (!montar) return;
    let t: number | undefined;
    const aoSairFoco = () => {
      if (document.activeElement !== quadro.current || tocou.current) return;
      t = window.setTimeout(() => { if (!tocou.current) comandar('playVideo'); }, 3_000);
    };
    window.addEventListener('blur', aoSairFoco);
    return () => { window.removeEventListener('blur', aoSairFoco); if (t) window.clearTimeout(t); };
  }, [montar, comandar]);

  // Progresso: 25/50/75/100% — uma vez cada.
  useEffect(() => {
    if (!duracao) return;
    const pct = (tempo / duracao) * 100;
    for (const m of MARCOS) {
      if ((pct >= m || (m === 100 && estado === 0)) && !marcados.current.has(m)) {
        marcados.current.add(m);
        onEvento('vsl_progresso', { pct: m, segundos: Math.round(tempo) });
      }
    }
  }, [tempo, duracao, estado, onEvento]);

  const src = `https://www.youtube.com/embed/${VSL_YOUTUBE_ID}?controls=0&rel=0&modestbranding=1`
    + `&playsinline=1&iv_load_policy=3&fs=0&disablekb=1&cc_load_policy=0&enablejsapi=1`
    + (typeof window !== 'undefined' ? `&origin=${encodeURIComponent(window.location.origin)}` : '');

  const terminou = estado === 0;
  const tocando = estado === 1;
  const pausado = comecou && estado === 2;

  /** Play pelo nosso código (toque fora do meio). Com som se o navegador deixar;
   *  senão, mudo — e o "Toque para ouvir" aparece. */
  function tocarPorCodigo() {
    comandar('playVideo');
    window.setTimeout(() => {
      if (!tocou.current) { comandar('mute'); comandar('playVideo'); }
    }, 2_500);
  }

  function tocarNoVideo() {
    if (terminou) return;
    if (mudo) { comandar('unMute'); comandar('playVideo'); return; }
    comandar(tocando ? 'pauseVideo' : 'playVideo');
  }

  return (
    <div style={{ maxWidth: VSL_VERTICAL ? 340 : 520, margin: '0 auto 24px' }}>
      <div style={{
        position: 'relative', width: '100%', paddingTop: VSL_VERTICAL ? '177.78%' : '56.25%',
        borderRadius: 18, overflow: 'hidden', background: '#1a1014',
        boxShadow: '0 16px 40px rgba(190,24,93,0.18), 0 0 0 3px #fff',
      }}>
        {montar && (
          <iframe
            ref={quadro}
            src={src}
            title="Consulta com a Tricologista Juliane Cost"
            allow="autoplay; encrypted-media; picture-in-picture"
            onLoad={aoCarregar}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
          />
        )}

        {/* Faixas de cima e de baixo: ali ficam título, canal e logo do YouTube —
            um toque neles ABRIA o YouTube numa nova aba e tirava a cliente da
            oferta. Essas faixas ficam com a gente (play por mensagem); só o MEIO
            deixa o toque atravessar até o player, que começa com som. */}
        {!comecou && (
          <>
            <div onClick={tocarPorCodigo} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '18%', zIndex: 2, cursor: 'pointer' }} />
            <div onClick={tocarPorCodigo} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '18%', zIndex: 2, cursor: 'pointer' }} />
          </>
        )}

        {/* Antes do play: capa nossa SÓ VISUAL — o toque no meio atravessa e cai no YouTube (som no 1º toque). */}
        {!comecou && (
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <picture>
              <source srcSet="/images/juliane-consultorio.avif" type="image/avif" />
              <source srcSet="/images/juliane-consultorio.webp" type="image/webp" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/juliane-consultorio.jpg" alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </picture>
            <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.55))' }} />
            <span style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: 76, height: 76, borderRadius: '50%', background: 'rgba(255,255,255,0.95)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)', animation: 'vslPulse 2s ease-in-out infinite',
            }}>
              <svg width="30" height="30" viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="#BE185D" /></svg>
            </span>
            <span style={{
              position: 'absolute', left: 0, right: 0, bottom: 14, textAlign: 'center',
              color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: 0.2, textShadow: '0 1px 6px rgba(0,0,0,0.5)',
            }}>
              ▶ Assista: como funciona a sua consulta
            </span>
          </div>
        )}

        {/* Depois do play: camada nossa — sem ela o toque cairia no YouTube (título, logo, sugestões). */}
        {comecou && (
          <button
            onClick={tocarNoVideo}
            aria-label={tocando ? 'Pausar' : 'Continuar'}
            style={{ position: 'absolute', inset: 0, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {pausado && !terminou && (
              <span style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.92)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="#BE185D" /></svg>
              </span>
            )}
          </button>
        )}

        {comecou && mudo && !terminou && (
          <button
            onClick={(e) => { e.stopPropagation(); comandar('unMute'); comandar('playVideo'); }}
            style={{
              position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.72)', color: '#fff', border: 'none', borderRadius: 99,
              padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            🔊 Toque para ouvir
          </button>
        )}

        {terminou && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(26,16,20,0.88)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20,
          }}>
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, textAlign: 'center' }}>Pronta para a sua consulta?</div>
            <button onClick={onCta} style={{
              background: 'linear-gradient(135deg, #22C55E, #16A34A)', color: '#fff', border: 'none',
              borderRadius: 12, padding: '14px 22px', fontSize: 15, fontWeight: 800, cursor: 'pointer',
            }}>{ctaTexto}</button>
            <button onClick={() => { comandar('seekTo', [0, true]); comandar('playVideo'); }}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
              Assistir de novo
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes vslPulse { 0%,100% { transform: translate(-50%,-50%) scale(1); } 50% { transform: translate(-50%,-50%) scale(1.07); } }`}</style>
    </div>
  );
}
