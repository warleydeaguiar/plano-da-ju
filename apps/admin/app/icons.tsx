// Ícones SVG próprios do admin — mesmo estilo do app do consumidor:
// stroke fino (1.7), viewBox 24×24, currentColor, cantos arredondados.
// Renderizam a 24×24 por padrão; passe size/color/stroke pra ajustar.

import * as React from 'react';

type IconProps = {
  size?: number;
  color?: string;
  stroke?: number;
  fill?: string;
  className?: string;
  style?: React.CSSProperties;
};

function I({ size = 24, color = 'currentColor', stroke = 1.7, fill = 'none', className, style, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill={fill} stroke={color} strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style} aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// ─── Pessoas / base ────────────────────────────────────────────────
export const IconUsers = (p: IconProps) => (
  <I {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6" opacity="0.7" />
    <path d="M17 14.4a5.5 5.5 0 0 1 3.5 5.1" opacity="0.7" />
  </I>
);

export const IconUserPlus = (p: IconProps) => (
  <I {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M18 8v6M21 11h-6" opacity="0.8" />
  </I>
);

// ─── Dinheiro / vendas ─────────────────────────────────────────────
export const IconMoney = (p: IconProps) => (
  <I {...p}>
    <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
    <circle cx="12" cy="12" r="2.6" />
    <path d="M6 9.5v5M18 9.5v5" opacity="0.6" />
  </I>
);

export const IconCreditCard = (p: IconProps) => (
  <I {...p}>
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
    <path d="M2.5 9.5h19" />
    <path d="M6 14.5h4" opacity="0.7" />
  </I>
);

export const IconReceipt = (p: IconProps) => (
  <I {...p}>
    <path d="M5 3h14v18l-2.3-1.5L14.4 21 12 19.5 9.6 21 7.3 19.5 5 21V3z" />
    <path d="M8.5 8h7M8.5 12h7M8.5 16h4" opacity="0.7" />
  </I>
);

export const IconBag = (p: IconProps) => (
  <I {...p}>
    <path d="M6 8h12l-1 12a2 2 0 0 1-2 1.8H9a2 2 0 0 1-2-1.8L6 8z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </I>
);

export const IconHandshake = (p: IconProps) => (
  <I {...p}>
    <path d="M12 8.5 9.5 6a2 2 0 0 0-2.8 0L3 9.7v4.6l2 2" />
    <path d="M12 8.5l2.5-2.5a2 2 0 0 1 2.8 0L21 9.7v4.6l-2 2" />
    <path d="M5 16.3l3 3a1.6 1.6 0 0 0 2.3 0l.7-.7.8.8a1.5 1.5 0 0 0 2.2 0l.6-.7.5.5a1.4 1.4 0 0 0 2-2l-3.4-3.4" />
  </I>
);

// ─── Métricas / performance ────────────────────────────────────────
export const IconChart = (p: IconProps) => (
  <I {...p}>
    <path d="M3 20h18" />
    <path d="M6 17V12M11 17V8M16 17v-4M21 17V5" />
  </I>
);

export const IconTrendUp = (p: IconProps) => (
  <I {...p}>
    <path d="M3 17l6-6 4 4 7-7" />
    <path d="M17 5h4v4" />
  </I>
);

export const IconTrendDown = (p: IconProps) => (
  <I {...p}>
    <path d="M3 7l6 6 4-4 7 7" />
    <path d="M17 19h4v-4" />
  </I>
);

export const IconTarget = (p: IconProps) => (
  <I {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" opacity="0.7" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </I>
);

export const IconClipboard = (p: IconProps) => (
  <I {...p}>
    <rect x="5" y="4" width="14" height="17" rx="2.5" />
    <path d="M9 4.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4.5V6H9V4.5z" />
    <path d="M9 11h6M9 15h4" opacity="0.7" />
  </I>
);

// ─── Funil / tráfego ───────────────────────────────────────────────
export const IconMegaphone = (p: IconProps) => (
  <I {...p}>
    <path d="M4 10v4a1 1 0 0 0 1 1h2l9 4V5L7 9H5a1 1 0 0 0-1 1z" />
    <path d="M19 9a3.5 3.5 0 0 1 0 6" opacity="0.7" />
    <path d="M7 15v3.5a1.5 1.5 0 0 0 3 0V16" opacity="0.7" />
  </I>
);

export const IconCursor = (p: IconProps) => (
  <I {...p}>
    <path d="M5 3l5.5 16 2.3-6.4L19 10.3 5 3z" />
  </I>
);

export const IconEye = (p: IconProps) => (
  <I {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </I>
);

export const IconEdit = (p: IconProps) => (
  <I {...p}>
    <path d="M4 20h4l10-10a2.1 2.1 0 0 0-3-3L5 17v3z" />
    <path d="M13.5 6.5l3 3" opacity="0.7" />
  </I>
);

// ─── Estado ────────────────────────────────────────────────────────
export const IconCheck = (p: IconProps) => (
  <I {...p} stroke={2}>
    <path d="M5 12.5l4.5 4.5L20 6" />
  </I>
);

export const IconCheckCircle = (p: IconProps) => (
  <I {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.5 2.5L16 9.5" strokeWidth={2} />
  </I>
);

export const IconClock = (p: IconProps) => (
  <I {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </I>
);

export const IconWarning = (p: IconProps) => (
  <I {...p}>
    <path d="M12 3.5 21 19a1 1 0 0 1-.9 1.5H3.9A1 1 0 0 1 3 19L12 3.5z" />
    <path d="M12 9.5v4.5" strokeWidth={2} />
    <circle cx="12" cy="17.3" r="0.9" fill="currentColor" stroke="none" />
  </I>
);

export const IconArrowRight = (p: IconProps) => (
  <I {...p} stroke={2}>
    <path d="M5 12h14M13 5l7 7-7 7" />
  </I>
);

export const IconChevronRight = (p: IconProps) => (
  <I {...p} stroke={2}>
    <path d="M9 5l7 7-7 7" />
  </I>
);

export const IconSearch = (p: IconProps) => (
  <I {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-5-5" />
  </I>
);

export const IconChat = (p: IconProps) => (
  <I {...p}>
    <path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
    <path d="M8 9.5h8M8 12.5h5" opacity="0.7" />
  </I>
);

export const IconBolt = (p: IconProps) => (
  <I {...p}>
    <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" />
  </I>
);

// ─── Sentimentos de check-in (substitui emojis) ────────────────────
export const IconFeelGood = (p: IconProps) => (
  <I {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 14a4.5 4.5 0 0 0 8 0" />
    <circle cx="9" cy="10" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="15" cy="10" r="0.9" fill="currentColor" stroke="none" />
  </I>
);

export const IconFeelNeutral = (p: IconProps) => (
  <I {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 14.5h7" />
    <circle cx="9" cy="10" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="15" cy="10" r="0.9" fill="currentColor" stroke="none" />
  </I>
);

export const IconFeelDry = (p: IconProps) => (
  <I {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 15.5a4.5 4.5 0 0 1 8 0" />
    <circle cx="9" cy="10" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="15" cy="10" r="0.9" fill="currentColor" stroke="none" />
  </I>
);

export const IconDrop = (p: IconProps) => (
  <I {...p}>
    <path d="M12 3.5c0 0 6 7 6 11a6 6 0 1 1-12 0c0-4 6-11 6-11z" />
    <path d="M9 14a3 3 0 0 0 3 3" strokeWidth={1.4} opacity="0.55" />
  </I>
);

export const IconSparkles = (p: IconProps) => (
  <I {...p}>
    <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
    <path d="M19 14l.8 2 2 .8-2 .8L19 19.5l-.8-1.9-2-.8 2-.8.8-2z" opacity="0.65" />
  </I>
);

// Mapeia o "hair_feel" do check-in para um ícone (substitui o emoji)
export function iconForHairFeel(feel: string | null): React.ComponentType<IconProps> {
  switch (feel) {
    case 'muito_seco': return IconFeelDry;
    case 'seco':       return IconFeelDry;
    case 'normal':     return IconFeelNeutral;
    case 'oleoso':     return IconDrop;
    case 'otimo':      return IconFeelGood;
    default:           return IconSparkles;
  }
}
