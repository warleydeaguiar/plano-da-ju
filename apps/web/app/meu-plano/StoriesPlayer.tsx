'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { T, fonts } from './theme';
import { IconClose, IconChevronLeft, IconChevronRight } from './icons';

export interface Story {
  id: string;
  title: string;
  description: string;
  media_type: 'video' | 'audio';
  media_url: string;
  cover_image_url: string | null;
  duration_seconds: number | null;
}

const AUDIO_FALLBACK_DURATION = 30;   // seconds, used if duration not yet known
const VIDEO_FALLBACK_DURATION = 15;

export default function StoriesPlayer({
  stories, initialIndex = 0, onClose, accessToken,
}: {
  stories: Story[];
  initialIndex?: number;
  onClose: () => void;
  accessToken: string;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [mediaDuration, setMediaDuration] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const offsetRef = useRef<number>(0);

  const story = stories[index];
  if (!story) {
    onClose();
    return null;
  }

  const advance = useCallback(() => {
    if (index < stories.length - 1) {
      setIndex(i => i + 1);
      setProgress(0);
      offsetRef.current = 0;
    } else {
      onClose();
    }
  }, [index, stories.length, onClose]);

  const goBack = useCallback(() => {
    if (index > 0) {
      setIndex(i => i - 1);
      setProgress(0);
      offsetRef.current = 0;
    }
  }, [index]);

  // Track view on advance
  const trackView = useCallback(async (storyId: string, completed: boolean) => {
    try {
      await fetch('/api/meu-plano/stories/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ story_id: storyId, completed }),
      });
    } catch {}
  }, [accessToken]);

  // Mark current story as viewed when it starts
  useEffect(() => {
    if (story) trackView(story.id, false);
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Progress timer
  useEffect(() => {
    if (paused) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      offsetRef.current = progress;
      return;
    }
    const duration = (mediaDuration ?? story.duration_seconds ?? (story.media_type === 'video' ? VIDEO_FALLBACK_DURATION : AUDIO_FALLBACK_DURATION)) * 1000;
    startTimeRef.current = performance.now();
    const startOffset = offsetRef.current;

    const tick = (now: number) => {
      const elapsed = (now - startTimeRef.current) / duration + startOffset;
      if (elapsed >= 1) {
        setProgress(1);
        trackView(story.id, true);
        advance();
        return;
      }
      setProgress(elapsed);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [story?.id, paused, mediaDuration]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync video playback
  useEffect(() => {
    if (story?.media_type === 'video' && videoRef.current) {
      if (paused) videoRef.current.pause();
      else videoRef.current.play().catch(() => {});
    }
    if (story?.media_type === 'audio' && audioRef.current) {
      if (paused) audioRef.current.pause();
      else audioRef.current.play().catch(() => {});
    }
  }, [paused, story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') advance();
      if (e.key === 'ArrowLeft') goBack();
      if (e.key === ' ') { e.preventDefault(); setPaused(p => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, goBack, onClose]);

  function handleTapZone(e: React.MouseEvent<HTMLDivElement>) {
    const x = e.clientX;
    const w = window.innerWidth;
    if (x < w * 0.3) goBack();
    else if (x > w * 0.7) advance();
    else setPaused(p => !p);
  }

  function handleMediaLoaded(e: React.SyntheticEvent<HTMLVideoElement | HTMLAudioElement>) {
    const el = e.currentTarget;
    if (!isNaN(el.duration) && isFinite(el.duration)) {
      setMediaDuration(el.duration);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: '#000',
      display: 'flex', flexDirection: 'column',
      fontFamily: fonts.ui,
    }}>
      {/* Progress bars */}
      <div style={{
        position: 'absolute', top: 'env(safe-area-inset-top, 0px)', left: 0, right: 0,
        display: 'flex', gap: 4, padding: '12px 12px 0',
        zIndex: 3,
      }}>
        {stories.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 99,
            background: 'rgba(255,255,255,0.30)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 99,
              background: '#FFF',
              width: i < index ? '100%' : i === index ? `${progress * 100}%` : '0%',
              transition: i === index ? 'none' : 'width 0.2s',
            }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{
        position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 20px)', left: 0, right: 0,
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
        zIndex: 3, color: '#FFF',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: `linear-gradient(135deg, ${T.pinkDeep}, ${T.gold})`,
          padding: 2,
        }}>
          <div style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: '#000',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <img src="/images/ju-depois.png" alt="Juliane" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Juliane Cost</div>
          <div style={{ fontSize: 11.5, opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {story.title}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.15)', border: 'none', color: '#FFF',
          width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconClose size={18} stroke={2.2} />
        </button>
      </div>

      {/* Media */}
      <div onClick={handleTapZone} style={{
        flex: 1, position: 'relative', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {story.media_type === 'video' ? (
          <video
            ref={videoRef}
            key={story.id}
            src={story.media_url}
            poster={story.cover_image_url ?? undefined}
            autoPlay
            playsInline
            onLoadedMetadata={handleMediaLoaded}
            onEnded={advance}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        ) : (
          <>
            <div style={{
              position: 'absolute', inset: 0,
              background: story.cover_image_url
                ? `url(${story.cover_image_url}) center/cover`
                : `linear-gradient(135deg, ${T.pinkDeep}, ${T.gold})`,
              filter: 'blur(12px)',
            }} />
            <div style={{
              position: 'relative', zIndex: 1, textAlign: 'center',
              padding: 32, color: '#FFF',
            }}>
              {/* Audio "now playing" with waveform animation */}
              <div style={{
                width: 200, height: 200, borderRadius: '50%',
                background: story.cover_image_url
                  ? `url(${story.cover_image_url}) center/cover`
                  : `linear-gradient(135deg, ${T.pinkDeep}, ${T.gold})`,
                margin: '0 auto 32px',
                border: '4px solid rgba(255,255,255,0.2)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                position: 'relative',
                animation: paused ? 'none' : 'spin 12s linear infinite',
              }}>
                <div style={{
                  position: 'absolute', inset: '50%',
                  width: 24, height: 24, borderRadius: '50%',
                  background: '#000',
                  transform: 'translate(-50%, -50%)',
                  border: '3px solid rgba(255,255,255,0.4)',
                }} />
              </div>
              <div style={{
                fontSize: 28, fontWeight: 600,
                fontFamily: fonts.display, letterSpacing: -0.5,
                marginBottom: 8,
              }}>
                <em style={{ fontStyle: 'italic' }}>{story.title}</em>
              </div>
              <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.5, maxWidth: 320, margin: '0 auto' }}>
                {story.description}
              </div>
              {/* Waveform pulse */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 24, height: 30, alignItems: 'flex-end' }}>
                {[...Array(7)].map((_, i) => (
                  <div key={i} style={{
                    width: 4, borderRadius: 2,
                    background: '#FFF', opacity: 0.7,
                    animation: paused ? 'none' : `wave 1.${i * 100}s ease-in-out infinite alternate`,
                    height: paused ? 8 : `${10 + (i % 3) * 8}px`,
                  }} />
                ))}
              </div>
            </div>
            <audio ref={audioRef} key={story.id} src={story.media_url} autoPlay onLoadedMetadata={handleMediaLoaded} onEnded={advance} />
          </>
        )}

        {/* Nav hint chevrons (subtle) */}
        {index > 0 && (
          <div style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }}>
            <IconChevronLeft size={28} />
          </div>
        )}
        {index < stories.length - 1 && (
          <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }}>
            <IconChevronRight size={28} />
          </div>
        )}
      </div>

      {/* Footer caption */}
      <div style={{
        position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)', left: 0, right: 0,
        padding: '0 20px', color: '#FFF', textAlign: 'center', zIndex: 2,
        pointerEvents: 'none',
      }}>
        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>
          Toque para pausar · ← → ou tap nas bordas
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes wave { from { height: 8px } to { height: 28px } }
      `}</style>
    </div>
  );
}
