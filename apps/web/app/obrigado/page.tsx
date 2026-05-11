import { Metadata } from 'next';
import ObrigadoClient from './ObrigadoClient';

export const metadata: Metadata = {
  title: 'Compra Confirmada! — Plano da Ju',
};

export default function ObrigadoPage() {
  return <ObrigadoClient />;
}
