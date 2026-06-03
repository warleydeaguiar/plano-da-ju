'use client';

import { T, fonts } from './theme';

// Tela de carregamento padrão do /meu-plano. Antes as páginas faziam
// `if (loading) return null`, o que dava um flash em branco. Agora mostra
// um pulso da marca enquanto os dados chegam.
export function PlanoLoading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div style={{
      minHeight: '70vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
    }}>
      <style>{`@keyframes plano-pulse{0%,100%{transform:scale(.85);opacity:.55}50%{transform:scale(1);opacity:1}}`}</style>
      <div style={{
        width: 46, height: 46, borderRadius: '50%',
        background: `conic-gradient(${T.pink}, ${T.gold}, ${T.pink})`,
        animation: 'plano-pulse 1.1s ease-in-out infinite',
      }} />
      <div style={{
        fontSize: 14, color: T.inkSoft, fontWeight: 600, fontFamily: fonts.ui,
      }}>{label}</div>
    </div>
  );
}
