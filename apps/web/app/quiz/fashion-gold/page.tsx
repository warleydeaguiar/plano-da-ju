import type { Metadata } from 'next'
import { Suspense } from 'react'
import QuizFashionGoldClient from './QuizFashionGoldClient'

export const metadata: Metadata = {
  title: 'Grupo VIP Ybera Paris — Promoções Exclusivas',
}

export default function QuizFashionGoldPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100svh', background: '#faf7f2' }} />}>
      <QuizFashionGoldClient />
    </Suspense>
  )
}
