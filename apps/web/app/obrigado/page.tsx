import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Compra Confirmada! — Plano da Ju',
};

export default function ObrigadoPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#1C0020', color: '#FFF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 12, letterSpacing: -0.5 }}>
          Compra confirmada!
        </h1>
        <p style={{ fontSize: 15, color: '#8E8E93', lineHeight: 1.6, marginBottom: 32 }}>
          Agora é só baixar o app e fazer sua primeira avaliação com foto. Seu plano personalizado estará pronto em breve!
        </p>

        {/* Countdown simulation */}
        <div style={{ background: '#2A0A30', borderRadius: 20, padding: '24px 20px', marginBottom: 24, border: '1px solid rgba(196,96,122,0.3)' }}>
          <div style={{ fontSize: 12, color: '#C4607A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Seu plano estará pronto em
          </div>
          <div style={{ fontSize: 42, fontWeight: 800, fontFamily: 'monospace', marginBottom: 4 }}>
            01:58:32
          </div>
          <div style={{ fontSize: 12, color: '#8E8E93' }}>
            A Juliane está analisando seu perfil
          </div>
        </div>

        {/* App download */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button style={{ background: '#FFF', border: 'none', borderRadius: 14, padding: '16px', fontSize: 14, fontWeight: 700, color: '#1C0020', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🍎</span> Baixar na App Store
          </button>
          <button style={{ background: '#FFF', border: 'none', borderRadius: 14, padding: '16px', fontSize: 14, fontWeight: 700, color: '#1C0020', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🤖</span> Baixar no Google Play
          </button>
        </div>

        <p style={{ fontSize: 12, color: '#48484A', marginTop: 24, lineHeight: 1.5 }}>
          Você receberá um e-mail de confirmação em breve. Qualquer dúvida, fale com a gente via WhatsApp.
        </p>
      </div>
    </div>
  );
}
