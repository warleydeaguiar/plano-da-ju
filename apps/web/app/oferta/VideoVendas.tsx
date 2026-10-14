'use client';

import { useEffect, useRef, useState } from 'react';
import { useAutoplayYoutube } from '@/lib/youtube-autoplay';

/**
 * Vídeo de vendas da oferta (14/10/26) — "Consulta com a Tricologista Juliane Cost".
 *
 * Sem os controles do YouTube (nada de barra, logo, título ou vídeos
 * sugeridos): a capa é nossa, o play é nosso, e tocar no vídeo pausa/retoma.
 * O som segue a regra medida no iPhone (lib/youtube-autoplay.ts): tenta com
 * som; se o navegador recusar, toca MUDO com "Toque para ouvir" — vídeo
 * tocando mudo vale mais do que parado com som.
 */
export const VSL_YOUTUBE_ID = 'trmyz41uviA';
/**
 * Liga o vídeo na oferta. Fica DESLIGADO enquanto o YouTube processa o upload
 * (sem isso a cliente veria "estamos processando este vídeo" no meio da oferta).
 */
export const VSL_ATIVO = true; // processado em 14/10/26 13:13 — 3min05s
/** Orientação medida no YouTube (formato 1280×720) — horizontal. */
export const VSL_VERTICAL = false;

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
  const [iniciado, setIniciado] = useState(false);
  const quadro = useRef<HTMLIFrameElement>(null);
  const yt = useAutoplayYoutube(quadro, iniciado, false);
  const marcados = useRef(new Set<number>());

  // Progresso: 25/50/75/100% — uma vez cada.
  useEffect(() => {
    if (!yt.duracao) return;
    const pct = (yt.tempo / yt.duracao) * 100;
    for (const m of MARCOS) {
      if ((pct >= m || (m === 100 && yt.estado === 0)) && !marcados.current.has(m)) {
        marcados.current.add(m);
        onEvento('vsl_progresso', { pct: m, segundos: Math.round(yt.tempo) });
      }
    }
  }, [yt.tempo, yt.duracao, yt.estado, onEvento]);

  const mudo = yt.remontarMudo;
  const src = `https://www.youtube.com/embed/${VSL_YOUTUBE_ID}?autoplay=1&controls=0&rel=0&modestbranding=1`
    + `&playsinline=1&iv_load_policy=3&fs=0&disablekb=1&cc_load_policy=0&enablejsapi=1`
    + (mudo ? '&mute=1' : '')
    + (typeof window !== 'undefined' ? `&origin=${encodeURIComponent(window.location.origin)}` : '');

  const terminou = yt.estado === 0;
  const pausado = iniciado && yt.ouviu && yt.estado === 2;
  const proporcao = VSL_VERTICAL ? '177.78%' : '56.25%';

  function tocarNoVideo() {
    if (terminou) return;
    if (yt.mudo || yt.somBloqueado) { yt.ligarSom(); return; }
    yt.comandar(yt.tocando ? 'pauseVideo' : 'playVideo');
  }

  return (
    <div style={{ maxWidth: VSL_VERTICAL ? 340 : 520, margin: '0 auto 24px' }}>
      <div style={{
        position: 'relative', width: '100%', paddingTop: proporcao,
        borderRadius: 18, overflow: 'hidden', background: '#1a1014',
        boxShadow: '0 16px 40px rgba(190,24,93,0.18), 0 0 0 3px #fff',
      }}>
        {!iniciado ? (
          <button
            onClick={() => { setIniciado(true); onEvento('vsl_play'); }}
            aria-label="Assistir ao vídeo da consulta"
            style={{ position: 'absolute', inset: 0, padding: 0, border: 'none', cursor: 'pointer', background: '#1a1014' }}
          >
            <picture>
              <source srcSet="/images/juliane-consultorio.avif" type="image/avif" />
              <source srcSet="/images/juliane-consultorio.webp" type="image/webp" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/juliane-consultorio.jpg" alt="Juliane Cost no consultório"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </picture>
            <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.55))' }} />
            <span style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: 76, height: 76, borderRadius: '50%', background: 'rgba(255,255,255,0.95)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)', animation: 'vslPulse 2s ease-in-out infinite',
            }}>
              <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="#BE185D" /></svg>
            </span>
            <span style={{
              position: 'absolute', left: 0, right: 0, bottom: 14, textAlign: 'center',
              color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: 0.2, textShadow: '0 1px 6px rgba(0,0,0,0.5)',
            }}>
              ▶ Assista: como funciona a sua consulta
            </span>
          </button>
        ) : (
          <>
            <iframe
              key={mudo ? 'mudo' : 'som'}
              ref={quadro}
              src={src}
              title="Consulta com a Tricologista Juliane Cost"
              allow="autoplay; encrypted-media; picture-in-picture"
              onLoad={yt.aoCarregar}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            />
            {/* Camada nossa por cima: sem ela, o toque cai no YouTube (título, logo, sugestões). */}
            <button
              onClick={tocarNoVideo}
              aria-label={yt.tocando ? 'Pausar' : 'Continuar'}
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
            {(yt.mudo || yt.somBloqueado) && !terminou && (
              <button
                onClick={(e) => { e.stopPropagation(); yt.ligarSom(); }}
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
                <button onClick={() => { yt.comandar('seekTo', [0, true]); yt.comandar('playVideo'); }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
                  Assistir de novo
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <style>{`@keyframes vslPulse { 0%,100% { transform: translate(-50%,-50%) scale(1); } 50% { transform: translate(-50%,-50%) scale(1.07); } }`}</style>
    </div>
  );
}
