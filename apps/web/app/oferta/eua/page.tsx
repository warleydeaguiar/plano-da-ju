import { Metadata } from 'next';
import OfertaEuaClient from './OfertaEuaClient';

export const metadata: Metadata = {
  title: 'Seu Plano Capilar — para brasileiras nos EUA',
  description: 'Plano capilar personalizado por US$ 9,90: produtos fáceis de achar nos Estados Unidos e a solução pra água dura que resseca o cabelo.',
};

export default function OfertaEuaPage() {
  return <OfertaEuaClient />;
}
