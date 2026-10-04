import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pedido recebido — Link na Bio PRO',
  robots: { index: false, follow: false },
};

export default function ObrigadoLinkBioPro() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-6 text-center text-white" style={{ background: 'var(--bg)' }}>
      <div className="max-w-sm">
        <div className="text-5xl mb-5">🎉</div>
        <h1 className="text-2xl font-extrabold mb-3">Pedido recebido!</h1>
        <p className="text-white/70 leading-relaxed">
          Recebi tudo certinho. Em breve eu mesma monto o seu link na bio e te envio por
          e-mail e WhatsApp. Obrigada pela confiança! 💛
        </p>
      </div>
    </div>
  );
}
