import { Metadata } from 'next';
import { Suspense } from 'react';
import ObrigadoClient from './ObrigadoClient';

export const metadata: Metadata = {
  title: 'Compra Confirmada! — Plano da Ju',
};

export default function ObrigadoPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#FFFAF5' }} />}>
      <ObrigadoClient />
    </Suspense>
  );
}
