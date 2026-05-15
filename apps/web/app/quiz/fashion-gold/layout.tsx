import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Grupo VIP Ybera Paris — Promoções Exclusivas',
  description: 'Acesse o grupo exclusivo de promoções Ybera Paris. Descontos de até 62% + sorteios mensais de kits completos. Grátis, sem compromisso.',
  openGraph: {
    title: 'Grupo VIP Ybera Paris — Promoções Exclusivas',
    description: 'Acesse o grupo exclusivo de promoções Ybera Paris. Descontos de até 62% + sorteios mensais de kits completos.',
    type: 'website',
  },
}

// Pixel agora está no root layout (apps/web/app/layout.tsx) — cobre TODO o funil.
// Events custom (Lead, InitiateCheckout, Purchase) são disparados nos clients via window.fbq.

export default function QuizFashionGoldLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
