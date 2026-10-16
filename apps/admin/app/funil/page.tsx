import Sidebar from '../components/Sidebar'
import { T, fonts } from '../theme'
import { FUNIS } from '@/lib/funil/mapa'
import { carregarFunil } from '@/lib/funil/dados'
import { buscarPessoa } from '@/lib/funil/pessoa'
import FunilClient from './FunilClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Funil — Admin Plano da Ju' }

/**
 * Mapa dos funis: tudo o que cada lead recebe, em ordem, com a prévia de cada
 * mensagem (o texto real, lido da fonte) e os números de 7 dias. A busca no
 * topo mostra o que UMA pessoa recebeu. Mapa em lib/funil/mapa.ts.
 */
export default async function FunilPage({ searchParams }: { searchParams: Promise<{ f?: string; pessoa?: string }> }) {
  const sp = await searchParams
  const busca = (sp.pessoa ?? '').trim()
  const [dados, pessoa] = await Promise.all([carregarFunil(), busca ? buscarPessoa(busca) : Promise.resolve(null)])
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: T.bg, fontFamily: fonts.ui, color: T.ink }}>
      <Sidebar />
      <main style={{ marginLeft: 234, flex: 1, height: '100vh', overflowY: 'auto', padding: '32px 32px 48px' }}>
        <FunilClient funis={FUNIS} chave={sp.f ?? FUNIS[0].chave} dados={dados} busca={busca} pessoa={pessoa} />
      </main>
    </div>
  )
}
