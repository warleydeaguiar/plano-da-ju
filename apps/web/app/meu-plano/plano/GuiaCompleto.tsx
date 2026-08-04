'use client';

// Guia completo de cuidados capilares — o mesmo conteúdo educativo do PDF da
// Juliane, portado pro app (aba Dicas). Estático (vale pra todas), com toque
// personalizado na frequência de lavagem conforme a oleosidade do couro.
import { useState } from 'react';
import { T, fonts, shadow } from '../theme';

const mlSearch = (q: string) => `https://lista.mercadolivre.com.br/${encodeURIComponent(q)}`;

// ── Callout (regra de ouro / atenção) ─────────────────────────
function Callout({ kicker, children, tone = 'rose' }: { kicker?: string; children: React.ReactNode; tone?: 'rose' | 'wine' }) {
  const wine = tone === 'wine';
  return (
    <div style={{
      background: wine ? T.pinkSoft : T.rose,
      borderLeft: `3px solid ${wine ? T.pinkDeep : T.pink}`,
      borderRadius: 12, padding: '12px 14px', margin: '12px 0 2px',
    }}>
      {kicker && <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: T.pinkDeep, marginBottom: 5 }}>{kicker}</div>}
      <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

function Lead({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13.5, color: T.inkSoft, lineHeight: 1.6, margin: '0 0 12px' }}>{children}</p>;
}
function SubH({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 14.5, fontWeight: 800, color: T.ink, margin: '16px 0 8px', fontFamily: fonts.display }}>{children}</div>;
}

// Lista numerada (passos)
function Steps({ items }: { items: [string, string][] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map(([b, d], i) => (
        <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: T.pink, color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{i + 1}</div>
          <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.5 }}><strong>{b}</strong> <span style={{ color: T.inkSoft }}>{d}</span></div>
        </div>
      ))}
    </div>
  );
}

