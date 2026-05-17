// Custom SVG icons — thin stroke style, matches Fraunces/Jakarta design language.
// All icons render at 24×24 by default; pass size + color to override.

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
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// ─── Navigation ────────────────────────────────────────────────────
export const IconHome = (p: IconProps) => (
  <I {...p}>
    <path d="M3 11l9-8 9 8" />
    <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
  </I>
);

export const IconCalendar = (p: IconProps) => (
  <I {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M3 10h18" />
    <path d="M8 3v4M16 3v4" />
  </I>
);

export const IconList = (p: IconProps) => (
  <I {...p}>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none" />
  </I>
);

export const IconChart = (p: IconProps) => (
  <I {...p}>
    <path d="M3 20h18" />
    <path d="M6 17V12M11 17V8M16 17v-4M21 17V5" />
  </I>
);

export const IconBag = (p: IconProps) => (
  <I {...p}>
    <path d="M6 8h12l-1 12a2 2 0 0 1-2 1.8H9a2 2 0 0 1-2-1.8L6 8z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </I>
);

// ─── Care actions ──────────────────────────────────────────────────
export const IconWash = (p: IconProps) => (
  // shower head + drops
  <I {...p}>
    <path d="M5 4h11a3 3 0 0 1 3 3v3" />
    <path d="M3 11h18" />
    <path d="M7 15.5l-1 2M12 16l-.5 2.5M17 15.5l1 2" />
    <circle cx="6.5" cy="20" r="0.6" fill="currentColor" stroke="none" />
    <circle cx="11.5" cy="21" r="0.6" fill="currentColor" stroke="none" />
    <circle cx="17.5" cy="20" r="0.6" fill="currentColor" stroke="none" />
  </I>
);

export const IconDrop = (p: IconProps) => (
  <I {...p}>
    <path d="M12 3.5c0 0 6 7 6 11a6 6 0 1 1-12 0c0-4 6-11 6-11z" />
    <path d="M9 14a3 3 0 0 0 3 3" strokeWidth={1.4} opacity="0.55" />
  </I>
);

export const IconFlask = (p: IconProps) => (
  // máscara/tratamento
  <I {...p}>
    <path d="M10 3h4M10 3v6L4.5 18.2A1.5 1.5 0 0 0 5.8 20.5h12.4a1.5 1.5 0 0 0 1.3-2.3L14 9V3" />
    <path d="M6.5 14h11" opacity="0.5" />
  </I>
);

export const IconLeaf = (p: IconProps) => (
  // nutrição (manteiga/karité)
  <I {...p}>
    <path d="M21 3s-9 0-13 4-4 12-4 12 8 0 12-4 5-12 5-12z" />
    <path d="M4 20l9-9" opacity="0.55" />
  </I>
);

export const IconShield = (p: IconProps) => (
  // reconstrução / proteção
  <I {...p}>
    <path d="M12 3l8 3v6c0 4.6-3.4 8.6-8 9.5-4.6-.9-8-4.9-8-9.5V6l8-3z" />
    <path d="M9 12l2 2 4-4" strokeWidth={2} />
  </I>
);

export const IconSparkles = (p: IconProps) => (
  <I {...p}>
    <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
    <path d="M19 14l.8 2 2 .8-2 .8L19 19.5l-.8-1.9-2-.8 2-.8.8-2z" opacity="0.65" />
  </I>
);

export const IconWind = (p: IconProps) => (
  // calor / secador
  <I {...p}>
    <path d="M3 9h11a3 3 0 0 0 0-6 3 3 0 0 0-3 3" />
    <path d="M3 14h15a3 3 0 0 1 0 6 3 3 0 0 1-3-3" />
    <path d="M3 12h8" />
  </I>
);

export const IconCamera = (p: IconProps) => (
  <I {...p}>
    <path d="M5 7h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
    <circle cx="12" cy="13" r="3.5" />
  </I>
);

// ─── State ─────────────────────────────────────────────────────────
export const IconCheck = (p: IconProps) => (
  <I {...p} stroke={2}>
    <path d="M5 12.5l4.5 4.5L20 6" />
  </I>
);

export const IconFlame = (p: IconProps) => (
  // streak
  <I {...p}>
    <path d="M12 3s-1.5 3 1 5.5C16 11 16.5 14 14 17c-.7.8-1.5 1.3-2 1.5-.5-.2-1.3-.7-2-1.5C7.5 14 8 11 11 8.5 13.5 6 12 3 12 3z" />
    <path d="M12 19.5c-1.8 0-3-1.2-3-3 0-1.5 1-2.5 2-3" opacity="0.65" />
  </I>
);

export const IconChevronRight = (p: IconProps) => (
  <I {...p} stroke={2}>
    <path d="M9 5l7 7-7 7" />
  </I>
);

export const IconChevronLeft = (p: IconProps) => (
  <I {...p} stroke={2}>
    <path d="M15 5l-7 7 7 7" />
  </I>
);

export const IconArrowRight = (p: IconProps) => (
  <I {...p} stroke={2}>
    <path d="M5 12h14M13 5l7 7-7 7" />
  </I>
);

export const IconClose = (p: IconProps) => (
  <I {...p} stroke={2}>
    <path d="M6 6l12 12M18 6L6 18" />
  </I>
);

export const IconSearch = (p: IconProps) => (
  <I {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-5-5" />
  </I>
);

export const IconClock = (p: IconProps) => (
  <I {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </I>
);

export const IconPin = (p: IconProps) => (
  <I {...p}>
    <path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" />
    <circle cx="12" cy="9" r="2.5" />
  </I>
);

export const IconRuler = (p: IconProps) => (
  <I {...p}>
    <path d="M3 13l10 10 8-8L11 5 3 13z" />
    <path d="M7 13l2 2M10 10l2 2M13 7l2 2" opacity="0.6" />
  </I>
);

export const IconHeart = (p: IconProps) => (
  <I {...p}>
    <path d="M12 20s-7-4.5-7-10.5a4.5 4.5 0 0 1 8-2.8 4.5 4.5 0 0 1 8 2.8c0 6-7 10.5-7 10.5z" />
  </I>
);

export const IconScissors = (p: IconProps) => (
  <I {...p}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M20 4L8.5 15.5M8.5 8.5L20 20" />
  </I>
);

export const IconBolt = (p: IconProps) => (
  <I {...p}>
    <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" />
  </I>
);

export const IconLink = (p: IconProps) => (
  <I {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </I>
);

export const IconMoon = (p: IconProps) => (
  <I {...p}>
    <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" />
  </I>
);

export const IconSun = (p: IconProps) => (
  <I {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
  </I>
);

// ─── Pattern: choose by event/category name ────────────────────────
export function iconForEvent(eventType: string): React.ComponentType<IconProps> {
  switch (eventType) {
    case 'wash':            return IconWash;
    case 'hydration_mask':  return IconDrop;
    case 'nutrition_mask':  return IconLeaf;
    case 'reconstruction':  return IconShield;
    case 'oil_treatment':   return IconSparkles;
    case 'heat_used':       return IconWind;
    case 'photo':           return IconCamera;
    case 'sun_exposure':    return IconSun;
    case 'cut':             return IconScissors;
    case 'chemical':        return IconBolt;
    default:                return IconHeart;
  }
}

export function iconForCategory(cat: string | null, name?: string | null): React.ComponentType<IconProps> {
  const ref = `${cat ?? ''} ${name ?? ''}`.toLowerCase();
  if (ref.includes('shampoo') || ref.includes('limpeza') || ref.includes('co-wash')) return IconWash;
  if (ref.includes('condicionador') || ref.includes('hidrat')) return IconDrop;
  if (ref.includes('máscara') || ref.includes('mascara')) return IconFlask;
  if (ref.includes('óleo') || ref.includes('oleo')) return IconSparkles;
  if (ref.includes('protetor') || ref.includes('térm') || ref.includes('term')) return IconSun;
  if (ref.includes('recons') || ref.includes('queratina') || ref.includes('protein')) return IconShield;
  if (ref.includes('nutri') || ref.includes('karit') || ref.includes('manteiga')) return IconLeaf;
  return IconHeart;
}

export function iconForTask(title: string): React.ComponentType<IconProps> {
  const t = title.toLowerCase();
  if (t.includes('hidrat')) return IconDrop;
  if (t.includes('lavag') || t.includes('shampoo') || t.includes('lava')) return IconWash;
  if (t.includes('nutri')) return IconLeaf;
  if (t.includes('recon')) return IconShield;
  if (t.includes('óleo') || t.includes('oleo')) return IconSparkles;
  if (t.includes('descan')) return IconMoon;
  if (t.includes('leave')) return IconFlask;
  if (t.includes('co-wash')) return IconWash;
  if (t.includes('avalia')) return IconChart;
  return IconHeart;
}
