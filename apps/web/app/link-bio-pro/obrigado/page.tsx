import { Metadata } from 'next';
import ObrigadoClient from './ObrigadoClient';

export const metadata: Metadata = {
  title: 'Pedido recebido — Link na Bio PRO',
  robots: { index: false, follow: false },
};

export default function ObrigadoLinkBioPro() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-6 text-center text-white" style={{ background: 'var(--bg)' }}>
      <div className="max-w-sm w-full">
        <div className="text-5xl mb-5">🎉</div>
        <h1 className="text-2xl font-extrabold mb-3">Pedido recebido!</h1>
        <p className="text-white/70 leading-relaxed">
          Pagamento confirmado. Agora é comigo: vou montar o seu link na bio com tudo o que você me
          contou e te envio por e-mail e WhatsApp. Obrigada pela confiança! 💛
        </p>
        <p className="text-white/50 text-sm mt-4">
          Lembrou de alguma foto, logo ou link que ficou de fora? Me manda por lá:
        </p>
        <ObrigadoClient />
      </div>
    </div>
  );
}