// Dois cards lado a lado (ok/bad ou genéricos)
function TwoCol({ cards }: { cards: { title: string; items: string[]; tone?: 'ok' | 'bad' | 'plain' }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
      {cards.map((c, i) => {
        const border = c.tone === 'ok' ? T.green : c.tone === 'bad' ? T.pink : T.borderSoft;
        const head = c.tone === 'ok' ? T.green : c.tone === 'bad' ? T.pinkDeep : T.ink;
        return (
          <div key={i} style={{ background: T.cream, borderRadius: 12, padding: '12px 13px', border: `1px solid ${border}22` }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: head, marginBottom: 7 }}>{c.title}</div>
            <ul style={{ margin: 0, paddingLeft: 15, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {c.items.map((it, j) => <li key={j} style={{ fontSize: 12, color: T.inkSoft, lineHeight: 1.45 }}>{it}</li>)}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ── Acordeão ──────────────────────────────────────────────────
function Section({ emoji, title, children, defaultOpen = false }: { emoji: string; title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: T.surface, borderRadius: 16, boxShadow: shadow.card, border: `1px solid ${T.borderSoft}`, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '15px 16px',
        background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>{emoji}</span>
        <span style={{ flex: 1, fontSize: 14.5, fontWeight: 800, color: T.ink, fontFamily: fonts.display }}>{title}</span>
        <span style={{ fontSize: 12, color: T.pinkDeep, fontWeight: 700, flexShrink: 0 }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && <div style={{ padding: '0 16px 18px' }}>{children}</div>}
    </div>
  );
}

const ETAPAS = [
  { ic: '💧', t: 'Hidratação', s: 'Devolve água', desc: 'Imagine uma planta sem água: ela murcha. O cabelo também. Quando falta hidratação, o fio fica opaco, áspero, armado e difícil de desembaraçar.', ativos: 'babosa, pantenol, glicerina, aloe vera, ácido hialurônico. É a etapa mais frequente do cronograma.', label: 'Ativos' },
  { ic: '🫧', t: 'Nutrição', s: 'Devolve lipídios', desc: 'São os óleos naturais que protegem o fio. Quando falta nutrição, surgem frizz, pontas espigadas, excesso de volume e porosidade. A nutrição é a responsável pelo brilho.', ativos: 'óleo de argan, coco, abacate e macadâmia; manteiga de karité e murumuru.', label: 'Ativos' },
  { ic: '✚', t: 'Reconstrução', s: 'Devolve proteínas', desc: 'Repõe queratina, colágeno e aminoácidos. Indicada pra cabelos descoloridos, quebradiços, elásticos ou muito danificados.', ativos: 'reconstrução em excesso endurece o fio. Entra só a cada 15–30 dias, conforme a necessidade — nunca toda semana.', label: 'Atenção' },
];

const BRUSHES = [
  { nome: 'Tangle Teezer', tag: '★ Favorita da Ju', desc: 'Uma das melhores do mundo pra desembaraçar sem puxar os fios. Pode usar no cabelo molhado.', itens: ['Reduz a quebra', 'Ótima pra fios finos, loiros e com química'], buscar: 'tangle teezer escova' },
  { nome: 'Michel Mercier', tag: '★', desc: 'Pensada pra diferentes espessuras. Muito confortável e puxa menos os fios.', itens: ['Ótima pra cabelos longos e grossos', 'Diminui bastante a quebra'], buscar: 'escova michel mercier' },
  { nome: 'Wet Brush', tag: '', desc: 'Ótimo custo-benefício, cerdas extremamente flexíveis. Desembaraça molhado sem machucar o couro.', itens: ['Serve pra todos os tipos de cabelo'], buscar: 'wet brush escova' },
  { nome: 'Escovas de bambu', tag: '', desc: 'Pra quem prefere materiais naturais: massageiam o couro e produzem menos eletricidade estática.', itens: ['Ajudam a reduzir o frizz', 'Muito resistentes'], buscar: 'escova de bambu cabelo' },
];

export default function GuiaCompleto({ couro = 'normal' }: { couro?: string }) {
  const freq: [string, string, string][] = [
    ['Raiz oleosa', 'Pode lavar diariamente.', 'oleoso'],
    ['Raiz normal', 'Dia sim, dia não.', 'normal'],
    ['Raiz seca', '2 a 3 vezes por semana.', 'seco'],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Como o cabelo funciona */}
      <Section emoji="🔬" title="Como o cabelo funciona" defaultOpen>
        <Lead>Antes de tratar, entenda como o fio é formado. Ele tem três camadas — e o tratamento acontece principalmente nas duas primeiras.</Lead>
        {[
          ['Cutícula', 'Camada externa', 'Como um telhado de escamas. Fechada, protege tudo o que está por dentro.'],
          ['Córtex', 'Camada central', 'Onde fica quase toda a estrutura: queratina, proteínas, pigmentos e a elasticidade do fio.'],
          ['Medula', 'Núcleo', 'A parte mais interna. Praticamente não influencia nos tratamentos cosméticos.'],
        ].map(([t, k, d], i) => (
          <div key={i} style={{ background: T.cream, borderRadius: 12, padding: '11px 13px', marginBottom: 8, border: `1px solid ${T.borderSoft}` }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, fontFamily: fonts.display }}>{t}</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: T.gold, margin: '1px 0 4px' }}>{k}</div>
            <div style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.5 }}>{d}</div>
          </div>
        ))}
        <SubH>A cutícula é o seu termômetro</SubH>
        <TwoCol cards={[
          { title: 'Cutícula fechada', tone: 'ok', items: ['Cabelo com brilho', 'Desembaraça fácil', 'Perde menos água', 'Toque macio'] },
          { title: 'Cutícula aberta', tone: 'bad', items: ['Frizz e aspereza', 'Ressecamento', 'Pontas duplas', 'Quebra'] },
        ]} />
        <Callout kicker="Guarde isto">Grande parte do tratamento é manter a cutícula saudável. Quando o córtex sofre com descoloração, chapinha, secador ou química, o fio perde força e começa a quebrar — é por isso que a reconstrução existe.</Callout>
      </Section>

      {/* O que é cronograma + 3 etapas */}
      <Section emoji="🗓️" title="O que é cronograma capilar">
        <Lead>É um planejamento pra devolver ao cabelo, de forma organizada, tudo o que ele perde no dia a dia. Cada etapa tem uma função — e é a alternância entre elas que faz o resultado acontecer.</Lead>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4 }}>
          {[['Sem brilho, opaco', 'hidratação'], ['Frizz e ressecado', 'nutrição'], ['Quebrando muito', 'reconstrução']].map(([a, b], i) => (
            <div key={i} style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.5, paddingBottom: 6, borderBottom: i < 2 ? `1px solid ${T.borderSoft}` : 'none' }}>
              <strong style={{ color: T.ink }}>{a}</strong> → está pedindo <strong style={{ color: T.pinkDeep }}>{b}</strong>
            </div>
          ))}
        </div>
        <Callout kicker="A regra de ouro">Um cronograma de verdade se diferencia de "usar sempre a mesma máscara" justamente porque alterna as etapas. O excesso de qualquer uma — principalmente reconstrução — atrapalha em vez de ajudar.</Callout>
        <SubH>As três etapas</SubH>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ETAPAS.map((e, i) => (
            <div key={i} style={{ background: T.cream, borderRadius: 12, padding: '12px 13px', border: `1px solid ${T.borderSoft}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>{e.ic}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, fontFamily: fonts.display, lineHeight: 1 }}>{e.t}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: T.gold, marginTop: 2 }}>{e.s}</div>
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.5, marginBottom: 5 }}>{e.desc}</div>
              <div style={{ fontSize: 12, color: T.ink, lineHeight: 1.5 }}><strong>{e.label}:</strong> {e.ativos}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Como lavar */}
      <Section emoji="🚿" title="Como lavar corretamente">
        <Lead>Parece simples, mas a maior parte das pessoas lava o cabelo do jeito errado. Estes cinco passos mudam a base de tudo.</Lead>
        <Steps items={[
          ['Molhe completamente os fios.', 'A água precisa penetrar de verdade antes do shampoo.'],
          ['Shampoo apenas na raiz.', 'Nunca esfregue o comprimento — quem limpa o comprimento é a espuma escorrendo.'],
          ['Massageie com as pontas dos dedos.', 'Nunca as unhas. A massagem ativa a circulação do couro.'],
          ['Enxágue completamente.', 'Resíduo de shampoo deixa o cabelo pesado e sem brilho.'],
          ['Raiz muito oleosa? Faça uma segunda lavagem.', 'A primeira remove a sujeira; a segunda realmente limpa.'],
        ]} />
        <Callout kicker="Temperatura importa">Água morna na lavagem e água fria no enxágue final. Água muito quente abre demais a cutícula, estimula oleosidade na raiz, resseca o comprimento e aumenta o frizz.</Callout>
      </Section>

      {/* Máscara & condicionador + óleo/protetor */}
      <Section emoji="🧴" title="Máscara, condicionador & óleo">
        <Steps items={[
          ['Retire o excesso de água com a toalha.', 'Quanto menos água no fio, melhor a absorção da máscara.'],
          ['Divida o cabelo em mechas', 'e passe mecha por mecha, enluvando delicadamente.'],
          ['Nunca aplique na raiz', '— exceto máscaras específicas pra couro cabeludo.'],
          ['Respeite o tempo indicado.', 'Mais tempo não significa mais resultado. Depois, enxágue completamente.'],
        ]} />
        <Callout kicker="Condicionador é obrigatório? Sim.">Muita gente acha que a máscara substitui — na maioria das vezes, não. O condicionador sela a cutícula depois do tratamento: menos frizz, mais brilho e fios alinhados.</Callout>
        <SubH>Óleo capilar & protetor térmico</SubH>
        <Lead>O óleo é um finalizador: ele não hidrata em profundidade, ele sela tudo o que a máscara entregou. <strong>Óleo de Mirra:</strong> 2 a 3 gotas já bastam — óleo em excesso pesa. Se você usa chapinha ou secador, protetor térmico <strong>não é opcional</strong>: o calor acima de 180 °C começa a degradar as proteínas do fio.</Lead>
        <Callout kicker="A ordem certa importa" tone="wine">Máscara sela com água fria → toalha → óleo de mirra nas pontas úmidas → protetor térmico → só então o calor. Fazer na sequência errada é o que consome a hidratação mais rápido do que qualquer máscara consegue repor.</Callout>
      </Section>

      {/* Rotina & hábitos (personalizado pelo couro) */}
      <Section emoji="🌙" title="Rotina & hábitos que fazem a diferença">
        <SubH>Com que frequência lavar?</SubH>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {freq.map(([t, d, key]) => {
            const on = couro === key;
            return (
              <div key={key} style={{
                display: 'flex', justifyContent: 'space-between', gap: 8, padding: '9px 12px', borderRadius: 10,
                background: on ? T.pinkSoft : T.cream, border: `1px solid ${on ? T.pink + '55' : T.borderSoft}`,
              }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: on ? T.pinkDeep : T.ink }}>{t}</span>
                <span style={{ fontSize: 12.5, color: T.inkSoft, textAlign: 'right' }}>{d}{on && <strong style={{ color: T.pinkDeep }}> · o seu caso</strong>}</span>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 12 }}>
          <TwoCol cards={[
            { title: 'Como pentear', items: ['Comece sempre pelas pontas.', 'Depois o comprimento; só então a raiz.', 'Nunca puxe de cima pra baixo.', 'Dentes largos ou cerdas macias.'] },
            { title: 'Fronha de cetim', items: ['Menos quebra e menos nós', 'Menos frizz', 'Mais brilho ao acordar'] },
          ]} />
        </div>
        <Callout kicker="Evite dormir de cabelo molhado">O fio molhado é mais frágil, e o hábito favorece quebra, frizz, caspa e fungos. Deixe secar antes de deitar e evite prender o cabelo muito apertado.</Callout>
      </Section>

      {/* O que mais prejudica */}
      <Section emoji="⚠️" title="O que mais prejudica o cabelo">
        <Lead>Boa parte dos danos não vem do que falta — vem do que se repete sem perceber.</Lead>
        <TwoCol cards={[
          { title: 'Evite', tone: 'bad', items: ['Dormir de cabelo molhado', 'Prender muito apertado', 'Chapinha todos os dias', 'Água muito quente'] },
          { title: 'Evite', tone: 'bad', items: ['Escovar com força', 'Descolorações frequentes', 'Lavar pouco (couro oleoso)', 'Não cortar as pontas'] },
        ]} />
        <Callout kicker="Cortar os fios regularmente" tone="wine">Cabelo danificado: corte a cada <strong>3 meses</strong>. Pontas saudáveis: a cada <strong>6 meses</strong> pra manter o formato e a saúde.</Callout>
      </Section>

      {/* Escovas */}
      <Section emoji="💇‍♀️" title="As melhores escovas">
        <Lead>A escova certa diminui a quebra, reduz o frizz e facilita o desembaraço. A errada faz o contrário: arranca fios e favorece pontas duplas.</Lead>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {BRUSHES.map((b, i) => (
            <div key={i} style={{ background: T.cream, borderRadius: 12, padding: '12px 13px', border: `1px solid ${T.borderSoft}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, flexWrap: 'wrap' }}>
                {b.tag && <span style={{ fontSize: 10, fontWeight: 800, color: T.pinkDeep, background: T.pinkSoft, borderRadius: 6, padding: '2px 6px' }}>{b.tag}</span>}
                <strong style={{ fontSize: 13.5, color: T.ink }}>{b.nome}</strong>
              </div>
              <div style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.5, marginBottom: 6 }}>{b.desc}</div>
              <ul style={{ margin: '0 0 8px', paddingLeft: 15, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {b.itens.map((it, j) => <li key={j} style={{ fontSize: 12, color: T.inkSoft }}>{it}</li>)}
              </ul>
              <a href={mlSearch(b.buscar)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 700, color: T.pinkDeep, textDecoration: 'none' }}>Buscar no Mercado Livre →</a>
            </div>
          ))}
        </div>
        <Callout kicker="Escovas que eu evitaria">Escovas com bolinhas nas pontas <strong>quando essas bolinhas começam a soltar</strong> — o plástico exposto vira um "gancho" que aumenta o atrito e a quebra. Lave a sua pelo menos 1x por semana com água morna e shampoo neutro.</Callout>
      </Section>

      {/* Alimentação */}
      <Section emoji="🥑" title="Alimentação que fortalece">
        <Lead>O cabelo é formado principalmente por proteína. Se faltam nutrientes, ele sente — e nenhum produto tópico compensa isso sozinho.</Lead>
        <div style={{ background: T.cream, borderRadius: 12, padding: '12px 13px', border: `1px solid ${T.borderSoft}` }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.ink, marginBottom: 7 }}>Inclua na rotina</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <ul style={{ margin: 0, paddingLeft: 15, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {['Carnes magras e ovos', 'Peixes', 'Espinafre e brócolis', 'Castanhas'].map((it, j) => <li key={j} style={{ fontSize: 12, color: T.inkSoft }}>{it}</li>)}
            </ul>
            <ul style={{ margin: 0, paddingLeft: 15, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {['Abacate', 'Morango e laranja', 'Feijão'].map((it, j) => <li key={j} style={{ fontSize: 12, color: T.inkSoft }}>{it}</li>)}
            </ul>
          </div>
          <div style={{ fontSize: 11.5, color: T.inkMuted, lineHeight: 1.5, marginTop: 8 }}>Proteínas, ferro, zinco, vitamina C, complexo B e gorduras boas — nutrientes pra formação e fortalecimento dos fios.</div>
        </div>
        <div style={{ marginTop: 10 }}>
          <TwoCol cards={[
            { title: 'Água', items: ['Fios desidratados começam dentro do corpo.', 'Beba água ao longo do dia.'] },
            { title: 'Vitaminas que ajudam', items: ['Ferro, vitamina D, zinco', 'Biotina, complexo B, ômega 3'] },
          ]} />
        </div>
        <div style={{ fontSize: 11, color: T.inkMuted, lineHeight: 1.5, marginTop: 10 }}>A suplementação pode ajudar quando existe deficiência nutricional, mas deve ser orientada por um profissional de saúde. Este material é educativo e não substitui avaliação individual.</div>
      </Section>
    </div>
  );
}
