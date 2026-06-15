// Ícones próprios da sidebar do admin — estilo de linha coeso (stroke 1.7,
// viewBox 24×24, currentColor → herdam a cor do item ativo/inativo, cantos
// arredondados). Mesma linguagem visual dos ícones do dashboard (icons.tsx).
import * as React from 'react';

type P = { size?: number; stroke?: number; style?: React.CSSProperties };

function I({ size = 18, stroke = 1.7, style, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round"
      style={style} aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export type SidebarIcon = (p: P) => React.JSX.Element;

// Dashboard — grade
export const SbDashboard: SidebarIcon = (p) => (
  <I {...p}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
  </I>
);

// Revisão de Planos — prancheta com check
export const SbPlanos: SidebarIcon = (p) => (
  <I {...p}>
    <rect x="5" y="4" width="14" height="17" rx="2.5" />
    <path d="M9 4h6v2.4a.6.6 0 0 1-.6.6H9.6A.6.6 0 0 1 9 6.4z" />
    <path d="M8.6 13.2l2 2 4-4.2" />
  </I>
);

// Usuárias — duas pessoas
export const SbUsuarias: SidebarIcon = (p) => (
  <I {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6" opacity="0.65" />
    <path d="M17 14.4a5.5 5.5 0 0 1 3.5 5.1" opacity="0.65" />
  </I>
);

// Grupos de Promoções — comunidade (3 pessoas)
export const SbGrupos: SidebarIcon = (p) => (
  <I {...p}>
    <circle cx="8" cy="8.5" r="2.6" />
    <circle cx="16" cy="8.5" r="2.6" opacity="0.7" />
    <path d="M3 19a5 5 0 0 1 8.5-3.2" />
    <path d="M12.5 15.8A5 5 0 0 1 21 19" opacity="0.7" />
  </I>
);

// Followup — telefone
export const SbFollowup: SidebarIcon = (p) => (
  <I {...p}>
    <path d="M5 4h3l1.6 4-2 1.2a11 11 0 0 0 5.2 5.2l1.2-2 4 1.6v3a2 2 0 0 1-2.2 2A16 16 0 0 1 3 6.2 2 2 0 0 1 5 4z" />
  </I>
);

// Anúncios — megafone
export const SbAnuncios: SidebarIcon = (p) => (
  <I {...p}>
    <path d="M4 10v4a1 1 0 0 0 1 1h2l8 4.5V4.5L7 9H5a1 1 0 0 0-1 1z" />
    <path d="M18.5 9a4 4 0 0 1 0 6" opacity="0.7" />
  </I>
);

// Google Analytics — gráfico de linha subindo
export const SbAnalytics: SidebarIcon = (p) => (
  <I {...p}>
    <path d="M4 4v15a1 1 0 0 0 1 1h15" />
    <path d="M7.5 14.5l3.2-3.4 2.8 2 4-5.1" />
  </I>
);

// Email Marketing — envelope
export const SbEmail: SidebarIcon = (p) => (
  <I {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M3.6 7.2l8.4 5.6 8.4-5.6" />
  </I>
);

// Quiz — alvo
export const SbQuiz: SidebarIcon = (p) => (
  <I {...p}>
    <circle cx="12" cy="12" r="8.2" />
    <circle cx="12" cy="12" r="4.2" opacity="0.75" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
  </I>
);

// Stories da Juliane — anel de story + play
export const SbStories: SidebarIcon = (p) => (
  <I {...p}>
    <circle cx="12" cy="12" r="8.4" strokeDasharray="3 2.6" />
    <path d="M10.3 9.2l4.6 2.8-4.6 2.8z" fill="currentColor" stroke="none" />
  </I>
);

// Suporte — headset
export const SbSuporte: SidebarIcon = (p) => (
  <I {...p}>
    <path d="M5 13.5v-1.5a7 7 0 0 1 14 0v1.5" />
    <rect x="3" y="13" width="3.8" height="6.5" rx="1.6" />
    <rect x="17.2" y="13" width="3.8" height="6.5" rx="1.6" />
    <path d="M19.1 19.5a3 3 0 0 1-3 3h-2.1" opacity="0.7" />
  </I>
);

// Atendimento (Chatwoot) — balão de conversa
export const SbChat: SidebarIcon = (p) => (
  <I {...p}>
    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v6A2.5 2.5 0 0 1 17.5 15H9l-4 3.5V15H6.5A2.5 2.5 0 0 1 4 12.5z" />
    <path d="M9 9.5h.01M12 9.5h.01M15 9.5h.01" opacity="0.8" />
  </I>
);

// Produtos — sacola
export const SbProdutos: SidebarIcon = (p) => (
  <I {...p}>
    <path d="M5.5 8h13l-1 11.2a1.6 1.6 0 0 1-1.6 1.4H8.1a1.6 1.6 0 0 1-1.6-1.4z" />
    <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
  </I>
);

// Ybera — folha (cuidado natural)
export const SbYbera: SidebarIcon = (p) => (
  <I {...p}>
    <path d="M5 19c0-8 6-14.5 15-14.5C20 12.5 14 19 5 19z" />
    <path d="M5.5 18.5C9.5 14.5 13.5 11.5 17 8.5" opacity="0.6" />
  </I>
);

// Experimentos A/B — frasco
export const SbExperimentos: SidebarIcon = (p) => (
  <I {...p}>
    <path d="M9 3.5h6" />
    <path d="M10 3.5v5.5l-4.6 7.6A2 2 0 0 0 7.1 20h9.8a2 2 0 0 0 1.7-3.4L14 9V3.5" />
    <path d="M7.6 15h8.8" opacity="0.6" />
  </I>
);

// Checkout — carrinho
export const SbCheckout: SidebarIcon = (p) => (
  <I {...p}>
    <circle cx="9.5" cy="19.5" r="1.4" />
    <circle cx="17" cy="19.5" r="1.4" />
    <path d="M3 4h2.2l2.4 11.2h10.2L20 8H6.4" />
  </I>
);

// Erros do Sistema — alerta
export const SbErros: SidebarIcon = (p) => (
  <I {...p}>
    <path d="M12 4.2l8.6 15.3a1 1 0 0 1-.87 1.5H4.27a1 1 0 0 1-.87-1.5z" />
    <path d="M12 10v4.2" />
    <path d="M12 17.4h.01" />
  </I>
);

// Configurações — engrenagem
export const SbConfig: SidebarIcon = (p) => (
  <I {...p}>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.1 5.1l1.85 1.85M17.05 17.05l1.85 1.85M18.9 5.1l-1.85 1.85M6.95 17.05L5.1 18.9" opacity="0.85" />
  </I>
);
