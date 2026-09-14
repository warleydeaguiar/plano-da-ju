import Sidebar from './components/Sidebar';
import { T, fonts } from './theme';

/**
 * Tela de carregamento de todas as páginas do painel.
 *
 * Sem ela, clicar num item do menu não mudava nada na tela até o servidor
 * terminar de montar a página inteira — segundos parecendo travado. Com ela, o
 * menu continua no lugar e o conteúdo mostra blocos provisórios na hora.
 */
export default function Carregando() {
  const bloco = (altura: number, flex?: number) => (
    <div className="skel" style={{ height: altura, borderRadius: 16, flex }} />
  );
  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: T.bg, fontFamily: fonts.ui, color: T.ink,
    }}>
      <Sidebar />
      <main className="dash-main" aria-busy="true" aria-label="Carregando" style={{
        marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto',
        padding: 32, display: 'flex', flexDirection: 'column', gap: 22,
      }}>
        <div className="skel" style={{ height: 34, width: 260, borderRadius: 10 }} />
        <div className="dash-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {bloco(112)}{bloco(112)}{bloco(112)}{bloco(112)}
        </div>
        {bloco(260)}
        <div style={{ display: 'flex', gap: 16 }}>{bloco(200, 1)}{bloco(200, 1)}</div>
      </main>
    </div>
  );
}
