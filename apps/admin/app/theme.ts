// Design tokens do painel admin — espelham o app do consumidor (/meu-plano).
// Estética: creme quente + plum + rosa vibrante + ouro champagne.
// Adaptado pra contexto desktop (sidebar, tabelas, grids largos).

export const T = {
  // Surfaces
  bg:        '#FFFAF5',
  bgWarm:    '#FFF1E8',
  surface:   '#FFFFFF',
  cream:     '#FFF7EE',
  champagne: '#F5E6D3',

  // Ink (warm dark plum)
  ink:       '#2A1E2C',
  inkSoft:   '#7C6B7E',
  inkMuted:  '#B5A6B7',

  // Accent — vibrant pink (Ybera-ish)
  pink:      '#EC4899',
  pinkDeep:  '#BE185D',
  pinkSoft:  '#FCE7F3',
  pinkBlush: '#FFD1E0',
  rose:      '#FFE4EA',

  // Secondary — warm gold
  gold:      '#C9A877',
  goldDeep:  '#9C7B4F',
  goldSoft:  '#F5E6D3',

  // Semantic
  green:     '#22A06B',
  greenSoft: '#E1F5EB',
  blue:      '#2563EB',
  blueSoft:  '#DBEAFE',
  alert:     '#D97706',
  alertSoft: '#FEF3C7',
  danger:    '#DC2626',
  dangerSoft: '#FEE2E2',
  purple:    '#9333EA',
  purpleSoft: '#F3E8FF',

  // Hairlines
  border:     'rgba(196,140,150,0.18)',
  borderSoft: 'rgba(42,30,44,0.06)',
};

export const fonts = {
  display: '"Fraunces", "Cormorant Garamond", Georgia, serif',
  ui:      '"Plus Jakarta Sans", "Inter", -apple-system, system-ui, sans-serif',
};

export const shadow = {
  card:   '0 1px 3px rgba(42,30,44,0.06), 0 1px 2px rgba(42,30,44,0.04)',
  raised: '0 8px 24px rgba(190,24,93,0.10), 0 2px 6px rgba(42,30,44,0.06)',
  hero:   '0 12px 32px rgba(190,24,93,0.22), 0 4px 12px rgba(42,30,44,0.08)',
  glass:  '0 2px 8px rgba(190,24,93,0.06)',
};

export const gradient = {
  hero:       `linear-gradient(135deg, ${T.pinkDeep} 0%, ${T.pink} 60%, ${T.gold} 100%)`,
  heroSoft:   `linear-gradient(135deg, ${T.pink} 0%, ${T.pinkDeep} 100%)`,
  warm:       `linear-gradient(135deg, ${T.bgWarm} 0%, ${T.rose} 100%)`,
  gold:       `linear-gradient(135deg, ${T.goldSoft} 0%, ${T.champagne} 100%)`,
  ink:        `linear-gradient(135deg, ${T.ink} 0%, #3D2A3F 100%)`,
  pinkToGold: `linear-gradient(90deg, ${T.pink}, ${T.gold})`,
};

// Gradientes determinísticos pra avatares (por id)
export const AVATAR_GRADIENTS = [
  `linear-gradient(135deg, ${T.pinkDeep}, ${T.pink})`,
  `linear-gradient(135deg, ${T.gold}, ${T.goldDeep})`,
  `linear-gradient(135deg, ${T.pink}, ${T.gold})`,
  `linear-gradient(135deg, ${T.purple}, ${T.pinkDeep})`,
  `linear-gradient(135deg, ${T.pinkDeep}, ${T.gold})`,
];

export function gradientForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}
