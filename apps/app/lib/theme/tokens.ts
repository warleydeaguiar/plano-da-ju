/**
 * Design tokens — Plano da Ju
 *
 * Single source of truth para todas as cores, espaçamentos e tipografia.
 * Importe `T` em vez de redeclarar `const C = {...}` em cada tela.
 */

export const T = {
  // Brand
  accent: '#C4607A',     // Rose primário (botões, CTAs)
  accent2: '#9B4A6A',    // Rose escuro (heros, gradient end)
  accent3: '#8B3A6E',    // Rose mais escuro ainda (top gradient checkin)
  rose50: '#FDE8EE',     // Rose pastel (badges, highlights)
  rose100: '#FDF0F3',    // Rose ainda mais pastel (selected states)

  // Neutros
  bg: '#F2F2F7',         // Background screens
  bgWarm: '#FDF8F5',     // Background warm (checkin)
  surface: '#FFFFFF',    // Cards
  dark: '#1C1C1E',       // Text primário
  darkAlt: '#2D1B2E',    // Text alt (admin/web context)
  mid: '#48484A',        // Text secundário
  sub: '#8E8E93',        // Text terciário (placeholder, captions)
  sep: '#E5E5EA',        // Separadores
  border: '#EDE6F2',     // Border sutil (rose-tinted)

  // Semânticas
  green: '#34C759',      // Success / done
  red: '#FF3B30',        // Danger / cancel / breakage
  gold: '#FF9500',       // Warning / attention / today
  blue: '#007AFF',       // Info
  purple: '#AF52DE',     // Acessório

  // Categorias capilares (para chips/dots)
  catHidratacao: '#5AC8FA',  // Azul ciano
  catNutricao: '#34C759',    // Verde
  catReconstrucao: '#C4607A', // Rose (mesma do accent — é a "mais forte")
  catLavagem: '#AF52DE',     // Roxo
  catFinalizacao: '#FF9500', // Dourado
  catProtecao: '#8E8E93',    // Cinza
};

// Gradientes prontos
export const GRAD = {
  hero: ['#9B4A6A', '#C4607A'] as [string, string],
  heroDark: ['#2D1B2E', '#6B3070'] as [string, string],
  checkinTop: ['#8B3A6E', '#C4607A'] as [string, string],
  avatar: ['#9B4A6A', '#C4607A'] as [string, string],
};

// Sombras prontas (RN style)
export const SHADOW = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  cardLg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  pill: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
};

// Spacing scale
export const SP = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Radius scale
export const R = {
  s: 8,
  m: 12,
  l: 14,
  xl: 16,
  xxl: 20,
  pill: 999,
};
